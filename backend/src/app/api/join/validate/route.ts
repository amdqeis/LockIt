import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
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
    if (!code || code.trim().length < 4) {
      return errorResponse("MISSING_CODE", "Parameter kode ujian wajib diisi (min 4 karakter)", 400);
    }

    const exam = await prisma.exam.findFirst({
      where: { accessCode: { equals: code.trim().toUpperCase() } },
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

    if (exam.status === "draft") {
      return errorResponse("EXAM_NOT_STARTED", "Ujian belum dibuka oleh pengawas", 409);
    }

    if (exam.status === "ended" || exam.status === "archived") {
      return errorResponse("EXAM_ENDED", "Ujian telah berakhir", 410);
    }

    const now = new Date();
    if (exam.endTime && now > exam.endTime) {
      return errorResponse("EXAM_TIME_EXPIRED", "Waktu ujian telah berakhir", 410);
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
