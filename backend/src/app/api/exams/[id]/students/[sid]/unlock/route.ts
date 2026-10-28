import { NextRequest } from "next/server";
import { authenticateTeacher } from "@/lib/middleware/auth";
import { prisma } from "@/lib/prisma";
import { successResponse, errorResponse, safeErrorMessage } from "@/lib/response";
import { AppError } from "@/lib/errors";

export async function POST(
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
    });

    if (!student || student.examId !== id) {
      return errorResponse("NOT_FOUND", "Data peserta tidak ditemukan di ujian ini", 404);
    }

    const updated = await prisma.student.update({
      where: { id: sid },
      data: { isLocked: false },
    });

    // Broadcast unlock to both student and teacher dashboard
    const io = (globalThis as any).io;
    if (io) {
      try {
        io.of("/student-session").to(`student:${sid}`).emit("student_unlocked", {
          message: "Sesi ujian Anda telah dibuka kembali oleh pengawas.",
        });
        io.of("/teacher-dashboard").to(`exam:${id}`).emit("student_unlocked", {
          studentId: sid,
          isLocked: false,
        });
      } catch (socketErr) {
        console.error("Socket emit unlock failed:", socketErr);
      }
    }

    return successResponse({
      studentId: updated.id,
      isLocked: updated.isLocked,
      message: "Peserta berhasil di-unlock",
    });
  } catch (err: any) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    return errorResponse("INTERNAL_SERVER_ERROR", safeErrorMessage(err, "Gagal meng-unlock peserta"), 500);
  }
}
