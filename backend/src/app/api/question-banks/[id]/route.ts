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
    const bank = await prisma.questionBank.findUnique({ where: { id }, include: { questions: { orderBy: { orderIndex: "asc" } }, drafts: { where: { committedAt: null }, orderBy: { updatedAt: "desc" } } } });
    return bank ? successResponse(bank) : errorResponse("NOT_FOUND", "Bank soal tidak ditemukan", 404);
  } catch (err) { return bankError(err); }
}
export async function PATCH(req: NextRequest, { params }: Context) {
  try {
    const teacher = await bankTeacher(req);
    const { id } = await params;
    const input = bankSchema.partial().extend({ revision: z.number().int().positive() }).parse(await req.json());
    const { revision, ...data } = input;
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
