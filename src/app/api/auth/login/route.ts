import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  verifyPassword,
  generateAccessToken,
  generateRefreshTokenString,
  hashRefreshToken,
} from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/response";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const loginSchema = z.object({
  email: z.string().email("Format email tidak valid"),
  password: z.string().min(1, "Password wajib diisi"),
});

export async function POST(req: NextRequest) {
  try {
    const clientIp = getClientIp(req.headers);
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
      return errorResponse("INVALID_CREDENTIALS", "Email atau password salah", 401);
    }

    const passwordValid = await verifyPassword(password, teacher.passwordHash);
    if (!passwordValid) {
      return errorResponse("INVALID_CREDENTIALS", "Email atau password salah", 401);
    }

    // 1. Generate Access Token (15 min)
    const accessToken = generateAccessToken({
      teacherId: teacher.id,
      email: teacher.email,
      fullName: teacher.fullName,
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

    const response = successResponse({
      accessToken,
      teacher: {
        id: teacher.id,
        email: teacher.email,
        fullName: teacher.fullName,
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

    return response;
  } catch (err: any) {
    return errorResponse("INTERNAL_SERVER_ERROR", err.message || "Gagal melakukan login", 500);
  }
}
