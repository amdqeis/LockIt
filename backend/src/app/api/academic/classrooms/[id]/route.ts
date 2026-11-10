import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authenticateTeacher } from "@/lib/middleware/auth";
import { successResponse, errorResponse, safeErrorMessage } from "@/lib/response";
import { AppError } from "@/lib/errors";
import { normalizeName, assertClassroomNotReferenced } from "@/lib/academic";

const updateSchema = z.object({
  name: z.string().trim().min(1).max(50).optional(),
  gradeLevelId: z.string().min(1).optional(),
  isArchived: z.boolean().optional(),
});

type Context = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Context) {
  try {
    await authenticateTeacher(req);
    const { id } = await params;
    const classroom = await prisma.classroom.findUnique({
      where: { id },
      include: {
        gradeLevel: { select: { id: true, name: true } },
        _count: { select: { exams: true } },
      },
    });
    if (!classroom) return errorResponse("NOT_FOUND", "Rombel tidak ditemukan", 404);
    return successResponse(classroom);
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err.code, err.message, err.statusCode, err.details);
    return errorResponse("INTERNAL_SERVER_ERROR", safeErrorMessage(err, "Gagal mengambil data rombel"), 500);
  }
}

export async function PUT(req: NextRequest, { params }: Context) {
  try {
    await authenticateTeacher(req);
    const { id } = await params;
    const body = await req.json().catch(() => null);
    if (!body) return errorResponse("INVALID_BODY", "Request body harus berupa JSON", 400);

    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return errorResponse("VALIDATION_ERROR", "Data rombel tidak valid", 400, parsed.error.flatten().fieldErrors);

    const existing = await prisma.classroom.findUnique({
      where: { id },
      include: { _count: { select: { exams: true } } },
    });
    if (!existing) return errorResponse("NOT_FOUND", "Rombel tidak ditemukan", 404);

    const targetGradeLevelId = parsed.data.gradeLevelId ?? existing.gradeLevelId;
    if (parsed.data.gradeLevelId && parsed.data.gradeLevelId !== existing.gradeLevelId) {
      if (existing._count.exams > 0) {
        return errorResponse("CONFLICT", "Tingkat suatu rombel yang sudah digunakan oleh ujian tidak dapat diubah.", 409);
      }
      const newGrade = await prisma.gradeLevel.findUnique({ where: { id: parsed.data.gradeLevelId } });
      if (!newGrade) return errorResponse("NOT_FOUND", "Tingkat tujuan tidak ditemukan", 404);
    }

    const newName = parsed.data.name !== undefined ? parsed.data.name.trim() : existing.name;
    const normalizedName = normalizeName(newName);

    if (newName !== existing.name || targetGradeLevelId !== existing.gradeLevelId) {
      const conflict = await prisma.classroom.findUnique({
        where: {
          gradeLevelId_normalizedName: {
            gradeLevelId: targetGradeLevelId,
            normalizedName,
          },
        },
      });
      if (conflict && conflict.id !== id) {
        return errorResponse("CONFLICT", `Rombel "${newName}" sudah terdaftar pada tingkat tersebut.`, 409);
      }
    }

    const updated = await prisma.classroom.update({
      where: { id },
      data: {
        name: newName,
        normalizedName,
        gradeLevelId: targetGradeLevelId,
        isArchived: parsed.data.isArchived !== undefined ? parsed.data.isArchived : existing.isArchived,
      },
      include: {
        gradeLevel: { select: { id: true, name: true } },
      },
    });

    return successResponse(updated);
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err.code, err.message, err.statusCode, err.details);
    return errorResponse("INTERNAL_SERVER_ERROR", safeErrorMessage(err, "Gagal memperbarui rombel"), 500);
  }
}

export async function DELETE(req: NextRequest, { params }: Context) {
  try {
    await authenticateTeacher(req);
    const { id } = await params;

    const existing = await prisma.classroom.findUnique({ where: { id } });
    if (!existing) return errorResponse("NOT_FOUND", "Rombel tidak ditemukan", 404);

    await assertClassroomNotReferenced(id);

    await prisma.classroom.delete({ where: { id } });
    return successResponse({ deleted: true });
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err.code, err.message, err.statusCode, err.details);
    return errorResponse("INTERNAL_SERVER_ERROR", safeErrorMessage(err, "Gagal menghapus rombel"), 500);
  }
}

