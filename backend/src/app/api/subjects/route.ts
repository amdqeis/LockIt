import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { bankError, bankTeacher } from "@/lib/question-bank";
import { successResponse } from "@/lib/response";

export async function GET(req: NextRequest) {
  try {
    await bankTeacher(req);
    return successResponse(await prisma.subject.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { banks: true } } } }));
  } catch (err) { return bankError(err); }
}
export async function POST(req: NextRequest) {
  try {
    await bankTeacher(req);
    const { name } = z.object({ name: z.string().trim().min(1).max(100) }).parse(await req.json());
    const existing = await prisma.subject.findFirst({ where: { name: { equals: name, mode: "insensitive" } } });
    if (existing) return successResponse(existing);
    return successResponse(await prisma.subject.create({ data: { name } }), 201);
  } catch (err) { return bankError(err); }
}
