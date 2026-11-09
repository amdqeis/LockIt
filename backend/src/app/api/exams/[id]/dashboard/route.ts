import { NextRequest } from "next/server";
import { authenticateTeacher } from "@/lib/middleware/auth";
import { prisma } from "@/lib/prisma";
import { successResponse, errorResponse, safeErrorMessage } from "@/lib/response";
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

    if (!exam || (teacher.role !== "ADMIN" && exam.teacherId !== teacher.teacherId)) {
      return errorResponse("NOT_FOUND", "Ujian tidak ditemukan", 404);
    }

    // Parallelize all 6 independent dashboard queries to eliminate sequential latency
    const [
      studentStatusCounts,
      totalViolationsResult,
      lockedCount,
      recentEvents,
      recentWarnings,
      lobbyStudents,
    ] = await Promise.all([
      // 1. Aggregate student counts by status
      prisma.student.groupBy({
        by: ["status"],
        where: { examId: id },
        _count: { id: true },
      }),
      // 2. Total violations count across all students
      prisma.student.aggregate({
        where: { examId: id },
        _sum: { violationCount: true },
      }),
      // 3. Locked students count
      prisma.student.count({
        where: {
          examId: id,
          isLocked: true,
          status: { in: ["active", "disconnected"] },
        },
      }),
      // 4. Recent 50 proctoring events
      prisma.proctoringEvent.findMany({
        where: { examId: id },
        orderBy: { timestamp: "desc" },
        take: 50,
        include: {
          student: {
            select: {
              id: true,
              name: true,
              nisn: true,
            },
          },
        },
      }),
      // 5. Recent 5 warnings
      prisma.warning.findMany({
        where: { examId: id },
        orderBy: { sentAt: "desc" },
        take: 5,
        include: {
          student: {
            select: {
              id: true,
              name: true,
              nisn: true,
            },
          },
        },
      }),
      // 6. Peserta yang sedang berada di lobby (waiting atau accepted)
      prisma.student.findMany({
        where: {
          examId: id,
          status: { in: ["waiting", "accepted"] },
        },
        orderBy: { joinedAt: "asc" },
        select: {
          id: true,
          name: true,
          nisn: true,
          status: true,
          joinedAt: true,
          acceptedAt: true,
          ipAddress: true,
        },
      }),
    ]);

    let activeCount = 0;
    let disconnectedCount = 0;
    let submittedCount = 0;
    let waitingCount = 0;
    let acceptedCount = 0;
    let rejectedCount = 0;

    for (const group of studentStatusCounts) {
      if (group.status === "active") activeCount = group._count.id;
      else if (group.status === "disconnected") disconnectedCount = group._count.id;
      else if (group.status === "submitted") submittedCount = group._count.id;
      else if (group.status === "waiting") waitingCount = group._count.id;
      else if (group.status === "accepted") acceptedCount = group._count.id;
      else if (group.status === "rejected") rejectedCount = group._count.id;
    }

    const totalViolations = totalViolationsResult._sum.violationCount || 0;

    return successResponse({
      exam: {
        id: exam.id,
        title: exam.title,
        className: exam.className,
        accessCode: exam.accessCode,
        durationMinutes: exam.durationMinutes,
        status: exam.status,
        startTime: exam.startTime,
        endTime: exam.endTime,
        totalQuestions: exam._count.questions,
      },
      overview: {
        totalJoined: exam._count.students,
        activeCount,
        disconnectedCount,
        submittedCount,
        waitingCount,
        acceptedCount,
        rejectedCount,
        lobbyCount: waitingCount + acceptedCount,
        lockedCount,
        totalViolations,
      },
      lobbyStudents: lobbyStudents.map((s) => ({
        id: s.id,
        name: s.name,
        nisn: s.nisn,
        status: s.status,
        joinedAt: s.joinedAt.toISOString(),
        acceptedAt: s.acceptedAt ? s.acceptedAt.toISOString() : null,
        ipAddress: s.ipAddress,
      })),
      recentEvents: recentEvents.map((ev) => ({
        id: ev.id,
        studentId: ev.studentId,
        studentName: ev.student.name,
        nisn: ev.student.nisn,
        eventType: ev.eventType,
        durationMs: ev.durationMs,
        metadata: ev.metadata,
        timestamp: ev.timestamp.toISOString(),
      })),
      recentWarnings: recentWarnings.map((w) => ({
        id: w.id,
        studentId: w.studentId,
        studentName: w.student.name,
        nisn: w.student.nisn,
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
    return errorResponse("INTERNAL_SERVER_ERROR", safeErrorMessage(err, "Gagal mengambil data dashboard ujian"), 500);
  }
}
