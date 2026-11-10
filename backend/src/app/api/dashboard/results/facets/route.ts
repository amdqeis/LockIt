import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { authenticateTeacher } from "@/lib/middleware/auth";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { errorResponse, safeErrorMessage, successResponse } from "@/lib/response";

export async function GET(req: NextRequest) {
  try {
    const teacher = await authenticateTeacher(req);
    const where: Prisma.ExamWhereInput = { status: { in: ["active", "ended", "archived"] }, ...(teacher.role === "ADMIN" ? {} : { teacherId: teacher.teacherId }) };
    const [subjects, classes, periods, categories] = await Promise.all([
      prisma.exam.groupBy({ by: ["subjectName"], where, orderBy: { subjectName: "asc" } }),
      prisma.exam.groupBy({ by: ["className"], where, orderBy: { className: "asc" } }),
      prisma.exam.groupBy({ by: ["academicYear", "semester"], where, orderBy: [{ academicYear: "desc" }, { semester: "asc" }] }),
      prisma.exam.groupBy({ by: ["category"], where, orderBy: { category: "asc" } }),
    ]);
    return successResponse({
      subject: subjects.flatMap(value => value.subjectName ? [value.subjectName] : []),
      className: classes.flatMap(value => value.className ? [value.className] : []),
      period: periods.flatMap(value => value.academicYear && value.semester ? [`${value.academicYear} · ${value.semester}`] : []),
      category: categories.flatMap(value => value.category ? [value.category] : []),
    }, 200, { "Cache-Control": "private, no-store" });
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err.code, err.message, err.statusCode, err.details);
    return errorResponse("INTERNAL_SERVER_ERROR", safeErrorMessage(err, "Gagal memuat pilihan filter hasil"), 500);
  }
}
