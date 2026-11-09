import { XMLParser, XMLValidator } from "fast-xml-parser";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { draftContentSchema, questionSchema } from "@/lib/question-bank";
import { parseXmlQuestionBank } from "@/services/question-parser";

const MAX_XML_SIZE = 20 * 1024 * 1024;
const MAX_IMAGE_SIZE = 2 * 1024 * 1024;
const managedPath = /^(?:\/api\/question-banks\/media\/[a-z0-9-]+|\/uploads\/exams\/[a-z0-9-]+\/[a-z0-9._-]+)$/i;
const attachmentSchema = z.object({ type: z.enum(["image/png", "image/jpeg", "image/webp"]), data: z.string().min(1).max(3 * 1024 * 1024) });
const archiveSchema = z.object({ title: z.string().trim().min(1).max(200), description: z.string().max(500).nullable().optional(), questions: z.array(z.unknown()).min(1).max(200), media: z.record(attachmentSchema).default({}), warnings: z.array(z.string().max(300)).max(10).default([]) });
export type BankXml = z.infer<typeof archiveSchema>;

function imageMatches(bytes: Buffer, type: string): boolean {
  if (!bytes.length || bytes.length > MAX_IMAGE_SIZE) return false;
  if (type === "image/png") return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (type === "image/jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  return bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
}
export function decodeAttachment(type: string, data: string): Buffer {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(data) || data.length % 4 !== 0) throw new AppError("INVALID_IMAGE", "Data gambar dalam XML tidak valid", 400);
  const bytes = Buffer.from(data, "base64");
  if (!imageMatches(bytes, type)) throw new AppError("INVALID_IMAGE", "Gambar dalam XML harus berupa PNG, JPEG, atau WebP maksimal 2 MB", 400);
  return bytes;
}
function mappedQuestions(archive: BankXml, media: Record<string, string>) {
  return archive.questions.map((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new AppError("VALIDATION_ERROR", "Data soal dalam XML tidak valid", 400);
    const question = value as Record<string, unknown>;
    const mapImage = (image: unknown) => {
      if (!image) return null;
      if (typeof image !== "string") throw new AppError("VALIDATION_ERROR", "Alamat gambar dalam XML tidak valid", 400);
      if (managedPath.test(image) && !media[image]) throw new AppError("VALIDATION_ERROR", "Gambar yang dikelola EduQuas tidak tersedia dalam XML", 400);
      return media[image] || image;
    };
    if (!Array.isArray(question.options)) throw new AppError("VALIDATION_ERROR", "Pilihan soal dalam XML tidak valid", 400);
    return { ...question, sourceQuestionId: undefined, imageUrl: mapImage(question.imageUrl), options: question.options.map(value => {
      if (!value || typeof value !== "object" || Array.isArray(value)) throw new AppError("VALIDATION_ERROR", "Pilihan soal dalam XML tidak valid", 400);
      const option = value as Record<string, unknown>;
      return { ...option, imageUrl: mapImage(option.imageUrl) };
    }) };
  });
}
export function validateBankXml(xml: Buffer): BankXml {
  if (!xml.length || xml.length > MAX_XML_SIZE) throw new AppError("INVALID_XML", "Ukuran XML maksimal 20 MB", 400);
  const text = xml.toString("utf8");
  if (/<!DOCTYPE|<!ENTITY/i.test(text) || XMLValidator.validate(text) !== true) throw new AppError("INVALID_XML", "Format XML tidak valid atau mengandung deklarasi entitas", 400);
  const document = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", processEntities: false }).parse(text);
  let raw: unknown;
  if (document.exam) {
    const old = parseXmlQuestionBank(text);
    let omittedImages = false;
    const image = (url: string | null | undefined) => {
      if (url && managedPath.test(url)) { omittedImages = true; return null; }
      return url || null;
    };
    const questions = old.questions.map(question => ({ ...question, imageUrl: image(question.imageUrl), type: "single_choice", options: question.options.map(option => ({ ...option, id: option.label, imageUrl: image(option.imageUrl) })) }));
    raw = { title: old.examTitle || "Bank soal impor", questions, media: {}, warnings: omittedImages ? ["Gambar lokal pada XML lama tidak disertakan. Unggah ulang gambar sebelum memakai bank soal."] : [] };
  } else {
    const root = document["eduquas-bank"];
    if (!root || String(root["@_version"]) !== "1" || root.payload?.["@_encoding"] !== "base64-json") throw new AppError("INVALID_XML", "Versi XML EduQuas tidak didukung", 400);
    const encoded = String(root.payload["#text"] || "");
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded) || encoded.length % 4 !== 0) throw new AppError("INVALID_XML", "Isi XML tidak valid", 400);
    try { raw = JSON.parse(Buffer.from(encoded, "base64").toString("utf8")); }
    catch { throw new AppError("INVALID_XML", "Isi XML tidak valid", 400); }
  }
  const archive = archiveSchema.parse(raw);
  const placeholder: Record<string, string> = Object.create(null);
  for (const [url, attachment] of Object.entries(archive.media)) {
    if (!managedPath.test(url)) throw new AppError("INVALID_XML", "Alamat media dalam XML tidak didukung", 400);
    decodeAttachment(attachment.type, attachment.data);
    placeholder[url] = "/api/question-banks/media/00000000-0000-4000-8000-000000000000";
  }
  const questions = z.array(questionSchema).min(1).max(200).parse(mappedQuestions(archive, placeholder));
  draftContentSchema.parse({ questions });
  return archive;
}
export function materializeBankXml(archive: BankXml, media: Record<string, string>) {
  return z.array(questionSchema).min(1).max(200).parse(mappedQuestions(archive, media));
}
export function makeBankXml(archive: BankXml): Buffer {
  const payload = Buffer.from(JSON.stringify(archive), "utf8").toString("base64");
  const xml = Buffer.from(`<?xml version="1.0" encoding="UTF-8"?><eduquas-bank version="1"><payload encoding="base64-json">${payload}</payload></eduquas-bank>`, "utf8");
  if (xml.length > MAX_XML_SIZE) throw new AppError("XML_TOO_LARGE", "Bank terlalu besar untuk satu XML; batas ekspor adalah 20 MB", 400);
  return xml;
}
