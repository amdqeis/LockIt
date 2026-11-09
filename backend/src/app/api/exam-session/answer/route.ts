import { NextRequest } from "next/server";
import { z } from "zod";
import { authenticateStudent } from "@/lib/middleware/auth";
import { prisma } from "@/lib/prisma";
import { successResponse, errorResponse, safeErrorMessage } from "@/lib/response";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError } from "@/lib/errors";
import { validateChoiceAnswer } from "@/lib/student-answer";

const answerSchema = z.object({
  questionId: z.string().uuid("ID soal tidak valid"),
  selectedOption: z
    .string()
    .trim()
    .max(2000, "Jawaban terlalu panjang (maks. 2000 karakter)")
    .nullable()
    .optional(),
});

export async function POST(req: NextRequest) {
  try {
    const { student } = await authenticateStudent(req);
    const exam = student.exam;

    // Rate limiting: 60 requests per minute per student
    const rateLimit = checkRateLimit(student.id, {
      windowMs: 60 * 1000,
      max: 60,
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
    if (!["active", "disconnected"].includes(student.status)) {
      return errorResponse("EXAM_NOT_STARTED", "Peserta belum memulai ujian atau tidak lagi diizinkan mengerjakan.", 403);
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

    // Verify question belongs to this exam and check question type
    const question = await prisma.question.findUnique({
      where: { id: questionId },
      select: { examId: true, type: true, options: true },
    });

    if (!question || question.examId !== exam.id) {
      return errorResponse("QUESTION_NOT_FOUND", "Soal tidak ditemukan pada ujian ini", 404);
    }

    let cleanOption: string | null = null;
    if (selectedOption && selectedOption.trim().length > 0) {
      if (question.type === "short_answer") {
        // Soal jawaban singkat: simpan teks mentah siswa tanpa uppercase atau regex pilihan ganda
        cleanOption = selectedOption.trim();
      } else {
        const selection = validateChoiceAnswer(question.options, selectedOption, question.type === "multi_select");
        if (!selection.ok) return errorResponse("VALIDATION_ERROR", selection.message, 400);
        cleanOption = selection.value;
      }
    }

    const answer = await prisma.answer.upsert({
      where: {
        studentId_questionId: {
          studentId: student.id,
          questionId,
        },
      },
      update: {
        selectedOption: cleanOption,
        updatedAt: now,
      },
      create: {
        studentId: student.id,
        questionId,
        selectedOption: cleanOption,
        answeredAt: now,
      },
    });

    // Emit real-time answer progress to teacher dashboard
    const io = (globalThis as any).io;
    if (io) {
      try {
        const answeredCount = await prisma.answer.count({
          where: {
            studentId: student.id,
            selectedOption: { not: null },
            NOT: { selectedOption: "" },
          },
        });

        io.of("/teacher-dashboard").to(`exam:${exam.id}`).emit("student_answer_progress", {
          studentId: student.id,
          answeredCount,
        });
      } catch (socketErr) {
        console.error("Socket emit failed on student answer:", socketErr);
      }
    }

    return successResponse({
      questionId: answer.questionId,
      selectedOption: answer.selectedOption,
      savedAt: answer.updatedAt.toISOString(),
    });
  } catch (err: any) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    return errorResponse("INTERNAL_SERVER_ERROR", safeErrorMessage(err, "Gagal menyimpan jawaban"), 500);
  }
}
