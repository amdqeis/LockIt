import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { authenticateStudent } from "@/lib/middleware/auth";
import { findBrowserIdentity } from "@/lib/browser-identity";
import { bankError, bankTeacher } from "@/lib/question-bank";
import { errorResponse } from "@/lib/response";
import { questionBankMediaDirectory } from "@/lib/question-bank-media";

export async function GET(req: NextRequest, { params }: { params: Promise<{ mediaId: string }> }) {
  try {
    const { mediaId } = await params;
    const media = await prisma.questionBankMedia.findUnique({ where: { id: mediaId } });
    if (!media) return errorResponse("NOT_FOUND", "Gambar tidak ditemukan", 404);
    try { await bankTeacher(req); }
    catch {
      const examIds = new Set<string>();
      try {
        const { student } = await authenticateStudent(req, { skipSubmittedCheck: true });
        const settings = student.exam.settings && typeof student.exam.settings === "object" ? student.exam.settings as Record<string, unknown> : {};
        const canReview = student.status === "submitted" && settings.allow_answer_review === true;
        const canWork = ["active", "disconnected"].includes(student.status) && student.exam.status === "active" && !student.isLocked;
        if (canReview || canWork) examIds.add(student.examId);
      } catch { /* Riwayat browser dapat tersedia tanpa sesi ujian aktif. */ }
      const browser = await findBrowserIdentity(req);
      if (browser) {
        const links = await prisma.browserStudent.findMany({ where: { browserId: browser.id, student: { status: "submitted" } }, include: { student: { include: { exam: true } } } });
        for (const { student } of links) {
          const settings = student.exam.settings && typeof student.exam.settings === "object" ? student.exam.settings as Record<string, unknown> : {};
          if (settings.allow_answer_review === true) examIds.add(student.examId);
        }
      }
      if (!examIds.size) return errorResponse("NOT_FOUND", "Gambar tidak ditemukan", 404);
      const imageUrl = `/api/question-banks/media/${mediaId}`;
      const questions = await prisma.question.findMany({ where: { examId: { in: [...examIds] } }, select: { imageUrl: true, options: true } });
      const allowed = questions.some(q => q.imageUrl === imageUrl || (Array.isArray(q.options) && q.options.some(o => typeof o === "object" && o !== null && !Array.isArray(o) && o.imageUrl === imageUrl)));
      if (!allowed) return errorResponse("NOT_FOUND", "Gambar tidak ditemukan", 404);
    }
    const bytes = await readFile(path.join(questionBankMediaDirectory(), media.filename));
    return new NextResponse(bytes, { headers: { "Content-Type": media.mimeType, "Content-Length": String(bytes.length), "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (err) { return bankError(err); }
}
