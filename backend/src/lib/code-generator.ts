import crypto from "crypto";
import { prisma } from "@/lib/prisma";

const CHARS = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // 32 characters, excluding ambiguous 0, O, 1, I

export function generateRandomCode(length: number = 6): string {
  let result = "";
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    result += CHARS[bytes[i] % CHARS.length];
  }
  return result;
}

export async function generateUniqueAccessCode(length: number = 6): Promise<string> {
  let attempts = 0;
  while (attempts < 10) {
    const code = generateRandomCode(length);
    const existing = await prisma.exam.findUnique({
      where: { accessCode: code },
    });
    if (!existing) {
      return code;
    }
    attempts++;
  }
  // LOW-01: Jangan diam-diam hasilkan kode yang mungkin tidak unik.
  // Lempar error agar masalah collision terdeteksi dan diinvestigasi.
  throw new Error(
    `[CodeGenerator] Gagal menghasilkan kode unik setelah 10 percobaan (length=${length}). ` +
    "Kemungkinan terlalu banyak ujian aktif atau ada issue DB."
  );
}

