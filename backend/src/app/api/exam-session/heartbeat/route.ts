import { NextRequest } from "next/server";
import { authenticateStudent } from "@/lib/middleware/auth";
import { prisma } from "@/lib/prisma";
import { successResponse, errorResponse } from "@/lib/response";
import { AppError } from "@/lib/errors";

export async function POST(req: NextRequest) {
  try {
    const { student } = await authenticateStudent(req);
    const exam = student.exam;

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
    return errorResponse("INTERNAL_SERVER_ERROR", err.message || "Gagal memperbarui sinyal kehadiran", 500);
  }
}
