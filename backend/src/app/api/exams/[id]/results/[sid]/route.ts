import { NextRequest } from "next/server";
import { authenticateTeacher } from "@/lib/middleware/auth";
import { prisma } from "@/lib/prisma";
import { autoGradeStudent } from "@/services/grading";
import { successResponse, errorResponse, safeErrorMessage } from "@/lib/response";
import { AppError } from "@/lib/errors";
import { z } from "zod";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; sid: string }> }
) {
  try {
    const teacher = await authenticateTeacher(req);
    const { id, sid } = await params;

    const exam = await prisma.exam.findUnique({ where: { id } });
    if (!exam || (teacher.role !== "ADMIN" && exam.teacherId !== teacher.teacherId)) {
      return errorResponse("NOT_FOUND", "Ujian tidak ditemukan", 404);
    }

    const student = await prisma.student.findUnique({
      where: { id: sid },
      include: {
        answers: true,
      },
    });

    if (!student || student.examId !== id) {
      return errorResponse("NOT_FOUND", "Data peserta tidak ditemukan pada ujian ini", 404);
    }

    const summary = await autoGradeStudent(sid);

    const questions = await prisma.question.findMany({
      where: { examId: id },
      orderBy: { orderIndex: "asc" },
    });

    const answerMap = new Map(student.answers.map((a) => [a.questionId, a]));

    const detailedAnswers = questions.map((q) => {
      const ans = answerMap.get(q.id);
      return {
        questionId: q.id,
        orderIndex: q.orderIndex,
        questionText: q.questionText,
        content: q.content,
        imageUrl: q.imageUrl,
        imageAlt: q.imageAlt,
        type: q.type,
        options: q.options,
        correctAnswer: q.correctAnswer,
        points: q.points,
        selectedOption: ans?.selectedOption ?? null,
        isCorrect: q.type === "short_answer" ? (ans?.isCorrect ?? null) : (ans?.isCorrect ?? false),
        answeredAt: ans?.answeredAt ?? null,
      };
    });

    return successResponse({
      summary,
      answers: detailedAnswers,
    });
  } catch (err: any) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    return errorResponse("INTERNAL_SERVER_ERROR", safeErrorMessage(err, "Gagal mengambil rincian jawaban peserta"), 500);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; sid: string }> }) {
  try {
    const teacher = await authenticateTeacher(req);
    const { id, sid } = await params;
    const exam = await prisma.exam.findUnique({ where: { id }, select: { teacherId: true } });
    if (!exam || (teacher.role !== "ADMIN" && exam.teacherId !== teacher.teacherId)) return errorResponse("NOT_FOUND", "Ujian tidak ditemukan", 404);
    const parsed = z.object({ questionId: z.string().uuid(), isCorrect: z.boolean().nullable() }).safeParse(await req.json().catch(() => null));
    if (!parsed.success) return errorResponse("VALIDATION_ERROR", "Penilaian tidak valid", 400);
    const student = await prisma.student.findFirst({ where: { id: sid, examId: id, status: "submitted" }, select: { id: true } });
    if (!student) return errorResponse("INVALID_STATE", "Penilaian tersedia setelah peserta mengumpulkan ujian", 409);
    const question = await prisma.question.findFirst({ where: { id: parsed.data.questionId, examId: id, type: "short_answer" }, select: { id: true } });
    if (!question) return errorResponse("NOT_FOUND", "Soal jawaban singkat tidak ditemukan", 404);
    const updated = await prisma.answer.updateMany({ where: { studentId: sid, questionId: question.id, selectedOption: { not: null }, NOT: { selectedOption: "" } }, data: { isCorrect: parsed.data.isCorrect } });
    if (!updated.count) return errorResponse("NOT_FOUND", "Jawaban peserta tidak ditemukan", 404);
    return successResponse({ summary: await autoGradeStudent(sid) });
  } catch (err: unknown) {
    if (err instanceof AppError) return errorResponse(err.code, err.message, err.statusCode, err.details);
    return errorResponse("INTERNAL_SERVER_ERROR", safeErrorMessage(err, "Penilaian belum dapat disimpan"), 500);
  }
}
