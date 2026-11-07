import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { bankError, bankTeacher, draftContentSchema } from "@/lib/question-bank";
import { errorResponse, successResponse } from "@/lib/response";

type Context = { params: Promise<{ id: string }> };
export async function POST(req: NextRequest, { params }: Context) {
  try {
    const teacher = await bankTeacher(req);
    const { id } = await params;
    if (!await prisma.questionBank.findUnique({ where: { id }, select: { id: true } })) return errorResponse("NOT_FOUND", "Bank soal tidak ditemukan", 404);
    const content = draftContentSchema.parse(await req.json());
    const draft = await prisma.questionBankDraft.create({ data: { bankId: id, createdBy: teacher.teacherId, updatedBy: teacher.teacherId, content: content as Prisma.InputJsonValue } });
    return successResponse(draft, 201);
  } catch (err) { return bankError(err); }
}
