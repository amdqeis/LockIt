import { randomUUID, createHash } from "crypto";
import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { bankError, bankTeacher, draftContentSchema } from "@/lib/question-bank";
import { questionBankMediaDirectory } from "@/lib/question-bank-media";
import { decodeAttachment, materializeBankXml, validateBankXml } from "@/lib/question-bank-xml";
import { errorResponse, successResponse } from "@/lib/response";

export async function POST(req: NextRequest) {
  const written: string[] = [];
  try {
    const teacher = await bankTeacher(req);
    const length = Number(req.headers.get("content-length") || 0);
    if (length > 20 * 1024 * 1024 + 64 * 1024) return errorResponse("INVALID_XML", "Ukuran XML maksimal 20 MB", 413);
    const form = await req.formData();
    const file = form.get("file");
    const subjectId = z.string().uuid().parse(form.get("subjectId"));
    if (!(file instanceof File) || file.size > 20 * 1024 * 1024) return errorResponse("INVALID_XML", "Pilih XML berukuran maksimal 20 MB", 400);
    const subject = await prisma.subject.findUnique({ where: { id: subjectId } });
    if (!subject) return errorResponse("NOT_FOUND", "Mata pelajaran tidak ditemukan", 404);
    const bytes = Buffer.from(await file.arrayBuffer());
    const archive = validateBankXml(bytes);
    const importKey = createHash("sha256").update(subjectId).update(bytes).digest("hex");
    const findExisting = () => prisma.questionBank.findUnique({ where: { importKey }, include: { drafts: { where: { committedAt: null }, orderBy: { createdAt: "asc" }, take: 1 } } });
    const previous = await findExisting();
    if (previous) return successResponse({ bankId: previous.id, draftId: previous.drafts[0]?.id || null, draftOwnedByCaller: previous.drafts[0]?.createdBy === teacher.teacherId, alreadyImported: true });
    const dir = questionBankMediaDirectory();
    const mediaMap: Record<string, string> = Object.create(null);
    const uploads: { id: string; filename: string; mimeType: string; size: number; uploadedBy: string }[] = [];
    for (const [oldUrl, attachment] of Object.entries(archive.media)) {
      const content = decodeAttachment(attachment.type, attachment.data);
      const id = randomUUID();
      const ext = attachment.type === "image/png" ? "png" : attachment.type === "image/jpeg" ? "jpg" : "webp";
      const filename = `${randomUUID()}.${ext}`;
      await mkdir(dir, { recursive: true });
      const target = path.join(dir, filename);
      await writeFile(target, content, { flag: "wx" }); written.push(target);
      mediaMap[oldUrl] = `/api/question-banks/media/${id}`;
      uploads.push({ id, filename, mimeType: attachment.type, size: content.length, uploadedBy: teacher.teacherId });
    }
    const questions = materializeBankXml(archive, mediaMap);
    const content = draftContentSchema.parse({ questions });
    try {
      const result = await prisma.$transaction(async tx => {
        if (uploads.length) await tx.questionBankMedia.createMany({ data: uploads });
        const bank = await tx.questionBank.create({ data: { title: archive.title, subject: subject.name, subjectId, description: archive.description || null, importKey, createdBy: teacher.teacherId, updatedBy: teacher.teacherId } });
        const draft = await tx.questionBankDraft.create({ data: { bankId: bank.id, createdBy: teacher.teacherId, updatedBy: teacher.teacherId, content: content as Prisma.InputJsonValue } });
        return { bankId: bank.id, draftId: draft.id, draftOwnedByCaller: true, alreadyImported: false };
      });
      return successResponse(result, 201);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        const current = await findExisting();
        if (current) { await Promise.all(written.map(file => unlink(file).catch(() => {}))); written.length = 0; return successResponse({ bankId: current.id, draftId: current.drafts[0]?.id || null, draftOwnedByCaller: current.drafts[0]?.createdBy === teacher.teacherId, alreadyImported: true }); }
      }
      throw err;
    }
  } catch (err) {
    await Promise.all(written.map(file => unlink(file).catch(() => {})));
    return bankError(err);
  }
}
