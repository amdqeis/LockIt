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
    if (!exam) {
      return errorResponse("NOT_FOUND", "Ujian tidak ditemukan", 404);
    }
    if (!["draft", "active"].includes(exam.status) || (exam.endTime && exam.endTime <= new Date())) return errorResponse("INVALID_STATE", "Ujian tidak menerima peserta saat ini", 409);

    const student = await prisma.student.findUnique({
      where: { id: sid },
    });

    if (!student || student.examId !== id) {
      return errorResponse("NOT_FOUND", "Data peserta tidak ditemukan di ujian ini", 404);
    }

    const decision = await prisma.$transaction(async (tx) => {
      const currentExam = await tx.exam.findUnique({ where: { id }, select: { status: true, startTime: true, endTime: true } });
      if (!currentExam || (currentExam.status !== "draft" && currentExam.status !== "active") || (currentExam.endTime && currentExam.endTime <= new Date())) return null;
      const status = currentExam.status === "active" ? "active" as const : "accepted" as const;
      const changed = await tx.student.updateMany({
        where: { id: sid, examId: id, status: "waiting" },
        data: { status, acceptedAt: new Date() },
      });
      if (!changed.count) return false;
      await tx.admissionHistory.create({ data: { studentId: sid, teacherId: teacher.teacherId, action: "approved" } });
      return { status, startTime: currentExam.startTime, endTime: currentExam.endTime };
    }, { isolationLevel: "Serializable" });
    if (decision === null) return errorResponse("INVALID_STATE", "Ujian tidak menerima peserta saat ini", 409);
    if (!decision) return errorResponse("INVALID_STATE", "Hanya peserta yang menunggu dapat diterima", 409);
    const updated = { ...student, status: decision.status };

    const io = (globalThis as any).io;
    if (io) {
      try {
        io.of("/student-session").to(`student:${sid}`).emit("student_accepted", {
          message: decision.status === "active" ? "Kamu telah diterima. Ujian sedang berlangsung." : "Kamu telah diterima oleh pengawas. Menunggu ujian dimulai.",
          status: decision.status,
          startTime: decision.startTime?.toISOString() ?? null,
          endTime: decision.endTime?.toISOString() ?? null,
        });
        io.of("/teacher-dashboard").to(`exam:${id}`).emit("student_status_changed", {
          studentId: sid,
          status: decision.status,
          name: updated.name,
          nisn: updated.nisn,
        });
      } catch (socketErr) {
        console.error("Socket emit accept failed:", socketErr);
      }
    }

    return successResponse({
      studentId: updated.id,
      status: decision.status,
      startTime: decision.startTime?.toISOString() ?? null,
      endTime: decision.endTime?.toISOString() ?? null,
      message: decision.status === "active" ? "Peserta diterima langsung ke ujian yang sedang berlangsung" : "Peserta disetujui dan menunggu ujian dimulai",
    });
  } catch (err: any) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    return errorResponse("INTERNAL_SERVER_ERROR", safeErrorMessage(err, "Gagal menerima peserta"), 500);
  }
}
