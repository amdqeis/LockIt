import { NextRequest } from "next/server";
import { z } from "zod";
import { authenticateTeacher } from "@/lib/middleware/auth";
import { prisma } from "@/lib/prisma";
import { successResponse, errorResponse, safeErrorMessage } from "@/lib/response";
import { AppError } from "@/lib/errors";
import { scheduleExamAutoEnd, executeExamEnd, cancelExamAutoEnd } from "@/lib/scheduler";
import { normalizeQuestionForDb } from "@/services/question-parser";
import { retrySerializable } from "@/lib/transaction-retry";

const statusSchema = z.object({
  status: z.enum(["draft", "active", "ended", "archived"]),
  questions: z.array(z.any()).optional(),
  bankId: z.string().optional(),
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

    if (!exam) {
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
      if (!exam.classroomId || !exam.subjectId) {
        return errorResponse("VALIDATION_ERROR", "Ujian draf harus dilengkapi rombel dan mata pelajaran sebelum diaktifkan.", 400);
      }
      let questionCount = exam._count.questions;

      // If exam doesn't have questions yet but questions payload was provided, populate them
      if (questionCount === 0 && Array.isArray(parsed.data.questions) && parsed.data.questions.length > 0) {
        await prisma.$transaction(async (tx) => {
          const questionData = parsed.data.questions!.map((q, idx) => {
            const norm = normalizeQuestionForDb(q, idx);
            return {
              examId: id,
              orderIndex: norm.orderIndex,
              questionText: norm.questionText,
              content: norm.content === undefined ? undefined : norm.content as any,
              imageUrl: norm.imageUrl,
              imageAlt: norm.imageAlt,
              hint: norm.hint,
              hintContent: norm.hintContent === undefined ? undefined : norm.hintContent as any,
              type: norm.type || "single_choice",
              options: norm.options as any,
              correctAnswer: norm.correctAnswer,
              points: norm.points,
            };
          });
          await tx.question.createMany({ data: questionData });

          if (parsed.data.bankId) {
            const currentSettings = (typeof exam.settings === "object" && exam.settings !== null ? exam.settings : {}) as any;
            await tx.exam.update({
              where: { id },
              data: {
                settings: {
                  ...currentSettings,
                  bank_id: parsed.data.bankId,
                },
              },
            });
          }
        });
        questionCount = parsed.data.questions.length;
      }

      // Must have at least 1 question
      if (questionCount === 0) {
        return errorResponse("NO_QUESTIONS", "Ujian tidak dapat dimulai karena belum memiliki soal", 400);
      }

      const startTime = new Date();
      const endTime = new Date(startTime.getTime() + exam.durationMinutes * 60 * 1000);

      const updated = await retrySerializable(() => prisma.$transaction(async (tx) => {
        const claimed = await tx.exam.updateMany({
          where: { id, status: "draft" },
          data: { status: "active", startTime, endTime },
        });
        if (!claimed.count) return null;
        await tx.student.updateMany({
          where: { examId: id, status: "accepted", isLocked: false },
          data: { status: "active" },
        });
        return tx.exam.findUniqueOrThrow({ where: { id } });
      }, { isolationLevel: "Serializable" }));
      if (!updated) {
        const latest = await prisma.exam.findUnique({ where: { id } });
        if (latest?.status === "active" && latest.endTime && latest.endTime > new Date()) {
          return successResponse({ exam: latest, message: "Ujian sudah dimulai; waktu global tidak diubah." });
        }
        return errorResponse("INVALID_STATE", "Status ujian berubah sebelum dapat dimulai", 409);
      }

      const io = (globalThis as any).io;
      if (io) {
        try {
          io.of("/student-session").to(`exam:${id}`).emit("exam_started", {
            examId: id,
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
            durationMinutes: exam.durationMinutes,
          });
          io.of("/teacher-dashboard").to(`exam:${id}`).emit("exam_started", {
            examId: id,
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
          });
        } catch (socketErr) {
          console.error("Socket emit exam_started failed in status transition:", socketErr);
        }
      }

      // Schedule auto-end timer
      scheduleExamAutoEnd(updated.id, endTime, io);

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
