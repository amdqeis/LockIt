import { NextRequest } from "next/server";
import { authenticateStudent } from "@/lib/middleware/auth";
import { prisma } from "@/lib/prisma";
import { successResponse, errorResponse, safeErrorMessage } from "@/lib/response";
import { AppError } from "@/lib/errors";

export async function GET(req: NextRequest) {
  try {
    const { student } = await authenticateStudent(req);
    const exam = student.exam;

    const questionCount = await prisma.question.count({
      where: { examId: exam.id },
    });

    // Ambil seluruh peserta ujian ini yang belum di-kick
    const allStudents = await prisma.student.findMany({
      where: {
        examId: exam.id,
        status: { notIn: ["kicked"] },
      },
      orderBy: { joinedAt: "asc" },
      select: {
        id: true,
        name: true,
        nisn: true,
        status: true,
        joinedAt: true,
      },
    });

    // Masking NISN untuk privasi peserta lain (3 digit pertama + *******)
    const participants = allStudents.map((s) => {
      const isSelf = s.id === student.id;
      const maskedNisn = isSelf
        ? s.nisn
        : s.nisn.length > 3
        ? s.nisn.slice(0, 3) + "*******"
        : "*******";

      return {
        id: s.id,
        name: s.name,
        nisn: maskedNisn,
        status: s.status,
        joinedAt: s.joinedAt.toISOString(),
        isSelf,
      };
    });

    return successResponse({
      currentStudent: {
        id: student.id,
        name: student.name,
        nisn: student.nisn,
        status: student.status,
        kickReason: student.kickReason ?? null,
      },
      exam: {
        id: exam.id,
        title: exam.title,
        accessCode: exam.accessCode,
        durationMinutes: exam.durationMinutes,
        status: exam.status,
        questionCount,
        startTime: exam.startTime?.toISOString() ?? null,
        endTime: exam.endTime?.toISOString() ?? null,
        serverTime: new Date().toISOString(),
      },
      participants,
      totalParticipants: participants.length,
      // Flag helper jika ujian sudah aktif dan siswa berstatus aktif
      canStartExam: exam.status === "active" && student.status === "active",
    });
  } catch (err: any) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    return errorResponse("INTERNAL_SERVER_ERROR", safeErrorMessage(err, "Gagal memuat status lobby ujian"), 500);
  }
}
