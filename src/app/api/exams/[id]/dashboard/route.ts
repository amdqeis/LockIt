import { NextRequest } from "next/server";
import { authenticateTeacher } from "@/lib/middleware/auth";
import { prisma } from "@/lib/prisma";
import { successResponse, errorResponse } from "@/lib/response";
import { AppError } from "@/lib/errors";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const teacher = await authenticateTeacher(req);
    const { id } = await params;

    const exam = await prisma.exam.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            questions: true,
            students: true,
          },
        },
      },
    });

    if (!exam || exam.teacherId !== teacher.teacherId) {
      return errorResponse("NOT_FOUND", "Ujian tidak ditemukan", 404);
    }

    // Aggregate student counts by status
    const studentStatusCounts = await prisma.student.groupBy({
      by: ["status"],
      where: { examId: id },
      _count: { id: true },
    });

    let onlineCount = 0;
    let disconnectedCount = 0;
    let submittedCount = 0;
    let waitingCount = 0;

    for (const group of studentStatusCounts) {
      if (group.status === "active") onlineCount = group._count.id;
      else if (group.status === "disconnected") disconnectedCount = group._count.id;
      else if (group.status === "submitted") submittedCount = group._count.id;
      else if (group.status === "waiting") waitingCount = group._count.id;
    }

    // Total violations count across all students
    const totalViolationsResult = await prisma.student.aggregate({
      where: { examId: id },
      _sum: { violationCount: true },
    });
    const totalViolations = totalViolationsResult._sum.violationCount || 0;

    // Locked students count
    const lockedCount = await prisma.student.count({
      where: {
        examId: id,
        isLocked: true,
      },
    });

    // Recent 10 proctoring events
    const recentEvents = await prisma.proctoringEvent.findMany({
      where: { examId: id },
      orderBy: { timestamp: "desc" },
      take: 10,
      include: {
        student: {
          select: {
            id: true,
            name: true,
            nim: true,
          },
        },
      },
    });

    // Recent 5 warnings
    const recentWarnings = await prisma.warning.findMany({
      where: { examId: id },
      orderBy: { sentAt: "desc" },
      take: 5,
      include: {
        student: {
          select: {
            id: true,
            name: true,
            nim: true,
          },
        },
      },
    });

    return successResponse({
      exam: {
        id: exam.id,
        title: exam.title,
        accessCode: exam.accessCode,
        durationMinutes: exam.durationMinutes,
        status: exam.status,
        startTime: exam.startTime,
        endTime: exam.endTime,
        totalQuestions: exam._count.questions,
      },
      overview: {
        totalJoined: exam._count.students,
        onlineCount,
        disconnectedCount,
        submittedCount,
        waitingCount,
        lockedCount,
        totalViolations,
      },
      recentEvents: recentEvents.map((ev) => ({
        id: ev.id,
        studentId: ev.studentId,
        studentName: ev.student.name,
        nim: ev.student.nim,
        eventType: ev.eventType,
        durationMs: ev.durationMs,
        metadata: ev.metadata,
        timestamp: ev.timestamp.toISOString(),
      })),
      recentWarnings: recentWarnings.map((w) => ({
        id: w.id,
        studentId: w.studentId,
        studentName: w.student.name,
        nim: w.student.nim,
        message: w.message,
        sentAt: w.sentAt.toISOString(),
        isRead: w.isRead,
      })),
      serverTime: new Date().toISOString(),
    });
  } catch (err: any) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    return errorResponse("INTERNAL_SERVER_ERROR", err.message || "Gagal mengambil data dashboard ujian", 500);
  }
}
