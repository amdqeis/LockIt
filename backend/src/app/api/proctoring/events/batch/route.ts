import { NextRequest } from "next/server";
import { z } from "zod";
import { authenticateStudent } from "@/lib/middleware/auth";
import { prisma } from "@/lib/prisma";
import { successResponse, errorResponse, safeErrorMessage } from "@/lib/response";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError } from "@/lib/errors";
import { isScreenshotDetectionEnabled, shouldIgnoreLegacyProctoringEvent } from "@/lib/proctoring-events";

const eventTypeEnum = z.enum([
  "fullscreen_exit",
  "fullscreen_denied",
  "window_blur",
  "tab_switch",
  "copy_attempt",
  "paste_attempt",
  "right_click",
  "devtools",
  "reconnect",
  "heartbeat_lost",
  "ip_change",
  "screenshot",
]);

const batchEventSchema = z.object({
  events: z
    .array(
      z.object({
        eventType: eventTypeEnum,
        timestamp: z.string().datetime().optional(),
        durationMs: z.number().int().nonnegative().optional(),
        metadata: z.record(z.any()).optional(),
      })
    )
    .min(1, "Minimal 1 event")
    .max(100, "Maksimal 100 event per batch"),
});

export async function POST(req: NextRequest) {
  try {
    const { student } = await authenticateStudent(req);
    const exam = student.exam;

    // Rate limit: 10 batch req/min per student
    const rateLimit = checkRateLimit(student.id, {
      windowMs: 60 * 1000,
      max: 10,
      keyPrefix: "proctoring:batch",
    });

    if (!rateLimit.success) {
      return errorResponse("TOO_MANY_REQUESTS", "Terlalu sering mengirim batch event", 429);
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return errorResponse("INVALID_BODY", "Request body harus berupa JSON", 400);
    }

    const parsed = batchEventSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Data batch event tidak valid", 400, parsed.error.flatten());
    }

    const { events } = parsed.data;
    const acceptedEvents = events.filter((event) => !shouldIgnoreLegacyProctoringEvent(event.eventType, event.metadata));
    if (acceptedEvents.length === 0) {
      return successResponse({
        insertedCount: 0,
        ignoredCount: events.length,
        violationCount: student.violationCount,
        isLocked: student.isLocked,
      });
    }

    // Save events in bulk
    await prisma.proctoringEvent.createMany({
      data: acceptedEvents.map((ev) => ({
        studentId: student.id,
        examId: exam.id,
        eventType: ev.eventType,
        timestamp: ev.timestamp ? new Date(ev.timestamp) : new Date(),
        durationMs: ev.durationMs || null,
        metadata: ev.metadata ? (ev.metadata as any) : undefined,
      })),
    });

    // Helper: evaluate if event counts as violation under exam policy
    const policy = (exam.violationPolicy as any) || {};
    const maxViolations = policy.max_violations || 3;
    const policyAction = policy.action || "lock";

    const isViolation = (eventType: string) => {
      switch (eventType) {
        case "copy_attempt":
        case "paste_attempt":
          return false;
        case "right_click":
          return policy.detect_right_click !== false;
        case "devtools":
          return policy.detect_devtools !== false;
        case "tab_switch":
        case "window_blur":
          return policy.detect_tab_switch !== false;
        case "fullscreen_exit":
        case "fullscreen_denied":
          return policy.detect_fullscreen_exit !== false;
        case "screenshot":
          return isScreenshotDetectionEnabled(policy);
        case "ip_change":
          return policy.detect_ip_change !== false;
        case "reconnect":
        case "heartbeat_lost":
        default:
          return false;
      }
    };

    const qualifyingViolationsCount = acceptedEvents.filter((ev) => isViolation(ev.eventType)).length;
    const screenshotEnabled = isScreenshotDetectionEnabled(policy);
    const hasScreenshotViolation = acceptedEvents.some((ev) => ev.eventType === "screenshot") && screenshotEnabled;

    const updatedStudent = qualifyingViolationsCount > 0
      ? await prisma.student.update({
          where: { id: student.id },
          data: {
            violationCount: { increment: qualifyingViolationsCount },
          },
        })
      : await prisma.student.findUniqueOrThrow({
          where: { id: student.id },
        });

    const shouldLock =
      (hasScreenshotViolation || (updatedStudent.violationCount >= maxViolations && policyAction === "lock")) &&
      !updatedStudent.isLocked;

    if (shouldLock) {
      await prisma.student.update({
        where: { id: student.id },
        data: { isLocked: true },
      });
      updatedStudent.isLocked = true;
    }

    // Emit batch alert to Teacher dashboard
    const io = (globalThis as any).io;
    if (io) {
      try {
        const shouldNotifyBatch = acceptedEvents.some((ev) =>
          ev.eventType !== "screenshot" || screenshotEnabled
        );
        if (shouldNotifyBatch) {
          io.of("/teacher-dashboard").to(`exam:${exam.id}`).emit("student_violation_batch", {
            studentId: student.id,
            name: student.name,
            nisn: student.nisn,
            violationCount: updatedStudent.violationCount,
            isLocked: updatedStudent.isLocked,
            eventsCount: acceptedEvents.length,
          });
        }

        // Emit detail untuk event kritis (screenshot & ip_change)
        for (const ev of acceptedEvents) {
          if ((ev.eventType === "screenshot" && screenshotEnabled) || ev.eventType === "ip_change") {
            io.of("/teacher-dashboard").to(`exam:${exam.id}`).emit("student_violation", {
              studentId: student.id,
              name: student.name,
              nisn: student.nisn,
              violationCount: updatedStudent.violationCount,
              isLocked: updatedStudent.isLocked,
              event: {
                eventType: ev.eventType,
                timestamp: ev.timestamp || new Date().toISOString(),
                durationMs: ev.durationMs,
                metadata: ev.metadata,
              },
            });

            if (ev.eventType === "screenshot") {
              io.of("/teacher-dashboard").to(`exam:${exam.id}`).emit("screenshot_detected", {
                studentId: student.id,
                name: student.name,
                nisn: student.nisn,
                timestamp: ev.timestamp || new Date().toISOString(),
                violationCount: updatedStudent.violationCount,
              });
            }
          }
        }
      } catch (socketErr) {
        console.error("Socket emit failed on batch events:", socketErr);
      }
    }

    return successResponse({
      insertedCount: acceptedEvents.length,
      ignoredCount: events.length - acceptedEvents.length,
      violationCount: updatedStudent.violationCount,
      isLocked: updatedStudent.isLocked,
    });
  } catch (err: any) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    return errorResponse("INTERNAL_SERVER_ERROR", safeErrorMessage(err, "Gagal mencatat batch proctoring event"), 500);
  }
}
