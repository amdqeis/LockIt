import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyStudentSessionToken } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/response";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { createRequestLogger } from "@/lib/logger";

// GET /api/join/validate?code=ABC123
// Digunakan oleh halaman / untuk memvalidasi kode ujian sebelum siswa mengisi nama + NISN.
// Rate limit lebih longgar dari POST /api/join (10x / 5 menit vs 5x / 5 menit).
export async function GET(req: NextRequest) {
  const log = createRequestLogger(req.headers.get("x-request-id") ?? undefined);
  try {
    const clientIp = getClientIp(req.headers);

    // Rate limit: 10x per 5 menit per IP
    const rateLimit = checkRateLimit(clientIp, {
      windowMs: 5 * 60 * 1000,
      max: 10,
      keyPrefix: "join:validate",
    });

    if (!rateLimit.success) {
      return errorResponse(
        "TOO_MANY_REQUESTS",
        "Terlalu banyak percobaan. Coba lagi beberapa menit lagi.",
        429,
        { retryAfter: rateLimit.retryAfterSeconds }
      );
    }

    const code = req.nextUrl.searchParams.get("code");
    const normalizedCode = code?.trim() ?? "";
    if (!/^[A-Za-z0-9]{6}$/.test(normalizedCode)) {
      return errorResponse("INVALID_CODE", "Kode ujian harus terdiri dari 6 karakter huruf atau angka.", 400);
    }

    const exam = await prisma.exam.findFirst({
      where: { accessCode: { equals: normalizedCode.toUpperCase() } },
      select: {
        id: true,
        title: true,
        status: true,
        durationMinutes: true,
        endTime: true,
      },
    });

    if (!exam) {
      return errorResponse("EXAM_NOT_FOUND", "Kode ujian tidak ditemukan", 404);
    }


    if (exam.status === "ended" || exam.status === "archived") {
      return errorResponse("EXAM_ENDED", "Ujian telah berakhir", 410);
    }

    const now = new Date();
    if (exam.endTime && now > exam.endTime) {
      return errorResponse("EXAM_TIME_EXPIRED", "Waktu ujian telah berakhir", 410);
    }

    // Deteksi jika token/perangkat ini telah menyelesaikan ujian ini
    const cookieToken = req.cookies.get("studentSession")?.value;
    const headerToken = req.headers.get("x-student-session");
    const existingToken = cookieToken || headerToken;

    if (existingToken) {
      const existingPayload = verifyStudentSessionToken(existingToken);
      if (existingPayload && existingPayload.examId === exam.id) {
        const studentFromToken = await prisma.student.findUnique({
          where: { id: existingPayload.studentId },
          select: { status: true },
        });

        if (studentFromToken && studentFromToken.status === "submitted") {
          return errorResponse(
            "ALREADY_SUBMITTED",
            "Anda sudah menyelesaikan dan mengumpulkan ujian ini.",
            403
          );
        }
      }
    }

    log.info("Validate code success", { examId: exam.id, status: exam.status });

    return successResponse({
      exam: {
        title: exam.title,
        status: exam.status,
        durationMinutes: exam.durationMinutes,
        endTime: exam.endTime?.toISOString() ?? null,
        serverTime: now.toISOString(),
      },
    });
  } catch (err: any) {
    log.error("Validate code error", { err });
    return errorResponse("INTERNAL_SERVER_ERROR", "Gagal memvalidasi kode ujian", 500);
  }
}
