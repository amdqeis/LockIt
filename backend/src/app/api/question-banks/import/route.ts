import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { bankError, bankSchema, bankTeacher, draftContentSchema } from "@/lib/question-bank";
import { successResponse } from "@/lib/response";

export async function GET(req: NextRequest) {
  try {
    await bankTeacher(req);
    const importKey = z.string().regex(/^[a-f0-9]{64}$/).parse(req.nextUrl.searchParams.get("key"));
    const bank = await prisma.questionBank.findUnique({ where: { importKey }, include: { drafts: { where: { committedAt: null }, orderBy: { createdAt: "asc" }, take: 1 } } });
    return successResponse(bank ? { bankId: bank.id, draftId: bank.drafts[0]?.id || null, committed: !bank.drafts.length, alreadyImported: true } : null);
  } catch (err) { return bankError(err); }
}

export async function POST(req: NextRequest) {
  try {
    const teacher = await bankTeacher(req);
    const input = z.object({ importKey: z.string().regex(/^[a-f0-9]{64}$/), bank: bankSchema, content: draftContentSchema.optional(), contents: z.array(draftContentSchema).min(1).optional() }).refine(value => Boolean(value.content || value.contents), "Draf impor diperlukan").parse(await req.json());
    const contents = input.contents || (input.content ? [input.content] : []);
    const existing = async () => prisma.questionBank.findUnique({ where: { importKey: input.importKey }, include: { drafts: { where: { committedAt: null }, orderBy: { createdAt: "asc" }, take: 1 } } });
    const previous = await existing();
    if (previous) return successResponse({ bankId: previous.id, draftId: previous.drafts[0]?.id || null, committed: !previous.drafts.length, alreadyImported: true });
    try {
      const result = await prisma.$transaction(async tx => {
        const bank = await tx.questionBank.create({ data: { ...input.bank, importKey: input.importKey, createdBy: teacher.teacherId, updatedBy: teacher.teacherId } });
        let draftId: string | null = null;
        for (const content of contents) {
          const draft = await tx.questionBankDraft.create({ data: { bankId: bank.id, createdBy: teacher.teacherId, updatedBy: teacher.teacherId, content: content as Prisma.InputJsonValue } });
          draftId ||= draft.id;
        }
        return { bankId: bank.id, draftId, alreadyImported: false };
      });
      return successResponse(result, 201);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        const current = await existing();
        if (current) return successResponse({ bankId: current.id, draftId: current.drafts[0]?.id || null, committed: !current.drafts.length, alreadyImported: true });
      }
      throw err;
    }
  } catch (err) { return bankError(err); }
}
