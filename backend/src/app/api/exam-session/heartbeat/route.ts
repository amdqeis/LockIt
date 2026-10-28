import { NextRequest } from "next/server";
import { authenticateStudent } from "@/lib/middleware/auth";
import { prisma } from "@/lib/prisma";
import { successResponse, errorResponse, safeErrorMessage } from "@/lib/response";
import { AppError } from "@/lib/errors";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const { student } = await authenticateStudent(req);
    const exam = student.exam;

    // HIGH-06: Rate limit heartbeat — normal setiap 10-30 detik, max 10/menit
    const rateLimit = checkRateLimit(student.id, {
      windowMs: 60 * 1000,
      max: 10,
      keyPrefix: "heartbeat",
    });

    if (!rateLimit.success) {
      // Kembalikan data heartbeat standar tanpa error agar siswa tidak bingung,
      // tapi abaikan proses DB untuk mencegah abuse
      return successResponse({
        studentId: student.id,
        status: student.status,
        isLocked: student.isLocked,
        isExamActive: exam.status === "active",
        serverTime: new Date().toISOString(),
      });
    }

    const now = new Date();
    const isExamActive = exam.status === "active" && (!exam.endTime || now <= exam.endTime);

    if (student.status === "disconnected" && isExamActive) {
      await prisma.student.update({
        where: { id: student.id },
        data: { status: "active" },
      });

      // Notify Teacher dashboard that student reconnected via HTTP heartbeat
      const io = (globalThis as any).io;
      if (io) {
        try {
          io.of("/teacher-dashboard").to(`exam:${exam.id}`).emit("student_presence", {
            studentId: student.id,
            name: student.name,
            nim: student.nim,
            status: "active",
            lastSeen: now.toISOString(),
          });
        } catch (socketErr) {
          console.error("Socket emit failed on heartbeat:", socketErr);
        }
      }
    }

    return successResponse({
      studentId: student.id,
      status: student.status,
      isLocked: student.isLocked,
      isExamActive,
      serverTime: now.toISOString(),
    });
  } catch (err: any) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    return errorResponse("INTERNAL_SERVER_ERROR", safeErrorMessage(err, "Gagal memperbarui sinyal kehadiran"), 500);
  }
}
