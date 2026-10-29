import { NextRequest } from "next/server";
import { z } from "zod";
import { authenticateTeacher } from "@/lib/middleware/auth";
import { prisma } from "@/lib/prisma";
import { successResponse, errorResponse, safeErrorMessage } from "@/lib/response";
import { AppError } from "@/lib/errors";
import { scheduleExamAutoEnd, executeExamEnd, cancelExamAutoEnd } from "@/lib/scheduler";

const statusSchema = z.object({
  status: z.enum(["draft", "active", "ended", "archived"]),
});

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const teacher = await authenticateTeacher(req);
    const { id } = await params;

    const exam = await prisma.exam.findUnique({
      where: { id },
      include: {
        _count: { select: { questions: true } },
      },
    });

    if (!exam || (teacher.role !== "ADMIN" && exam.teacherId !== teacher.teacherId)) {
      return errorResponse("NOT_FOUND", "Ujian tidak ditemukan", 404);
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return errorResponse("INVALID_BODY", "Request body harus berupa JSON", 400);
    }

    const parsed = statusSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Status tidak valid", 400, parsed.error.flatten());
    }

    const nextStatus = parsed.data.status;
    const currentStatus = exam.status;

    // Validate state machine transitions
    if (currentStatus === "draft" && nextStatus === "active") {
      // Must have at least 1 question
      if (exam._count.questions === 0) {
        return errorResponse("NO_QUESTIONS", "Ujian tidak dapat dimulai karena belum memiliki soal", 400);
      }

      const startTime = new Date();
      const endTime = new Date(startTime.getTime() + exam.durationMinutes * 60 * 1000);

      const updated = await prisma.exam.update({
        where: { id },
        data: {
          status: "active",
          startTime,
          endTime,
        },
      });

      // Schedule auto-end timer
      scheduleExamAutoEnd(updated.id, endTime, (globalThis as any).io);

      return successResponse({
        exam: updated,
        message: "Ujian berhasil dimulai",
      });
    }

    if (currentStatus === "active" && nextStatus === "ended") {
      // Manual end by teacher
      cancelExamAutoEnd(id);
      await executeExamEnd(id, (globalThis as any).io);

      const updated = await prisma.exam.findUnique({ where: { id } });
      return successResponse({
        exam: updated,
        message: "Ujian telah diakhiri",
      });
    }

    if (currentStatus === "ended" && nextStatus === "archived") {
      const updated = await prisma.exam.update({
        where: { id },
        data: { status: "archived" },
      });
      return successResponse({
        exam: updated,
        message: "Ujian berhasil diarsipkan",
      });
    }

    return errorResponse(
      "INVALID_TRANSITION",
      `Transisi status dari '${currentStatus}' ke '${nextStatus}' tidak diizinkan`,
      400
    );
  } catch (err: any) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    return errorResponse("INTERNAL_SERVER_ERROR", safeErrorMessage(err, "Gagal mengubah status ujian"), 500);
  }
}
