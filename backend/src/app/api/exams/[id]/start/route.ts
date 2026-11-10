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

    if (!exam) {
      return errorResponse("NOT_FOUND", "Ujian tidak ditemukan", 404);
    }

    if (exam.status === "draft" && (!exam.classroomId || !exam.subjectId)) {
      return errorResponse("VALIDATION_ERROR", "Ujian draf harus dilengkapi rombel dan mata pelajaran sebelum dimulai.", 400);
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
    if (exam.status === "active") {
      if (!exam.endTime || exam.endTime <= now) return errorResponse("EXAM_TIME_EXPIRED", "Waktu ujian telah berakhir", 400);
      return successResponse({ examId, status: "active", startTime: exam.startTime, endTime: exam.endTime, message: "Ujian sudah dimulai." });
    }
    const startTime = now;
    const endTime = new Date(now.getTime() + exam.durationMinutes * 60 * 1000);
    const started = await prisma.$transaction(async tx => {
      const claimed = await tx.exam.updateMany({ where: { id: examId, status: "draft" }, data: { status: "active", startTime, endTime } });
      if (!claimed.count) return null;
      const students = await tx.student.updateMany({ where: { examId, status: "accepted", isLocked: false }, data: { status: "active" } });
      return { students };
    });
    if (!started) {
      const current = await prisma.exam.findUnique({ where: { id: examId } });
      if (current?.status === "active" && current.endTime && current.endTime > now) return successResponse({ examId, status: "active", startTime: current.startTime, endTime: current.endTime, message: "Ujian sudah dimulai." });
      return errorResponse("INVALID_STATE", "Status ujian berubah sebelum dapat dimulai", 409);
    }
    const updatedStudents = started.students;

    const io = (globalThis as any).io;
    if (io) {
      try {
        // Emit ke namespace peserta ujian
        io.of("/student-session").to(`exam:${examId}`).emit("exam_started", {
          examId,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          durationMinutes: exam.durationMinutes,
        });

        // Emit ke dashboard guru
        io.of("/teacher-dashboard").to(`exam:${examId}`).emit("exam_started", {
          examId,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          activeStudentsCount: updatedStudents.count,
        });
      } catch (socketErr) {
        console.error("Socket emit exam_started failed:", socketErr);
      }
    }

    // Schedule auto-end timer
    scheduleExamAutoEnd(examId, endTime, io);

    return successResponse({
      examId,
      status: "active",
      startTime: startTime.toISOString(),
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
