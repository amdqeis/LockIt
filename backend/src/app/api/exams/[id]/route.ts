import { NextRequest } from "next/server";
import { z } from "zod";
import { authenticateTeacher } from "@/lib/middleware/auth";
import { prisma } from "@/lib/prisma";
import { successResponse, errorResponse, safeErrorMessage } from "@/lib/response";
import { AppError } from "@/lib/errors";

const updateExamSchema = z.object({
  title: z.string().min(3).optional(),
  description: z.string().nullable().optional(),
  durationMinutes: z.number().int().min(5).max(360).optional(),
  violationPolicy: z
    .object({
      max_violations: z.number().int().min(1).optional(),
      action: z.enum(["warning", "lock", "review"]).optional(),
      detect_copy_paste: z.boolean().optional(),
      detect_right_click: z.boolean().optional(),
      detect_devtools: z.boolean().optional(),
    })
    .optional(),
  settings: z
    .object({
      randomize_questions: z.boolean().optional(),
      display_mode: z.enum(["one_by_one", "all_at_once"]).optional(),
      auto_save_interval_seconds: z.number().int().min(5).max(120).optional(),
    })
    .optional(),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const teacher = await authenticateTeacher(req);
    const { id } = await params;

    const exam = await prisma.exam.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            questions: true,
            students: true,
          },
        },
      },
    });

    // RBAC: ADMIN bypass ownership; TEACHER hanya bisa akses ujiannya sendiri
    if (!exam || (teacher.role !== "ADMIN" && exam.teacherId !== teacher.teacherId)) {
      return errorResponse("NOT_FOUND", "Ujian tidak ditemukan", 404);
    }

    return successResponse(exam);
  } catch (err: any) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    return errorResponse("INTERNAL_SERVER_ERROR", safeErrorMessage(err, "Gagal mengambil data ujian"), 500);
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const teacher = await authenticateTeacher(req);
    const { id } = await params;

    const exam = await prisma.exam.findUnique({
      where: { id },
      include: { _count: { select: { students: true } } },
    });

    // RBAC: ADMIN bypass ownership
    if (!exam || (teacher.role !== "ADMIN" && exam.teacherId !== teacher.teacherId)) {
      return errorResponse("NOT_FOUND", "Ujian tidak ditemukan", 404);
    }

    if (exam.status === "ended" || exam.status === "archived") {
      return errorResponse("INVALID_STATE", "Ujian yang telah selesai atau diarsipkan tidak dapat diubah", 400);
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return errorResponse("INVALID_BODY", "Request body harus berupa JSON", 400);
    }

    const parsed = updateExamSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Data update tidak valid", 400, parsed.error.flatten().fieldErrors);
    }

    const updateData: any = {};

    if (exam.status === "active") {
      // When exam is active, only violation policy and settings can be modified
      if (parsed.data.violationPolicy) {
        updateData.violationPolicy = {
          ...(typeof exam.violationPolicy === "object" && exam.violationPolicy !== null ? exam.violationPolicy : {}),
          ...parsed.data.violationPolicy,
        };
      }
      if (parsed.data.settings) {
        updateData.settings = {
          ...(typeof exam.settings === "object" && exam.settings !== null ? exam.settings : {}),
          ...parsed.data.settings,
        };
      }
    } else {
      // Draft status: all fields can be edited
      if (parsed.data.title !== undefined) updateData.title = parsed.data.title;
      if (parsed.data.description !== undefined) updateData.description = parsed.data.description;
      if (parsed.data.durationMinutes !== undefined) updateData.durationMinutes = parsed.data.durationMinutes;
      if (parsed.data.violationPolicy !== undefined) updateData.violationPolicy = parsed.data.violationPolicy;
      if (parsed.data.settings !== undefined) updateData.settings = parsed.data.settings;
    }

    const updated = await prisma.exam.update({
      where: { id },
      data: updateData,
    });

    return successResponse(updated);
  } catch (err: any) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    return errorResponse("INTERNAL_SERVER_ERROR", safeErrorMessage(err, "Gagal mengupdate ujian"), 500);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const teacher = await authenticateTeacher(req);
    const { id } = await params;

    const exam = await prisma.exam.findUnique({
      where: { id },
      include: { _count: { select: { students: true } } },
    });

    // RBAC: ADMIN bypass ownership
    if (!exam || (teacher.role !== "ADMIN" && exam.teacherId !== teacher.teacherId)) {
      return errorResponse("NOT_FOUND", "Ujian tidak ditemukan", 404);
    }

    if (exam._count.students > 0 || exam.status === "active" || exam.status === "ended") {
      // Soft delete: status -> archived
      await prisma.exam.update({
        where: { id },
        data: { status: "archived" },
      });
      return successResponse({ message: "Ujian berhasil diarsipkan", archived: true });
    }

    // No students and still in draft: hard delete permitted
    await prisma.question.deleteMany({ where: { examId: id } });
    await prisma.exam.delete({ where: { id } });

    return successResponse({ message: "Ujian draft berhasil dihapus permanen", deleted: true });
  } catch (err: any) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    return errorResponse("INTERNAL_SERVER_ERROR", safeErrorMessage(err, "Gagal menghapus ujian"), 500);
  }
}
