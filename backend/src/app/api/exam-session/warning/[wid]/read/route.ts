import { NextRequest } from "next/server";
import { authenticateStudent } from "@/lib/middleware/auth";
import { prisma } from "@/lib/prisma";
import { successResponse, errorResponse, safeErrorMessage } from "@/lib/response";
import { AppError } from "@/lib/errors";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ wid: string }> }
) {
  try {
    const { student } = await authenticateStudent(req);
    const { wid } = await params;

    const warning = await prisma.warning.findUnique({
      where: { id: wid },
    });

    if (!warning || warning.studentId !== student.id) {
      return errorResponse("NOT_FOUND", "Peringatan tidak ditemukan", 404);
    }

    const updated = await prisma.warning.update({
      where: { id: wid },
      data: { isRead: true },
    });

    // Notify teacher dashboard that warning was acknowledged
    const io = (globalThis as any).io;
    if (io) {
      try {
        io.of("/teacher-dashboard").to(`exam:${student.examId}`).emit("warning_acknowledged", {
          warningId: wid,
          studentId: student.id,
          readAt: new Date().toISOString(),
        });
      } catch (socketErr) {
        console.error("Socket emit failed on warning read:", socketErr);
      }
    }

    return successResponse({
      warningId: updated.id,
      isRead: updated.isRead,
    });
  } catch (err: any) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    return errorResponse("INTERNAL_SERVER_ERROR", safeErrorMessage(err, "Gagal memperbarui status peringatan"), 500);
  }
}
