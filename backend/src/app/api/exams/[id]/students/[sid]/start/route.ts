import { NextRequest } from "next/server";
import { authenticateTeacher } from "@/lib/middleware/auth";
import { prisma } from "@/lib/prisma";
import { successResponse, errorResponse, safeErrorMessage } from "@/lib/response";
import { AppError } from "@/lib/errors";

// Legacy per-student action: it can only admit an already approved participant
// after the teacher has started the exam globally.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string; sid: string }> }) {
  try {
    const teacher = await authenticateTeacher(_req);
    const { id, sid } = await params;
    const exam = await prisma.exam.findUnique({ where: { id }, include: { _count: { select: { questions: true } } } });
    if (!exam || (teacher.role !== "ADMIN" && exam.teacherId !== teacher.teacherId)) return errorResponse("NOT_FOUND", "Ujian tidak ditemukan", 404);
    if (exam.status !== "active" || !exam.endTime || exam.endTime <= new Date()) return errorResponse("INVALID_STATE", "Mulai ujian secara global sebelum membuka sesi peserta", 409);
    if (exam._count.questions === 0) return errorResponse("NO_QUESTIONS", "Ujian belum memiliki soal", 400);

    const changed = await prisma.student.updateMany({
      where: { id: sid, examId: id, status: "accepted", isLocked: false },
      data: { status: "active" },
    });
    if (!changed.count) return errorResponse("INVALID_STATE", "Peserta harus disetujui dan tidak terkunci", 409);
    const student = await prisma.student.findUniqueOrThrow({ where: { id: sid } });
    const io = (globalThis as any).io;
    io?.of("/student-session").to(`student:${sid}`).emit("exam_started", {
      examId: id, studentId: sid, startTime: exam.startTime?.toISOString() ?? null, endTime: exam.endTime.toISOString(),
    });
    io?.of("/teacher-dashboard").to(`exam:${id}`).emit("student_status_changed", {
      studentId: sid, status: "active", name: student.name, nisn: student.nisn,
    });
    return successResponse({ studentId: student.id, status: student.status, startTime: exam.startTime, endTime: exam.endTime });
  } catch (err: any) {
    if (err instanceof AppError) return errorResponse(err.code, err.message, err.statusCode, err.details);
    return errorResponse("INTERNAL_SERVER_ERROR", safeErrorMessage(err, "Gagal membuka sesi peserta"), 500);
  }
}
