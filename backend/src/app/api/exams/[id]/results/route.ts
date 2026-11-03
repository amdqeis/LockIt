import { NextRequest } from "next/server";
import { authenticateTeacher } from "@/lib/middleware/auth";
import { prisma } from "@/lib/prisma";
import { getExamResults } from "@/services/grading";
import { successResponse, errorResponse, safeErrorMessage } from "@/lib/response";
import { AppError } from "@/lib/errors";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const teacher = await authenticateTeacher(req);
    const { id } = await params;

    let results;
    try {
      results = await getExamResults(id);
    } catch {
      return errorResponse("NOT_FOUND", "Ujian tidak ditemukan", 404);
    }

    if (teacher.role !== "ADMIN" && results.exam.teacherId !== teacher.teacherId) {
      return errorResponse("NOT_FOUND", "Ujian tidak ditemukan", 404);
    }

    return successResponse(results);
  } catch (err: any) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    return errorResponse("INTERNAL_SERVER_ERROR", safeErrorMessage(err, "Gagal mengambil rekap hasil ujian"), 500);
  }
}
