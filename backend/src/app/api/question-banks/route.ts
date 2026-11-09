import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { bankError, bankSchema, bankTeacher } from "@/lib/question-bank";
import { errorResponse, successResponse } from "@/lib/response";
import { z } from "zod";

export async function GET(req: NextRequest) {
  try {
    await bankTeacher(req);
    if (req.nextUrl.searchParams.has("limit")) {
      const rawLimit = req.nextUrl.searchParams.get("limit") || "";
      const limit = Number(rawLimit);
      const cursor = req.nextUrl.searchParams.get("cursor");
      const folder = req.nextUrl.searchParams.get("subjectId");
      if (!/^\d+$/.test(rawLimit) || !Number.isInteger(limit) || limit < 1 || limit > 50 || (cursor !== null && (!cursor || cursor.length > 128))) return errorResponse("VALIDATION_ERROR", "Parameter halaman bank soal tidak valid", 400);
      if (folder !== null && folder !== "unassigned" && !z.string().uuid().safeParse(folder).success) return errorResponse("VALIDATION_ERROR", "Mata pelajaran tidak valid", 400);
      const where = folder === null ? {} : { subjectId: folder === "unassigned" ? null : folder };
      if (cursor) {
        const anchor = await prisma.questionBank.findUnique({ where: { id: cursor }, select: { id: true, subjectId: true } });
        if (!anchor || (folder !== null && anchor.subjectId !== (folder === "unassigned" ? null : folder))) return errorResponse("INVALID_CURSOR", "Halaman bank soal tidak ditemukan", 400);
      }
      const banks = await prisma.questionBank.findMany({ where, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], take: limit + 1, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}), select: { id: true, title: true, subject: true, subjectId: true, revision: true, _count: { select: { questions: true } } } });
      const items = banks.slice(0, limit);
      return successResponse({ items, nextCursor: banks.length > limit ? items[items.length - 1]?.id ?? null : null }, 200, { "Cache-Control": "private, no-store" });
    }
    const banks = await prisma.questionBank.findMany({ orderBy: { updatedAt: "desc" }, include: { _count: { select: { questions: true } }, questions: { select: { points: true } } } });
    return successResponse(banks);
  } catch (err) { return bankError(err); }
}
export async function POST(req: NextRequest) {
  try {
    const teacher = await bankTeacher(req);
    const input = bankSchema.parse(await req.json());
    const folder = input.subjectId ? await prisma.subject.findUnique({ where: { id: input.subjectId } }) : null;
    if (input.subjectId && !folder) return errorResponse("NOT_FOUND", "Mata pelajaran tidak ditemukan", 404);
    const bank = await prisma.questionBank.create({ data: { ...input, subject: folder?.name ?? input.subject, createdBy: teacher.teacherId, updatedBy: teacher.teacherId } });
    return successResponse(bank, 201);
  } catch (err) { return bankError(err); }
}
