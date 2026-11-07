import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { errorResponse, successResponse } from "@/lib/response";
import { findBrowserIdentity } from "@/lib/browser-identity";
import { buildStudentReview } from "@/services/student-review";

function privateResponse(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ studentId: string }> }) {
  try {
    const { studentId } = await params;
    const browser = await findBrowserIdentity(req);
    if (!browser) return privateResponse(errorResponse("BROWSER_SESSION_REQUIRED", "Riwayat browser tidak tersedia", 401));

    const link = await prisma.browserStudent.findUnique({
      where: { browserId_studentId: { browserId: browser.id, studentId } },
      include: { student: { include: { exam: true } } },
    });
    if (!link) return privateResponse(errorResponse("NOT_FOUND", "Riwayat ujian tidak ditemukan", 404));

    return privateResponse(successResponse(await buildStudentReview(link.student)));
  } catch (error) {
    if (error instanceof AppError) return privateResponse(errorResponse(error.code, error.message, error.statusCode, error.details));
    return privateResponse(errorResponse("INTERNAL_SERVER_ERROR", "Gagal memuat review jawaban", 500));
  }
}
