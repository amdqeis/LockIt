import { NextRequest } from "next/server";
import { z } from "zod";
import { authenticateStudent } from "@/lib/middleware/auth";
import { prisma } from "@/lib/prisma";
import { successResponse, errorResponse } from "@/lib/response";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError } from "@/lib/errors";

const answerSchema = z.object({
  questionId: z.string().uuid("ID soal tidak valid"),
  selectedOption: z.string().max(2).nullable(),
});

export async function POST(req: NextRequest) {
  try {
    const { student } = await authenticateStudent(req);
    const exam = student.exam;

    // Rate limiting: 30 requests per minute per student
    const rateLimit = checkRateLimit(student.id, {
      windowMs: 60 * 1000,
      max: 30,
      keyPrefix: "exam:answer",
    });

    if (!rateLimit.success) {
      return errorResponse("TOO_MANY_REQUESTS", "Terlalu sering menyimpan jawaban. Coba beberapa saat lagi.", 429);
    }

    // STRICT VALIDATION (SEC-06)
    if (exam.status !== "active") {
      return errorResponse("EXAM_NOT_ACTIVE", "Ujian tidak sedang dalam status aktif", 403);
    }

    const now = new Date();
    if (exam.endTime && now > exam.endTime) {
      return errorResponse("EXAM_TIME_EXPIRED", "Waktu ujian telah berakhir", 403);
    }

    if (student.status === "submitted") {
      return errorResponse("ALREADY_SUBMITTED", "Ujian telah selesai dikumpulkan, jawaban tidak dapat diubah", 403);
    }

    if (student.isLocked) {
      return errorResponse("STUDENT_LOCKED", "Sesi Anda sedang terkunci karena pelanggaran. Hubungi pengawas.", 403);
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return errorResponse("INVALID_BODY", "Request body harus berupa JSON", 400);
    }

    const parsed = answerSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Data jawaban tidak valid", 400, parsed.error.flatten());
    }

    const { questionId, selectedOption } = parsed.data;

    // Verify question belongs to this exam
    const question = await prisma.question.findUnique({
      where: { id: questionId },
      select: { examId: true },
    });

    if (!question || question.examId !== exam.id) {
      return errorResponse("QUESTION_NOT_FOUND", "Soal tidak ditemukan pada ujian ini", 404);
    }

    const answer = await prisma.answer.upsert({
      where: {
        studentId_questionId: {
          studentId: student.id,
          questionId,
        },
      },
      update: {
        selectedOption: selectedOption ? selectedOption.toUpperCase() : null,
        updatedAt: now,
      },
      create: {
        studentId: student.id,
        questionId,
        selectedOption: selectedOption ? selectedOption.toUpperCase() : null,
        answeredAt: now,
      },
    });

    return successResponse({
      questionId: answer.questionId,
      selectedOption: answer.selectedOption,
      savedAt: answer.updatedAt.toISOString(),
    });
  } catch (err: any) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    return errorResponse("INTERNAL_SERVER_ERROR", err.message || "Gagal menyimpan jawaban", 500);
  }
}
