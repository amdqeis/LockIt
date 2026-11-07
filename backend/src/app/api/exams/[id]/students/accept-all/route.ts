import { NextRequest } from "next/server";
import { authenticateTeacher } from "@/lib/middleware/auth";
import { prisma } from "@/lib/prisma";
import { successResponse, errorResponse, safeErrorMessage } from "@/lib/response";
import { AppError } from "@/lib/errors";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const teacher = await authenticateTeacher(req);
    const { id } = await params;

    const exam = await prisma.exam.findUnique({ where: { id } });
    if (!exam || (teacher.role !== "ADMIN" && exam.teacherId !== teacher.teacherId)) {
      return errorResponse("NOT_FOUND", "Ujian tidak ditemukan", 404);
    }
    if (!["draft", "active"].includes(exam.status) || (exam.endTime && exam.endTime <= new Date())) return errorResponse("INVALID_STATE", "Ujian tidak menerima peserta saat ini", 409);

    const updated = await prisma.student.updateMany({
      where: { examId: id, status: "waiting" },
      data: {
        status: "accepted",
        acceptedAt: new Date(),
      },
    });

    const io = (globalThis as any).io;
    if (io) {
      try {
        io.of("/teacher-dashboard").to(`exam:${id}`).emit("all_students_accepted", {
          count: updated.count,
        });
        io.of("/student-session").to(`exam:${id}`).emit("student_accepted", {
          message: "Semua peserta telah diterima oleh pengawas. Menunggu ujian dimulai.",
        });
      } catch (socketErr) {
        console.error("Socket emit accept-all failed:", socketErr);
      }
    }

    return successResponse({
      acceptedCount: updated.count,
      message: `${updated.count} peserta berhasil diterima`,
    });
  } catch (err: any) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    return errorResponse("INTERNAL_SERVER_ERROR", safeErrorMessage(err, "Gagal menerima semua peserta"), 500);
  }
}
