import { NextRequest } from "next/server";
import { authenticateTeacher } from "@/lib/middleware/auth";
import { prisma } from "@/lib/prisma";
import { successResponse, errorResponse, safeErrorMessage } from "@/lib/response";
import { AppError } from "@/lib/errors";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; sid: string }> }
) {
  try {
    const teacher = await authenticateTeacher(req);
    const { id, sid } = await params;

    const exam = await prisma.exam.findUnique({ where: { id } });
    if (!exam || exam.teacherId !== teacher.teacherId) {
      return errorResponse("NOT_FOUND", "Ujian tidak ditemukan", 404);
    }

    const student = await prisma.student.findUnique({
      where: { id: sid },
      include: {
        proctoringEvents: {
          orderBy: { timestamp: "asc" },
        },
        warnings: {
          orderBy: { sentAt: "asc" },
        },
      },
    });

    if (!student || student.examId !== id) {
      return errorResponse("NOT_FOUND", "Data peserta tidak ditemukan pada ujian ini", 404);
    }

    return successResponse({
      student: {
        id: student.id,
        name: student.name,
        nim: student.nim,
        status: student.status,
        isLocked: student.isLocked,
        violationCount: student.violationCount,
        joinedAt: student.joinedAt,
        submittedAt: student.submittedAt,
        ipAddress: student.ipAddress,
        userAgent: student.userAgent,
      },
      events: student.proctoringEvents,
      warnings: student.warnings,
    });
  } catch (err: any) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    return errorResponse("INTERNAL_SERVER_ERROR", safeErrorMessage(err, "Gagal mengambil log pelanggaran peserta"), 500);
  }
}
