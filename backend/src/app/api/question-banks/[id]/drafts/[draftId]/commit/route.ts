import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { bankError, bankTeacher, questionSchema } from "@/lib/question-bank";
import { AppError } from "@/lib/errors";
import { successResponse } from "@/lib/response";

type Context = { params: Promise<{ id: string; draftId: string }> };
export async function POST(req: NextRequest, { params }: Context) {
  try {
    const teacher = await bankTeacher(req);
    const { id, draftId } = await params;
    const { revision } = z.object({ revision: z.number().int().positive() }).parse(await req.json());
    const result = await prisma.$transaction(async tx => {
      const draft = await tx.questionBankDraft.findFirst({ where: { id: draftId, bankId: id } });
      if (!draft) throw new AppError("NOT_FOUND", "Draf tidak ditemukan", 404);
      if (draft.committedAt) return { alreadyCommitted: true };
      if (draft.revision !== revision) throw new AppError("CONFLICT", "Draf telah berubah. Muat ulang sebelum menyimpan.", 409);
      const content = z.object({ questions: z.array(questionSchema).min(1).max(200), bankRevision: z.number().int().positive().optional() }).parse(draft.content);
      const existingIds = content.questions.flatMap(q => q.sourceQuestionId ? [q.sourceQuestionId] : []);
      if (new Set(existingIds).size !== existingIds.length) throw new AppError("VALIDATION_ERROR", "Soal yang sama tidak dapat disunting dua kali dalam satu draf.", 400);
      if (existingIds.length && !content.bankRevision) throw new AppError("CONFLICT", "Versi bank untuk penyuntingan tidak tersedia.", 409);
      const claimed = await tx.questionBankDraft.updateMany({ where: { id: draftId, bankId: id, revision, committedAt: null }, data: { committedAt: new Date(), updatedBy: teacher.teacherId, revision: { increment: 1 } } });
      if (!claimed.count) throw new AppError("CONFLICT", "Draf sedang disimpan dari tempat lain.", 409);
      const lockedBank = await tx.questionBank.updateMany({ where: { id, ...(existingIds.length ? { revision: content.bankRevision } : {}) }, data: { revision: { increment: 1 }, updatedBy: teacher.teacherId } });
      if (!lockedBank.count) throw new AppError("CONFLICT", "Bank soal telah berubah. Simpan pekerjaan sebagai salinan atau muat versi terbaru.", 409);
      const last = await tx.bankQuestion.aggregate({ where: { bankId: id }, _max: { orderIndex: true } });
      let nextOrder = (last._max.orderIndex ?? -1) + 1;
      for (const q of content.questions) {
        const data = {
          type: q.type, questionText: q.questionText, content: q.content === undefined ? Prisma.JsonNull : q.content as Prisma.InputJsonValue,
          imageUrl: q.imageUrl || null, imageAlt: q.imageAlt || null, options: q.options as Prisma.InputJsonValue,
          correctAnswer: q.correctAnswer || null, correctAnswers: q.correctAnswers == null ? Prisma.JsonNull : q.correctAnswers as Prisma.InputJsonValue,
          points: q.points, hint: q.hint || null, hintContent: q.hintContent === undefined ? Prisma.JsonNull : q.hintContent as Prisma.InputJsonValue,
        };
        if (q.sourceQuestionId) {
          const changed = await tx.bankQuestion.updateMany({ where: { id: q.sourceQuestionId, bankId: id }, data });
          if (!changed.count) throw new AppError("CONFLICT", "Soal yang disunting sudah dihapus.", 409);
        } else await tx.bankQuestion.create({ data: { ...data, bankId: id, orderIndex: nextOrder++ } });
      }
      return { alreadyCommitted: false, count: content.questions.length };
    });
    return successResponse(result);
  } catch (err) { return bankError(err); }
}
