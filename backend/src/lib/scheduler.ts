import { prisma } from "@/lib/prisma";
import { autoGradeExam } from "@/services/grading";

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
      console.log(`[Scheduler] Auto-ending exam ${examId}...`);
      await executeExamEnd(examId, ioInstance);
    } catch (err) {
      console.error(`[Scheduler] Error auto-ending exam ${examId}:`, err);
    } finally {
      activeTimers.delete(examId);
    }
  }, delayMs);

  activeTimers.set(examId, timer);
  console.log(`[Scheduler] Scheduled auto-end for exam ${examId} in ${Math.round(delayMs / 1000)} seconds.`);
}

export function cancelExamAutoEnd(examId: string) {
  if (activeTimers.has(examId)) {
    clearTimeout(activeTimers.get(examId)!);
    activeTimers.delete(examId);
    console.log(`[Scheduler] Cancelled auto-end timer for exam ${examId}.`);
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
    console.error(`[Scheduler] Auto-grading failed for exam ${examId}:`, gradeErr);
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
      console.error(`[Scheduler] Socket broadcast error:`, socketErr);
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
          console.log(`[Scheduler] Exam ${exam.id} end time passed during downtime. Ending now.`);
          await executeExamEnd(exam.id, ioInstance);
        } else {
          // Reschedule
          scheduleExamAutoEnd(exam.id, exam.endTime, ioInstance);
        }
      }
    }
  } catch (err) {
    console.error(`[Scheduler] Error rescheduling exams on boot:`, err);
  }
}
