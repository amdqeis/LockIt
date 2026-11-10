import { NextRequest } from "next/server";
import { authenticateStudent } from "@/lib/middleware/auth";
import { prisma } from "@/lib/prisma";
import { successResponse, errorResponse, safeErrorMessage } from "@/lib/response";
import { AppError } from "@/lib/errors";

export async function GET(req: NextRequest) {
  try {
    const { student } = await authenticateStudent(req);
    const exam = student.exam;

    const questionCount = await prisma.question.count({
      where: { examId: exam.id },
    });
    const latestAdmissionAction = await prisma.admissionHistory.findFirst({
      where: { studentId: student.id },
      orderBy: { createdAt: "desc" },
      select: { action: true, reason: true, createdAt: true },
    });

    return successResponse({
      student: {
        id: student.id,
        name: student.name,
        nisn: student.nisn,
        status: student.status,
        kickReason: student.kickReason ?? null,
        isLocked: student.isLocked,
        violationCount: student.violationCount,
        violationCycleCount: student.violationCycleCount,
        recoveryRequired: student.recoveryRequired,
        latestAdmissionAction,
      },
      exam: {
        id: exam.id,
        title: exam.title,
        accessCode: exam.accessCode,
        durationMinutes: exam.durationMinutes,
        status: exam.status,
        questionCount,
        startTime: exam.startTime?.toISOString() ?? null,
        endTime: exam.endTime?.toISOString() ?? null,
        serverTime: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    return errorResponse("INTERNAL_SERVER_ERROR", safeErrorMessage(err, "Gagal memuat status waiting room"), 500);
  }
}
