import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { bankError, bankSchema, bankTeacher } from "@/lib/question-bank";
import { successResponse } from "@/lib/response";

export async function GET(req: NextRequest) {
  try {
    await bankTeacher(req);
    const banks = await prisma.questionBank.findMany({ orderBy: { updatedAt: "desc" }, include: { _count: { select: { questions: true } }, questions: { select: { points: true } } } });
    return successResponse(banks);
  } catch (err) { return bankError(err); }
}
export async function POST(req: NextRequest) {
  try {
    const teacher = await bankTeacher(req);
    const input = bankSchema.parse(await req.json());
    const bank = await prisma.questionBank.create({ data: { ...input, createdBy: teacher.teacherId, updatedBy: teacher.teacherId } });
    return successResponse(bank, 201);
  } catch (err) { return bankError(err); }
}
