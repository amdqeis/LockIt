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

    const now = new Date();

    // 1. Update Student status to submitted
    const updatedStudent = await prisma.student.update({
      where: { id: student.id },
      data: {
        status: "submitted",
        submittedAt: now,
      },
    });

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
        io.of("/teacher-dashboard").to(`exam:${exam.id}`).emit("student_submitted", {
          studentId: student.id,
          name: student.name,
          nim: student.nim,
          submittedAt: now.toISOString(),
          score: scoreSummary?.finalScore ?? null,
        });
      } catch (socketErr) {
        console.error("Socket emit failed on student submit:", socketErr);
      }
    }

    const response = successResponse({
      message: "Ujian berhasil dikumpulkan. Terima kasih telah mengerjakan!",
      studentId: updatedStudent.id,
      submittedAt: now.toISOString(),
    });

    // Clear student session cookie
    response.cookies.delete("studentSession");

    return response;
  } catch (err: any) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    return errorResponse("INTERNAL_SERVER_ERROR", safeErrorMessage(err, "Gagal mengumpulkan ujian"), 500);
  }
}
