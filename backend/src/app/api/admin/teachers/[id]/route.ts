import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/middleware/auth";
import { successResponse, errorResponse, safeErrorMessage } from "@/lib/response";
import { AppError } from "@/lib/errors";

// ─── SCHEMA ──────────────────────────────────────────────────────────────────

const updateTeacherSchema = z.object({
  fullName: z.string().min(2, "Nama lengkap minimal 2 karakter").optional(),
  phone:    z.string().max(20).nullable().optional(),
  role:     z.enum(["TEACHER", "ADMIN"]).optional(),
  isActive: z.boolean().optional(),
});

// ─── HELPERS ─────────────────────────────────────────────────────────────────

async function getTeacherOrThrow(id: string) {
  const teacher = await prisma.teacher.findUnique({
    where: { id },
    select: {
      id:          true,
      email:       true,
      fullName:    true,
      role:        true,
      isActive:    true,
      phone:       true,
      lastLoginAt: true,
      createdAt:   true,
      _count:      { select: { exams: true } },
    },
  });
  if (!teacher) throw Object.assign(new Error("Guru tidak ditemukan"), { _notFound: true });
  return teacher;
}

// ─── GET /api/admin/teachers/[id] ────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin(req);
    const { id } = await params;
    const teacher = await getTeacherOrThrow(id);
    return successResponse({
      ...teacher,
      examCount: teacher._count.exams,
      _count: undefined,
    });
  } catch (err: any) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    if (err._notFound) return errorResponse("NOT_FOUND", "Guru tidak ditemukan", 404);
    return errorResponse("INTERNAL_SERVER_ERROR", safeErrorMessage(err, "Gagal mengambil data guru"), 500);
  }
}

// ─── PUT /api/admin/teachers/[id] ────────────────────────────────────────────

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin(req);
    const { id } = await params;

    const body = await req.json().catch(() => null);
    if (!body) return errorResponse("INVALID_BODY", "Request body harus berupa JSON", 400);

    const parsed = updateTeacherSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Data tidak valid", 400, parsed.error.flatten().fieldErrors);
    }

    // Pastikan target ada
    const existing = await prisma.teacher.findUnique({ where: { id } });
    if (!existing) return errorResponse("NOT_FOUND", "Guru tidak ditemukan", 404);

    const updated = await prisma.teacher.update({
      where: { id },
      data:  parsed.data,
      select: {
        id:          true,
        email:       true,
        fullName:    true,
        role:        true,
        isActive:    true,
        phone:       true,
        lastLoginAt: true,
        createdAt:   true,
      },
    });

    return successResponse(updated);
  } catch (err: any) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    return errorResponse("INTERNAL_SERVER_ERROR", safeErrorMessage(err, "Gagal mengupdate data guru"), 500);
  }
}

// ─── DELETE /api/admin/teachers/[id] — SOFT DELETE ───────────────────────────
// Tidak hapus data permanen: set isActive=false + revoke semua refresh token.
// Ujian yang sedang berjalan tetap berlanjut sampai selesai.

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminPayload = await requireAdmin(req);
    const { id } = await params;

    // Guard: Admin tidak bisa menonaktifkan dirinya sendiri
    if (adminPayload.teacherId === id) {
      return errorResponse("FORBIDDEN", "Anda tidak dapat menonaktifkan akun Anda sendiri.", 403);
    }

    const existing = await prisma.teacher.findUnique({ where: { id } });
    if (!existing) return errorResponse("NOT_FOUND", "Guru tidak ditemukan", 404);

    // Soft delete: nonaktifkan + revoke semua refresh token
    await prisma.$transaction([
      prisma.teacher.update({
        where: { id },
        data:  { isActive: false },
      }),
      prisma.refreshToken.updateMany({
        where:  { teacherId: id, isRevoked: false },
        data:   { isRevoked: true },
      }),
    ]);

    return successResponse({ message: "Akun guru berhasil dinonaktifkan." });
  } catch (err: any) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    return errorResponse("INTERNAL_SERVER_ERROR", safeErrorMessage(err, "Gagal menonaktifkan akun guru"), 500);
  }
}
