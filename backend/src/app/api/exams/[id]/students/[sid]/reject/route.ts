import { NextRequest } from "next/server";
import { z } from "zod";
import { authenticateTeacher } from "@/lib/middleware/auth";
import { prisma } from "@/lib/prisma";
import { successResponse, errorResponse, safeErrorMessage } from "@/lib/response";
import { AppError } from "@/lib/errors";

const rejectSchema = z.object({ reason: z.string().trim().max(500).optional().default("") });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; sid: string }> }) {
  try {
    const teacher = await authenticateTeacher(req);
    const { id, sid } = await params;
    const body = await req.json().catch(() => ({}));
    const parsed = rejectSchema.safeParse(body);
    if (!parsed.success) return errorResponse("VALIDATION_ERROR", "Alasan penolakan tidak valid", 400, parsed.error.flatten());

    const exam = await prisma.exam.findUnique({ where: { id } });
    if (!exam) {
      return errorResponse("NOT_FOUND", "Ujian tidak ditemukan", 404);
    }
    if ((exam.status !== "draft" && exam.status !== "active") || (exam.endTime && exam.endTime <= new Date())) {
      return errorResponse("INVALID_STATE", "Ujian tidak menerima keputusan peserta saat ini", 409);
    }

    const student = await prisma.student.findFirst({ where: { id: sid, examId: id } });
    if (!student) return errorResponse("NOT_FOUND", "Data peserta tidak ditemukan di ujian ini", 404);
    if (student.status !== "waiting") return errorResponse("INVALID_STATE", "Hanya permintaan yang menunggu dapat ditolak", 409);

    const decision = await prisma.$transaction(async (tx) => {
      const currentExam = await tx.exam.findUnique({ where: { id }, select: { status: true, endTime: true } });
      if (!currentExam || (currentExam.status !== "draft" && currentExam.status !== "active") || (currentExam.endTime && currentExam.endTime <= new Date())) return "closed" as const;
      const changed = await tx.student.updateMany({
        where: { id: sid, examId: id, status: "waiting" },
        data: { status: "rejected" },
      });
      if (!changed.count) return "unchanged" as const;
      await tx.admissionHistory.create({
        data: { studentId: sid, teacherId: teacher.teacherId, action: "rejected", reason: parsed.data.reason || null },
      });
      return "rejected" as const;
    }, { isolationLevel: "Serializable" });
    if (decision === "closed") return errorResponse("INVALID_STATE", "Ujian tidak menerima keputusan peserta saat ini", 409);
    if (decision !== "rejected") return errorResponse("INVALID_STATE", "Hanya permintaan yang menunggu dapat ditolak", 409);

    const io = (globalThis as any).io;
    io?.of("/student-session").to(`student:${sid}`).emit("student_rejected", {
      reason: parsed.data.reason || null,
      message: parsed.data.reason || "Permintaan masuk belum disetujui. Anda dapat mengajukan ulang dengan kode yang sama.",
    });
    io?.of("/teacher-dashboard").to(`exam:${id}`).emit("student_status_changed", {
      studentId: sid, status: "rejected", name: student.name, nisn: student.nisn,
    });

    return successResponse({ studentId: sid, status: "rejected", reason: parsed.data.reason || null });
  } catch (err: any) {
    if (err instanceof AppError) return errorResponse(err.code, err.message, err.statusCode, err.details);
    return errorResponse("INTERNAL_SERVER_ERROR", safeErrorMessage(err, "Gagal menolak permintaan peserta"), 500);
  }
}
