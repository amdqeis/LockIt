import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  verifyPassword,
  generateAccessToken,
  generateRefreshTokenString,
  hashRefreshToken,
} from "@/lib/auth";
import { successResponse, errorResponse, safeErrorMessage } from "@/lib/response";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { createRequestLogger } from "@/lib/logger";

const loginSchema = z.object({
  email: z.string().email("Format email tidak valid"),
  password: z.string().min(1, "Password wajib diisi"),
});

export async function POST(req: NextRequest) {
  const log = createRequestLogger(req.headers.get("x-request-id") ?? undefined);
  try {
    const clientIp = getClientIp(req.headers);
    log.info("Login attempt", { ip: clientIp });
    const rateLimit = checkRateLimit(clientIp, {
      windowMs: 15 * 60 * 1000,
      max: 5,
      keyPrefix: "auth:login",
    });

    if (!rateLimit.success) {
      return errorResponse(
        "TOO_MANY_REQUESTS",
        `Terlalu banyak percobaan login gagal. Silakan coba lagi dalam ${rateLimit.retryAfterSeconds} detik.`,
        429,
        { retryAfter: rateLimit.retryAfterSeconds }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return errorResponse("INVALID_BODY", "Request body harus berupa JSON", 400);
    }

    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Data login tidak valid", 400, parsed.error.flatten().fieldErrors);
    }

    const { email, password } = parsed.data;

    const teacher = await prisma.teacher.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!teacher) {
      log.warn("Login failed: email not found", { email });
      return errorResponse("INVALID_CREDENTIALS", "Email atau password salah", 401);
    }

    // Guard: akun dinonaktifkan oleh Admin
    if (!teacher.isActive) {
      log.warn("Login rejected: account inactive", { email });
      return errorResponse("ACCOUNT_INACTIVE", "Akun Anda telah dinonaktifkan. Hubungi administrator institusi.", 403);
    }

    const passwordValid = await verifyPassword(password, teacher.passwordHash);
    if (!passwordValid) {
      log.warn("Login failed: wrong password", { email });
      return errorResponse("INVALID_CREDENTIALS", "Email atau password salah", 401);
    }

    // 1. Generate Access Token (15 min) — sertakan role untuk RBAC
    const accessToken = generateAccessToken({
      teacherId: teacher.id,
      email: teacher.email,
      fullName: teacher.fullName,
      role: teacher.role,
    });

    // 2. Generate Refresh Token (7 days)
    const rawRefreshToken = generateRefreshTokenString();
    const tokenHash = hashRefreshToken(rawRefreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await prisma.refreshToken.create({
      data: {
        teacherId: teacher.id,
        tokenHash,
        expiresAt,
      },
    });

    // Update lastLoginAt secara async (non-blocking — tidak perlu await)
    prisma.teacher.update({
      where: { id: teacher.id },
      data: { lastLoginAt: new Date() },
    }).catch((e) => log.warn("Failed to update lastLoginAt", { err: e?.message }));

    const response = successResponse({
      accessToken,
      teacher: {
        id: teacher.id,
        email: teacher.email,
        fullName: teacher.fullName,
        role: teacher.role,
        isActive: teacher.isActive,
      },
    });

    // Set secure httpOnly cookie for refresh token
    response.cookies.set("refreshToken", rawRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/api/auth",
      expires: expiresAt,
    });

    // Session presence indicator for frontend middleware route guard
    response.cookies.set("hasTeacherSession", "1", {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: expiresAt,
    });

    // LOW-02: Emit request ID ke response header untuk tracing
    response.headers.set("X-Request-ID", log.requestId);
    log.info("Login success", { teacherId: teacher.id, email: teacher.email });
    return response;
  } catch (err: any) {
    log.error("Login error", { err: safeErrorMessage(err, "unknown") });
    return errorResponse("INTERNAL_SERVER_ERROR", safeErrorMessage(err, "Gagal melakukan login"), 500);
  }
}
