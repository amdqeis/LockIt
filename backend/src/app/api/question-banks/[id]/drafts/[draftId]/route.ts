import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { bankError, bankTeacher, draftContentSchema } from "@/lib/question-bank";
import { errorResponse, successResponse } from "@/lib/response";

type Context = { params: Promise<{ id: string; draftId: string }> };
export async function GET(req: NextRequest, { params }: Context) {
  try {
    await bankTeacher(req);
    const { id, draftId } = await params;
    const draft = await prisma.questionBankDraft.findFirst({ where: { id: draftId, bankId: id } });
    return draft ? successResponse(draft) : errorResponse("NOT_FOUND", "Draf tidak ditemukan", 404);
  } catch (err) { return bankError(err); }
}
export async function PUT(req: NextRequest, { params }: Context) {
  try {
    const teacher = await bankTeacher(req);
    const { id, draftId } = await params;
    const input = z.object({ revision: z.number().int().positive(), content: draftContentSchema }).parse(await req.json());
    const changed = await prisma.questionBankDraft.updateMany({ where: { id: draftId, bankId: id, revision: input.revision, committedAt: null }, data: { content: input.content as Prisma.InputJsonValue, revision: { increment: 1 }, updatedBy: teacher.teacherId } });
    if (!changed.count) return errorResponse("CONFLICT", "Draf telah berubah atau sudah disimpan. Muat ulang sebelum melanjutkan.", 409);
    return successResponse(await prisma.questionBankDraft.findUnique({ where: { id: draftId } }));
  } catch (err) { return bankError(err); }
}

export async function DELETE(req: NextRequest, { params }: Context) {
  try {
    const teacher = await bankTeacher(req);
    const { id, draftId } = await params;
    const { revision } = z.object({ revision: z.number().int().positive() }).parse(await req.json());
    const removed = await prisma.questionBankDraft.deleteMany({ where: { id: draftId, bankId: id, createdBy: teacher.teacherId, revision, committedAt: null } });
    if (!removed.count) return errorResponse("CONFLICT", "Draf telah berubah atau tidak dapat dihapus.", 409);
    return successResponse({ deleted: true });
  } catch (err) { return bankError(err); }
}
