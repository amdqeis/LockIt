import { NextRequest } from "next/server";
import { z } from "zod";
import { authenticateStudent } from "@/lib/middleware/auth";
import { prisma } from "@/lib/prisma";
import { successResponse, errorResponse, safeErrorMessage } from "@/lib/response";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError } from "@/lib/errors";
import { isScreenshotDetectionEnabled, shouldIgnoreLegacyProctoringEvent } from "@/lib/proctoring-events";

const eventTypeEnum = z.enum([
  "fullscreen_exit", "fullscreen_denied", "window_blur", "tab_switch", "copy_attempt", "paste_attempt",
  "right_click", "devtools", "reconnect", "heartbeat_lost", "ip_change", "screenshot",
]);
const eventSchema = z.object({
  eventType: eventTypeEnum,
  incidentId: z.string().uuid().optional(),
  timestamp: z.string().datetime().optional(),
  durationMs: z.number().int().nonnegative().optional(),
  metadata: z.record(z.any()).optional(),
});
const batchEventSchema = z.object({ events: z.array(eventSchema).min(1).max(100) });

function isViolation(eventType: string, policy: Record<string, unknown>) {
  switch (eventType) {
    case "right_click": return policy.detect_right_click !== false;
    case "devtools": return policy.detect_devtools !== false;
    case "tab_switch":
    case "window_blur": return policy.detect_tab_switch !== false;
    case "fullscreen_exit": return policy.detect_fullscreen_exit !== false;
    case "fullscreen_denied": return false;
    case "screenshot": return isScreenshotDetectionEnabled(policy);
    case "ip_change": return policy.detect_ip_change !== false;
    default: return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { student } = await authenticateStudent(req);
    const exam = student.exam;
    if (!["active", "disconnected"].includes(student.status)) return errorResponse("EXAM_NOT_ACTIVE", "Sesi proctoring tidak aktif", 403);
    const rateLimit = checkRateLimit(student.id, { windowMs: 60_000, max: 10, keyPrefix: "proctoring:batch" });
    if (!rateLimit.success) return errorResponse("TOO_MANY_REQUESTS", "Terlalu sering mengirim batch event", 429);
    const body = await req.json().catch(() => null);
    if (!body) return errorResponse("INVALID_BODY", "Request body harus berupa JSON", 400);
    const parsed = batchEventSchema.safeParse(body);
    if (!parsed.success) return errorResponse("VALIDATION_ERROR", "Data batch event tidak valid", 400, parsed.error.flatten());

    const accepted = parsed.data.events.filter((event) => !shouldIgnoreLegacyProctoringEvent(event.eventType, event.metadata));
    if (!accepted.length) return successResponse({ insertedCount: 0, ignoredCount: parsed.data.events.length, violationCount: student.violationCount, violationCycleCount: student.violationCycleCount, isLocked: student.isLocked });
    const withIds = accepted.map((event) => ({ ...event, incidentId: event.incidentId || crypto.randomUUID() }));
    const uniqueById = new Map(withIds.map((event) => [event.incidentId, event]));
    const candidateEvents = [...uniqueById.values()];
    const policy = (exam.violationPolicy && typeof exam.violationPolicy === "object" ? exam.violationPolicy : {}) as Record<string, unknown>;
    const maxViolations = typeof policy.max_violations === "number" && policy.max_violations > 0 ? policy.max_violations : 3;
    const policyAction = typeof policy.action === "string" ? policy.action : "lock";

    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.student.findUniqueOrThrow({ where: { id: student.id } });
      const existing = await tx.proctoringEvent.findMany({
        where: { studentId: student.id, incidentId: { in: candidateEvents.map((event) => event.incidentId) } },
        select: { incidentId: true },
      });
      const existingIds = new Set(existing.map((event) => event.incidentId));
      const freshEvents = candidateEvents.filter((event) => !existingIds.has(event.incidentId));
      if (!freshEvents.length) return { insertedCount: 0, current, freshEvents: [] as typeof freshEvents };

      const created = await tx.proctoringEvent.createMany({
        data: freshEvents.map((event) => ({
          studentId: student.id, examId: exam.id, eventType: event.eventType, incidentId: event.incidentId,
          timestamp: event.timestamp ? new Date(event.timestamp) : new Date(), durationMs: event.durationMs || null,
          metadata: event.metadata ? event.metadata as any : undefined,
        })),
        skipDuplicates: true,
      });
      if (created.count !== freshEvents.length) throw new Error("PROCTORING_INCIDENT_RACE");

      const counts = !current.isLocked ? freshEvents.filter((event) => isViolation(event.eventType, policy)).length : 0;
      const cycleCount = current.violationCycleCount + counts;
      const screenshotLock = !current.isLocked && freshEvents.some((event) => event.eventType === "screenshot") && isScreenshotDetectionEnabled(policy);
      const shouldLock = !current.isLocked && (screenshotLock || (counts > 0 && cycleCount >= maxViolations && policyAction === "lock"));
      const updated = counts || shouldLock
        ? await tx.student.update({ where: { id: student.id }, data: {
            violationCount: { increment: counts }, violationCycleCount: { increment: counts }, ...(shouldLock ? { isLocked: true } : {}),
          } })
        : current;
      return { insertedCount: created.count, current: updated, freshEvents };
    }, { isolationLevel: "Serializable" });

    if (result.insertedCount) {
      const io = (globalThis as any).io;
      io?.of("/teacher-dashboard").to(`exam:${exam.id}`).emit("student_violation_batch", {
        studentId: student.id, name: student.name, nisn: student.nisn,
        violationCount: result.current.violationCount, violationCycleCount: result.current.violationCycleCount,
        isLocked: result.current.isLocked, eventsCount: result.insertedCount,
      });
      for (const event of result.freshEvents) {
        if (event.eventType === "screenshot" && isScreenshotDetectionEnabled(policy)) {
          io?.of("/teacher-dashboard").to(`exam:${exam.id}`).emit("screenshot_detected", {
            studentId: student.id, name: student.name, nisn: student.nisn,
            timestamp: event.timestamp || new Date().toISOString(), violationCount: result.current.violationCount,
          });
        }
      }
    }
    return successResponse({
      insertedCount: result.insertedCount,
      ignoredCount: parsed.data.events.length - accepted.length,
      violationCount: result.current.violationCount,
      violationCycleCount: result.current.violationCycleCount,
      isLocked: result.current.isLocked,
    });
  } catch (err: any) {
    if (err instanceof AppError) return errorResponse(err.code, err.message, err.statusCode, err.details);
    return errorResponse("INTERNAL_SERVER_ERROR", safeErrorMessage(err, "Gagal mencatat batch proctoring event"), 500);
  }
}
