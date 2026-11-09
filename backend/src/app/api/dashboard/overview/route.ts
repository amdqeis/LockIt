import { NextRequest } from "next/server";
import { authenticateTeacher } from "@/lib/middleware/auth";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { errorResponse, safeErrorMessage, successResponse } from "@/lib/response";
import { dashboardCacheKey, readDashboardCache, writeDashboardCache } from "@/lib/dashboard-cache";

export async function GET(req: NextRequest) {
  try {
    const teacher = await authenticateTeacher(req);
    const cacheKey = dashboardCacheKey(teacher.role, teacher.teacherId);
    const cached = await readDashboardCache<unknown>(cacheKey);
    if (cached !== null) return successResponse(cached, 200, { "Cache-Control": "private, no-store" });
    const owner = teacher.role === "ADMIN" ? {} : { teacherId: teacher.teacherId };
    const [waiting, ungraded, activeCount, activeExams, draftExams] = await Promise.all([
      prisma.student.count({ where: { status: "waiting", exam: { ...owner, status: { in: ["draft", "active"] } } } }),
      prisma.answer.count({ where: { isCorrect: null, selectedOption: { not: null }, NOT: { selectedOption: "" }, question: { type: "short_answer" }, student: { status: "submitted", exam: { ...owner } } } }),
      prisma.exam.count({ where: { ...owner, status: "active" } }),
      prisma.exam.findMany({ where: { ...owner, status: "active" }, orderBy: [{ startTime: "desc" }, { id: "desc" }], take: 6, select: { id: true, title: true, status: true, className: true, scheduledStartAt: true, _count: { select: { questions: true } } } }),
      prisma.exam.findMany({ where: { ...owner, status: "draft" }, orderBy: [{ scheduledStartAt: { sort: "asc", nulls: "last" } }, { id: "desc" }], take: 6, select: { id: true, title: true, status: true, className: true, scheduledStartAt: true, _count: { select: { questions: true } } } }),
    ]);
    const data = { waiting, ungraded, activeCount, exams: [...activeExams, ...draftExams].slice(0, 6) };
    await writeDashboardCache(cacheKey, data);
    return successResponse(data, 200, { "Cache-Control": "private, no-store" });
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err.code, err.message, err.statusCode, err.details);
    return errorResponse("INTERNAL_SERVER_ERROR", safeErrorMessage(err, "Gagal memuat ringkasan"), 500);
  }
}
