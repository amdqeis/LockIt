import { prisma } from "@/lib/prisma";
import { calculateScore, calculateQuestionScore } from "./score-calculation";

export interface StudentScoreSummary {
  studentId: string;
  name: string;
  nisn: string;
  status: string;
  totalPoints: number;
  earnedPoints: number;
  finalScore: number; // Scaled 0 - 100
  correctCount: number;
  pendingManualCount: number;
  totalQuestions: number;
  violationCount: number;
  submittedAt: Date | null;
}

export async function autoGradeStudent(studentId: string): Promise<StudentScoreSummary> {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      exam: {
        include: {
          questions: true,
        },
      },
      answers: true,
    },
  });

  if (!student) {
    throw new Error("Data mahasiswa tidak ditemukan");
  }

  const questions = student.exam.questions;
  const answerMap = new Map(student.answers.map((a) => [a.questionId, a]));

  const answerUpdates: { id: string; isCorrect: boolean }[] = [];

  for (const q of questions) {
    if (q.type === "short_answer") {
      // Soal jawaban singkat dinilai manual oleh guru; lewati evaluasi otomatis
      continue;
    }

    const answer = answerMap.get(q.id);

    if (answer && answer.selectedOption) {
      const qScore = calculateQuestionScore(q, answer);
      const isCorrect = qScore.isFullCorrect;
      // Collect answer updates if not yet evaluated or changed
      if (answer.isCorrect !== isCorrect) {
        answerUpdates.push({ id: answer.id, isCorrect });
      }
    } else {
      // If student never answered this question
      if (answer && answer.isCorrect !== false) {
        answerUpdates.push({ id: answer.id, isCorrect: false });
      }
    }
  }

  const updatesById = new Map(answerUpdates.map(update => [update.id, update.isCorrect]));
  const scoringAnswers = student.answers.map(answer => updatesById.has(answer.id) ? { ...answer, isCorrect: updatesById.get(answer.id)! } : answer);

  // Batch execute answer updates in parallel (eliminating N+1 query loop)
  if (answerUpdates.length > 0) {
    await Promise.all(
      answerUpdates.map(({ id, isCorrect }) =>
        prisma.answer.update({
          where: { id },
          data: { isCorrect },
        })
      )
    );
  }

  const score = calculateScore(questions, scoringAnswers);

  return {
    studentId: student.id,
    name: student.name,
    nisn: student.nisn,
    status: student.status,
    ...score,
    totalQuestions: questions.length,
    violationCount: student.violationCount,
    submittedAt: student.submittedAt,
  };
}

export async function autoGradeExam(examId: string): Promise<StudentScoreSummary[]> {
  // CRIT-04: Batch fetch semua data dalam 2 query, bukan N+1 loop per student
  const [allStudents, allQuestions] = await Promise.all([
    prisma.student.findMany({
      where: { examId },
      include: { answers: true },
    }),
    prisma.question.findMany({
      where: { examId },
    }),
  ]);

  const autoGradableQuestions = allQuestions.filter((q) => q.type !== "short_answer");

  // Collect answer updates to do in bulk
  const answerUpdates: { id: string; isCorrect: boolean }[] = [];
  const results: StudentScoreSummary[] = [];

  for (const student of allStudents) {
    const answerMap = new Map(student.answers.map((a) => [a.questionId, a]));
    const studentUpdates = new Map<string, boolean>();

    for (const q of autoGradableQuestions) {
      const answer = answerMap.get(q.id);

      if (answer && answer.selectedOption) {
        const qScore = calculateQuestionScore(q, answer);
        const isCorrect = qScore.isFullCorrect;
        if (answer.isCorrect !== isCorrect) {
          answerUpdates.push({ id: answer.id, isCorrect });
          studentUpdates.set(answer.id, isCorrect);
        }
      } else if (answer && answer.isCorrect !== false) {
        answerUpdates.push({ id: answer.id, isCorrect: false });
        studentUpdates.set(answer.id, false);
      }
    }

    const scoringAnswers = student.answers.map(answer => studentUpdates.has(answer.id) ? { ...answer, isCorrect: studentUpdates.get(answer.id)! } : answer);
    const score = calculateScore(allQuestions, scoringAnswers);

    results.push({
      studentId: student.id,
      name: student.name,
      nisn: student.nisn,
      status: student.status,
      ...score,
      totalQuestions: allQuestions.length,
      violationCount: student.violationCount,
      submittedAt: student.submittedAt,
    });
  }

  // Bulk update answer records (1 update per changed answer, parallelized)
  if (answerUpdates.length > 0) {
    await Promise.all(
      answerUpdates.map(({ id, isCorrect }) =>
        prisma.answer.update({ where: { id }, data: { isCorrect } })
      )
    );
  }

  return results;
}

// ─── MED-01: Pure-read grading summary ─────────────────────────────────────────
// Digunakan oleh GET /results endpoint — TIDAK menulis ke DB.
// Membaca nilai isCorrect yang sudah ditulis oleh autoGradeExam (dipanggil saat exam ended).
// Untuk ujian yang sudah ended, nilai isCorrect di DB sudah final.
// Untuk ujian yang masih active, skor bersifat indikatif (belum final).
export async function readStudentGradingSummaries(examId: string): Promise<StudentScoreSummary[]> {
  const [allStudents, allQuestions] = await Promise.all([
    prisma.student.findMany({
      where: { examId },
      include: { answers: true },
    }),
    prisma.question.findMany({
      where: { examId },
      select: { id: true, points: true, type: true, correctAnswer: true, options: true },
    }),
  ]);

  const results: StudentScoreSummary[] = [];

  for (const student of allStudents) {
    const score = calculateScore(allQuestions, student.answers);

    results.push({
      studentId: student.id,
      name: student.name,
      nisn: student.nisn,
      status: student.status,
      ...score,
      totalQuestions: allQuestions.length,
      violationCount: student.violationCount,
      submittedAt: student.submittedAt,
    });
  }

  return results;
}

// ─── MED-01: getExamResults menggunakan pure-read path ─────────────────────────
// GET endpoint tidak boleh menulis ke DB (melanggar idempotency).
// Jika exam sudah ended → baca hasil grading dari DB (sudah ditulis saat exam berakhir).
// Jika exam masih active → tampilkan skor sementara berdasarkan isCorrect yang sudah ada.
export async function getExamResults(examId: string) {
  // Parallel fetch: exam metadata & student summaries run concurrently
  const [exam, studentSummaries] = await Promise.all([
    prisma.exam.findUnique({
      where: { id: examId },
      include: {
        _count: { select: { questions: true } },
      },
    }),
    readStudentGradingSummaries(examId),
  ]);

  if (!exam) {
    throw new Error("Ujian tidak ditemukan");
  }

  const scores = studentSummaries.map((s) => s.finalScore);
  const totalStudents = studentSummaries.length;
  const submittedStudents = studentSummaries.filter((s) => s.status === "submitted").length;

  const averageScore =
    totalStudents > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / totalStudents) * 10) / 10 : 0;
  const minScore = totalStudents > 0 ? Math.min(...scores) : 0;
  const maxScore = totalStudents > 0 ? Math.max(...scores) : 0;

  return {
    exam: {
      id: exam.id,
      teacherId: exam.teacherId,
      title: exam.title,
      accessCode: exam.accessCode,
      durationMinutes: exam.durationMinutes,
      status: exam.status,
      totalQuestions: exam._count.questions,
    },
    statistics: {
      totalStudents,
      submittedStudents,
      averageScore,
      minScore,
      maxScore,
    },
    students: studentSummaries,
  };
}
