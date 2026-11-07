import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";

type ReviewStudent = {
  id: string;
  name: string;
  nisn: string;
  status: string;
  exam: {
    id: string;
    title: string;
    durationMinutes: number;
    settings: unknown;
  };
};

export async function buildStudentReview(student: ReviewStudent) {
  if (student.status !== "submitted") {
    throw new AppError("EXAM_NOT_SUBMITTED", "Review jawaban hanya dapat diakses setelah ujian selesai dikumpulkan", 400);
  }

  const settings = student.exam.settings && typeof student.exam.settings === "object"
    ? student.exam.settings as Record<string, unknown>
    : {};
  if (settings.allow_answer_review !== true) {
    throw new AppError("FORBIDDEN", "Pengawas tidak mengizinkan review jawaban untuk ujian ini", 403);
  }

  const showScoreToStudent = settings.show_score_to_student !== false;
  const [questions, answers] = await Promise.all([
    prisma.question.findMany({
      where: { examId: student.exam.id },
      orderBy: { orderIndex: "asc" },
      select: {
        id: true,
        orderIndex: true,
        type: true,
        questionText: true,
        imageUrl: true,
        options: true,
        points: true,
        correctAnswer: showScoreToStudent,
      },
    }),
    prisma.answer.findMany({
      where: { studentId: student.id },
      select: {
        questionId: true,
        selectedOption: true,
        isCorrect: showScoreToStudent,
      },
    }),
  ]);

  const answersByQuestion = new Map(answers.map((answer) => [answer.questionId, answer]));
  const formattedQuestions = questions.map((question) => {
    const answer = answersByQuestion.get(question.id);
    return {
      id: question.id,
      orderIndex: question.orderIndex,
      type: question.type,
      questionText: question.questionText,
      imageUrl: question.imageUrl,
      options: question.options,
      points: question.points,
      studentAnswer: answer?.selectedOption ?? null,
      ...(showScoreToStudent ? {
        correctAnswer: (question as typeof question & { correctAnswer?: string }).correctAnswer ?? "",
        isCorrect: question.type === "short_answer" ? (answer?.isCorrect ?? null) : (answer?.isCorrect ?? false),
      } : {}),
    };
  });

  let summary: { score: number; earnedPoints: number; totalPoints: number; correctCount: number } | null = null;
  if (showScoreToStudent) {
    let earnedPoints = 0;
    let totalPoints = 0;
    let correctCount = 0;
    for (const question of questions) {
      if (question.type === "short_answer") continue;
      totalPoints += question.points;
      if (answersByQuestion.get(question.id)?.isCorrect) {
        earnedPoints += question.points;
        correctCount += 1;
      }
    }
    summary = {
      score: totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0,
      earnedPoints,
      totalPoints,
      correctCount,
    };
  }

  return {
    exam: {
      id: student.exam.id,
      title: student.exam.title,
      durationMinutes: student.exam.durationMinutes,
      totalQuestions: questions.length,
    },
    student: { id: student.id, name: student.name, nisn: student.nisn },
    showScoreToStudent,
    summary,
    questions: formattedQuestions,
  };
}
