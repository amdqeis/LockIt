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
  // If collisions after 10 attempts, try length + 1
  return generateRandomCode(length + 1);
}
