import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { bankError, bankSchema, bankTeacher } from "@/lib/question-bank";
import { errorResponse, successResponse } from "@/lib/response";

type Context = { params: Promise<{ id: string }> };
export async function GET(req: NextRequest, { params }: Context) {
  try {
    await bankTeacher(req);
    const { id } = await params;
    const bank = await prisma.questionBank.findUnique({ where: { id }, include: { subjectFolder: { include: { gradeLevel: true } }, questions: { orderBy: { orderIndex: "asc" } }, drafts: { where: { committedAt: null }, orderBy: { updatedAt: "desc" } } } });
    return bank ? successResponse(bank) : errorResponse("NOT_FOUND", "Bank soal tidak ditemukan", 404);
  } catch (err) { return bankError(err); }
}
export async function PATCH(req: NextRequest, { params }: Context) {
  try {
    const teacher = await bankTeacher(req);
    const { id } = await params;
    const input = bankSchema.partial().extend({ revision: z.number().int().positive() }).parse(await req.json());
    const { revision, ...data } = input;
    if (data.subjectId) {
      const current = await prisma.questionBank.findUnique({
        where: { id },
        include: { subjectFolder: true },
      });
      if (!current) return errorResponse("NOT_FOUND", "Bank soal tidak ditemukan", 404);

      const folder = await prisma.subject.findUnique({ where: { id: data.subjectId }, include: { gradeLevel: true } });
      if (!folder) return errorResponse("NOT_FOUND", "Mata pelajaran tidak ditemukan", 404);
      if (!folder.gradeLevelId || folder.isArchived || folder.gradeLevel?.isArchived) return errorResponse("VALIDATION_ERROR", "Pilih mata pelajaran dan tingkat yang aktif.", 400);

      if (current.subjectFolder?.gradeLevelId && folder.gradeLevelId && current.subjectFolder.gradeLevelId !== folder.gradeLevelId) {
        return errorResponse("VALIDATION_ERROR", "Pemindahan bank antar-mapel dibatasi dalam tingkat yang sama.", 400);
      }
      data.subject = folder.name;
    }
    const changed = await prisma.questionBank.updateMany({ where: { id, revision }, data: { ...data, updatedBy: teacher.teacherId, revision: { increment: 1 } } });
    if (!changed.count) return errorResponse("CONFLICT", "Bank telah berubah atau tidak ditemukan. Muat ulang sebelum menyimpan.", 409);
    return successResponse(await prisma.questionBank.findUnique({ where: { id } }));
  } catch (err) { return bankError(err); }
}
export async function DELETE(req: NextRequest, { params }: Context) {
  try {
    await bankTeacher(req);
    const { id } = await params;
    const { revision } = z.object({ revision: z.number().int().positive() }).parse(await req.json());
    const removed = await prisma.questionBank.deleteMany({ where: { id, revision } });
    if (!removed.count) return errorResponse("CONFLICT", "Bank telah berubah atau tidak ditemukan. Muat ulang sebelum menghapus.", 409);
    return successResponse({ deleted: true });
  } catch (err) { return bankError(err); }
}
