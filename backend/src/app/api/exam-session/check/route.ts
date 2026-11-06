import { NextRequest } from "next/server";
import { authenticateStudent } from "@/lib/middleware/auth";
import { successResponse, errorResponse, safeErrorMessage } from "@/lib/response";
import { AppError } from "@/lib/errors";

/**
 * GET /api/exam-session/check
 *
 * Periksa apakah request membawa studentSession cookie yang masih valid.
 * Digunakan oleh halaman-halaman publik (/join, /) untuk mendeteksi sesi ujian
 * yang sedang berlangsung dan menawarkan auto-resume kepada siswa.
 *
 * Selalu mengembalikan HTTP 200 — error dikodekan di dalam body { isActive: false }.
 * Ini memudahkan frontend agar tidak perlu catch error untuk kasus "tidak ada sesi".
 */
export async function GET(req: NextRequest) {
  try {
    const { student } = await authenticateStudent(req, { skipSubmittedCheck: true });
    const exam = student.exam;
    const now = new Date();

    const examSettings = (typeof exam.settings === "object" && exam.settings !== null ? exam.settings : {}) as any;
    const showScoreToStudent = examSettings.show_score_to_student !== false;
    const allowAnswerReview = examSettings.allow_answer_review === true;

    // Siswa sudah submit — sesi berakhir
    if (student.status === "submitted") {
      return successResponse({
        isActive: false,
        reason: "submitted" as const,
        studentName: student.name,
        studentNisn: student.nisn,
        examTitle: exam.title,
        showScoreToStudent,
        allowAnswerReview,
      });
    }

    // Ujian sudah selesai
    if (exam.status === "ended" || exam.status === "archived") {
      return successResponse({ isActive: false, reason: "exam_ended" as const });
    }

    // Ujian belum dimulai (draft) — sesi cookie sudah ada tapi ujian belum aktif
    if (exam.status === "draft") {
      return successResponse({ isActive: false, reason: "exam_not_started" as const });
    }

    // Waktu ujian habis
    if (exam.endTime && now > exam.endTime) {
      return successResponse({ isActive: false, reason: "time_expired" as const });
    }

    const timeLeftSeconds =
      exam.endTime
        ? Math.max(0, Math.floor((exam.endTime.getTime() - now.getTime()) / 1000))
        : null;

    return successResponse({
      isActive: true,
      isLocked: student.isLocked,
      studentId: student.id,
      studentName: student.name,
      studentNisn: student.nisn,
      examId: exam.id,
      examTitle: exam.title,
      examStatus: exam.status,
      endTime: exam.endTime?.toISOString() ?? null,
      timeLeftSeconds,
    });
  } catch (err: any) {
    // Token tidak ada / tidak valid / kedaluwarsa — bukan error server, cukup isActive: false
    if (err instanceof AppError && (err.statusCode === 401 || err.statusCode === 403)) {
      return successResponse({ isActive: false, reason: "no_session" as const });
    }
    // Error lain yang tidak terduga — tetap kembalikan isActive: false agar frontend tidak crash
    console.error("[exam-session/check] Unexpected error:", safeErrorMessage(err, "unknown"));
    return successResponse({ isActive: false, reason: "error" as const });
  }
}
