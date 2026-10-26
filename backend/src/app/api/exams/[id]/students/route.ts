import { NextRequest } from "next/server";
import { authenticateTeacher } from "@/lib/middleware/auth";
import { prisma } from "@/lib/prisma";
import { successResponse, errorResponse } from "@/lib/response";
import { AppError } from "@/lib/errors";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const teacher = await authenticateTeacher(req);
    const { id } = await params;

    const exam = await prisma.exam.findUnique({ where: { id } });
    if (!exam || exam.teacherId !== teacher.teacherId) {
      return errorResponse("NOT_FOUND", "Ujian tidak ditemukan", 404);
    }

    const students = await prisma.student.findMany({
      where: { examId: id },
      orderBy: { joinedAt: "asc" },
      select: {
        id: true,
        name: true,
        nim: true,
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
    });

    return successResponse({
      examId: id,
      totalStudents: students.length,
      students,
    });
  } catch (err: any) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    return errorResponse("INTERNAL_SERVER_ERROR", err.message || "Gagal mengambil data peserta", 500);
  }
}
