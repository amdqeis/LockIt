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

    // Fetch questions
    let questions = await prisma.question.findMany({
      where: { examId: exam.id },
      orderBy: { orderIndex: "asc" },
      select: {
        id: true,
        orderIndex: true,
        questionText: true,
        imageUrl: true,
        options: true,
        points: true,
        // correctAnswer is intentionally excluded for security
      },
    });

    const settings = (exam.settings as any) || {};
    if (settings.randomize_questions) {
      questions = pseudoRandomShuffle(questions, student.nim, exam.id);
    }

    // Fetch existing answers of this student
    const answers = await prisma.answer.findMany({
      where: { studentId: student.id },
      select: {
        questionId: true,
        selectedOption: true,
        updatedAt: true,
      },
    });

    return successResponse({
      student: {
        id: student.id,
        name: student.name,
        nim: student.nim,
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
      questions,
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
