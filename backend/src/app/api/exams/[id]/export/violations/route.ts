import { NextRequest, NextResponse } from "next/server";
import { authenticateTeacher } from "@/lib/middleware/auth";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/response";
import { AppError } from "@/lib/errors";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const teacher = await authenticateTeacher(req);
    const { id } = await params;

    const exam = await prisma.exam.findUnique({ where: { id } });
    if (!exam || exam.teacherId !== teacher.teacherId) {
      return errorResponse("NOT_FOUND", "Ujian tidak ditemukan", 404);
    }

    const events = await prisma.proctoringEvent.findMany({
      where: { examId: id },
      orderBy: { timestamp: "asc" },
      include: {
        student: {
          select: {
            name: true,
            nim: true,
          },
        },
      },
    });

    const header = ["Timestamp (UTC)", "Nama Mahasiswa", "NIM", "Jenis Pelanggaran", "Durasi (ms)", "Metadata"];
    const rows = events.map((ev) => [
      `"${ev.timestamp.toISOString()}"`,
      `"${ev.student.name.replace(/"/g, '""')}"`,
      `"${ev.student.nim}"`,
      `"${ev.eventType}"`,
      ev.durationMs !== null ? ev.durationMs : "-",
      ev.metadata ? `"${JSON.stringify(ev.metadata).replace(/"/g, '""')}"` : '""',
    ]);

    const csvContent = [header.join(","), ...rows.map((r) => r.join(","))].join("\r\n");

    const safeTitle = exam.title.replace(/[^a-zA-Z0-9_-]/g, "_");
    const fileName = `log_pelanggaran_${safeTitle}_${exam.accessCode}.csv`;

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
    return errorResponse("INTERNAL_SERVER_ERROR", err.message || "Gagal mengexport log pelanggaran", 500);
  }
}
