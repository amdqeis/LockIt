import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { generateStudentSessionToken, hashStudentToken } from "@/lib/auth";
import { successResponse, errorResponse, safeErrorMessage } from "@/lib/response";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { createRequestLogger } from "@/lib/logger";

const joinSchema = z.object({
  accessCode: z.string().min(4, "Kode akses tidak valid").max(10).trim(),
  name: z.string().min(2, "Nama minimal 2 karakter").max(100).trim(),
  nim: z.string().min(3, "NIM minimal 3 karakter").max(30).trim(),
});

export async function POST(req: NextRequest) {
  // LOW-02: middleware.ts sudah inject x-request-id ke setiap request — pakai yang sama
  const log = createRequestLogger(req.headers.get("x-request-id") ?? undefined);
  try {
    const clientIp = getClientIp(req.headers);
    const userAgent = req.headers.get("user-agent") || null;
    log.info("Student join attempt", { ip: clientIp });

    // Rate limiting: 5 attempts per 5 minutes per IP
    const rateLimit = checkRateLimit(clientIp, {
      windowMs: 5 * 60 * 1000,
      max: 5,
      keyPrefix: "exam:join",
    });

    if (!rateLimit.success) {
      return errorResponse(
        "TOO_MANY_REQUESTS",
        `Terlalu banyak percobaan join yang gagal. Coba lagi dalam ${rateLimit.retryAfterSeconds} detik.`,
        429,
        { retryAfter: rateLimit.retryAfterSeconds }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return errorResponse("INVALID_BODY", "Request body harus berupa JSON", 400);
    }

    const parsed = joinSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Data join tidak valid", 400, parsed.error.flatten().fieldErrors);
    }

    const { accessCode, name, nim } = parsed.data;

    // Find Exam by access code (case-insensitive)
    const exam = await prisma.exam.findFirst({
      where: {
        accessCode: { equals: accessCode.toUpperCase() },
      },
    });

    if (!exam) {
      return errorResponse("EXAM_NOT_FOUND", "Ujian dengan kode akses tersebut tidak ditemukan", 404);
    }

    if (exam.status === "draft") {
      return errorResponse("EXAM_NOT_STARTED", "Ujian belum dibuka oleh dosen/guru pengawas", 400);
    }

    if (exam.status === "ended" || exam.status === "archived") {
      return errorResponse("EXAM_ENDED", "Ujian telah berakhir", 400);
    }

    const now = new Date();
    if (exam.endTime && now > exam.endTime) {
      return errorResponse("EXAM_TIME_EXPIRED", "Waktu pengerjaan ujian telah berakhir", 400);
    }

    // Check if student with same NIM already exists in this exam
    let student = await prisma.student.findUnique({
      where: {
        examId_nim: {
          examId: exam.id,
          nim,
        },
      },
    });

    // Bug fix: deklarasi di scope luar agar tersedia di kedua path (reconnect & new student)
    // dan bisa dipakai saat cookies.set. DB hanya menyimpan hash-nya (sessionTokenHash).
    let freshToken: string;

    if (student) {
      if (student.status === "submitted") {
        return errorResponse("ALREADY_SUBMITTED", "NIM ini telah menyelesaikan dan mengumpulkan ujian", 403);
      }

      // HIGH-04: Pastikan ujian masih aktif sebelum mengizinkan reconnect
      if (exam.status !== "active") {
        return errorResponse("EXAM_NOT_ACTIVE", "Ujian sudah berakhir, sesi tidak dapat dilanjutkan", 403);
      }

      // Reconnect scenario
      const previousIp = student.ipAddress;
      log.info("Student reconnect", { studentId: student.id, nim: student.nim, examId: exam.id });
      freshToken = generateStudentSessionToken({
        studentId: student.id,
        examId: exam.id,
        nim: student.nim,
      });

      student = await prisma.student.update({
        where: { id: student.id },
        data: {
          // LOW-04: Simpan hash token, bukan token asli
          sessionTokenHash: hashStudentToken(freshToken),
          status: "active",
          ipAddress: clientIp,
          userAgent,
        },
      });

      // HIGH-07: Catat IP change untuk deteksi potensi impersonasi oleh guru
      const ipChanged = !!previousIp && previousIp !== clientIp;
      await prisma.proctoringEvent.create({
        data: {
          studentId: student.id,
          examId: exam.id,
          eventType: "reconnect",
          metadata: {
            newIp: clientIp,
            oldIp: previousIp ?? null,
            ipChanged,
            reason: "rejoined_with_code",
          },
        },
      });
    } else {
      // New student joining
      const dummyId = crypto.randomUUID();
      log.info("New student joining", { nim, examId: exam.id });
      freshToken = generateStudentSessionToken({
        studentId: dummyId,
        examId: exam.id,
        nim,
      });

      // LOW-04: Simpan hash token, bukan token asli
      const freshTokenHash = hashStudentToken(freshToken);

      student = await prisma.student.create({
        data: {
          id: dummyId,
          examId: exam.id,
          name,
          nim,
          sessionTokenHash: freshTokenHash,
          status: "active",
          ipAddress: clientIp,
          userAgent,
        },
      });
    }

    const response = successResponse({
      student: {
        id: student.id,
        name: student.name,
        nim: student.nim,
        examId: student.examId,
        status: student.status,
      },
      exam: {
        id: exam.id,
        title: exam.title,
        description: exam.description,
        durationMinutes: exam.durationMinutes,
        startTime: exam.startTime,
        endTime: exam.endTime,
        serverTime: new Date().toISOString(),
      },
    });

    // Bug fix: gunakan freshToken (JWT asli), BUKAN student.sessionTokenHash.
    // Hash hanya disimpan di DB untuk verifikasi; browser butuh JWT asli untuk autentikasi.
    response.cookies.set("studentSession", freshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: exam.durationMinutes * 60 + 3600, // Duration + 1 hr buffer
    });

    log.info("Join success", { studentId: student.id, nim: student.nim, examId: exam.id });
    return response;
  } catch (err: any) {
    log.error("Join error", { err: safeErrorMessage(err, "unknown") });
    return errorResponse("INTERNAL_SERVER_ERROR", safeErrorMessage(err, "Gagal bergabung ke ujian"), 500);
  }
}
