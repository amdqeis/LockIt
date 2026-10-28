import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { requireAdmin } from "@/lib/middleware/auth";
import { successResponse, errorResponse, safeErrorMessage } from "@/lib/response";
import { AppError } from "@/lib/errors";

const resetPasswordSchema = z.object({
  newPassword: z.string().min(8, "Password baru minimal 8 karakter"),
});

// ─── POST /api/admin/teachers/[id]/reset-password ────────────────────────────
// Side effects:
//   1. Update passwordHash
//   2. Revoke SEMUA refresh token guru → force re-login di semua sesi

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin(req);
    const { id } = await params;

    const body = await req.json().catch(() => null);
    if (!body) return errorResponse("INVALID_BODY", "Request body harus berupa JSON", 400);

    const parsed = resetPasswordSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Data tidak valid", 400, parsed.error.flatten().fieldErrors);
    }

    const teacher = await prisma.teacher.findUnique({ where: { id } });
    if (!teacher) return errorResponse("NOT_FOUND", "Guru tidak ditemukan", 404);

    const newPasswordHash = await hashPassword(parsed.data.newPassword);

    // Atomic: update password + revoke semua sesi
    await prisma.$transaction([
      prisma.teacher.update({
        where: { id },
        data:  { passwordHash: newPasswordHash },
      }),
      prisma.refreshToken.updateMany({
        where: { teacherId: id, isRevoked: false },
        data:  { isRevoked: true },
      }),
    ]);

    return successResponse({ message: "Password berhasil direset. Semua sesi aktif guru telah dihentikan." });
  } catch (err: any) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    return errorResponse("INTERNAL_SERVER_ERROR", safeErrorMessage(err, "Gagal mereset password"), 500);
  }
}
