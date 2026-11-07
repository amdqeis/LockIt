import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { bankError, bankTeacher, questionSchema } from "@/lib/question-bank";
import { AppError } from "@/lib/errors";
import { successResponse } from "@/lib/response";

type Context = { params: Promise<{ id: string; questionId: string }> };
export async function PUT(req: NextRequest, { params }: Context) {
  try {
    const teacher = await bankTeacher(req);
    const { id, questionId } = await params;
    const input = z.object({ revision: z.number().int().positive(), question: questionSchema }).parse(await req.json());
    const q = input.question;
    const result = await prisma.$transaction(async tx => {
      const updated = await tx.questionBank.updateMany({ where: { id, revision: input.revision }, data: { revision: { increment: 1 }, updatedBy: teacher.teacherId } });
      if (!updated.count) throw new AppError("CONFLICT", "Bank telah berubah. Muat ulang sebelum menyimpan.", 409);
      const changed = await tx.bankQuestion.updateMany({ where: { id: questionId, bankId: id }, data: {
        type: q.type, questionText: q.questionText, content: q.content === undefined ? Prisma.JsonNull : q.content as Prisma.InputJsonValue,
        imageUrl: q.imageUrl || null, imageAlt: q.imageAlt || null, options: q.options as Prisma.InputJsonValue,
        correctAnswer: q.correctAnswer || null, correctAnswers: q.correctAnswers == null ? Prisma.JsonNull : q.correctAnswers as Prisma.InputJsonValue,
        points: q.points, hint: q.hint || null, hintContent: q.hintContent === undefined ? Prisma.JsonNull : q.hintContent as Prisma.InputJsonValue,
      } });
      if (!changed.count) throw new AppError("NOT_FOUND", "Soal tidak ditemukan", 404);
      return tx.bankQuestion.findUnique({ where: { id: questionId } });
    });
    return successResponse(result);
  } catch (err) { return bankError(err); }
}
export async function DELETE(req: NextRequest, { params }: Context) {
  try {
    const teacher = await bankTeacher(req);
    const { id, questionId } = await params;
    const { revision } = z.object({ revision: z.number().int().positive() }).parse(await req.json());
    await prisma.$transaction(async tx => {
      const updated = await tx.questionBank.updateMany({ where: { id, revision }, data: { revision: { increment: 1 }, updatedBy: teacher.teacherId } });
      if (!updated.count) throw new AppError("CONFLICT", "Bank telah berubah. Muat ulang sebelum menghapus.", 409);
      const removed = await tx.bankQuestion.deleteMany({ where: { id: questionId, bankId: id } });
      if (!removed.count) throw new AppError("NOT_FOUND", "Soal tidak ditemukan", 404);
    });
    return successResponse({ deleted: true });
  } catch (err) { return bankError(err); }
}
