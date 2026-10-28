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
      response.cookies.delete("refreshToken");
      response.cookies.delete("hasTeacherSession");
      return response;
    }

    // Guard: akun dinonaktifkan oleh Admin
    if (!storedToken.teacher.isActive) {
      const response = errorResponse("ACCOUNT_INACTIVE", "Akun telah dinonaktifkan. Hubungi administrator.", 403);
      response.cookies.delete("refreshToken");
      response.cookies.delete("hasTeacherSession");
      return response;
    }

    // 1. Revoke old token
    await prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { isRevoked: true },
    });

    // 2. Issue new tokens (Rotation)
    const newRawRefreshToken = generateRefreshTokenString();
    const newTokenHash = hashRefreshToken(newRawRefreshToken);
    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

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

    response.cookies.set("refreshToken", newRawRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/api/auth",
      expires: newExpiresAt,
    });

    response.cookies.set("hasTeacherSession", "1", {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: newExpiresAt,
    });

    return response;
  } catch (err: any) {
    return errorResponse("INTERNAL_SERVER_ERROR", safeErrorMessage(err, "Gagal memperbarui token"), 500);
  }
}
