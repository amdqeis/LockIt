import { NextRequest } from "next/server";
import { z } from "zod";
import { authenticateStudent } from "@/lib/middleware/auth";
import { prisma } from "@/lib/prisma";
import { successResponse, errorResponse, safeErrorMessage } from "@/lib/response";
import { AppError } from "@/lib/errors";

const recoverSchema = z.object({
  acknowledgedCycleCount: z.number().int().nonnegative(),
});

export async function POST(req: NextRequest) {
  try {
    const { student } = await authenticateStudent(req);
    const exam = student.exam;

    if (!["active", "disconnected"].includes(student.status)) {
      return errorResponse("EXAM_NOT_ACTIVE", "Sesi ujian tidak aktif", 403);
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return errorResponse("INVALID_BODY", "Request body harus berupa JSON", 400);
    }

    const parsed = recoverSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Data pemulihan tidak valid", 400, parsed.error.flatten());
    }

    const { acknowledgedCycleCount } = parsed.data;

    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.student.findUniqueOrThrow({
        where: { id: student.id },
      });

      // Supervisor lock has absolute precedence: recovery endpoint cannot unlock it.
      if (current.isLocked) {
        return {
          locked: true,
          current,
        };
      }

      // If a newer violation arrived, acknowledgment of older count cannot clear it.
      if (current.violationCycleCount > acknowledgedCycleCount) {
        return {
          staleAck: true,
          current,
        };
      }

      // Valid recovery: clear recoveryRequired and update recoveredCycleCount
      const updated = await tx.student.update({
        where: { id: student.id },
        data: {
          recoveryRequired: false,
          recoveredCycleCount: current.violationCycleCount,
        },
      });

      return {
        success: true,
        current: updated,
      };
    }, { isolationLevel: "Serializable" });

    if (result.locked) {
      return errorResponse(
        "STUDENT_LOCKED",
        "Sesi Anda terkunci oleh pengawas dan memerlukan pembukaan langsung oleh pengawas.",
        403,
        {
          isLocked: true,
          violationCycleCount: result.current.violationCycleCount,
          recoveryRequired: true,
        }
      );
    }

    if (result.staleAck) {
      return errorResponse(
        "NEW_VIOLATIONS_PENDING",
        "Terdapat pelanggaran baru yang masuk. Pulihkan kembali sesuai status terkini.",
        409,
        {
          isLocked: false,
          violationCycleCount: result.current.violationCycleCount,
          recoveryRequired: true,
        }
      );
    }

    const io = (globalThis as any).io;
    io?.of("/teacher-dashboard").to(`exam:${exam.id}`).emit("student_recovered", {
      studentId: student.id,
      name: student.name,
      nisn: student.nisn,
      violationCount: result.current.violationCount,
      violationCycleCount: result.current.violationCycleCount,
      recoveryRequired: false,
      isLocked: false,
    });

    return successResponse({
      studentId: student.id,
      violationCount: result.current.violationCount,
      violationCycleCount: result.current.violationCycleCount,
      recoveryRequired: false,
      isLocked: false,
    });
  } catch (err: any) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    return errorResponse("INTERNAL_SERVER_ERROR", safeErrorMessage(err, "Gagal memproses pemulihan sesi"), 500);
  }
}

