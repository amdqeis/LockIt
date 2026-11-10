import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authenticateTeacher } from "@/lib/middleware/auth";
import { errorResponse, successResponse, safeErrorMessage } from "@/lib/response";
import { AppError } from "@/lib/errors";
import { normalizeName, formatSubjectDisplayName, assertSubjectNotReferenced } from "@/lib/academic";

const updateSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  gradeLevelId: z.string().min(1).optional(),
  isArchived: z.boolean().optional(),
});

type Context = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Context) {
  try {
    await authenticateTeacher(req);
    const { id } = await params;
    const subject = await prisma.subject.findUnique({
      where: { id },
      include: {
        gradeLevel: { select: { id: true, name: true, isArchived: true } },
        _count: { select: { banks: true, exams: true } },
      },
    });
    if (!subject) return errorResponse("NOT_FOUND", "Mata pelajaran tidak ditemukan", 404);
    return successResponse({
      ...subject,
      displayName: formatSubjectDisplayName(subject.name, subject.gradeLevel?.name),
    });
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err.code, err.message, err.statusCode, err.details);
    return errorResponse("INTERNAL_SERVER_ERROR", safeErrorMessage(err, "Gagal mengambil data mata pelajaran"), 500);
  }
}

export async function PUT(req: NextRequest, { params }: Context) {
  try {
    await authenticateTeacher(req);
    const { id } = await params;
    const body = await req.json().catch(() => null);
    if (!body) return errorResponse("INVALID_BODY", "Request body harus berupa JSON", 400);

    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return errorResponse("VALIDATION_ERROR", "Data mata pelajaran tidak valid", 400, parsed.error.flatten().fieldErrors);

    const existing = await prisma.subject.findUnique({
      where: { id },
      include: {
        _count: { select: { banks: true, exams: true } },
      },
    });
    if (!existing) return errorResponse("NOT_FOUND", "Mata pelajaran tidak ditemukan", 404);

    const targetGradeLevelId = parsed.data.gradeLevelId !== undefined ? parsed.data.gradeLevelId : existing.gradeLevelId;

    if (parsed.data.gradeLevelId !== undefined && parsed.data.gradeLevelId !== existing.gradeLevelId) {
      if (existing._count.banks > 0 || existing._count.exams > 0) {
        return errorResponse("CONFLICT", "Tingkat suatu mapel yang sudah digunakan tidak dapat diubah.", 409);
      }
      const newGrade = await prisma.gradeLevel.findUnique({ where: { id: parsed.data.gradeLevelId } });
      if (!newGrade) return errorResponse("NOT_FOUND", "Tingkat tujuan tidak ditemukan", 404);
    }

    const newName = parsed.data.name !== undefined ? parsed.data.name.trim() : existing.name;
    const normalizedName = normalizeName(newName);

    if (targetGradeLevelId && (newName !== existing.name || targetGradeLevelId !== existing.gradeLevelId)) {
      const conflict = await prisma.subject.findUnique({
        where: {
          gradeLevelId_normalizedName: {
            gradeLevelId: targetGradeLevelId,
            normalizedName,
          },
        },
      });
      if (conflict && conflict.id !== id) {
        return errorResponse("CONFLICT", `Mata pelajaran "${newName}" sudah terdaftar pada tingkat tersebut.`, 409);
      }
    }

    const updated = await prisma.subject.update({
      where: { id },
      data: {
        name: newName,
        normalizedName,
        gradeLevelId: targetGradeLevelId,
        isArchived: parsed.data.isArchived !== undefined ? parsed.data.isArchived : existing.isArchived,
      },
      include: {
        gradeLevel: { select: { id: true, name: true } },
        _count: { select: { banks: true, exams: true } },
      },
    });

    return successResponse({
      ...updated,
      displayName: formatSubjectDisplayName(updated.name, updated.gradeLevel?.name),
    });
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err.code, err.message, err.statusCode, err.details);
    return errorResponse("INTERNAL_SERVER_ERROR", safeErrorMessage(err, "Gagal memperbarui mata pelajaran"), 500);
  }
}

export async function DELETE(req: NextRequest, { params }: Context) {
  try {
    await authenticateTeacher(req);
    const { id } = await params;
    const subject = await prisma.subject.findUnique({ where: { id } });
    if (!subject) return errorResponse("NOT_FOUND", "Mata pelajaran tidak ditemukan", 404);

    await assertSubjectNotReferenced(id);

    await prisma.subject.delete({ where: { id } });
    return successResponse({ deleted: true });
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err.code, err.message, err.statusCode, err.details);
    return errorResponse("INTERNAL_SERVER_ERROR", safeErrorMessage(err, "Gagal menghapus mata pelajaran"), 500);
  }
}
