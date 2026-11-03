import { NextRequest } from "next/server";
import { authenticateStudent } from "@/lib/middleware/auth";
import { prisma } from "@/lib/prisma";
import { successResponse, errorResponse, safeErrorMessage } from "@/lib/response";
import { AppError } from "@/lib/errors";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const { student } = await authenticateStudent(req);
    const exam = student.exam;

    // HIGH-06: Rate limit heartbeat — normal setiap 10-30 detik, max 10/menit
    const rateLimit = checkRateLimit(student.id, {
      windowMs: 60 * 1000,
      max: 10,
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
    const isExamActive = exam.status === "active" && (!exam.endTime || now <= exam.endTime);
    let currentIsLocked = student.isLocked;

    // Deteksi IP Change mid-exam
    const clientIp = getClientIp(req.headers);
    if (clientIp && clientIp !== "unknown") {
      if (student.ipAddress && student.ipAddress !== clientIp) {
        const previousIp = student.ipAddress;
        
        // Catat proctoring event ip_change
        await prisma.proctoringEvent.create({
          data: {
            studentId: student.id,
            examId: exam.id,
            eventType: "ip_change",
            metadata: {
              oldIp: previousIp,
              newIp: clientIp,
              detectedVia: "heartbeat",
            },
          },
        });

        // Increment violation count if policy enables IP change detection
        const policy = (exam.violationPolicy as any) || {};
        if (policy.detect_ip_change !== false) {
          const maxViolations = policy.max_violations || 3;
          const policyAction = policy.action || "lock";

          const updatedStudent = await prisma.student.update({
            where: { id: student.id },
            data: {
              ipAddress: clientIp,
              violationCount: { increment: 1 },
            },
          });

          const shouldLock =
            updatedStudent.violationCount >= maxViolations &&
            policyAction === "lock" &&
            !updatedStudent.isLocked;

          if (shouldLock) {
            await prisma.student.update({
              where: { id: student.id },
              data: { isLocked: true },
            });
            currentIsLocked = true;
          }

          // Emit student_violation ke dashboard guru
          const io = (globalThis as any).io;
          if (io) {
            try {
              io.of("/teacher-dashboard").to(`exam:${exam.id}`).emit("student_violation", {
                studentId: student.id,
                name: student.name,
                nisn: student.nisn,
                violationCount: updatedStudent.violationCount,
                isLocked: currentIsLocked,
                event: {
                  eventType: "ip_change",
                  timestamp: now.toISOString(),
                  metadata: { oldIp: previousIp, newIp: clientIp, detectedVia: "heartbeat" },
                },
              });
            } catch (socketErr) {
              console.error("Socket emit failed on heartbeat ip_change:", socketErr);
            }
          }
        } else {
          await prisma.student.update({
            where: { id: student.id },
            data: { ipAddress: clientIp },
          });
        }
      } else if (!student.ipAddress) {
        await prisma.student.update({
          where: { id: student.id },
          data: { ipAddress: clientIp },
        });
      }
    }

    if (student.status === "disconnected" && isExamActive) {
      await prisma.student.update({
        where: { id: student.id },
        data: { status: "active" },
      });

      // Notify Teacher dashboard that student reconnected via HTTP heartbeat
      const io = (globalThis as any).io;
      if (io) {
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
      status: student.status,
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
