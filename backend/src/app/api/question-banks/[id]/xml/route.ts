import { readFile } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { bankError, bankTeacher } from "@/lib/question-bank";
import { questionBankMediaDirectory } from "@/lib/question-bank-media";
import { decodeAttachment, makeBankXml, type BankXml } from "@/lib/question-bank-xml";
import { AppError } from "@/lib/errors";
import { errorResponse } from "@/lib/response";

type Context = { params: Promise<{ id: string }> };
export async function GET(req: NextRequest, { params }: Context) {
  try {
    await bankTeacher(req);
    const { id } = await params;
    const bank = await prisma.questionBank.findUnique({ where: { id }, include: { questions: { orderBy: { orderIndex: "asc" } } } });
    if (!bank) return errorResponse("NOT_FOUND", "Bank soal tidak ditemukan", 404);
    if (!bank.questions.length) return errorResponse("INVALID_XML", "Bank soal belum memiliki soal untuk diekspor", 400);
    const questions = bank.questions.map(q => ({ type: q.type, questionText: q.questionText, content: q.content, imageUrl: q.imageUrl, imageAlt: q.imageAlt, options: q.options, correctAnswer: q.correctAnswer, correctAnswers: q.correctAnswers, points: q.points, hint: q.hint, hintContent: q.hintContent }));
    const urls = new Set<string>();
    for (const q of questions) {
      if (q.imageUrl) urls.add(q.imageUrl);
      if (Array.isArray(q.options)) for (const option of q.options) if (option && typeof option === "object" && !Array.isArray(option) && typeof option.imageUrl === "string") urls.add(option.imageUrl);
    }
    const media: BankXml["media"] = Object.create(null);
    let externalCount = 0;
    for (const url of urls) {
      if (/^https?:\/\//i.test(url)) { externalCount++; continue; }
      let bytes: Buffer; let mime: "image/png" | "image/jpeg" | "image/webp";
      const managed = url.match(/^\/api\/question-banks\/media\/([a-z0-9-]+)$/i);
      if (managed) {
        const stored = await prisma.questionBankMedia.findUnique({ where: { id: managed[1] } });
        if (!stored || !["image/png", "image/jpeg", "image/webp"].includes(stored.mimeType) || path.basename(stored.filename) !== stored.filename) throw new AppError("MEDIA_NOT_FOUND", "Gambar bank tidak dapat diekspor", 404);
        mime = stored.mimeType as typeof mime;
        bytes = await readFile(path.join(questionBankMediaDirectory(), stored.filename));
      } else {
        const old = url.match(/^\/uploads\/exams\/([a-z0-9-]+)\/([a-z0-9_-]+\.(png|jpe?g|webp))$/i);
        if (!old) throw new AppError("INVALID_IMAGE", "Alamat gambar bank tidak didukung", 400);
        const ext = old[3].toLowerCase(); mime = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
        bytes = await readFile(path.join(process.cwd(), "public", "uploads", "exams", old[1], old[2]));
      }
      const data = bytes.toString("base64"); decodeAttachment(mime, data);
      media[url] = { type: mime, data };
    }
    const xml = makeBankXml({ title: bank.title, description: bank.description, questions, media, warnings: [] });
    return new NextResponse(xml as unknown as BodyInit, { headers: { "Content-Type": "application/xml; charset=utf-8", "Content-Disposition": `attachment; filename="bank-${bank.id}.xml"`, "Cache-Control": "private, no-store", "X-Eduquas-External-Media": String(externalCount) } });
  } catch (err) { return bankError(err); }
}
