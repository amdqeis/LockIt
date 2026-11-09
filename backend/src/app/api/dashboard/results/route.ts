import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { authenticateTeacher } from "@/lib/middleware/auth";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { errorResponse, safeErrorMessage, successResponse } from "@/lib/response";
import { calculateScore } from "@/services/score-calculation";

const querySchema = z.object({
  mode: z.enum(["list", "matrix"]).default("list"),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  subject: z.string().trim().max(100).optional(),
  className: z.string().trim().max(100).optional(),
  academicYear: z.string().trim().max(30).optional(),
  semester: z.enum(["ganjil", "genap"]).optional(),
  category: z.string().trim().max(100).optional(),
  search: z.string().trim().max(100).optional(),
  format: z.enum(["json", "csv"]).default("json"),
});
function csvCell(value: unknown) {
  const text = String(value ?? "");
  return `"${(/^[\t\r\n ]*[=+\-@]/.test(text) ? `'${text}` : text).replaceAll('"', '""')}"`;
}

export async function GET(req: NextRequest) {
  try {
    const teacher = await authenticateTeacher(req);
    const parsed = querySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
    if (!parsed.success) return errorResponse("VALIDATION_ERROR", "Filter hasil tidak valid", 400, parsed.error.flatten());
    const { mode, page, limit, subject, className, academicYear, semester, category, search, format } = parsed.data;
    const where: Prisma.ExamWhereInput = {
      status: { in: ["ended", "archived"] },
      ...(teacher.role === "ADMIN" ? {} : { teacherId: teacher.teacherId }),
      ...(subject ? { subjectName: subject } : {}), ...(className ? { className } : {}),
      ...(academicYear ? { academicYear } : {}), ...(semester ? { semester } : {}), ...(category ? { category } : {}),
      ...(search ? { OR: ["title", "subjectName", "className", "category", "academicYear"].map(field => ({ [field]: { contains: search, mode: "insensitive" } })) } : {}),
    };
    const exams = await prisma.exam.findMany({
      where, orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { id: true, title: true, subjectName: true, className: true, academicYear: true, semester: true, category: true, categoryNumber: true, passingScore: true },
    });
    const examIds = exams.map(exam => exam.id);
    const studentWhere: Prisma.StudentWhereInput = { examId: { in: examIds }, status: "submitted" };
    const allForExport = format === "csv";
    const skip = (page - 1) * limit;
    let total = 0;
    let nisns: string[] | null = null;
    if (mode === "matrix") {
      const groups = await prisma.student.groupBy({ by: ["nisn"], where: studentWhere, orderBy: { nisn: "asc" }, ...(!allForExport ? { skip, take: limit } : {}) });
      nisns = groups.map(group => group.nisn);
      total = allForExport ? nisns.length : (await prisma.student.groupBy({ by: ["nisn"], where: studentWhere })).length;
    } else total = await prisma.student.count({ where: studentWhere });
    const students = await prisma.student.findMany({
      where: { ...studentWhere, ...(nisns ? { nisn: { in: nisns } } : {}) },
      orderBy: [{ submittedAt: "desc" }, { id: "desc" }],
      ...(mode === "list" && !allForExport ? { skip, take: limit } : {}),
      select: { id: true, examId: true, name: true, nisn: true, status: true, submittedAt: true, violationCount: true, answers: { select: { questionId: true, selectedOption: true, isCorrect: true } } },
    });
    const pageExamIds = [...new Set(students.map(student => student.examId))];
    const questions = await prisma.question.findMany({ where: { examId: { in: pageExamIds } }, select: { id: true, examId: true, type: true, points: true } });
    const byExam = new Map(exams.map(exam => [exam.id, exam]));
    const attempts = students.map(student => ({ exam: byExam.get(student.examId)!, student: { studentId: student.id, name: student.name, nisn: student.nisn, status: student.status, submittedAt: student.submittedAt, violationCount: student.violationCount, ...calculateScore(questions.filter(question => question.examId === student.examId), student.answers) } }));
    const matrixStudents = nisns?.map(nisn => {
      const entries = attempts.filter(attempt => attempt.student.nisn === nisn);
      return { nisn, name: entries[0]?.student.name || "", scores: Object.fromEntries(entries.map(entry => [entry.exam.id, { finalScore: entry.student.finalScore, pendingManualCount: entry.student.pendingManualCount }])) };
    }) || [];
    if (format === "csv") {
      const rows: unknown[][] = mode === "list"
        ? [["Nama", "NISN", "Ujian", "Kelas", "Mata pelajaran", "Tahun ajaran", "Semester", "Nilai", "Status penilaian", "Pelanggaran", "Waktu selesai"], ...attempts.map(({ exam, student }) => [student.name, student.nisn, exam.title, exam.className, exam.subjectName, exam.academicYear, exam.semester, student.pendingManualCount ? "" : student.finalScore, student.pendingManualCount ? "Menunggu penilaian" : "Final", student.violationCount, student.submittedAt?.toISOString()])]
        : [["Nama", "NISN", ...exams.map(exam => `${exam.title} (${exam.id.slice(0, 8)})`)], ...matrixStudents.map(student => [student.name, student.nisn, ...exams.map(exam => { const score = student.scores[exam.id]; return !score ? "" : score.pendingManualCount ? "Menunggu penilaian" : score.finalScore; })])];
      return new NextResponse(`\uFEFF${rows.map(row => row.map(csvCell).join(",")).join("\r\n")}`, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="hasil-${mode}.csv"`, "Cache-Control": "private, no-store" } });
    }
    return successResponse({ exams, attempts: mode === "list" ? attempts : [], students: matrixStudents, page, total, totalPages: Math.ceil(total / limit) }, 200, { "Cache-Control": "private, no-store" });
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err.code, err.message, err.statusCode, err.details);
    return errorResponse("INTERNAL_SERVER_ERROR", safeErrorMessage(err, "Gagal mengambil rekap hasil"), 500);
  }
}
