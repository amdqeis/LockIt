import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

// ─── FAIL FAST: Secret wajib ada — jangan pernah gunakan fallback hardcoded ──
if (!process.env.JWT_ACCESS_SECRET) throw new Error("[FATAL] JWT_ACCESS_SECRET env wajib diset");
if (!process.env.JWT_REFRESH_SECRET) throw new Error("[FATAL] JWT_REFRESH_SECRET env wajib diset");
if (!process.env.STUDENT_SESSION_SECRET) throw new Error("[FATAL] STUDENT_SESSION_SECRET env wajib diset");

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const STUDENT_SESSION_SECRET = process.env.STUDENT_SESSION_SECRET;

export interface TeacherJwtPayload {
  teacherId: string;
  email: string;
  fullName: string;
}

export interface StudentTokenPayload {
  studentId: string;
  examId: string;
  nisn: string;
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

// LOW-04: Hash student session token sebelum disimpan ke DB.
// JWT asli tidak pernah disimpan plain — hanya SHA-256 hash-nya untuk lookup & verifikasi.
// Konsisten dengan cara teacher refresh token disimpan.
export function hashStudentToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}


// ─── STUDENT SESSION TOKEN ───────────────────────────────────────────

export function generateStudentSessionToken(data: { studentId: string; examId: string; nisn: string }): string {
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
