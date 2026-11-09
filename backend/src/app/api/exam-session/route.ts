import { NextRequest } from "next/server";
import { authenticateStudent } from "@/lib/middleware/auth";
import { prisma } from "@/lib/prisma";
import { successResponse, errorResponse, safeErrorMessage } from "@/lib/response";
import { AppError } from "@/lib/errors";

// MED-02: Seed dikombinasikan dari NIM + examId untuk mencegah prediksi urutan
// berdasarkan NIM saja (NIM SMA seringkali berurutan dan mudah ditebak)
function pseudoRandomShuffle<T>(array: T[], seedStr: string, salt: string): T[] {
  const result = [...array];
  const combined = seedStr + "|" + salt;
  let seed = 0;
  for (let i = 0; i < combined.length; i++) {
    seed = (seed * 31 + combined.charCodeAt(i)) & 0xffffffff;
  }

  for (let i = result.length - 1; i > 0; i--) {
    seed = (seed * 1664525 + 1013904223) & 0xffffffff;
    const j = Math.abs(seed) % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export async function GET(req: NextRequest) {
  try {
    const { student } = await authenticateStudent(req);
    const exam = student.exam;

    if (exam.status !== "active") {
      return errorResponse("EXAM_NOT_ACTIVE", "Ujian tidak dalam status aktif", 400);
    }

    const now = new Date();
    if (exam.endTime && now > exam.endTime) {
      return errorResponse("EXAM_TIME_EXPIRED", "Waktu pengerjaan ujian telah berakhir", 400);
    }

    if (student.status === "submitted") {
      return errorResponse("ALREADY_SUBMITTED", "Ujian telah selesai dikumpulkan", 403);
    }

    if (student.status === "waiting" || student.status === "accepted" || student.status === "rejected") {
      return errorResponse("EXAM_NOT_STARTED", "Ujian belum dimulai oleh pengawas", 403);
    }

    if (student.status === "kicked") {
      return errorResponse("STUDENT_KICKED", `Kamu telah dikeluarkan dari ujian ini: ${student.kickReason || "oleh pengawas"}`, 403);
    }
    if (student.isLocked) return errorResponse("STUDENT_LOCKED", "Sesi Anda terkunci. Hubungi pengawas.", 403);

    // Parallel fetch: questions and student answers concurrently
    const [fetchedQuestions, answers] = await Promise.all([
      prisma.question.findMany({
        where: { examId: exam.id },
        orderBy: { orderIndex: "asc" },
        select: {
          id: true,
          orderIndex: true,
          type: true,
          questionText: true,
          content: true,
          imageUrl: true,
          imageAlt: true,
          hint: true,
          hintContent: true,
          options: true,
          points: true,
          // correctAnswer is intentionally excluded for security
        },
      }),
      prisma.answer.findMany({
        where: { studentId: student.id },
        select: {
          questionId: true,
          selectedOption: true,
          updatedAt: true,
        },
      }),
    ]);

    let questions = fetchedQuestions;

    const settings = (exam.settings as any) || {};
    if (settings.randomize_questions) {
      questions = pseudoRandomShuffle(questions, student.nisn, exam.id);
    }
    if (settings.randomize_choices) {
      questions = questions.map((q) => {
        if (Array.isArray(q.options) && q.options.length > 1) {
          return {
            ...q,
            options: pseudoRandomShuffle(q.options as any[], student.nisn, `${exam.id}-${q.id}`),
          };
        }
        return q;
      });
    }

    const totalQuestions = questions.length;
    let selectedQuestions = questions;
    let currentChunk = 1;
    let totalChunks = 1;
    let hasMore = false;

    const chunkParam = req.nextUrl.searchParams.get("chunk");
    const limitParam = req.nextUrl.searchParams.get("limit");
    const offsetParam = req.nextUrl.searchParams.get("offset");

    if (chunkParam === "1") {
      const half = Math.ceil(totalQuestions / 2);
      selectedQuestions = questions.slice(0, half);
      currentChunk = 1;
      totalChunks = totalQuestions > half ? 2 : 1;
      hasMore = totalChunks > 1;
    } else if (chunkParam === "2") {
      const half = Math.ceil(totalQuestions / 2);
      selectedQuestions = questions.slice(half);
      currentChunk = 2;
      totalChunks = 2;
      hasMore = false;
    } else if (limitParam) {
      const limit = Math.max(1, parseInt(limitParam, 10) || 10);
      const offset = Math.max(0, parseInt(offsetParam || "0", 10) || 0);
      selectedQuestions = questions.slice(offset, offset + limit);
      currentChunk = Math.floor(offset / limit) + 1;
      totalChunks = Math.ceil(totalQuestions / limit);
      hasMore = offset + limit < totalQuestions;
    }

    return successResponse({
      student: {
        id: student.id,
        name: student.name,
        nisn: student.nisn,
        isLocked: student.isLocked,
        violationCount: student.violationCount,
      },
      exam: {
        id: exam.id,
        title: exam.title,
        description: exam.description,
        durationMinutes: exam.durationMinutes,
        startTime: exam.startTime,
        endTime: exam.endTime,
        settings: exam.settings,
        violationPolicy: exam.violationPolicy,
      },
      questions: selectedQuestions,
      totalQuestions,
      chunk: currentChunk,
      totalChunks,
      hasMore,
      answers,
      serverTime: new Date().toISOString(),
    });
  } catch (err: any) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    return errorResponse("INTERNAL_SERVER_ERROR", safeErrorMessage(err, "Gagal memuat sesi ujian"), 500);
  }
}
