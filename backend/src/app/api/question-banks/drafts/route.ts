import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { bankError, bankTeacher } from "@/lib/question-bank";
import { successResponse } from "@/lib/response";

export async function GET(req: NextRequest) {
  try {
    const teacher = await bankTeacher(req);
    const drafts = await prisma.questionBankDraft.findMany({
      where: { createdBy: teacher.teacherId, committedAt: null },
      orderBy: { updatedAt: "desc" }, take: 5,
      select: { id: true, bankId: true, updatedAt: true, bank: { select: { title: true } } },
    });
    return successResponse(drafts);
  } catch (err) { return bankError(err); }
}
