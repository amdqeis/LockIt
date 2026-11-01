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
    if (!exam || (teacher.role !== "ADMIN" && exam.teacherId !== teacher.teacherId)) {
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
      data: {
        status: "accepted",
        acceptedAt: new Date(),
      },
    });

    const io = (globalThis as any).io;
    if (io) {
      try {
        io.of("/student-session").to(`student:${sid}`).emit("student_accepted", {
          message: "Kamu telah diterima oleh pengawas. Menunggu ujian dimulai.",
        });
        io.of("/teacher-dashboard").to(`exam:${id}`).emit("student_status_changed", {
          studentId: sid,
          status: "accepted",
          name: updated.name,
          nisn: updated.nisn,
        });
      } catch (socketErr) {
        console.error("Socket emit accept failed:", socketErr);
      }
    }

    return successResponse({
      studentId: updated.id,
      status: updated.status,
      message: "Peserta berhasil diterima",
    });
  } catch (err: any) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    return errorResponse("INTERNAL_SERVER_ERROR", safeErrorMessage(err, "Gagal menerima peserta"), 500);
  }
}
