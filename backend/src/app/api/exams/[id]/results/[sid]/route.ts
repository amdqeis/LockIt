import { NextRequest } from "next/server";
import { authenticateTeacher } from "@/lib/middleware/auth";
import { prisma } from "@/lib/prisma";
import { autoGradeStudent } from "@/services/grading";
import { successResponse, errorResponse, safeErrorMessage } from "@/lib/response";
import { AppError } from "@/lib/errors";

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
        imageUrl: q.imageUrl,
        options: q.options,
        correctAnswer: q.correctAnswer,
        points: q.points,
        selectedOption: ans?.selectedOption ?? null,
        isCorrect: ans?.isCorrect ?? false,
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
