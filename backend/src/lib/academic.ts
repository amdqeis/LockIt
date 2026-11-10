import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";

export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

export function formatSubjectDisplayName(subjectName: string, gradeLevelName?: string | null): string {
  if (!gradeLevelName) return subjectName;
  return `${subjectName} · ${gradeLevelName}`;
}

export function formatBankDisplayName(bankTitle: string, subjectName: string, gradeLevelName?: string | null): string {
  const subjectDisplay = formatSubjectDisplayName(subjectName, gradeLevelName);
  return `${bankTitle} — ${subjectDisplay}`;
}

/**
 * Recognizes common classroom patterns like "X-1", "X A", "XI-IPA-1", "XII.2", "10-1", "Kelas X-1", etc.
 */
export function parseLegacyClassName(raw: string): { gradeLevelName: string; classroomName: string } | null {
  const cleaned = raw.trim().replace(/^kelas\s+/i, "");
  // Match Roman numerals X, XI, XII or VII, VIII, IX or digits 7..12
  const match = cleaned.match(/^(X|XI|XII|VII|VIII|IX|10|11|12|7|8|9)(?:[\s\-_/.]+(.+))?$/i);
  if (!match) return null;

  let gradeToken = match[1].toUpperCase();
  if (gradeToken === "10") gradeToken = "X";
  else if (gradeToken === "11") gradeToken = "XI";
  else if (gradeToken === "12") gradeToken = "XII";
  else if (gradeToken === "7") gradeToken = "VII";
  else if (gradeToken === "8") gradeToken = "VIII";
  else if (gradeToken === "9") gradeToken = "IX";

  const gradeLevelName = `Tingkat ${gradeToken}`;
  const suffix = (match[2] || "").trim();
  const classroomName = suffix ? `${gradeToken}-${suffix}` : `${gradeToken}-1`;

  return { gradeLevelName, classroomName };
}

export async function assertGradeLevelNotReferenced(gradeLevelId: string): Promise<void> {
  const classroomCount = await prisma.classroom.count({ where: { gradeLevelId } });
  if (classroomCount > 0) {
    throw new AppError("CONFLICT", "Tingkat masih memiliki rombel terdaftar. Hapus atau pindahkan rombel terlebih dahulu.", 409);
  }
  const subjectCount = await prisma.subject.count({ where: { gradeLevelId } });
  if (subjectCount > 0) {
    throw new AppError("CONFLICT", "Tingkat masih memiliki mata pelajaran terdaftar. Hapus atau pindahkan mata pelajaran terlebih dahulu.", 409);
  }
}

export async function assertClassroomNotReferenced(classroomId: string): Promise<void> {
  const examCount = await prisma.exam.count({ where: { classroomId } });
  if (examCount > 0) {
    throw new AppError("CONFLICT", "Rombel masih digunakan oleh ujian. Arsipkan rombel sebagai gantinya.", 409);
  }
}

export async function assertSubjectNotReferenced(subjectId: string): Promise<void> {
  const bankCount = await prisma.questionBank.count({ where: { subjectId } });
  if (bankCount > 0) {
    throw new AppError("CONFLICT", "Mata pelajaran masih memiliki bank soal. Pindahkan atau hapus bank soal terlebih dahulu.", 409);
  }
  const examCount = await prisma.exam.count({ where: { subjectId } });
  if (examCount > 0) {
    throw new AppError("CONFLICT", "Mata pelajaran masih digunakan oleh ujian. Arsipkan mata pelajaran sebagai gantinya.", 409);
  }
}

