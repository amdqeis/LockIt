import { NextRequest } from "next/server";
import { authenticateTeacher } from "@/lib/middleware/auth";
import { prisma } from "@/lib/prisma";
import { generateUniqueAccessCode } from "@/lib/code-generator";
import { successResponse, errorResponse, safeErrorMessage } from "@/lib/response";
import { AppError } from "@/lib/errors";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const teacher = await authenticateTeacher(req);
    const { id } = await params;

    const exam = await prisma.exam.findUnique({
      where: { id },
    });

    if (!exam || exam.teacherId !== teacher.teacherId) {
      return errorResponse("NOT_FOUND", "Ujian tidak ditemukan", 404);
    }

    if (exam.status === "ended" || exam.status === "archived") {
      return errorResponse("INVALID_STATE", "Tidak dapat membuat kode baru untuk ujian yang sudah berakhir/diarsipkan", 400);
    }

    const newCode = await generateUniqueAccessCode(6);

    const updated = await prisma.exam.update({
      where: { id },
      data: { accessCode: newCode },
    });

    return successResponse({
      accessCode: updated.accessCode,
      message: "Kode akses berhasil diperbarui",
    });
  } catch (err: any) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    return errorResponse("INTERNAL_SERVER_ERROR", safeErrorMessage(err, "Gagal mengubah kode akses"), 500);
  }
}
