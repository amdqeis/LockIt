import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { calculateScore, calculateQuestionScore } from "./score-calculation";
import { parseStudentAssignment, applyAssignmentToQuestions } from "@/lib/student-assignment";

type ReviewStudent = {
  id: string;
  name: string;
  nisn: string;
  status: string;
  assignedQuestions?: unknown;
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
  let assignedQuestionsRaw = student.assignedQuestions;
  if (assignedQuestionsRaw === undefined) {
    const s = await prisma.student.findUnique({
      where: { id: student.id },
      select: { assignedQuestions: true },
    });
    assignedQuestionsRaw = s?.assignedQuestions ?? null;
  }
  const assignment = parseStudentAssignment(assignedQuestionsRaw);

  const [rawQuestions, answers] = await Promise.all([
    prisma.question.findMany({
      where: { examId: student.exam.id },
      orderBy: { orderIndex: "asc" },
      select: {
        id: true,
        orderIndex: true,
        type: true,
        questionText: true,
        content: true,
        imageUrl: true,
        imageAlt: true,
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

  const questions = applyAssignmentToQuestions(rawQuestions, assignment);
  const answersByQuestion = new Map(answers.map((answer) => [answer.questionId, answer]));
  const formattedQuestions = questions.map((question) => {
    const answer = answersByQuestion.get(question.id);
    const qScore = showScoreToStudent ? calculateQuestionScore(question, answer) : null;
    return {
      id: question.id,
      orderIndex: question.orderIndex,
      type: question.type,
      questionText: question.questionText,
      content: question.content,
      imageUrl: question.imageUrl,
      imageAlt: question.imageAlt,
      options: question.options,
      points: question.points,
      studentAnswer: answer?.selectedOption ?? null,
      ...(showScoreToStudent ? {
        correctAnswer: (question as typeof question & { correctAnswer?: string }).correctAnswer ?? "",
        earnedPoints: qScore ? qScore.earnedPoints : 0,
        isPartiallyCorrect: qScore ? qScore.isPartiallyCorrect : false,
        isCorrect: question.type === "short_answer" ? (answer?.isCorrect ?? null) : (qScore ? qScore.isFullCorrect : false),
      } : {}),
    };
  });

  let summary: { score: number; earnedPoints: number; totalPoints: number; correctCount: number; pendingManualCount: number } | null = null;
  if (showScoreToStudent) {
    const { finalScore, ...score } = calculateScore(questions, answers.map(answer => ({ ...answer, isCorrect: answer.isCorrect ?? null })));
    summary = {
      score: finalScore,
      ...score,
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
