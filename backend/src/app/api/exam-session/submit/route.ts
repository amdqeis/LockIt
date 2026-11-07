import { NextRequest } from "next/server";
import { authenticateStudent } from "@/lib/middleware/auth";
import { prisma } from "@/lib/prisma";
import { autoGradeStudent } from "@/services/grading";
import { successResponse, errorResponse, safeErrorMessage } from "@/lib/response";
import { AppError } from "@/lib/errors";

export async function POST(req: NextRequest) {
  try {
    const { student } = await authenticateStudent(req);
    const exam = student.exam;

    if (student.status === "submitted") {
      return errorResponse("ALREADY_SUBMITTED", "Ujian telah selesai dikumpulkan sebelumnya", 400);
    }
    if (!["active", "disconnected"].includes(student.status)) return errorResponse("EXAM_NOT_STARTED", "Peserta belum memulai ujian atau tidak lagi diizinkan mengumpulkan.", 403);
    if (student.isLocked) return errorResponse("STUDENT_LOCKED", "Sesi Anda terkunci. Hubungi pengawas.", 403);

    const now = new Date();

    // 1. Update Student status to submitted
    const updatedStudent = await prisma.student.updateMany({
      where: { id: student.id, status: { in: ["active", "disconnected"] }, isLocked: false },
      data: {
        status: "submitted",
        submittedAt: now,
      },
    });
    if (!updatedStudent.count) return errorResponse("INVALID_STATE", "Sesi berubah atau ujian sudah dikumpulkan", 409);

    // 2. Trigger auto-grading for this student immediately (RISK-14)
    let scoreSummary = null;
    try {
      scoreSummary = await autoGradeStudent(student.id);
    } catch (gradeErr) {
      console.error(`Auto-grading failed for student ${student.id}:`, gradeErr);
    }

    // 3. Notify Teacher dashboard via Socket.IO if available
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

        io.of("/teacher-dashboard").to(`exam:${exam.id}`).emit("student_submitted", {
          studentId: student.id,
          name: student.name,
          nisn: student.nisn,
          submittedAt: now.toISOString(),
          score: scoreSummary?.finalScore ?? null,
          pendingManualCount: scoreSummary?.pendingManualCount ?? null,
          answeredCount,
        });
      } catch (socketErr) {
        console.error("Socket emit failed on student submit:", socketErr);
      }
    }

    const examSettings = (typeof exam.settings === "object" && exam.settings !== null ? exam.settings : {}) as any;
    const showScoreToStudent = examSettings.show_score_to_student !== false;
    const allowAnswerReview = examSettings.allow_answer_review === true;

    const response = successResponse({
      message: "Ujian berhasil dikumpulkan. Terima kasih telah mengerjakan!",
      studentId: student.id,
      submittedAt: now.toISOString(),
      showScoreToStudent,
      allowAnswerReview,
      ...(showScoreToStudent && scoreSummary ? { score: scoreSummary.finalScore, pendingManualCount: scoreSummary.pendingManualCount } : {}),
    });

    // Pertahankan cookie studentSession agar request berikutnya (dan halaman /exam/done)
    // dapat mendeteksi via JWT bahwa siswa sudah menyelesaikan ujian ini (status: submitted)
    // dan menolak akses ulang ke pengerjaan soal.

    return response;
  } catch (err: any) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    return errorResponse("INTERNAL_SERVER_ERROR", safeErrorMessage(err, "Gagal mengumpulkan ujian"), 500);
  }
}
