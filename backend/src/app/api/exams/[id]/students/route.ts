import { NextRequest } from "next/server";
import { authenticateTeacher } from "@/lib/middleware/auth";
import { prisma } from "@/lib/prisma";
import { successResponse, errorResponse, safeErrorMessage } from "@/lib/response";
import { AppError } from "@/lib/errors";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const teacher = await authenticateTeacher(req);
    const { id } = await params;

    // HIGH-02: Pagination params
    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
    const pageSize = Math.min(200, Math.max(1, parseInt(url.searchParams.get("pageSize") ?? "100", 10)));
    const skip = (page - 1) * pageSize;

    const exam = await prisma.exam.findUnique({ where: { id } });
    if (!exam || exam.teacherId !== teacher.teacherId) {
      return errorResponse("NOT_FOUND", "Ujian tidak ditemukan", 404);
    }

    const [students, total] = await Promise.all([
      prisma.student.findMany({
        where: { examId: id },
        orderBy: { joinedAt: "asc" },
        take: pageSize,
        skip,
        select: {
          id: true,
          name: true,
          nisn: true,
          status: true,
          isLocked: true,
          violationCount: true,
          joinedAt: true,
          submittedAt: true,
          _count: {
            select: {
              answers: true,
              proctoringEvents: true,
              warnings: true,
            },
          },
        },
      }),
      prisma.student.count({ where: { examId: id } }),
    ]);

    return successResponse({
      examId: id,
      totalStudents: total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      students,
    });
  } catch (err: any) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    return errorResponse("INTERNAL_SERVER_ERROR", safeErrorMessage(err, "Gagal mengambil data peserta"), 500);
  }
}

