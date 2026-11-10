import { NextRequest } from "next/server";
import { z } from "zod";
import { authenticateTeacher } from "@/lib/middleware/auth";
import { prisma } from "@/lib/prisma";
import { successResponse, errorResponse, safeErrorMessage } from "@/lib/response";
import { AppError } from "@/lib/errors";

const kickSchema = z.object({
  reason: z.string().trim().max(200).optional(),
});

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

    const student = await prisma.student.findUnique({
      where: { id: sid },
    });

    if (!student || student.examId !== id) {
      return errorResponse("NOT_FOUND", "Data peserta tidak ditemukan di ujian ini", 404);
    }

    const body = await req.json().catch(() => ({}));
    const parsed = kickSchema.safeParse(body);
    const reason = (parsed.success && parsed.data.reason) ? parsed.data.reason : "Dikeluarkan oleh pengawas ujian";

    const updated = await prisma.student.update({
      where: { id: sid },
      data: {
        status: "kicked",
        kickedAt: new Date(),
        kickReason: reason,
        sessionTokenHash: "", // Invalidate student session
      },
    });

    const io = (globalThis as any).io;
    if (io) {
      try {
        io.of("/student-session").to(`student:${sid}`).emit("student_kicked", {
          reason,
        });
        io.of("/teacher-dashboard").to(`exam:${id}`).emit("student_status_changed", {
          studentId: sid,
          status: "kicked",
          reason,
          name: updated.name,
          nisn: updated.nisn,
        });
      } catch (socketErr) {
        console.error("Socket emit kick failed:", socketErr);
      }
    }

    return successResponse({
      studentId: updated.id,
      status: updated.status,
      reason,
      message: "Peserta berhasil dikeluarkan",
    });
  } catch (err: any) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    return errorResponse("INTERNAL_SERVER_ERROR", safeErrorMessage(err, "Gagal mengeluarkan peserta"), 500);
  }
}
