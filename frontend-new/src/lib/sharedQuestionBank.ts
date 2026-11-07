import type { JSONContent } from "@tiptap/core";
import { apiFetch, fetchPrivateMedia } from "./apiClient";
import type { QuestionBank } from "./questionBank";

export type QuestionKind = "single_choice" | "multi_select" | "latex" | "short_answer";
export interface SharedOption { id: string; label: string; text: string; content?: JSONContent; imageUrl?: string | null; imageAlt?: string | null }
export interface SharedQuestion { id?: string; sourceQuestionId?: string; clientId: string; type: QuestionKind; questionText: string; content: JSONContent; imageUrl?: string | null; imageAlt?: string | null; options: SharedOption[]; correctAnswer: string | null; correctAnswers: string[]; points: number; hint: string; hintContent: JSONContent; importIssue?: string }
export interface SharedDraft { id: string; bankId: string; revision: number; committedAt: string | null; content: { questions: SharedQuestion[]; pasteSource?: string; bankRevision?: number }; updatedAt: string }
export interface SharedBank { id: string; title: string; subject: string; description?: string | null; status: string; revision: number; _count?: { questions: number }; questions?: SharedQuestion[]; drafts?: SharedDraft[] }
export const emptyDoc = (): JSONContent => ({ type: "doc", content: [{ type: "paragraph" }] });
export function textDoc(text: string): JSONContent { return { type: "doc", content: text.split("\n").map(line => ({ type: "paragraph", ...(line ? { content: [{ type: "text", text: line }] } : {}) })) }; }
export function legacyDoc(text: string): JSONContent {
  const doc: JSONContent[] = [];
  let paragraph: JSONContent[] = [];
  const flush = () => { doc.push({ type: "paragraph", ...(paragraph.length ? { content: paragraph } : {}) }); paragraph = []; };
  const segments = text.split(/(\$\$[^$]+\$\$|\$[^$\n]+\$)/g);
  for (const segment of segments) {
    if (segment.startsWith("$$") && segment.endsWith("$$") && segment.length > 4) {
      if (paragraph.length) flush();
      doc.push({ type: "equationBlock", attrs: { latex: segment.slice(2, -2) } });
    } else if (segment.startsWith("$") && segment.endsWith("$") && segment.length > 2) {
      paragraph.push({ type: "equation", attrs: { latex: segment.slice(1, -1) } });
    } else {
      const lines = segment.split("\n");
      lines.forEach((line, index) => { if (index) flush(); if (line) paragraph.push({ type: "text", text: line }); });
    }
  }
  if (paragraph.length || !doc.length) flush();
  return { type: "doc", content: doc };
}
export function blankQuestion(kind: QuestionKind = "single_choice", points = 10): SharedQuestion {
  return { clientId: crypto.randomUUID(), type: kind, questionText: "", content: emptyDoc(), options: ["a", "b"].map(id => ({ id, label: id.toUpperCase(), text: "", content: emptyDoc() })), correctAnswer: null, correctAnswers: [], points, hint: "", hintContent: emptyDoc() };
}
export class RequestError extends Error {
  constructor(message: string, public code?: string) { super(message); }
}
export async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await apiFetch<T>(url, options);
  if (!response.success || response.data === undefined) throw new RequestError(response.error?.message || "Gagal terhubung ke server.", response.error?.code);
  return response.data;
}
export async function uploadEmbeddedImage(url?: string | null): Promise<string | null> {
  if (!url || /^https?:\/\//i.test(url) || /^\/api\/question-banks\/media\//i.test(url)) return url || null;
  if (!/^data:image\/(png|jpeg|webp);base64,/i.test(url)) throw new Error("Ada gambar lokal yang tidak didukung. Gunakan PNG, JPEG, atau WebP.");
  const blob = await (await fetch(url)).blob();
  if (blob.size > 2 * 1024 * 1024) throw new Error("Gambar lokal melebihi 2 MB.");
  const form = new FormData(); form.set("image", new File([blob], "gambar", { type: blob.type }));
  return (await request<{ url: string }>("/api/question-banks/media", { method: "POST", body: form })).url;
}
export async function portableImage(url?: string | null): Promise<string | null> {
  if (!url || !url.startsWith("/api/question-banks/media/")) return url || null;
  const response = await fetchPrivateMedia(url);
  if (!response.ok) throw new Error("Gambar tidak dapat diunduh untuk ekspor.");
  const blob = await response.blob();
  return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onerror = () => reject(new Error("Gambar tidak dapat dibaca.")); reader.onload = () => resolve(String(reader.result)); reader.readAsDataURL(blob); });
}
export async function loadSharedBanks(): Promise<QuestionBank[]> {
  const banks = await request<Array<SharedBank & { tags?: string[]; difficulty?: QuestionBank["difficulty"]; questions?: Array<{ points: number }>; createdAt?: string; updatedAt?: string; createdBy?: string }>>("/api/question-banks");
  return banks.map(b => ({ id: b.id, title: b.title, subject: b.subject, description: b.description || null, tags: Array.isArray(b.tags) ? b.tags : [], difficulty: b.difficulty || "mixed", status: b.status as QuestionBank["status"], questionCount: b._count?.questions || 0, totalPoints: (b.questions || []).reduce((sum, q) => sum + q.points, 0), usedInExams: 0, createdAt: b.createdAt || "", updatedAt: b.updatedAt || "", createdBy: b.createdBy || "" }));
}
function hasIncompleteEquation(node?: JSONContent): boolean {
  if (!node) return false;
  if ((node.type === "equation" || node.type === "equationBlock") && (!String(node.attrs?.latex || "").trim() || /\\placeholder|#\?/.test(String(node.attrs?.latex || "")))) return true;
  return (node.content || []).some(hasIncompleteEquation);
}
export function invalidQuestion(q: SharedQuestion): string[] {
  const errors: string[] = [];
  if (q.importIssue) errors.push(q.importIssue);
  if (!q.questionText.trim()) errors.push("Isi pertanyaan.");
  if (hasIncompleteEquation(q.content) || hasIncompleteEquation(q.hintContent) || q.options.some(o => hasIncompleteEquation(o.content))) errors.push("Lengkapi slot persamaan.");
  if (!Number.isInteger(q.points) || q.points < 1 || q.points > 100) errors.push("Bobot harus antara 1 dan 100.");
  if ([q.imageUrl, ...q.options.map(o => o.imageUrl)].some(url => url && !/^https?:\/\//i.test(url) && !/^\/api\/question-banks\/media\/[a-z0-9-]+$/i.test(url))) errors.push("Unggah ulang gambar lokal sebelum menyimpan.");
  if (q.type !== "short_answer") {
    if (q.options.length < 2 || q.options.length > 6 || q.options.some(o => !o.text.trim() && !o.imageUrl)) errors.push("Isi dua hingga enam pilihan.");
    if (new Set(q.options.map(o => o.id)).size !== q.options.length) errors.push("Setiap pilihan harus memiliki label berbeda.");
    const keys = q.type === "multi_select" ? q.correctAnswers : q.correctAnswer ? [q.correctAnswer] : [];
    if (!keys.length || keys.some(key => !q.options.some(o => o.id === key))) errors.push("Pilih kunci jawaban.");
  }
  return errors;
}

export function parseImportedXml(source: string): { questions: SharedQuestion[]; warnings: string[] } {
  if (/<!DOCTYPE|<!ENTITY/i.test(source)) throw new Error("Deklarasi DOCTYPE dan ENTITY tidak didukung.");
  const document = new DOMParser().parseFromString(source, "application/xml");
  if (document.querySelector("parsererror")) throw new Error("Format XML tidak valid.");
  const elements = Array.from(document.querySelectorAll("question"));
  if (elements.length > 200) throw new Error("Berkas berisi lebih dari 200 soal.");
  const warnings: string[] = [];
  const questions = elements.map((element, index) => {
    const text = (parent: Element, selector: string) => parent.querySelector(selector)?.textContent?.trim() || "";
    const content = (parent: Element, selector: string) => {
      const value = text(parent, selector);
      if (!value) return undefined;
      try { const parsed = JSON.parse(value) as JSONContent; if (parsed.type === "doc") return parsed; }
      catch { /* sumber XML tetap ada untuk diperiksa */ }
      warnings.push(`Soal ${index + 1}: dokumen persamaan tidak valid; periksa teks sumber.`);
      return undefined;
    };
    const type = text(element, ":scope > type") || element.getAttribute("type") || "single_choice";
    const optionElements = Array.from(element.querySelectorAll(":scope > options > option, :scope > option"));
    const options = optionElements.map((option, i) => ({
      id: option.getAttribute("id") || option.getAttribute("label") || String.fromCharCode(97 + i),
      text: text(option, ":scope > text") || Array.from(option.childNodes).filter(node => node.nodeType === 3 || node.nodeType === 4).map(node => node.textContent || "").join("").trim(),
      imageUrl: text(option, ":scope > imageUrl") || option.getAttribute("image") || null,
      imageAlt: text(option, ":scope > imageAlt") || null,
      content: content(option, ":scope > contentJson"),
      isCorrect: option.getAttribute("correct") === "true",
    }));
    const answers = Array.from(element.querySelectorAll(":scope > correctAnswers > answer")).map(answer => answer.textContent?.trim() || "").filter(Boolean);
    const key = text(element, ":scope > correctAnswer") || element.getAttribute("correctAnswer") || "";
    const pointsText = text(element, ":scope > points") || element.getAttribute("points");
    const raw = {
      type, questionText: text(element, ":scope > questionText") || text(element, ":scope > text"), content: content(element, ":scope > contentJson"),
      imageUrl: text(element, ":scope > imageUrl") || text(element, ":scope > image") || element.getAttribute("image"),
      imageAlt: text(element, ":scope > imageAlt"), hint: text(element, ":scope > hint"), hintContent: content(element, ":scope > hintContentJson"),
      points: pointsText ? Number(pointsText) : 10, options,
      ...(answers.length ? { correctAnswers: answers } : key ? { correctAnswer: key } : {}),
    };
    const question = normalizeImportedQuestion(raw);
    if (!question.questionText) warnings.push(`Soal ${index + 1}: teks soal kosong; lengkapi sebelum menyimpan.`);
    if (question.importIssue) warnings.push(`Soal ${index + 1}: ${question.importIssue}`);
    return question;
  });
  if (!questions.length) throw new Error("Tidak ditemukan elemen soal dalam XML.");
  return { questions, warnings };
}

export function parsePastedQuestions(source: string): { questions: SharedQuestion[]; warnings: string[] } {
  const questions: SharedQuestion[] = [];
  const warnings: string[] = [];
  let current: SharedQuestion | null = null;
  let target: "question" | string = "question";
  for (const raw of source.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const start = line.match(/^(\d+)[.)]\s+(.+)$/);
    if (start) {
      if (questions.length >= 200) { warnings.push("Maksimal 200 soal per kumpulan."); break; }
      current = blankQuestion(); current.questionText = start[2]; current.content = textDoc(start[2]); current.options = []; questions.push(current); target = "question"; continue;
    }
    if (!current) { warnings.push(`Teks sebelum nomor soal perlu diperiksa: ${line.slice(0, 80)}`); continue; }
    const option = line.match(/^([A-Fa-f])[.)]\s+(.+)$/);
    if (option) { const id = option[1].toLowerCase(); current.options.push({ id, label: id.toUpperCase(), text: option[2], content: textDoc(option[2]) }); target = id; continue; }
    const key = line.match(/^kunci\s*:\s*(.+)$/i);
    if (key) {
      const value = key[1].trim();
      if (!/^[A-Fa-f](?:\s*[,;]\s*[A-Fa-f])*$/.test(value)) warnings.push(`Kunci soal ${questions.length} tidak dikenali: ${value}`);
      else { const keys = value.split(/[,;]/).map(k => k.trim().toLowerCase()); current.type = keys.length > 1 ? "multi_select" : "single_choice"; current.correctAnswer = keys[0]; current.correctAnswers = keys; }
      target = "question"; continue;
    }
    const points = line.match(/^bobot\s*:\s*(\d+)$/i);
    if (points) { current.points = Number(points[1]); target = "question"; continue; }
    if (target === "question") { current.questionText += `\n${line}`; current.content = textDoc(current.questionText); }
    else { const item = current.options.find(o => o.id === target); if (item) { item.text += `\n${line}`; item.content = textDoc(item.text); } }
  }
  if (!questions.length) warnings.push("Tidak ditemukan soal bernomor. Teks sumber tetap tersedia.");
  return { questions, warnings };
}

export function normalizeImportedQuestion(input: unknown): SharedQuestion {
  const raw = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const rawType = String(raw.type || "single_choice").toLowerCase();
  const aliases: Record<string, QuestionKind> = { single_choice: "single_choice", multiple_choice: "single_choice", multi_select: "multi_select", latex: "latex", short_answer: "short_answer" };
  const question = blankQuestion(aliases[rawType] || "single_choice", typeof raw.points === "number" ? raw.points : 10);
  if (!aliases[rawType]) question.importIssue = `Jenis soal ${rawType} belum dikenali. Pilih jenis soal.`;
  question.questionText = String(raw.questionText || raw.text || "");
  question.content = raw.content && typeof raw.content === "object" && (raw.content as JSONContent).type === "doc" ? raw.content as JSONContent : legacyDoc(question.questionText);
  question.hint = typeof raw.hint === "string" ? raw.hint : "";
  question.hintContent = raw.hintContent && typeof raw.hintContent === "object" && (raw.hintContent as JSONContent).type === "doc" ? raw.hintContent as JSONContent : legacyDoc(question.hint);
  question.imageUrl = typeof raw.imageUrl === "string" ? raw.imageUrl : typeof raw.image === "string" ? raw.image : null;
  question.imageAlt = typeof raw.imageAlt === "string" ? raw.imageAlt : null;
  const options = Array.isArray(raw.options) ? raw.options : [];
  question.options = options.map((value, index) => {
    const option = value && typeof value === "object" ? value as Record<string, unknown> : {};
    const id = String(option.id || option.label || String.fromCharCode(97 + index)).toLowerCase();
    const text = typeof value === "string" ? value : String(option.text || "");
    const content = option.content && typeof option.content === "object" && (option.content as JSONContent).type === "doc" ? option.content as JSONContent : legacyDoc(text);
    return { id, label: id.toUpperCase(), text, content, imageUrl: typeof option.imageUrl === "string" ? option.imageUrl : null, imageAlt: typeof option.imageAlt === "string" ? option.imageAlt : null };
  });
  const marked = options.flatMap((value, index) => value && typeof value === "object" && (value as Record<string, unknown>).isCorrect === true ? [question.options[index].id] : []);
  const keys = Array.isArray(raw.correctAnswers) ? raw.correctAnswers.map(String) : typeof raw.correctAnswer === "string" && raw.correctAnswer ? raw.correctAnswer.split(",") : marked;
  question.correctAnswers = keys.map(key => key.trim().toLowerCase()).filter(Boolean);
  question.correctAnswer = question.correctAnswers[0] || null;
  return question;
}
