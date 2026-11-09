import { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { authenticateStudent } from "@/lib/middleware/auth";
import { prisma } from "@/lib/prisma";
import { successResponse, errorResponse, safeErrorMessage } from "@/lib/response";
import { AppError } from "@/lib/errors";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const { student } = await authenticateStudent(req);
    const exam = student.exam;

    // HIGH-06: Rate limit heartbeat — normal setiap 10-30 detik (max 10/menit),
    // saat status terkunci izinkan frekuensi lebih tinggi (max 45/menit) untuk deteksi unblock instan
    const rateLimit = checkRateLimit(student.id, {
      windowMs: 60 * 1000,
      max: student.isLocked ? 45 : 10,
      keyPrefix: "heartbeat",
    });

    if (!rateLimit.success) {
      // Kembalikan data heartbeat standar tanpa error agar siswa tidak bingung,
      // tapi abaikan proses DB untuk mencegah abuse
      return successResponse({
        studentId: student.id,
        status: student.status,
        isLocked: student.isLocked,
        isExamActive: exam.status === "active",
        serverTime: new Date().toISOString(),
      });
    }

    const now = new Date();
    const [currentStudent, currentExam] = await Promise.all([
      prisma.student.findUniqueOrThrow({ where: { id: student.id }, select: { status: true, isLocked: true } }),
      prisma.exam.findUnique({ where: { id: exam.id }, select: { status: true, endTime: true } }),
    ]);
    const isExamActive = currentExam?.status === "active" && (!currentExam.endTime || now <= currentExam.endTime);
    let currentIsLocked = currentStudent.isLocked;
    let currentStatus = currentStudent.status;

    // Catat perubahan IP sekali, dan gunakan siklus yang sama dengan event proctoring lain.
    const clientIp = getClientIp(req.headers);
    if (clientIp && clientIp !== "unknown" && isExamActive && ["active", "disconnected"].includes(student.status)) {
      const policy = (exam.violationPolicy && typeof exam.violationPolicy === "object" ? exam.violationPolicy : {}) as Record<string, unknown>;
      const maxViolations = typeof policy.max_violations === "number" && policy.max_violations > 0 ? policy.max_violations : 3;
      const policyAction = typeof policy.action === "string" ? policy.action : "lock";
      const ipChange = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const current = await tx.student.findUniqueOrThrow({ where: { id: student.id } });
        if (current.ipAddress === clientIp) return null;
        const counts = Boolean(current.ipAddress) && policy.detect_ip_change !== false && !current.isLocked;
        const nextCycle = current.violationCycleCount + (counts ? 1 : 0);
        const shouldLock = counts && nextCycle >= maxViolations && policyAction === "lock";
        const changed = await tx.student.updateMany({
          where: { id: student.id, ipAddress: current.ipAddress },
          data: {
            ipAddress: clientIp,
            ...(counts ? { violationCount: { increment: 1 }, violationCycleCount: { increment: 1 } } : {}),
            ...(shouldLock ? { isLocked: true } : {}),
          },
        });
        if (!changed.count) return null;
        const event = current.ipAddress ? await tx.proctoringEvent.create({
          data: {
            studentId: student.id, examId: exam.id, eventType: "ip_change",
            metadata: { oldIp: current.ipAddress, newIp: clientIp, detectedVia: "heartbeat" },
          },
        }) : null;
        const updated = await tx.student.findUniqueOrThrow({ where: { id: student.id } });
        return { event, student: updated, shouldLock };
      }, { isolationLevel: "Serializable" });
      if (ipChange) {
        currentIsLocked = ipChange.student.isLocked;
        if (ipChange.event) {
          const io = (globalThis as any).io;
          io?.of("/teacher-dashboard").to(`exam:${exam.id}`).emit("student_violation", {
            studentId: student.id, name: student.name, nisn: student.nisn,
            violationCount: ipChange.student.violationCount,
            violationCycleCount: ipChange.student.violationCycleCount,
            isLocked: ipChange.student.isLocked,
            event: { id: ipChange.event.id, eventType: "ip_change", timestamp: ipChange.event.timestamp.toISOString(), metadata: ipChange.event.metadata },
          });
        }
        if (ipChange.shouldLock) {
          const io = (globalThis as any).io;
          io?.of("/student-session").to(`student:${student.id}`).emit("student_locked", {
            message: "Batas pelanggaran tercapai dan sesi dikunci.", isLocked: true,
            violationCycleCount: ipChange.student.violationCycleCount,
          });
        }
      }
    }

    if (currentStudent.status === "disconnected" && isExamActive) {
      const restored = await prisma.student.updateMany({
        where: { id: student.id, examId: exam.id, status: "disconnected" },
        data: { status: "active" },
      });
      if (restored.count) currentStatus = "active";

      // Notify Teacher dashboard that student reconnected via HTTP heartbeat
      const io = (globalThis as any).io;
      if (io && restored.count) {
        try {
          io.of("/teacher-dashboard").to(`exam:${exam.id}`).emit("student_presence", {
            studentId: student.id,
            name: student.name,
            nisn: student.nisn,
            status: "active",
            lastSeen: now.toISOString(),
          });
        } catch (socketErr) {
          console.error("Socket emit failed on heartbeat:", socketErr);
        }
      }
    }

    // Cek pesan peringatan belum dibaca dari guru (Item 9b)
    const latestWarning = await prisma.warning.findFirst({
      where: { studentId: student.id, isRead: false },
      orderBy: { sentAt: "desc" },
    });

    return successResponse({
      studentId: student.id,
      status: currentStatus,
      isLocked: currentIsLocked,
      isExamActive,
      serverTime: now.toISOString(),
      warning: latestWarning
        ? {
            id: latestWarning.id,
            message: latestWarning.message,
            sentAt: latestWarning.sentAt.toISOString(),
          }
        : null,
    });
  } catch (err: any) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    return errorResponse("INTERNAL_SERVER_ERROR", safeErrorMessage(err, "Gagal memperbarui sinyal kehadiran"), 500);
  }
}
