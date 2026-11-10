import { retrySerializable } from "@/lib/transaction-retry";
import { NextRequest } from "next/server";
import { z } from "zod";
import { authenticateStudent } from "@/lib/middleware/auth";
import { prisma } from "@/lib/prisma";
import { successResponse, errorResponse, safeErrorMessage } from "@/lib/response";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError } from "@/lib/errors";
import { isScreenshotDetectionEnabled, shouldIgnoreLegacyProctoringEvent, isViolation } from "@/lib/proctoring-events";

const eventTypeEnum = z.enum([
  "fullscreen_exit", "fullscreen_denied", "window_blur", "tab_switch", "copy_attempt", "paste_attempt",
  "right_click", "devtools", "reconnect", "heartbeat_lost", "ip_change", "screenshot",
]);
const proctoringEventSchema = z.object({
  eventType: eventTypeEnum,
  incidentId: z.string().uuid().optional(),
  timestamp: z.string().datetime().optional(),
  durationMs: z.number().int().nonnegative().optional(),
  metadata: z.record(z.any()).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const { student } = await authenticateStudent(req);
    const exam = student.exam;
    if (!["active", "disconnected"].includes(student.status)) return errorResponse("EXAM_NOT_ACTIVE", "Sesi proctoring tidak aktif", 403);
    const rateLimit = checkRateLimit(student.id, { windowMs: 60_000, max: 60, keyPrefix: "proctoring:single" });
    if (!rateLimit.success) return errorResponse("TOO_MANY_REQUESTS", "Terlalu banyak pengiriman event", 429);
    if (student.status === "submitted") return errorResponse("ALREADY_SUBMITTED", "Ujian sudah selesai dikumpulkan", 400);
    const body = await req.json().catch(() => null);
    if (!body) return errorResponse("INVALID_BODY", "Request body harus berupa JSON", 400);
    const parsed = proctoringEventSchema.safeParse(body);
    if (!parsed.success) return errorResponse("VALIDATION_ERROR", "Data event tidak valid", 400, parsed.error.flatten());
    const { eventType, incidentId, timestamp, durationMs, metadata } = parsed.data;
    if (shouldIgnoreLegacyProctoringEvent(eventType, metadata)) {
      return successResponse({ eventId: null, ignored: true, violationCount: student.violationCount, violationCycleCount: student.violationCycleCount, isLocked: student.isLocked });
    }

    const idempotencyKey = incidentId || crypto.randomUUID();
    const policy = (exam.violationPolicy && typeof exam.violationPolicy === "object" ? exam.violationPolicy : {}) as Record<string, unknown>;
    const maxViolations = typeof policy.max_violations === "number" && policy.max_violations > 0 ? policy.max_violations : 3;
    const policyAction = typeof policy.action === "string" ? policy.action : "lock";
    let result;
    try {
      result = await retrySerializable(() => prisma.$transaction(async (tx) => {
        const current = await tx.student.findUniqueOrThrow({ where: { id: student.id } });
        const event = await tx.proctoringEvent.create({ data: {
          studentId: student.id, examId: exam.id, eventType, incidentId: idempotencyKey,
          timestamp: timestamp ? new Date(timestamp) : new Date(), durationMs: durationMs || null,
          metadata: metadata ? metadata as any : undefined,
        } });
        const counts = !current.isLocked && isViolation(eventType, policy) ? 1 : 0;
        const cycleCount = current.violationCycleCount + counts;
        const screenshotLock = !current.isLocked && eventType === "screenshot" && isScreenshotDetectionEnabled(policy);
        const shouldLock = !current.isLocked && (screenshotLock || (counts > 0 && cycleCount >= maxViolations && policyAction === "lock"));
        const shouldRequireRecovery = !current.isLocked && !shouldLock && (current.recoveryRequired || cycleCount >= 2);
        const updated = counts || shouldLock || (shouldRequireRecovery !== current.recoveryRequired)
          ? await tx.student.update({ where: { id: student.id }, data: {
              violationCount: { increment: counts },
              violationCycleCount: { increment: counts },
              ...(shouldLock ? { isLocked: true } : {}),
              ...(shouldRequireRecovery ? { recoveryRequired: true } : {}),
            } })
          : current;
        return { event, updated, screenshotLock };
      }, { isolationLevel: "Serializable" }));
    } catch (err: any) {
      if (incidentId && err?.code === "P2002") {
        const [existing, current] = await Promise.all([
          prisma.proctoringEvent.findFirst({ where: { studentId: student.id, incidentId } }),
          prisma.student.findUniqueOrThrow({ where: { id: student.id } }),
        ]);
        let finalStudent = current;
        let screenshotLock = false;
        if (!current.isLocked && eventType === "screenshot" && isScreenshotDetectionEnabled(policy)) {
          finalStudent = await prisma.student.update({
            where: { id: student.id },
            data: { isLocked: true },
          });
          screenshotLock = true;
          const io = (globalThis as any).io;
          io?.of("/teacher-dashboard").to(`exam:${exam.id}`).emit("screenshot_detected", {
            studentId: student.id, name: student.name, nisn: student.nisn, timestamp: new Date().toISOString(), violationCount: finalStudent.violationCount,
          });
          io?.of("/student-session").to(`student:${student.id}`).emit("student_locked", {
            message: "Shortcut screenshot terdeteksi dan sesi dikunci.",
            isLocked: true, violationCycleCount: finalStudent.violationCycleCount,
          });
        }
        return successResponse({
          eventId: existing?.id ?? null,
          duplicate: true,
          violationCount: finalStudent.violationCount,
          violationCycleCount: finalStudent.violationCycleCount,
          recoveryRequired: finalStudent.recoveryRequired,
          isLocked: finalStudent.isLocked,
          screenshotEnforced: screenshotLock,
        });
      }
      throw err;
    }

    const io = (globalThis as any).io;
    if (eventType !== "screenshot" || result.screenshotLock) {
      io?.of("/teacher-dashboard").to(`exam:${exam.id}`).emit("student_violation", {
        studentId: student.id, name: student.name, nisn: student.nisn,
        violationCount: result.updated.violationCount, violationCycleCount: result.updated.violationCycleCount,
        recoveryRequired: result.updated.recoveryRequired,
        isLocked: result.updated.isLocked,
        event: { id: result.event.id, incidentId: result.event.incidentId, eventType: result.event.eventType, timestamp: result.event.timestamp.toISOString(), durationMs: result.event.durationMs, metadata: result.event.metadata },
      });
    }
    if (result.screenshotLock) io?.of("/teacher-dashboard").to(`exam:${exam.id}`).emit("screenshot_detected", {
      studentId: student.id, name: student.name, nisn: student.nisn, timestamp: result.event.timestamp.toISOString(), violationCount: result.updated.violationCount,
    });
    if (result.updated.isLocked && !student.isLocked) io?.of("/student-session").to(`student:${student.id}`).emit("student_locked", {
      message: result.screenshotLock ? "Shortcut screenshot terdeteksi dan sesi dikunci." : "Batas pelanggaran tercapai dan sesi dikunci.",
      isLocked: true, violationCycleCount: result.updated.violationCycleCount,
    });
    return successResponse({
      eventId: result.event.id,
      incidentId: idempotencyKey,
      violationCount: result.updated.violationCount,
      violationCycleCount: result.updated.violationCycleCount,
      recoveryRequired: result.updated.recoveryRequired,
      isLocked: result.updated.isLocked,
      screenshotEnforced: result.screenshotLock,
    });
  } catch (err: any) {
    if (err instanceof AppError) return errorResponse(err.code, err.message, err.statusCode, err.details);
    return errorResponse("INTERNAL_SERVER_ERROR", safeErrorMessage(err, "Gagal mencatat event proctoring"), 500);
  }
}
