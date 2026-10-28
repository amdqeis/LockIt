import { prisma } from "@/lib/prisma";

export interface StudentScoreSummary {
  studentId: string;
  name: string;
  nim: string;
  status: string;
  totalPoints: number;
  earnedPoints: number;
  finalScore: number; // Scaled 0 - 100
  correctCount: number;
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

  let earnedPoints = 0;
  let totalPoints = 0;
  let correctCount = 0;

  for (const q of questions) {
    totalPoints += q.points;
    const answer = answerMap.get(q.id);

    if (answer && answer.selectedOption) {
      const isCorrect = answer.selectedOption.toUpperCase() === q.correctAnswer.toUpperCase();
      if (isCorrect) {
        earnedPoints += q.points;
        correctCount += 1;
      }

      // Update answer record if not yet evaluated or changed
      if (answer.isCorrect !== isCorrect) {
        await prisma.answer.update({
          where: { id: answer.id },
          data: { isCorrect },
        });
      }
    } else {
      // If student never answered this question
      if (answer && answer.isCorrect !== false) {
        await prisma.answer.update({
          where: { id: answer.id },
          data: { isCorrect: false },
        });
      }
    }
  }

  const finalScore = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 1000) / 10 : 0;

  return {
    studentId: student.id,
    name: student.name,
    nim: student.nim,
    status: student.status,
    totalPoints,
    earnedPoints,
    finalScore,
    correctCount,
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

  const questionMap = new Map(allQuestions.map((q) => [q.id, q]));
  const totalPoints = allQuestions.reduce((sum, q) => sum + q.points, 0);

  // Collect answer updates to do in bulk
  const answerUpdates: { id: string; isCorrect: boolean }[] = [];
  const results: StudentScoreSummary[] = [];

  for (const student of allStudents) {
    const answerMap = new Map(student.answers.map((a) => [a.questionId, a]));
    let earnedPoints = 0;
    let correctCount = 0;

    for (const q of allQuestions) {
      const answer = answerMap.get(q.id);

      if (answer && answer.selectedOption) {
        const isCorrect = answer.selectedOption.toUpperCase() === q.correctAnswer.toUpperCase();
        if (isCorrect) {
          earnedPoints += q.points;
          correctCount += 1;
        }
        if (answer.isCorrect !== isCorrect) {
          answerUpdates.push({ id: answer.id, isCorrect });
        }
      } else if (answer && answer.isCorrect !== false) {
        answerUpdates.push({ id: answer.id, isCorrect: false });
      }
    }

    const finalScore = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 1000) / 10 : 0;

    results.push({
      studentId: student.id,
      name: student.name,
      nim: student.nim,
      status: student.status,
      totalPoints,
      earnedPoints,
      finalScore,
      correctCount,
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
      select: { id: true, points: true },
    }),
  ]);

  const questionPointsMap = new Map(allQuestions.map((q) => [q.id, q.points]));
  const totalPoints = allQuestions.reduce((sum, q) => sum + q.points, 0);
  const results: StudentScoreSummary[] = [];

  for (const student of allStudents) {
    let earnedPoints = 0;
    let correctCount = 0;

    for (const answer of student.answers) {
      if (answer.isCorrect === true) {
        earnedPoints += questionPointsMap.get(answer.questionId) ?? 0;
        correctCount += 1;
      }
    }

    const finalScore = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 1000) / 10 : 0;

    results.push({
      studentId: student.id,
      name: student.name,
      nim: student.nim,
      status: student.status,
      totalPoints,
      earnedPoints,
      finalScore,
      correctCount,
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
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    include: {
      _count: { select: { questions: true } },
    },
  });

  if (!exam) {
    throw new Error("Ujian tidak ditemukan");
  }

  // Pure-read: tidak menulis ke DB
  const studentSummaries = await readStudentGradingSummaries(examId);

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
