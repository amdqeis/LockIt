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
    if (!exam) {
      return errorResponse("NOT_FOUND", "Ujian tidak ditemukan", 404);
    }
    if (!["draft", "active"].includes(exam.status) || (exam.endTime && exam.endTime <= new Date())) return errorResponse("INVALID_STATE", "Ujian tidak menerima peserta saat ini", 409);

    const updated = await prisma.$transaction(async (tx) => {
      const currentExam = await tx.exam.findUnique({ where: { id }, select: { status: true, startTime: true, endTime: true } });
      if (!currentExam || (currentExam.status !== "draft" && currentExam.status !== "active") || (currentExam.endTime && currentExam.endTime <= new Date())) return null;
      const status = currentExam.status === "active" ? "active" as const : "accepted" as const;
      const pending = await tx.student.findMany({ where: { examId: id, status: "waiting" }, select: { id: true } });
      const changed = await tx.student.updateMany({ where: { id: { in: pending.map((student) => student.id) }, status: "waiting" }, data: { status, acceptedAt: new Date() } });
      if (changed.count) {
        await tx.admissionHistory.createMany({ data: pending.map((student) => ({ studentId: student.id, teacherId: teacher.teacherId, action: "approved" as const })) });
      }
      return { count: changed.count, status, startTime: currentExam.startTime, endTime: currentExam.endTime };
    }, { isolationLevel: "Serializable" });
    if (!updated) return errorResponse("INVALID_STATE", "Ujian tidak menerima peserta saat ini", 409);

    const io = (globalThis as any).io;
    if (io) {
      try {
        io.of("/teacher-dashboard").to(`exam:${id}`).emit("all_students_accepted", {
          count: updated.count,
        });
        io.of("/student-session").to(`exam:${id}`).emit("student_accepted", {
          message: updated.status === "active" ? "Semua peserta yang menunggu telah diterima ke ujian." : "Semua peserta telah diterima oleh pengawas. Menunggu ujian dimulai.",
          status: updated.status,
          startTime: updated.startTime?.toISOString() ?? null,
          endTime: updated.endTime?.toISOString() ?? null,
        });
      } catch (socketErr) {
        console.error("Socket emit accept-all failed:", socketErr);
      }
    }

    return successResponse({
      acceptedCount: updated.count,
      status: updated.status,
      startTime: updated.startTime?.toISOString() ?? null,
      endTime: updated.endTime?.toISOString() ?? null,
      message: `${updated.count} peserta berhasil diterima`,
    });
  } catch (err: any) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    return errorResponse("INTERNAL_SERVER_ERROR", safeErrorMessage(err, "Gagal menerima semua peserta"), 500);
  }
}
