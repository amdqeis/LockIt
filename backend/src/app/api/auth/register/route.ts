import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/response";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const registerSchema = z.object({
  email: z.string().email("Format email tidak valid"),
  password: z.string().min(8, "Password minimal 8 karakter"),
  fullName: z.string().min(2, "Nama lengkap minimal 2 karakter"),
});

export async function POST(req: NextRequest) {
  try {
    const clientIp = getClientIp(req.headers);
    const rateLimit = checkRateLimit(clientIp, {
      windowMs: 15 * 60 * 1000,
      max: 5,
      keyPrefix: "auth:register",
    });

    if (!rateLimit.success) {
      return errorResponse(
        "TOO_MANY_REQUESTS",
        `Terlalu banyak percobaan registrasi. Coba lagi dalam ${rateLimit.retryAfterSeconds} detik.`,
        429,
        { retryAfter: rateLimit.retryAfterSeconds }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return errorResponse("INVALID_BODY", "Request body harus berupa JSON", 400);
    }

    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Data registrasi tidak valid", 400, parsed.error.flatten().fieldErrors);
    }

    const { email, password, fullName } = parsed.data;

    // Check if email already exists
    const existing = await prisma.teacher.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existing) {
      return errorResponse("EMAIL_ALREADY_EXISTS", "Email sudah terdaftar di sistem", 409);
    }

    const passwordHash = await hashPassword(password);
    const teacher = await prisma.teacher.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        fullName,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        createdAt: true,
      },
    });

    return successResponse(teacher, 201);
  } catch (err: any) {
    return errorResponse("INTERNAL_SERVER_ERROR", err.message || "Gagal melakukan registrasi", 500);
  }
}
