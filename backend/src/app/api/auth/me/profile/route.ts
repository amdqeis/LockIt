import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authenticateTeacher } from "@/lib/middleware/auth";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { successResponse, errorResponse, safeErrorMessage } from "@/lib/response";
import { AppError } from "@/lib/errors";

// ─── SCHEMA ──────────────────────────────────────────────────────────────────

const profileSchema = z.object({
  fullName:        z.string().min(2, "Nama lengkap minimal 2 karakter").optional(),
  phone:           z.string().max(20).nullable().optional(),
  currentPassword: z.string().optional(),
  newPassword:     z.string().min(8, "Password baru minimal 8 karakter").optional().nullable(),
}).superRefine((data, ctx) => {
  // Jika ingin ganti password, currentPassword wajib ada
  if (data.newPassword && !data.currentPassword) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Password saat ini wajib diisi untuk mengganti password",
      path: ["currentPassword"],
    });
  }
});

// ─── PUT /api/auth/me/profile ─────────────────────────────────────────────────

export async function PUT(req: NextRequest) {
  try {
    const payload = await authenticateTeacher(req);

    const body = await req.json().catch(() => null);
    if (!body) return errorResponse("INVALID_BODY", "Request body harus berupa JSON", 400);

    const parsed = profileSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Data tidak valid", 400, parsed.error.flatten().fieldErrors);
    }

    const { fullName, phone, currentPassword, newPassword } = parsed.data;

    const teacher = await prisma.teacher.findUnique({ where: { id: payload.teacherId } });
    if (!teacher) return errorResponse("NOT_FOUND", "Data guru tidak ditemukan", 404);

    const updateData: any = {};

    if (fullName !== undefined) updateData.fullName = fullName;
    if (phone    !== undefined) updateData.phone    = phone;

    // Ganti password jika diminta
    if (newPassword && currentPassword) {
      const isValid = await verifyPassword(currentPassword, teacher.passwordHash);
      if (!isValid) {
        return errorResponse("INVALID_CREDENTIALS", "Password saat ini tidak sesuai", 401);
      }
      updateData.passwordHash = await hashPassword(newPassword);
    }

    if (Object.keys(updateData).length === 0) {
      return errorResponse("NO_CHANGES", "Tidak ada data yang diubah", 400);
    }

    const updated = await prisma.teacher.update({
      where: { id: payload.teacherId },
      data:  updateData,
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
    return errorResponse("INTERNAL_SERVER_ERROR", safeErrorMessage(err, "Gagal mengupdate profil"), 500);
  }
}
