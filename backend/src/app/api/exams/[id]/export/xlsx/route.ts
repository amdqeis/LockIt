import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { authenticateTeacher } from "@/lib/middleware/auth";
import { prisma } from "@/lib/prisma";
import { autoGradeExam, getExamResults } from "@/services/grading";
import { errorResponse, safeErrorMessage } from "@/lib/response";
import { AppError } from "@/lib/errors";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const teacher = await authenticateTeacher(req);
    const { id } = await params;

    const exam = await prisma.exam.findUnique({
      where: { id },
      include: { _count: { select: { questions: true } } },
    });

    if (!exam || exam.teacherId !== teacher.teacherId) {
      return errorResponse("NOT_FOUND", "Ujian tidak ditemukan", 404);
    }

    const { statistics, students } = await getExamResults(id);

    // Create Excel Workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "LockIt Proctoring System";
    workbook.created = new Date();

    const sheet = workbook.addWorksheet("Rekap Nilai", {
      views: [{ showGridLines: true }],
    });

    // 1. Title Banner
    sheet.mergeCells("A1:G1");
    const titleCell = sheet.getCell("A1");
    titleCell.value = `REKAPITULASI HASIL UJIAN: ${exam.title.toUpperCase()}`;
    titleCell.font = { name: "Arial", size: 14, bold: true, color: { argb: "FFFFFFFF" } };
    titleCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1E3A8A" }, // Dark Blue
    };
    titleCell.alignment = { horizontal: "center", vertical: "middle" };
    sheet.getRow(1).height = 30;

    // 2. Metadata Rows
    sheet.getCell("A3").value = "Kode Akses:";
    sheet.getCell("B3").value = exam.accessCode;
    sheet.getCell("A4").value = "Durasi:";
    sheet.getCell("B4").value = `${exam.durationMinutes} Menit`;
    sheet.getCell("A5").value = "Jumlah Soal:";
    sheet.getCell("B5").value = exam._count.questions;

    sheet.getCell("E3").value = "Total Peserta:";
    sheet.getCell("F3").value = statistics.totalStudents;
    sheet.getCell("E4").value = "Rata-rata Nilai:";
    sheet.getCell("F4").value = statistics.averageScore;
    sheet.getCell("E5").value = "Nilai Min / Max:";
    sheet.getCell("F5").value = `${statistics.minScore} / ${statistics.maxScore}`;

    ["A3", "A4", "A5", "E3", "E4", "E5"].forEach((cellRef) => {
      sheet.getCell(cellRef).font = { bold: true };
    });

    // 3. Table Headers
    const headers = ["No", "Nama Mahasiswa", "NIM", "Nilai Akhir", "Pelanggaran", "Status", "Waktu Selesai"];
    const headerRow = sheet.getRow(7);
    headerRow.values = headers;
    headerRow.height = 24;

    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF3B82F6" }, // Blue
      };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = {
        top: { style: "thin" },
        bottom: { style: "thin" },
        left: { style: "thin" },
        right: { style: "thin" },
      };
    });

    // 4. Data Rows
    students.forEach((s, idx) => {
      const row = sheet.addRow([
        idx + 1,
        s.name,
        s.nim,
        s.finalScore,
        s.violationCount,
        s.status === "submitted" ? "Selesai" : "Belum Submit",
        s.submittedAt ? s.submittedAt.toLocaleString("id-ID") : "-",
      ]);

      row.height = 20;

      // Center columns for No, NIM, Nilai, Pelanggaran, Status
      row.getCell(1).alignment = { horizontal: "center" };
      row.getCell(3).alignment = { horizontal: "center" };
      row.getCell(4).alignment = { horizontal: "center" };
      row.getCell(5).alignment = { horizontal: "center" };
      row.getCell(6).alignment = { horizontal: "center" };
      row.getCell(7).alignment = { horizontal: "center" };

      // Highlight score cell
      const scoreCell = row.getCell(4);
      scoreCell.font = { bold: true };
      if (s.finalScore >= 70) {
        scoreCell.font = { bold: true, color: { argb: "FF166534" } }; // Green
      } else {
        scoreCell.font = { bold: true, color: { argb: "FF991B1B" } }; // Red
      }

      // Highlight violation if > 0
      const violCell = row.getCell(5);
      if (s.violationCount > 0) {
        violCell.font = { bold: true, color: { argb: "FFB91C1C" } };
      }

      row.eachCell((cell) => {
        cell.border = {
          top: { style: "thin", color: { argb: "FFE5E7EB" } },
          bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
          left: { style: "thin", color: { argb: "FFE5E7EB" } },
          right: { style: "thin", color: { argb: "FFE5E7EB" } },
        };
      });
    });

    // Adjust column widths
    sheet.columns = [
      { width: 6 },  // No
      { width: 30 }, // Nama
      { width: 18 }, // NIM
      { width: 14 }, // Nilai Akhir
      { width: 14 }, // Pelanggaran
      { width: 16 }, // Status
      { width: 22 }, // Waktu Selesai
    ];

    const buffer = await workbook.xlsx.writeBuffer();

    const safeTitle = exam.title.replace(/[^a-zA-Z0-9_-]/g, "_");
    const fileName = `hasil_ujian_${safeTitle}_${exam.accessCode}.xlsx`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (err: any) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    return errorResponse("INTERNAL_SERVER_ERROR", safeErrorMessage(err, "Gagal mengexport Excel"), 500);
  }
}
