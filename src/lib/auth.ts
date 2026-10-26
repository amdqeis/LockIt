import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "lockit_access_default_secret_key";
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "lockit_refresh_default_secret_key";
const STUDENT_SESSION_SECRET = process.env.STUDENT_SESSION_SECRET || "lockit_student_default_secret_key";

export interface TeacherJwtPayload {
  teacherId: string;
  email: string;
  fullName: string;
}

export interface StudentTokenPayload {
  studentId: string;
  examId: string;
  nim: string;
  timestamp: number;
}

// ─── PASSWORD UTILITIES ──────────────────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ─── TEACHER JWT (ACCESS TOKEN) ──────────────────────────────────────

export function generateAccessToken(payload: TeacherJwtPayload): string {
  return jwt.sign(payload, JWT_ACCESS_SECRET, { expiresIn: "15m" });
}

export function verifyAccessToken(token: string): TeacherJwtPayload | null {
  try {
    return jwt.verify(token, JWT_ACCESS_SECRET) as TeacherJwtPayload;
  } catch {
    return null;
  }
}

// ─── TEACHER REFRESH TOKEN ───────────────────────────────────────────

export function generateRefreshTokenString(): string {
  return crypto.randomBytes(40).toString("hex");
}

export function hashRefreshToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// ─── STUDENT SESSION TOKEN ───────────────────────────────────────────

export function generateStudentSessionToken(data: { studentId: string; examId: string; nim: string }): string {
  const payload: StudentTokenPayload = {
    ...data,
    timestamp: Date.now(),
  };
  return jwt.sign(payload, STUDENT_SESSION_SECRET, { expiresIn: "24h" });
}

export function verifyStudentSessionToken(token: string): StudentTokenPayload | null {
  try {
    return jwt.verify(token, STUDENT_SESSION_SECRET) as StudentTokenPayload;
  } catch {
    return null;
  }
}
