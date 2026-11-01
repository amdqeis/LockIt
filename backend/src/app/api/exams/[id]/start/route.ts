import { NextRequest } from "next/server";
import { authenticateTeacher } from "@/lib/middleware/auth";
import { prisma } from "@/lib/prisma";
import { successResponse, errorResponse, safeErrorMessage } from "@/lib/response";
import { AppError } from "@/lib/errors";
import { scheduleExamAutoEnd } from "@/lib/scheduler";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const teacher = await authenticateTeacher(req);
    const { id: examId } = await params;

    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      include: {
        _count: { select: { questions: true } },
      },
    });

    if (!exam || (teacher.role !== "ADMIN" && exam.teacherId !== teacher.teacherId)) {
      return errorResponse("NOT_FOUND", "Ujian tidak ditemukan", 404);
    }

    if (exam.status !== "draft" && exam.status !== "active") {
      return errorResponse(
        "INVALID_STATE",
        `Ujian tidak dapat dimulai karena berstatus '${exam.status}'`,
        400
      );
    }

    if (exam._count.questions === 0) {
      return errorResponse(
        "NO_QUESTIONS",
        "Ujian tidak dapat dimulai karena belum memiliki butir soal",
        400
      );
    }

    const now = new Date();
    const endTime = new Date(now.getTime() + exam.durationMinutes * 60 * 1000);

    const updatedExam = await prisma.exam.update({
      where: { id: examId },
      data: {
        status: "active",
        startTime: now,
        endTime,
      },
    });

    // Update semua siswa yang ada di lobby (status: "waiting" atau "accepted") menjadi "active"
    const updatedStudents = await prisma.student.updateMany({
      where: {
        examId,
        status: { in: ["waiting", "accepted"] },
      },
      data: {
        status: "active",
      },
    });

    const io = (globalThis as any).io;
    if (io) {
      try {
        // Emit ke namespace peserta ujian
        io.of("/student-session").to(`exam:${examId}`).emit("exam_started", {
          examId,
          startTime: now.toISOString(),
          endTime: endTime.toISOString(),
          durationMinutes: exam.durationMinutes,
        });

        // Emit ke dashboard guru
        io.of("/teacher-dashboard").to(`exam:${examId}`).emit("exam_started", {
          examId,
          startTime: now.toISOString(),
          endTime: endTime.toISOString(),
          activeStudentsCount: updatedStudents.count,
        });
      } catch (socketErr) {
        console.error("Socket emit exam_started failed:", socketErr);
      }
    }

    // Schedule auto-end timer
    scheduleExamAutoEnd(updatedExam.id, endTime, io);

    return successResponse({
      examId,
      status: "active",
      startTime: now.toISOString(),
      endTime: endTime.toISOString(),
      activatedStudentsCount: updatedStudents.count,
      message: "Ujian berhasil dimulai",
    });
  } catch (err: any) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    return errorResponse("INTERNAL_SERVER_ERROR", safeErrorMessage(err, "Gagal memulai ujian"), 500);
  }
}
