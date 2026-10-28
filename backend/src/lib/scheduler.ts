import { prisma } from "@/lib/prisma";
import { autoGradeExam } from "@/services/grading";
import { logger } from "@/lib/logger";

// In-memory registry of scheduled auto-end timers
const activeTimers = new Map<string, NodeJS.Timeout>();

export function scheduleExamAutoEnd(examId: string, endTime: Date, ioInstance?: any) {
  // Cancel any existing timer for this exam
  if (activeTimers.has(examId)) {
    clearTimeout(activeTimers.get(examId)!);
    activeTimers.delete(examId);
  }

  const delayMs = Math.max(0, endTime.getTime() - Date.now());

  const timer = setTimeout(async () => {
    try {
      logger.info(`Auto-ending exam`, { examId });
      await executeExamEnd(examId, ioInstance);
    } catch (err) {
      logger.error(`Error auto-ending exam`, { examId, err: String(err) });
    } finally {
      activeTimers.delete(examId);
    }
  }, delayMs);

  activeTimers.set(examId, timer);
  logger.info(`Scheduled auto-end for exam`, { examId, delaySeconds: Math.round(delayMs / 1000) });
}

export function cancelExamAutoEnd(examId: string) {
  if (activeTimers.has(examId)) {
    clearTimeout(activeTimers.get(examId)!);
    activeTimers.delete(examId);
    logger.info(`Cancelled auto-end timer`, { examId });
  }
}

export async function executeExamEnd(examId: string, ioInstance?: any) {
  const now = new Date();

  // 1. Update Exam status to 'ended'
  await prisma.exam.update({
    where: { id: examId },
    data: { status: "ended" },
  });

  // 2. Auto-submit all non-submitted students
  const unsubmittedStudents = await prisma.student.findMany({
    where: {
      examId,
      status: { not: "submitted" },
    },
  });

  if (unsubmittedStudents.length > 0) {
    await prisma.student.updateMany({
      where: {
        examId,
        status: { not: "submitted" },
      },
      data: {
        status: "submitted",
        submittedAt: now,
      },
    });
  }

  // 3. Trigger auto-grading batch for all students in the exam
  try {
    await autoGradeExam(examId);
  } catch (gradeErr) {
    logger.error(`Auto-grading failed`, { examId, err: String(gradeErr) });
  }

  // 4. Broadcast to Socket.IO if available
  if (ioInstance) {
    try {
      ioInstance.of("/teacher-dashboard").to(`exam:${examId}`).emit("exam_ended", {
        examId,
        endedAt: now.toISOString(),
      });
      ioInstance.of("/student-session").to(`exam:${examId}`).emit("exam_ended", {
        examId,
        message: "Waktu ujian telah berakhir. Jawaban Anda otomatis dikumpulkan.",
      });
    } catch (socketErr) {
      logger.error(`Socket broadcast error on exam end`, { examId, err: String(socketErr) });
    }
  }
}

// Reschedule all active exams on server boot
export async function rescheduleActiveExamsOnBoot(ioInstance?: any) {
  try {
    const activeExams = await prisma.exam.findMany({
      where: { status: "active" },
    });

    const now = Date.now();
    for (const exam of activeExams) {
      if (exam.endTime) {
        if (exam.endTime.getTime() <= now) {
          // Time already passed while server was down -> execute end immediately
          logger.warn(`Exam end time passed during downtime, ending now`, { examId: exam.id });
          await executeExamEnd(exam.id, ioInstance);
        } else {
          // Reschedule
          scheduleExamAutoEnd(exam.id, exam.endTime, ioInstance);
        }
      }
    }
  } catch (err) {
    logger.error(`Error rescheduling exams on boot`, { err: String(err) });
  }
}

// ─── MED-05: Cleanup expired/revoked refresh tokens ────────────────────────────
export async function cleanupExpiredTokens(): Promise<void> {
  try {
    const result = await prisma.refreshToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { isRevoked: true },
        ],
      },
    });
    if (result.count > 0) {
      logger.info(`Cleaned up expired/revoked refresh tokens`, { count: result.count });
    }
  } catch (err) {
    logger.error(`Error cleaning up refresh tokens`, { err: String(err) });
  }
}

// Jalankan cleanup setiap 6 jam
const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
if (typeof setInterval !== "undefined") {
  setInterval(cleanupExpiredTokens, SIX_HOURS_MS);
}

