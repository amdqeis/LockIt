import { NextRequest } from "next/server";
import { z } from "zod";
import { authenticateStudent } from "@/lib/middleware/auth";
import { prisma } from "@/lib/prisma";
import { successResponse, errorResponse, safeErrorMessage } from "@/lib/response";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError } from "@/lib/errors";

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

const proctoringEventSchema = z.object({
  eventType: eventTypeEnum,
  timestamp: z.string().datetime().optional(),
  durationMs: z.number().int().nonnegative().optional(),
  metadata: z.record(z.any()).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const { student } = await authenticateStudent(req);
    const exam = student.exam;

    // Rate limit: 60 req/min per student
    const rateLimit = checkRateLimit(student.id, {
      windowMs: 60 * 1000,
      max: 60,
      keyPrefix: "proctoring:single",
    });

    if (!rateLimit.success) {
      return errorResponse("TOO_MANY_REQUESTS", "Terlalu banyak pengiriman event", 429);
    }

    if (student.status === "submitted") {
      return errorResponse("ALREADY_SUBMITTED", "Ujian sudah selesai dikumpulkan", 400);
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return errorResponse("INVALID_BODY", "Request body harus berupa JSON", 400);
    }

    const parsed = proctoringEventSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Data event tidak valid", 400, parsed.error.flatten());
    }

    const { eventType, timestamp, durationMs, metadata } = parsed.data;

    // 1. Save proctoring event
    const event = await prisma.proctoringEvent.create({
      data: {
        studentId: student.id,
        examId: exam.id,
        eventType,
        timestamp: timestamp ? new Date(timestamp) : new Date(),
        durationMs: durationMs || null,
        metadata: metadata ? (metadata as any) : undefined,
      },
    });

    // Helper: evaluate if event counts as violation under exam policy
    const policy = (exam.violationPolicy as any) || {};
    const maxViolations = policy.max_violations || 3;
    const policyAction = policy.action || "lock";

    const countsAsViolation = (() => {
      switch (eventType) {
        case "copy_attempt":
        case "paste_attempt":
          return policy.detect_copy_paste !== false;
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
          return policy.detect_screenshot !== false;
        case "ip_change":
          return policy.detect_ip_change !== false;
        case "reconnect":
        case "heartbeat_lost":
        default:
          return false;
      }
    })();

    // 2. Atomic increment violation count only if policy enables this violation
    const updatedStudent = countsAsViolation
      ? await prisma.student.update({
          where: { id: student.id },
          data: {
            violationCount: { increment: 1 },
          },
        })
      : await prisma.student.findUniqueOrThrow({
          where: { id: student.id },
        });

    // Evaluasi lock: lock jika limit tercapai atau deteksi screenshot
    const isScreenshotLock = eventType === "screenshot" && policy.detect_screenshot !== false;
    const shouldLock =
      (isScreenshotLock || (updatedStudent.violationCount >= maxViolations && policyAction === "lock")) &&
      !updatedStudent.isLocked;

    if (shouldLock) {
      await prisma.student.update({
        where: { id: student.id },
        data: { isLocked: true },
      });
      updatedStudent.isLocked = true;
    }

    // 3. Emit real-time violation event to Teacher Dashboard via Socket.IO
    const io = (globalThis as any).io;
    if (io) {
      try {
        io.of("/teacher-dashboard").to(`exam:${exam.id}`).emit("student_violation", {
          studentId: student.id,
          name: student.name,
          nisn: student.nisn,
          violationCount: updatedStudent.violationCount,
          isLocked: updatedStudent.isLocked,
          event: {
            id: event.id,
            eventType: event.eventType,
            timestamp: event.timestamp.toISOString(),
            durationMs: event.durationMs,
            metadata: event.metadata,
          },
        });

        if (eventType === "screenshot") {
          io.of("/teacher-dashboard").to(`exam:${exam.id}`).emit("screenshot_detected", {
            studentId: student.id,
            name: student.name,
            nisn: student.nisn,
            timestamp: event.timestamp.toISOString(),
            violationCount: updatedStudent.violationCount,
          });
        }
      } catch (socketErr) {
        console.error("Socket emit failed on proctoring event:", socketErr);
      }
    }

    return successResponse({
      eventId: event.id,
      violationCount: updatedStudent.violationCount,
      isLocked: updatedStudent.isLocked,
    });
  } catch (err: any) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    // HIGH-03: Sembunyikan detail error internal di production
    const message =
      process.env.NODE_ENV === "production"
        ? "Gagal mencatat event proctoring"
        : safeErrorMessage(err, "Gagal mencatat event proctoring");
    return errorResponse("INTERNAL_SERVER_ERROR", message, 500);
  }
}
