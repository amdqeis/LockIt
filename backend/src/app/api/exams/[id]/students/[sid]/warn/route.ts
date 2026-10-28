import { NextRequest } from "next/server";
import { z } from "zod";
import { authenticateTeacher } from "@/lib/middleware/auth";
import { prisma } from "@/lib/prisma";
import { successResponse, errorResponse, safeErrorMessage } from "@/lib/response";
import { AppError } from "@/lib/errors";

const warnSchema = z.object({
  message: z.string().min(1, "Pesan peringatan tidak boleh kosong").max(500),
});

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

    const body = await req.json().catch(() => null);
    if (!body) {
      return errorResponse("INVALID_BODY", "Request body harus berupa JSON", 400);
    }

    const parsed = warnSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Data pesan tidak valid", 400, parsed.error.flatten());
    }

    const { message } = parsed.data;

    // 1. Save warning in database
    const warning = await prisma.warning.create({
      data: {
        examId: id,
        studentId: sid,
        teacherId: teacher.teacherId,
        message,
      },
    });

    // 2. Emit direct warning notification to student's socket room
    const io = (globalThis as any).io;
    if (io) {
      try {
        io.of("/student-session").to(`student:${sid}`).emit("teacher_warning", {
          warningId: warning.id,
          message: warning.message,
          sentAt: warning.sentAt.toISOString(),
        });
      } catch (socketErr) {
        console.error("Socket emit warning failed:", socketErr);
      }
    }

    return successResponse({
      warningId: warning.id,
      sentAt: warning.sentAt.toISOString(),
      message: "Peringatan berhasil dikirim ke peserta",
    });
  } catch (err: any) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    return errorResponse("INTERNAL_SERVER_ERROR", safeErrorMessage(err, "Gagal mengirim peringatan"), 500);
  }
}
