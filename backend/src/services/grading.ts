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
  const students = await prisma.student.findMany({
    where: { examId },
    select: { id: true },
  });

  const results: StudentScoreSummary[] = [];
  for (const s of students) {
    const summary = await autoGradeStudent(s.id);
    results.push(summary);
  }

  return results;
}

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

  const studentSummaries = await autoGradeExam(examId);

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
