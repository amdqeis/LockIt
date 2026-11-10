import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authenticateTeacher } from "@/lib/middleware/auth";
import { successResponse, errorResponse, safeErrorMessage } from "@/lib/response";
import { AppError } from "@/lib/errors";
import { normalizeName, assertGradeLevelNotReferenced } from "@/lib/academic";

const updateSchema = z.object({
  name: z.string().trim().min(1).max(50).optional(),
  isArchived: z.boolean().optional(),
});

type Context = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Context) {
  try {
    await authenticateTeacher(req);
    const { id } = await params;
    const gradeLevel = await prisma.gradeLevel.findUnique({
      where: { id },
      include: {
        _count: { select: { classrooms: true, subjects: true } },
      },
    });
    if (!gradeLevel) return errorResponse("NOT_FOUND", "Tingkat tidak ditemukan", 404);
    return successResponse(gradeLevel);
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err.code, err.message, err.statusCode, err.details);
    return errorResponse("INTERNAL_SERVER_ERROR", safeErrorMessage(err, "Gagal mengambil data tingkat"), 500);
  }
}

export async function PUT(req: NextRequest, { params }: Context) {
  try {
    await authenticateTeacher(req);
    const { id } = await params;
    const body = await req.json().catch(() => null);
    if (!body) return errorResponse("INVALID_BODY", "Request body harus berupa JSON", 400);

    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return errorResponse("VALIDATION_ERROR", "Data tingkat tidak valid", 400, parsed.error.flatten().fieldErrors);

    const existing = await prisma.gradeLevel.findUnique({ where: { id } });
    if (!existing) return errorResponse("NOT_FOUND", "Tingkat tidak ditemukan", 404);

    const updateData: { name?: string; normalizedName?: string; isArchived?: boolean } = {};
    if (parsed.data.name !== undefined) {
      const name = parsed.data.name.trim();
      const normalized = normalizeName(name);
      if (normalized !== existing.normalizedName) {
        const conflict = await prisma.gradeLevel.findUnique({ where: { normalizedName: normalized } });
        if (conflict && conflict.id !== id) {
          return errorResponse("CONFLICT", `Tingkat dengan nama "${name}" sudah terdaftar.`, 409);
        }
      }
      updateData.name = name;
      updateData.normalizedName = normalized;
    }
    if (parsed.data.isArchived !== undefined) {
      updateData.isArchived = parsed.data.isArchived;
    }

    const updated = await prisma.gradeLevel.update({
      where: { id },
      data: updateData,
    });

    return successResponse(updated);
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err.code, err.message, err.statusCode, err.details);
    return errorResponse("INTERNAL_SERVER_ERROR", safeErrorMessage(err, "Gagal memperbarui tingkat"), 500);
  }
}

export async function DELETE(req: NextRequest, { params }: Context) {
  try {
    await authenticateTeacher(req);
    const { id } = await params;

    const existing = await prisma.gradeLevel.findUnique({ where: { id } });
    if (!existing) return errorResponse("NOT_FOUND", "Tingkat tidak ditemukan", 404);

    await assertGradeLevelNotReferenced(id);

    await prisma.gradeLevel.delete({ where: { id } });
    return successResponse({ deleted: true });
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err.code, err.message, err.statusCode, err.details);
    return errorResponse("INTERNAL_SERVER_ERROR", safeErrorMessage(err, "Gagal menghapus tingkat"), 500);
  }
}

