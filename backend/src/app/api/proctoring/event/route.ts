import { NextRequest } from "next/server";
import { z } from "zod";
import { authenticateStudent } from "@/lib/middleware/auth";
import { prisma } from "@/lib/prisma";
import { successResponse, errorResponse } from "@/lib/response";
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

    // 2. Increment student violation count & evaluate policy
    const policy = (exam.violationPolicy as any) || {};
    const maxViolations = policy.max_violations || 5;
    const policyAction = policy.action || "warning";

    const newViolationCount = student.violationCount + 1;
    const shouldLock = newViolationCount >= maxViolations && policyAction === "lock";

    const updatedStudent = await prisma.student.update({
      where: { id: student.id },
      data: {
        violationCount: newViolationCount,
        ...(shouldLock ? { isLocked: true } : {}),
      },
    });

    // 3. Emit real-time violation event to Teacher Dashboard via Socket.IO
    const io = (globalThis as any).io;
    if (io) {
      try {
        io.of("/teacher-dashboard").to(`exam:${exam.id}`).emit("student_violation", {
          studentId: student.id,
          name: student.name,
          nim: student.nim,
          violationCount: newViolationCount,
          isLocked: updatedStudent.isLocked,
          event: {
            id: event.id,
            eventType: event.eventType,
            timestamp: event.timestamp.toISOString(),
            durationMs: event.durationMs,
            metadata: event.metadata,
          },
        });
      } catch (socketErr) {
        console.error("Socket emit failed on proctoring event:", socketErr);
      }
    }

    return successResponse({
      eventId: event.id,
      violationCount: newViolationCount,
      isLocked: updatedStudent.isLocked,
    });
  } catch (err: any) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    return errorResponse("INTERNAL_SERVER_ERROR", err.message || "Gagal mencatat event proctoring", 500);
  }
}
