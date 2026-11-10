import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  generateAccessToken,
  generateRefreshTokenString,
  hashRefreshToken,
} from "@/lib/auth";
import { successResponse, errorResponse, safeErrorMessage } from "@/lib/response";
export async function POST(req: NextRequest) {
  try {
    const rawRefreshToken = req.cookies.get("refreshToken")?.value;

    if (!rawRefreshToken) {
      return errorResponse("REFRESH_TOKEN_REQUIRED", "Refresh token tidak ditemukan di cookie", 401);
    }

    const tokenHash = hashRefreshToken(rawRefreshToken);

    const storedToken = await prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { teacher: true },
    });

    if (!storedToken || storedToken.isRevoked || new Date() > storedToken.expiresAt) {
      // Clear cookie if invalid
      const response = errorResponse("INVALID_REFRESH_TOKEN", "Refresh token tidak valid atau telah kedaluwarsa", 401);
      response.cookies.set("refreshToken", "", { path: "/api/auth", maxAge: 0, httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production" });
      response.cookies.delete("hasTeacherSession");
      response.cookies.delete("accessToken");
      return response;
    }

    // Guard: akun dinonaktifkan oleh Admin
    if (!storedToken.teacher.isActive) {
      const response = errorResponse("ACCOUNT_INACTIVE", "Akun telah dinonaktifkan. Hubungi administrator.", 403);
      response.cookies.set("refreshToken", "", { path: "/api/auth", maxAge: 0, httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production" });
      response.cookies.delete("hasTeacherSession");
      response.cookies.delete("accessToken");
      return response;
    }

    // 1. Revoke old token
    await prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { isRevoked: true },
    });

    // 2. Issue new tokens (Rotation)
    const isRememberMe = (storedToken.expiresAt.getTime() - storedToken.createdAt.getTime()) > 2 * 24 * 60 * 60 * 1000;
    const refreshDurationMs = isRememberMe
      ? 30 * 24 * 60 * 60 * 1000
      : 24 * 60 * 60 * 1000;
    const newRawRefreshToken = generateRefreshTokenString();
    const newTokenHash = hashRefreshToken(newRawRefreshToken);
    const newExpiresAt = new Date(Date.now() + refreshDurationMs);

    await prisma.refreshToken.create({
      data: {
        teacherId: storedToken.teacherId,
        tokenHash: newTokenHash,
        expiresAt: newExpiresAt,
      },
    });

    const newAccessToken = generateAccessToken({
      teacherId: storedToken.teacher.id,
      email:     storedToken.teacher.email,
      fullName:  storedToken.teacher.fullName,
      role:      storedToken.teacher.role,
    });

    const response = successResponse({
      accessToken: newAccessToken,
    });

    response.cookies.set("accessToken", newAccessToken, {
      httpOnly: true, secure: process.env.NODE_ENV === "production",
      sameSite: "strict", path: "/", maxAge: 15 * 60,
    });

    response.cookies.set("refreshToken", newRawRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/api/auth",
      ...(isRememberMe ? { expires: newExpiresAt } : {}),
    });

    response.cookies.set("hasTeacherSession", "1", {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      ...(isRememberMe ? { expires: newExpiresAt } : {}),
    });

    return response;
  } catch (err: any) {
    return errorResponse("INTERNAL_SERVER_ERROR", safeErrorMessage(err, "Gagal memperbarui token"), 500);
  }
}
