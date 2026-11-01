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
  nisn: z.string().regex(/^\d{10}$/, "NISN harus 10 digit angka").trim(),
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

    const { accessCode, name, nisn } = parsed.data;

    // Find Exam by access code (case-insensitive)
    const exam = await prisma.exam.findFirst({
      where: {
        accessCode: { equals: accessCode.toUpperCase() },
      },
    });

    if (!exam) {
      return errorResponse("EXAM_NOT_FOUND", "Ujian dengan kode akses tersebut tidak ditemukan", 404);
    }

    if (exam.status === "ended" || exam.status === "archived") {
      return errorResponse("EXAM_ENDED", "Ujian telah berakhir", 400);
    }

    const now = new Date();
    if (exam.endTime && now > exam.endTime) {
      return errorResponse("EXAM_TIME_EXPIRED", "Waktu pengerjaan ujian telah berakhir", 400);
    }

    // Check if student with same NISN already exists in this exam
    let student = await prisma.student.findUnique({
      where: {
        examId_nisn: {
          examId: exam.id,
          nisn,
        },
      },
    });

    // Bug fix: deklarasi di scope luar agar tersedia di kedua path (reconnect & new student)
    // dan bisa dipakai saat cookies.set. DB hanya menyimpan hash-nya (sessionTokenHash).
    let freshToken: string;

    if (student) {
      if (student.status === "submitted") {
        return errorResponse("ALREADY_SUBMITTED", "NISN ini telah menyelesaikan dan mengumpulkan ujian", 403);
      }

      if (student.status === "kicked") {
        return errorResponse("STUDENT_KICKED", `Kamu telah dikeluarkan dari ujian ini: ${student.kickReason || "oleh pengawas"}`, 403);
      }

      // Reconnect scenario
      const previousIp = student.ipAddress;
      log.info("Student reconnect", { studentId: student.id, nisn: student.nisn, examId: exam.id });
      freshToken = generateStudentSessionToken({
        studentId: student.id,
        examId: exam.id,
        nisn: student.nisn,
      });

      const ipChanged = !!previousIp && previousIp !== clientIp;

      student = await prisma.student.update({
        where: { id: student.id },
        data: {
          name,           // Selalu update nama saat reconnect (D-07)
          sessionTokenHash: hashStudentToken(freshToken),
          ipAddress: clientIp,
          userAgent,
        },
      });

      // Catat reconnect event
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

      // Jika IP berubah, hitung sebagai pelanggaran (Item 8)
      if (ipChanged) {
        const policy = (exam.violationPolicy as any) || {};
        const maxViolations = policy.max_violations || 3;
        const policyAction = policy.action || "lock";

        const updatedStudent = await prisma.student.update({
          where: { id: student.id },
          data: { violationCount: { increment: 1 } },
        });

        const shouldLock =
          updatedStudent.violationCount >= maxViolations &&
          policyAction === "lock" &&
          !updatedStudent.isLocked;

        if (shouldLock) {
          await prisma.student.update({
            where: { id: student.id },
            data: { isLocked: true },
          });
        }

        // Catat proctoring event khusus ip_change
        await prisma.proctoringEvent.create({
          data: {
            studentId: student.id,
            examId: exam.id,
            eventType: "ip_change",
            metadata: {
              oldIp: previousIp,
              newIp: clientIp,
            },
          },
        });

        const io = (globalThis as any).io;
        if (io) {
          try {
            io.of("/teacher-dashboard").to(`exam:${exam.id}`).emit("student_violation", {
              studentId: student.id,
              name: student.name,
              nisn: student.nisn,
              violationCount: updatedStudent.violationCount,
              isLocked: shouldLock ? true : updatedStudent.isLocked,
              event: {
                eventType: "ip_change",
                timestamp: new Date().toISOString(),
                metadata: { oldIp: previousIp, newIp: clientIp },
              },
            });
          } catch (socketErr) {
            console.error("Socket emit failed on ip_change:", socketErr);
          }
        }
      }
    } else {
      // New student joining — status awal waiting (Item 11)
      const dummyId = crypto.randomUUID();
      log.info("New student joining to waiting room", { nisn, examId: exam.id });
      freshToken = generateStudentSessionToken({
        studentId: dummyId,
        examId: exam.id,
        nisn,
      });

      const freshTokenHash = hashStudentToken(freshToken);

      student = await prisma.student.create({
        data: {
          id: dummyId,
          examId: exam.id,
          name,
          nisn,
          sessionTokenHash: freshTokenHash,
          status: "waiting",
          ipAddress: clientIp,
          userAgent,
        },
      });

      const io = (globalThis as any).io;
      if (io) {
        try {
          io.of("/teacher-dashboard").to(`exam:${exam.id}`).emit("student_joined_waiting", {
            studentId: student.id,
            name: student.name,
            nisn: student.nisn,
            status: student.status,
            joinedAt: student.joinedAt.toISOString(),
          });

          io.of("/student-session").to(`exam:${exam.id}`).emit("student_joined_lobby", {
            studentId: student.id,
            name: student.name,
            nisn: student.nisn.length > 3 ? student.nisn.slice(0, 3) + "*******" : "*******",
            status: student.status,
            joinedAt: student.joinedAt.toISOString(),
          });
        } catch (socketErr) {
          console.error("Socket emit failed on student_joined_waiting:", socketErr);
        }
      }
    }

    const nextStep = student.status === "active" ? "session" : "waiting_room";

    const response = successResponse({
      nextStep,
      student: {
        id: student.id,
        name: student.name,
        nisn: student.nisn,
        examId: student.examId,
        status: student.status,
      },
      exam: {
        id: exam.id,
        title: exam.title,
        description: exam.description,
        durationMinutes: exam.durationMinutes,
        status: exam.status,
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

    log.info("Join success", { studentId: student.id, nisn: student.nisn, examId: exam.id });
    return response;
  } catch (err: any) {
    log.error("Join error", { err: safeErrorMessage(err, "unknown") });
    return errorResponse("INTERNAL_SERVER_ERROR", safeErrorMessage(err, "Gagal bergabung ke ujian"), 500);
  }
}
