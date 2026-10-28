import { NextRequest } from "next/server";
import { authenticateTeacher } from "@/lib/middleware/auth";
import { prisma } from "@/lib/prisma";
import { successResponse, errorResponse, safeErrorMessage } from "@/lib/response";
import { AppError } from "@/lib/errors";

export async function GET(req: NextRequest) {
  try {
    const payload = await authenticateTeacher(req);

    const teacher = await prisma.teacher.findUnique({
      where: { id: payload.teacherId },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        phone: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    if (!teacher) {
      return errorResponse("NOT_FOUND", "Data guru tidak ditemukan", 404);
    }

    return successResponse(teacher);
  } catch (err: any) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    return errorResponse("INTERNAL_SERVER_ERROR", safeErrorMessage(err, "Gagal mengambil data user"), 500);
  }
}
