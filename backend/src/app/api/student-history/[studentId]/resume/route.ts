import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateStudentSessionToken, hashStudentToken } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { errorResponse, successResponse } from "@/lib/response";
import { findBrowserIdentity } from "@/lib/browser-identity";
import { canResumeStudent } from "@/lib/proctoring-events";

function privateResponse(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ studentId: string }> }) {
  try {
    const { studentId } = await params;
    const browser = await findBrowserIdentity(req);
    if (!browser) return privateResponse(errorResponse("BROWSER_SESSION_REQUIRED", "Riwayat browser tidak tersedia", 401));

    const link = await prisma.browserStudent.findUnique({
      where: { browserId_studentId: { browserId: browser.id, studentId } },
      include: { student: { include: { exam: true } } },
    });
    if (!link) return privateResponse(errorResponse("NOT_FOUND", "Riwayat ujian tidak ditemukan", 404));

    const { student } = link;
    if (!canResumeStudent({ studentStatus: student.status, examStatus: student.exam.status, endTime: student.exam.endTime })) {
      return privateResponse(errorResponse("SESSION_NOT_RESUMABLE", "Sesi ini tidak dapat dilanjutkan", 409));
    }

    const token = generateStudentSessionToken({ studentId: student.id, examId: student.examId, nisn: student.nisn });
    const updated = await prisma.student.updateMany({
      where: {
        id: student.id,
        status: { in: ["waiting", "accepted", "active", "disconnected"] },
      },
      data: { sessionTokenHash: hashStudentToken(token) },
    });
    if (updated.count !== 1) return privateResponse(errorResponse("SESSION_NOT_RESUMABLE", "Sesi ini tidak dapat dilanjutkan", 409));

    const response = successResponse({
      studentId: student.id,
      nextStep: student.status === "active" && student.exam.status === "active" ? "session" : "waiting_room",
      isLocked: student.isLocked,
    });
    response.cookies.set("studentSession", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: student.exam.durationMinutes * 60 + 3600,
    });
    return privateResponse(response);
  } catch (error) {
    if (error instanceof AppError) return privateResponse(errorResponse(error.code, error.message, error.statusCode, error.details));
    return privateResponse(errorResponse("INTERNAL_SERVER_ERROR", "Gagal melanjutkan ujian", 500));
  }
}
