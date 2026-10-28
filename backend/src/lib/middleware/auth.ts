import { NextRequest } from "next/server";
import { verifyAccessToken, verifyStudentSessionToken, hashStudentToken, TeacherJwtPayload, StudentTokenPayload } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UnauthorizedError } from "@/lib/errors";

export async function authenticateTeacher(req: NextRequest): Promise<TeacherJwtPayload> {
  const authHeader = req.headers.get("authorization");
  let token: string | null = null;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.substring(7);
  } else {
    token = req.cookies.get("accessToken")?.value ?? null;
  }

  if (!token) {
    throw new UnauthorizedError("Token autentikasi tidak ditemukan. Silakan login.");
  }

  const payload = verifyAccessToken(token);
  if (!payload) {
    throw new UnauthorizedError("Token tidak valid atau telah kedaluwarsa.");
  }

  return payload;
}

export async function authenticateStudent(req: NextRequest): Promise<{ student: any; payload: StudentTokenPayload }> {
  const cookieToken = req.cookies.get("studentSession")?.value;
  const headerToken = req.headers.get("x-student-session");
  const token = cookieToken || headerToken;

  if (!token) {
    throw new UnauthorizedError("Sesi ujian peserta tidak ditemukan. Silakan join ulang.");
  }

  const payload = verifyStudentSessionToken(token);
  if (!payload) {
    throw new UnauthorizedError("Sesi ujian tidak valid atau kedaluwarsa.");
  }

  // LOW-04: Lookup menggunakan hash — JWT asli tidak pernah digunakan untuk query DB
  const tokenHash = hashStudentToken(token);
  const student = await prisma.student.findFirst({
    where: {
      id: payload.studentId,
      sessionTokenHash: tokenHash,
    },
    include: { exam: true },
  });

  if (!student) {
    // Bisa berarti: student tidak ada, atau token sudah digantikan oleh login baru
    throw new UnauthorizedError("Sesi tidak valid atau telah digantikan oleh sesi baru.");
  }

  return { student, payload };
}

