import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { authenticateTeacher } from "@/lib/middleware/auth";
import { prisma } from "@/lib/prisma";
import { successResponse, errorResponse, safeErrorMessage } from "@/lib/response";
import { AppError } from "@/lib/errors";
import { calculateScore } from "@/services/score-calculation";

export async function GET(req: NextRequest) {
  try {
    await authenticateTeacher(req);
    const searchParams = req.nextUrl.searchParams;
    const gradeLevelId = searchParams.get("gradeLevelId") || undefined;
    const academicYear = searchParams.get("academicYear") || undefined;
    const semester = (searchParams.get("semester") as "ganjil" | "genap") || undefined;
    const category = searchParams.get("category") || undefined;
    const search = searchParams.get("search")?.trim() || undefined;

    const where: Prisma.ExamWhereInput = {
      status: { in: ["ended", "archived"] },
      ...(academicYear ? { academicYear } : {}),
      ...(semester ? { semester } : {}),
      ...(category ? { category } : {}),
      ...(gradeLevelId ? {
        OR: [
          { classroom: { gradeLevelId } },
          { subjectFolder: { gradeLevelId } },
        ],
      } : {}),
      ...(search ? {
        OR: [
          { title: { contains: search, mode: "insensitive" } },
          { subjectName: { contains: search, mode: "insensitive" } },
          { className: { contains: search, mode: "insensitive" } },
          { category: { contains: search, mode: "insensitive" } },
        ],
      } : {}),
    };

    const exams = await prisma.exam.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        title: true,
        status: true,
        classroomId: true,
        className: true,
        subjectId: true,
        subjectName: true,
        academicYear: true,
        semester: true,
        category: true,
        categoryNumber: true,
        passingScore: true,
        createdAt: true,
        classroom: {
          select: {
            id: true,
            name: true,
            gradeLevelId: true,
            gradeLevel: { select: { id: true, name: true } },
          },
        },
        subjectFolder: {
          select: {
            id: true,
            name: true,
            gradeLevelId: true,
            gradeLevel: { select: { id: true, name: true } },
          },
        },
      },
    });

    const examIds = exams.map((e) => e.id);

    // Fetch submitted students and their answers
    const students = await prisma.student.findMany({
      where: {
        examId: { in: examIds },
        status: "submitted",
      },
      select: {
        id: true,
        examId: true,
        name: true,
        nisn: true,
        submittedAt: true,
        violationCount: true,
        answers: {
          select: {
            questionId: true,
            selectedOption: true,
            isCorrect: true,
          },
        },
      },
    });

    const questions = await prisma.question.findMany({
      where: { examId: { in: examIds } },
      select: { id: true, examId: true, type: true, points: true, correctAnswer: true, options: true },
    });

    // Compute score per student attempt
    const scoresByExam = new Map<string, number[]>();
    const pendingGradingByExam = new Map<string, number>();

    for (const student of students) {
      const examQuestions = questions.filter((q) => q.examId === student.examId);
      const score = calculateScore(examQuestions, student.answers);
      if (!scoresByExam.has(student.examId)) scoresByExam.set(student.examId, []);
      scoresByExam.get(student.examId)!.push(score.finalScore);
      if (score.pendingManualCount > 0) {
        pendingGradingByExam.set(student.examId, (pendingGradingByExam.get(student.examId) || 0) + 1);
      }
    }

    type ResultExamItem = typeof exams[number] & {
      completedStudents: number;
      averageScore: number | null;
      pendingGradingCount: number;
    };

    type ResultSubjectGroup = {
      subjectId: string | null;
      subjectName: string;
      gradeLevelName: string | null;
      totalExams: number;
      totalCompletedStudents: number;
      averageScore: number | null;
      exams: ResultExamItem[];
    };

    type ResultClassroomGroup = {
      classroomId: string | null;
      className: string;
      gradeLevelId: string | null;
      gradeLevelName: string | null;
      totalExams: number;
      totalCompletedStudents: number;
      averageScore: number | null;
      subjects: ResultSubjectGroup[];
    };

    const classroomMap = new Map<string, ResultClassroomGroup>();
    const unmappedClassroomKey = "__unmapped__";

    for (const exam of exams) {
      const examScores = scoresByExam.get(exam.id) || [];
      const completedStudents = examScores.length;
      const averageScore = completedStudents > 0 ? Math.round((examScores.reduce((a, b) => a + b, 0) / completedStudents) * 10) / 10 : null;
      const pendingGradingCount = pendingGradingByExam.get(exam.id) || 0;

      const examItem: ResultExamItem = {
        ...exam,
        completedStudents,
        averageScore,
        pendingGradingCount,
      };

      const cId = exam.classroomId || unmappedClassroomKey;
      let cGroup = classroomMap.get(cId);
      if (!cGroup) {
        cGroup = {
          classroomId: exam.classroomId,
          className: exam.classroom?.name || exam.className || "Perlu Dipetakan",
          gradeLevelId: exam.classroom?.gradeLevelId || null,
          gradeLevelName: exam.classroom?.gradeLevel?.name || null,
          totalExams: 0,
          totalCompletedStudents: 0,
          averageScore: null,
          subjects: [],
        };
        classroomMap.set(cId, cGroup);
      }

      cGroup.totalExams++;
      cGroup.totalCompletedStudents += completedStudents;

      let sGroup = cGroup.subjects.find((s) => s.subjectId === (exam.subjectId || null));
      if (!sGroup) {
        sGroup = {
          subjectId: exam.subjectId,
          subjectName: exam.subjectFolder?.name || exam.subjectName || "Perlu Dipetakan",
          gradeLevelName: exam.subjectFolder?.gradeLevel?.name || exam.classroom?.gradeLevel?.name || null,
          totalExams: 0,
          totalCompletedStudents: 0,
          averageScore: null,
          exams: [],
        };
        cGroup.subjects.push(sGroup);
      }

      sGroup.totalExams++;
      sGroup.totalCompletedStudents += completedStudents;
      sGroup.exams.push(examItem);
    }

    // Compute averages across subjects and classrooms
    for (const cGroup of classroomMap.values()) {
      let classroomScoreSum = 0;
      let classroomScoreCount = 0;

      for (const sGroup of cGroup.subjects) {
        let subjectScoreSum = 0;
        let subjectScoreCount = 0;
        for (const e of sGroup.exams) {
          const scores = scoresByExam.get(e.id) || [];
          for (const s of scores) {
            subjectScoreSum += s;
            subjectScoreCount++;
          }
        }
        sGroup.averageScore = subjectScoreCount > 0 ? Math.round((subjectScoreSum / subjectScoreCount) * 10) / 10 : null;
        classroomScoreSum += subjectScoreSum;
        classroomScoreCount += subjectScoreCount;
      }

      cGroup.averageScore = classroomScoreCount > 0 ? Math.round((classroomScoreSum / classroomScoreCount) * 10) / 10 : null;
    }

    const groups = Array.from(classroomMap.values());

    return successResponse({
      totalExams: exams.length,
      groups,
    }, 200, { "Cache-Control": "private, no-store" });
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err.code, err.message, err.statusCode, err.details);
    return errorResponse("INTERNAL_SERVER_ERROR", safeErrorMessage(err, "Gagal mengambil kelompok hasil"), 500);
  }
}

