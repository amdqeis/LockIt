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

    if (!exam) {
      return errorResponse("NOT_FOUND", "Ujian tidak ditemukan", 404);
    }

    const [resultsData, questions, allAnswers] = await Promise.all([
      getExamResults(id),
      prisma.question.findMany({
        where: { examId: id },
        orderBy: { orderIndex: "asc" },
      }),
      prisma.answer.findMany({
        where: { question: { examId: id } },
        select: {
          studentId: true,
          questionId: true,
          selectedOption: true,
          isCorrect: true,
        },
      }),
    ]);
    const { statistics, students } = resultsData;
    const answerMap = new Map<string, { selectedOption: string | null; isCorrect: boolean | null }>();
    allAnswers.forEach((a) => {
      answerMap.set(`${a.studentId}_${a.questionId}`, { selectedOption: a.selectedOption, isCorrect: a.isCorrect });
    });

    // Create Excel Workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "EduQuas Proctoring System";
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
    const examSettings = (typeof exam.settings === "object" && exam.settings !== null ? exam.settings : {}) as any;
    const className = examSettings.class_name || "Semua Kelas / Umum";
    const examType = examSettings.exam_type || "Ujian Umum";

    sheet.getCell("A3").value = "Kode Akses:";
    sheet.getCell("B3").value = exam.accessCode;
    sheet.getCell("A4").value = "Durasi:";
    sheet.getCell("B4").value = `${exam.durationMinutes} Menit`;
    sheet.getCell("A5").value = "Jumlah Soal:";
    sheet.getCell("B5").value = exam._count.questions;

    sheet.getCell("C3").value = "Kelas:";
    sheet.getCell("D3").value = className;
    sheet.getCell("C4").value = "Kategori Ujian:";
    sheet.getCell("D4").value = examType;

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
    const headers = ["No", "Nama Siswa", "NISN", "Nilai", "Pelanggaran", "Status", "Waktu Selesai", "Penilaian Manual Tertunda"];
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
        s.nisn,
        s.finalScore,
        s.violationCount,
        s.status === "submitted" ? "Selesai" : "Belum Submit",
        s.submittedAt ? s.submittedAt.toLocaleString("id-ID") : "-",
        s.pendingManualCount,
      ]);

      row.height = 20;

      // Center columns for No, NISN, Nilai, Pelanggaran, Status
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
      { width: 18 }, // NISN
      { width: 14 }, // Nilai Akhir
      { width: 14 }, // Pelanggaran
      { width: 16 }, // Status
      { width: 22 }, // Waktu Selesai
      { width: 26 }, // Penilaian manual
    ];

    // 5. Worksheet Rincian Jawaban Per Butir Soal
    if (questions.length > 0) {
      const detailSheet = workbook.addWorksheet("Rincian Jawaban", {
        views: [{ showGridLines: true }],
      });

      const detailHeaders = [
        "No",
        "Nama Siswa",
        "NISN",
        ...questions.map((q, idx) => `Soal ${idx + 1} (${q.type === "short_answer" ? "Isian" : "PG"})`),
      ];

      const dHeaderRow = detailSheet.getRow(1);
      dHeaderRow.values = detailHeaders;
      dHeaderRow.height = 24;
      dHeaderRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF1E3A8A" },
        };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.border = {
          top: { style: "thin" },
          bottom: { style: "thin" },
          left: { style: "thin" },
          right: { style: "thin" },
        };
      });

      students.forEach((s, idx) => {
        const rowValues = [
          idx + 1,
          s.name,
          s.nisn,
          ...questions.map((q) => {
            const ans = answerMap.get(`${s.studentId}_${q.id}`);
            if (q.type === "short_answer") {
              // Untuk short_answer tampilkan answer.selectedOption apa adanya, bukan simbol benar/salah
              return ans?.selectedOption || "-";
            }
            if (!ans || !ans.selectedOption) return "-";
            return ans.isCorrect ? `✓ (${ans.selectedOption})` : `✗ (${ans.selectedOption})`;
          }),
        ];
        const row = detailSheet.addRow(rowValues);
        row.height = 20;

        row.getCell(1).alignment = { horizontal: "center" };
        row.getCell(3).alignment = { horizontal: "center" };

        row.eachCell((cell) => {
          cell.border = {
            top: { style: "thin", color: { argb: "FFE5E7EB" } },
            bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
            left: { style: "thin", color: { argb: "FFE5E7EB" } },
            right: { style: "thin", color: { argb: "FFE5E7EB" } },
          };
        });
      });

      detailSheet.columns = [
        { width: 6 },
        { width: 28 },
        { width: 18 },
        ...questions.map((q) => ({ width: q.type === "short_answer" ? 30 : 16 })),
      ];
    }

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
