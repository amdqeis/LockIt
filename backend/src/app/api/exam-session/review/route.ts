import { NextRequest } from "next/server";
import { authenticateStudent } from "@/lib/middleware/auth";
import { prisma } from "@/lib/prisma";
import { successResponse, errorResponse, safeErrorMessage } from "@/lib/response";
import { AppError } from "@/lib/errors";

export async function GET(req: NextRequest) {
  try {
    const { student } = await authenticateStudent(req, { skipSubmittedCheck: true });
    const exam = student.exam;

    // Siswa harus berstatus submitted untuk mengakses halaman review
    if (student.status !== "submitted") {
      return errorResponse(
        "EXAM_NOT_SUBMITTED",
        "Review jawaban hanya dapat diakses setelah ujian selesai dikumpulkan",
        400
      );
    }

    const examSettings = (typeof exam.settings === "object" && exam.settings !== null ? exam.settings : {}) as any;
    const allowAnswerReview = examSettings.allow_answer_review === true;

    if (!allowAnswerReview) {
      return errorResponse(
        "FORBIDDEN",
        "Pengawas tidak mengizinkan review jawaban untuk ujian ini",
        403
      );
    }

    const showScoreToStudent = examSettings.show_score_to_student !== false;

    // Ambil daftar soal dan jawaban siswa secara paralel
    const [questions, answers] = await Promise.all([
      prisma.question.findMany({
        where: { examId: exam.id },
        orderBy: { orderIndex: "asc" },
        select: {
          id: true,
          orderIndex: true,
          type: true,
          questionText: true,
          imageUrl: true,
          options: true,
          points: true,
          correctAnswer: showScoreToStudent, // Strictly omitted jika guru menyembunyikan nilai
        },
      }),
      prisma.answer.findMany({
        where: { studentId: student.id },
        select: {
          questionId: true,
          selectedOption: true,
          isCorrect: showScoreToStudent, // Strictly omitted jika guru menyembunyikan nilai
        },
      }),
    ]);

    const answersMap = new Map(answers.map((a) => [a.questionId, a]));

    const formattedQuestions = questions.map((q) => {
      const ans = answersMap.get(q.id);
      return {
        id: q.id,
        orderIndex: q.orderIndex,
        type: q.type,
        questionText: q.questionText,
        imageUrl: q.imageUrl,
        options: q.options,
        points: q.points,
        studentAnswer: ans?.selectedOption ?? null,
        ...(showScoreToStudent
          ? {
              correctAnswer: (q as any).correctAnswer ?? "",
              isCorrect: q.type === "short_answer" ? (ans?.isCorrect ?? null) : (ans?.isCorrect ?? false),
            }
          : {}),
      };
    });

    let scoreSummary = null;
    if (showScoreToStudent) {
      let earnedPoints = 0;
      let totalPoints = 0;
      let correctCount = 0;

      for (const q of questions) {
        if (q.type === "short_answer") continue;
        totalPoints += q.points;
        const ans = answersMap.get(q.id);
        if (ans?.isCorrect) {
          earnedPoints += q.points;
          correctCount++;
        }
      }

      const score = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
      scoreSummary = {
        score,
        earnedPoints,
        totalPoints,
        correctCount,
      };
    }

    return successResponse({
      exam: {
        id: exam.id,
        title: exam.title,
        durationMinutes: exam.durationMinutes,
        totalQuestions: questions.length,
      },
      student: {
        id: student.id,
        name: student.name,
        nisn: student.nisn,
      },
      showScoreToStudent,
      summary: scoreSummary,
      questions: formattedQuestions,
    });
  } catch (err: any) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    return errorResponse("INTERNAL_SERVER_ERROR", safeErrorMessage(err, "Gagal mengambil data review ujian"), 500);
  }
}

