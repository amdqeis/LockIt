import { NextRequest } from "next/server";
import { authenticateTeacher } from "@/lib/middleware/auth";
import { prisma } from "@/lib/prisma";
import { successResponse, errorResponse, safeErrorMessage } from "@/lib/response";
import { AppError } from "@/lib/errors";
import { calculateScore } from "@/services/score-calculation";
import { z } from "zod";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const teacher = await authenticateTeacher(req);
    const { id } = await params;

    // HIGH-02: Pagination params
    const url = new URL(req.url);
    const paging = z.object({ page: z.coerce.number().int().min(1).max(100000), pageSize: z.coerce.number().int().min(1).max(200) }).safeParse({ page: url.searchParams.get("page") ?? "1", pageSize: url.searchParams.get("pageSize") ?? "100" });
    if (!paging.success) return errorResponse("VALIDATION_ERROR", "Halaman peserta tidak valid", 400);
    const { page, pageSize } = paging.data;
    const search = z.string().trim().max(100).safeParse(url.searchParams.get("search") || "");
    if (!search.success) return errorResponse("VALIDATION_ERROR", "Pencarian peserta tidak valid", 400);
    const skip = (page - 1) * pageSize;
    const studentWhere = { examId: id, ...(search.data ? { OR: [{ name: { contains: search.data, mode: "insensitive" as const } }, { nisn: { contains: search.data } }] } : {}) };

    const exam = await prisma.exam.findUnique({ where: { id } });
    if (!exam) {
      return errorResponse("NOT_FOUND", "Ujian tidak ditemukan", 404);
    }

    const [students, total, questions] = await Promise.all([
      prisma.student.findMany({
        where: studentWhere,
        orderBy: [{ joinedAt: "asc" }, { id: "asc" }],
        take: pageSize,
        skip,
        select: {
          id: true,
          name: true,
          nisn: true,
          status: true,
          isLocked: true,
          violationCount: true,
          violationCycleCount: true,
          ipAddress: true,
          acceptedAt: true,
          kickedAt: true,
          kickReason: true,
          joinedAt: true,
          submittedAt: true,
          answers: {
            select: {
              questionId: true,
              selectedOption: true,
              isCorrect: true,
            },
          },
          _count: {
            select: {
              answers: true,
              proctoringEvents: true,
              warnings: true,
            },
          },
        },
      }),
      prisma.student.count({ where: studentWhere }),
      prisma.question.findMany({
        where: { examId: id },
        select: { id: true, points: true, type: true, correctAnswer: true, options: true },
      }),
    ]);

    const totalQuestions = questions.length;

    const formattedStudents = students.map((s) => {
      const answeredCount = s.answers.filter(
        (a) => a.selectedOption !== null && a.selectedOption.trim() !== ""
      ).length;

      let score: number | null = null;
      if (s.status === "submitted") {
        score = calculateScore(questions, s.answers).finalScore;
      }

      return {
        id: s.id,
        name: s.name,
        nisn: s.nisn,
        status: s.status,
        isLocked: s.isLocked,
        violationCount: s.violationCount,
        violationCycleCount: s.violationCycleCount,
        ipAddress: s.ipAddress,
        acceptedAt: s.acceptedAt,
        kickedAt: s.kickedAt,
        kickReason: s.kickReason,
        joinedAt: s.joinedAt,
        submittedAt: s.submittedAt,
        answeredCount,
        totalQuestions,
        score,
        lastSeen: (globalThis as any).studentLastHeartbeat?.get(s.id)
          ? new Date((globalThis as any).studentLastHeartbeat.get(s.id)).toISOString()
          : null,
        _count: s._count,
      };
    });

    return successResponse({
      examId: id,
      totalStudents: total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      students: formattedStudents,
    });
  } catch (err: any) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    return errorResponse("INTERNAL_SERVER_ERROR", safeErrorMessage(err, "Gagal mengambil data peserta"), 500);
  }
}

