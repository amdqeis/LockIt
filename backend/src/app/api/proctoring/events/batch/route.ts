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

    // Save events in bulk
    await prisma.proctoringEvent.createMany({
      data: events.map((ev) => ({
        studentId: student.id,
        examId: exam.id,
        eventType: ev.eventType,
        timestamp: ev.timestamp ? new Date(ev.timestamp) : new Date(),
        durationMs: ev.durationMs || null,
        metadata: ev.metadata ? (ev.metadata as any) : undefined,
      })),
    });

    // Update student violation count
    const policy = (exam.violationPolicy as any) || {};
    const maxViolations = policy.max_violations || 5;
    const policyAction = policy.action || "warning";

    const newViolationCount = student.violationCount + events.length;
    const shouldLock = newViolationCount >= maxViolations && policyAction === "lock";

    const updatedStudent = await prisma.student.update({
      where: { id: student.id },
      data: {
        violationCount: newViolationCount,
        ...(shouldLock ? { isLocked: true } : {}),
      },
    });

    // Emit batch alert to Teacher dashboard
    const io = (globalThis as any).io;
    if (io) {
      try {
        io.of("/teacher-dashboard").to(`exam:${exam.id}`).emit("student_violation_batch", {
          studentId: student.id,
          name: student.name,
          nim: student.nim,
          violationCount: newViolationCount,
          isLocked: updatedStudent.isLocked,
          eventsCount: events.length,
        });
      } catch (socketErr) {
        console.error("Socket emit failed on batch events:", socketErr);
      }
    }

    return successResponse({
      insertedCount: events.length,
      violationCount: newViolationCount,
      isLocked: updatedStudent.isLocked,
    });
  } catch (err: any) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    return errorResponse("INTERNAL_SERVER_ERROR", err.message || "Gagal mencatat batch proctoring event", 500);
  }
}
