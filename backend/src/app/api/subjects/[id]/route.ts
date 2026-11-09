import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { bankError, bankTeacher } from "@/lib/question-bank";
import { errorResponse, successResponse } from "@/lib/response";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await bankTeacher(req);
    const { id } = await params;
    const subject = await prisma.subject.findUnique({ where: { id }, include: { _count: { select: { banks: true } } } });
    if (!subject) return errorResponse("NOT_FOUND", "Mata pelajaran tidak ditemukan", 404);
    if (subject._count.banks) return errorResponse("CONFLICT", "Pindahkan bank soal sebelum menghapus folder.", 409);
    await prisma.subject.delete({ where: { id } });
    return successResponse({ deleted: true });
  } catch (err) { return bankError(err); }
}
