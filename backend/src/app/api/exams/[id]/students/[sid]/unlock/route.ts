import { NextRequest } from "next/server";
import { authenticateTeacher } from "@/lib/middleware/auth";
import { prisma } from "@/lib/prisma";
import { successResponse, errorResponse, safeErrorMessage } from "@/lib/response";
import { AppError } from "@/lib/errors";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; sid: string }> }) {
  try {
    const teacher = await authenticateTeacher(req);
    const { id, sid } = await params;
    const exam = await prisma.exam.findUnique({ where: { id } });
    if (!exam) return errorResponse("NOT_FOUND", "Ujian tidak ditemukan", 404);
    if (exam.status !== "active" || !exam.endTime || exam.endTime <= new Date()) return errorResponse("INVALID_STATE", "Peserta hanya dapat dibuka selama ujian berlangsung", 409);
    const student = await prisma.student.findFirst({ where: { id: sid, examId: id } });
    if (!student) return errorResponse("NOT_FOUND", "Data peserta tidak ditemukan di ujian ini", 404);
    if (!student.isLocked) return errorResponse("INVALID_STATE", "Peserta tidak sedang terkunci", 409);

    const unlocked = await prisma.$transaction(async (tx) => {
      const changed = await tx.student.updateMany({
        where: { id: sid, examId: id, isLocked: true },
        data: { isLocked: false, violationCycleCount: 0 },
      });
      if (!changed.count) return null;
      await tx.proctoringEvent.create({
        data: {
          studentId: sid, examId: id, eventType: "teacher_unlock",
          metadata: { teacherId: teacher.teacherId, previousCycleCount: student.violationCycleCount },
        },
      });
      return tx.student.findUniqueOrThrow({ where: { id: sid }, select: { id: true, isLocked: true, violationCount: true, violationCycleCount: true } });
    }, { isolationLevel: "Serializable" });
    if (!unlocked) return errorResponse("INVALID_STATE", "Peserta sudah dibuka oleh aksi lain", 409);

    const io = (globalThis as any).io;
    io?.of("/student-session").to(`student:${sid}`).emit("student_unlocked", {
      message: "Sesi ujian Anda telah dibuka kembali oleh pengawas.", violationCycleCount: 0,
    });
    io?.of("/teacher-dashboard").to(`exam:${id}`).emit("student_unlocked", {
      studentId: sid, isLocked: false, violationCycleCount: 0, violationCount: unlocked.violationCount,
    });
    return successResponse({ ...unlocked, message: "Kunci peserta dibuka. Hitungan siklus baru dimulai; total riwayat tetap tersimpan." });
  } catch (err: any) {
    if (err instanceof AppError) return errorResponse(err.code, err.message, err.statusCode, err.details);
    return errorResponse("INTERNAL_SERVER_ERROR", safeErrorMessage(err, "Gagal membuka kunci peserta"), 500);
  }
}
