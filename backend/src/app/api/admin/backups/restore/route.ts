import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/middleware/auth";
import { verifyPassword } from "@/lib/auth";
import { successResponse, errorResponse, safeErrorMessage } from "@/lib/response";
import { AppError } from "@/lib/errors";
import { startRestoreJob } from "@/lib/backup-restore";

const restoreSchema = z.object({
  type: z.enum(["saved", "upload"]),
  identifier: z.string().min(1, "Identifier backup wajib disertakan"),
  password: z.string().min(1, "Password konfirmasi administrator wajib diisi"),
});

export async function POST(req: NextRequest) {
  try {
    const adminUser = await requireAdmin(req);
    const body = await req.json().catch(() => null);
    if (!body) return errorResponse("INVALID_BODY", "Request body harus berupa JSON", 400);

    const parsed = restoreSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Data permohonan restore tidak valid", 400, parsed.error.flatten().fieldErrors);
    }

    const { type, identifier, password } = parsed.data;

    // Verify admin password
    const admin = await prisma.teacher.findUnique({ where: { id: adminUser.teacherId } });
    if (!admin) return errorResponse("UNAUTHORIZED", "Akun administrator tidak ditemukan", 401);

    const passwordValid = await verifyPassword(password, admin.passwordHash);
    if (!passwordValid) {
      return errorResponse("INVALID_CREDENTIALS", "Password konfirmasi administrator salah.", 401);
    }

    const result = await startRestoreJob(admin.id, {
      type,
      identifier,
    });

    return successResponse(result, 202);
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err.code, err.message, err.statusCode, err.details);
    return errorResponse("INTERNAL_SERVER_ERROR", safeErrorMessage(err, "Gagal memulai pemulihan backup"), 500);
  }
}

