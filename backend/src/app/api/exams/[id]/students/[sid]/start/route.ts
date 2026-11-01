import { NextRequest } from "next/server";
import { authenticateTeacher } from "@/lib/middleware/auth";
import { prisma } from "@/lib/prisma";
import { successResponse, errorResponse, safeErrorMessage } from "@/lib/response";
import { AppError } from "@/lib/errors";
import { scheduleExamAutoEnd } from "@/lib/scheduler";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; sid: string }> }
) {
  try {
    const teacher = await authenticateTeacher(req);
    const { id, sid } = await params;

    const exam = await prisma.exam.findUnique({
      where: { id },
      include: {
        _count: { select: { questions: true } },
      },
    });

    if (!exam || (teacher.role !== "ADMIN" && exam.teacherId !== teacher.teacherId)) {
      return errorResponse("NOT_FOUND", "Ujian tidak ditemukan", 404);
    }

    if (exam._count.questions === 0) {
      return errorResponse("NO_QUESTIONS", "Ujian belum memiliki soal", 400);
    }

    const student = await prisma.student.findUnique({
      where: { id: sid },
    });

    if (!student || student.examId !== id) {
      return errorResponse("NOT_FOUND", "Data peserta tidak ditemukan di ujian ini", 404);
    }

    const now = new Date();
    const io = (globalThis as any).io;

    // Jika status ujian masih draft, aktifkan ujian
    if (exam.status === "draft") {
      const endTime = new Date(now.getTime() + exam.durationMinutes * 60 * 1000);
      await prisma.exam.update({
        where: { id },
        data: {
          status: "active",
          startTime: now,
          endTime,
        },
      });

      if (io) {
        try {
          io.of("/student-session").to(`exam:${id}`).emit("exam_started", {
            examId: id,
            startTime: now.toISOString(),
            endTime: endTime.toISOString(),
            durationMinutes: exam.durationMinutes,
          });
          io.of("/teacher-dashboard").to(`exam:${id}`).emit("exam_started", {
            examId: id,
            startTime: now.toISOString(),
            endTime: endTime.toISOString(),
          });
        } catch (socketErr) {
          console.error("Socket emit failed on exam_started:", socketErr);
        }
      }

      scheduleExamAutoEnd(id, endTime, io);
    }

    // Update siswa menjadi active
    const updated = await prisma.student.update({
      where: { id: sid },
      data: {
        status: "active",
        acceptedAt: student.acceptedAt || now,
      },
    });

    if (io) {
      try {
        // Emit ke namespace student per siswa
        io.of("/student-session").to(`student:${sid}`).emit("exam_started", {
          examId: id,
          studentId: sid,
          startTime: now.toISOString(),
        });
        // Emit ke dashboard guru
        io.of("/teacher-dashboard").to(`exam:${id}`).emit("student_status_changed", {
          studentId: sid,
          status: "active",
          name: updated.name,
          nisn: updated.nisn,
        });
      } catch (socketErr) {
        console.error("Socket emit failed on student_status_changed:", socketErr);
      }
    }

    return successResponse({
      studentId: updated.id,
      status: updated.status,
      message: `Ujian berhasil dimulai untuk ${updated.name}`,
    });
  } catch (err: any) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    return errorResponse("INTERNAL_SERVER_ERROR", safeErrorMessage(err, "Gagal memulai ujian peserta"), 500);
  }
}
