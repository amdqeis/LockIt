import { z } from "zod";
import { NextRequest } from "next/server";
import { authenticateTeacher } from "@/lib/middleware/auth";
import { AppError } from "@/lib/errors";
import { errorResponse, safeErrorMessage } from "@/lib/response";

export const bankSchema = z.object({
  title: z.string().trim().min(1).max(200),
  subject: z.string().trim().min(1).max(100),
  subjectId: z.string().uuid().nullable().optional(),
  description: z.string().max(500).nullable().optional(),
  tags: z.array(z.string().max(60)).max(30).default([]),
  difficulty: z.enum(["easy", "medium", "hard", "mixed"]).default("mixed"),
  status: z.enum(["draft", "active", "archived"]).default("draft"),
});
const imageUrlSchema = z.string().max(2048).refine(value => /^https?:\/\//i.test(value) || /^\/api\/question-banks\/media\/[a-z0-9-]+$/i.test(value), "Alamat gambar tidak didukung.");
const optionSchema = z.object({
  id: z.string().min(1).max(8), label: z.string().min(1).max(8),
  text: z.string().max(20000), imageUrl: imageUrlSchema.nullable().optional(),
  imageAlt: z.string().max(500).nullable().optional(), content: z.unknown().optional(),
});
function invalidEquation(value: unknown, depth = 0): boolean {
  if (depth > 30) return true;
  if (Array.isArray(value)) return value.some(item => invalidEquation(item, depth + 1));
  if (!value || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  if (obj.type === "equation" || obj.type === "equationBlock") {
    const attrs = obj.attrs as Record<string, unknown> | undefined;
    const latex = typeof attrs?.latex === "string" ? attrs.latex : "";
    if (!latex.trim() || /\\placeholder|#\?/.test(latex)) return true;
  }
  return Object.values(obj).some(item => invalidEquation(item, depth + 1));
}
export const questionSchema = z.object({
  sourceQuestionId: z.string().uuid().optional(),
  type: z.enum(["single_choice", "multi_select", "latex", "short_answer"]),
  questionText: z.string().trim().min(1).max(50000), content: z.unknown().optional(),
  imageUrl: imageUrlSchema.nullable().optional(), imageAlt: z.string().max(500).nullable().optional(),
  options: z.array(optionSchema).max(6), correctAnswer: z.string().nullable().optional(),
  correctAnswers: z.array(z.string()).max(6).nullable().optional(),
  points: z.number().int().min(1).max(100), hint: z.string().max(20000).nullable().optional(), hintContent: z.unknown().optional(),
}).superRefine((q, ctx) => {
  if (invalidEquation([q.content, q.options, q.hintContent])) ctx.addIssue({ code: "custom", path: ["content"], message: "Lengkapi slot persamaan." });
  if (q.type === "short_answer") return;
  if (q.options.length < 2) ctx.addIssue({ code: "custom", path: ["options"], message: "Minimal dua pilihan jawaban." });
  const ids = new Set(q.options.map(o => o.id.toLowerCase()));
  if (ids.size !== q.options.length) ctx.addIssue({ code: "custom", path: ["options"], message: "ID pilihan harus unik." });
  if (q.options.some(o => !o.text.trim() && !o.imageUrl)) ctx.addIssue({ code: "custom", path: ["options"], message: "Isi setiap pilihan atau tambahkan gambar." });
  const keys = q.type === "multi_select" ? q.correctAnswers || [] : q.correctAnswer ? [q.correctAnswer] : [];
  if (!keys.length || keys.some(k => !ids.has(k.toLowerCase()))) ctx.addIssue({ code: "custom", path: ["correctAnswer"], message: "Pilih kunci jawaban yang tersedia." });
});
export const draftContentSchema = z.object({ questions: z.array(z.unknown()).max(200) }).passthrough().superRefine((value, ctx) => {
  const serialized = JSON.stringify(value);
  if (serialized.length > 4 * 1024 * 1024) ctx.addIssue({ code: "custom", message: "Draf terlalu besar. Kurangi isi atau gambar." });
  if (serialized.includes("data:image/")) ctx.addIssue({ code: "custom", message: "Unggah gambar sebelum menyimpan draf." });
});
export async function bankTeacher(req: NextRequest) {
  const teacher = await authenticateTeacher(req);
  if (teacher.role !== "TEACHER" && teacher.role !== "ADMIN") throw new AppError("FORBIDDEN", "Akses ditolak", 403);
  return teacher;
}
export function bankError(err: unknown) {
  if (err instanceof AppError) return errorResponse(err.code, err.message, err.statusCode, err.details);
  if (err instanceof z.ZodError) return errorResponse("VALIDATION_ERROR", "Periksa kembali data yang dimasukkan.", 400, err.flatten());
  return errorResponse("INTERNAL_SERVER_ERROR", safeErrorMessage(err, "Operasi bank soal gagal"), 500);
}
