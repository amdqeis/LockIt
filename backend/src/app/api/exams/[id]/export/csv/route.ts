import { NextRequest, NextResponse } from "next/server";
import { authenticateTeacher } from "@/lib/middleware/auth";
import { prisma } from "@/lib/prisma";
import { autoGradeExam } from "@/services/grading";
import { errorResponse, safeErrorMessage } from "@/lib/response";
import { AppError } from "@/lib/errors";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const teacher = await authenticateTeacher(req);
    const { id } = await params;

    const exam = await prisma.exam.findUnique({ where: { id } });
    if (!exam || (teacher.role !== "ADMIN" && exam.teacherId !== teacher.teacherId)) {
      return errorResponse("NOT_FOUND", "Ujian tidak ditemukan", 404);
    }

    const summaries = await autoGradeExam(id);

    // Build CSV content
    const header = ["Nama", "NISN", "Nilai", "Jumlah Pelanggaran", "Status", "Waktu Selesai"];
    const rows = summaries.map((s) => [
      `"${s.name.replace(/"/g, '""')}"`,
      `"${s.nisn}"`,
      s.finalScore,
      s.violationCount,
      s.status,
      s.submittedAt ? `"${s.submittedAt.toISOString()}"` : '"Belum Submit"',
    ]);

    const csvContent = [header.join(","), ...rows.map((r) => r.join(","))].join("\r\n");

    const safeTitle = exam.title.replace(/[^a-zA-Z0-9_-]/g, "_");
    const fileName = `hasil_ujian_${safeTitle}_${exam.accessCode}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (err: any) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    return errorResponse("INTERNAL_SERVER_ERROR", safeErrorMessage(err, "Gagal mengexport CSV"), 500);
  }
}
