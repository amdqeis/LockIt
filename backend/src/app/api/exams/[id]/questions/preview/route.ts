import { NextRequest } from "next/server";
import { authenticateTeacher } from "@/lib/middleware/auth";
import { prisma } from "@/lib/prisma";
import { successResponse, errorResponse, safeErrorMessage } from "@/lib/response";
import { AppError } from "@/lib/errors";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const teacher = await authenticateTeacher(req);
    const { id } = await params;

    const [exam, questions] = await Promise.all([
      prisma.exam.findUnique({ where: { id } }),
      prisma.question.findMany({
        where: { examId: id },
        orderBy: { orderIndex: "asc" },
      }),
    ]);

    if (!exam) {
      return errorResponse("NOT_FOUND", "Ujian tidak ditemukan", 404);
    }

    const totalPoints = questions.reduce((sum, q) => sum + q.points, 0);

    return successResponse({
      exam: {
        id: exam.id,
        title: exam.title,
        durationMinutes: exam.durationMinutes,
        status: exam.status,
        accessCode: exam.accessCode,
        totalQuestions: questions.length,
        totalPoints,
      },
      questions: questions.map((q) => ({
        id: q.id,
        orderIndex: q.orderIndex,
        questionText: q.questionText,
        content: q.content,
        imageUrl: q.imageUrl,
        imageAlt: q.imageAlt,
        type: q.type,
        options: q.options,
        correctAnswer: q.correctAnswer,
        points: q.points,
      })),
    });
  } catch (err: any) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    return errorResponse("INTERNAL_SERVER_ERROR", safeErrorMessage(err, "Gagal memuat preview soal"), 500);
  }
}
