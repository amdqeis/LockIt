import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
process.env.JWT_ACCESS_SECRET = "test-access-secret";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
process.env.STUDENT_SESSION_SECRET = "test-student-secret";
const subjectId = "11111111-1111-4111-8111-111111111111";
const bankId = "22222222-2222-4222-8222-222222222222";
const questionId = "33333333-3333-4333-8333-333333333333";
let stored: Record<string, unknown>[] = [];
const bank = { id: bankId, revision: 3, subjectId, questions: [{ id: questionId, orderIndex: 0, questionText: "Hitung", content: { type: "doc" }, imageUrl: "/api/question-banks/media/pic", imageAlt: "Grafik", hint: null, hintContent: null, type: "multi_select", options: [{ id: "AA", label: "AA", text: "Satu" }, { id: "BB", label: "BB", text: "Dua" }], correctAnswer: null, correctAnswers: ["AA", "BB"], points: 10 }] };
const tx = { subject: { findUnique: async () => ({ id: subjectId, name: "Matematika" }) }, questionBank: { findUnique: async () => bank }, exam: { create: async () => ({ id: "exam-1" }), findUnique: async () => ({ id: "exam-1" }) }, question: { createMany: async ({ data }: { data: Record<string, unknown>[] }) => { stored = data; } } };
(globalThis as unknown as { prisma: unknown }).prisma = { exam: { findUnique: async () => null }, $transaction: async (run: (db: typeof tx) => Promise<unknown>) => run(tx) };
const deps = Promise.all([import("./route"), import("@/lib/auth")]);
async function create(body: Record<string, unknown>) { const [{ POST }, { generateAccessToken }] = await deps; const token = generateAccessToken({ teacherId: "teacher-1", email: "t@example.invalid", fullName: "Guru", role: "TEACHER" }); return POST(new NextRequest("http://localhost/api/exams", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ title: "Ujian matematika", durationMinutes: 60, subjectId, bankId, bankRevision: 3, questionIds: [questionId], ...body }) })); }
test("bank snapshot preserves structured content, media and multi-character option IDs", async () => { stored = []; const response = await create({}); assert.equal(response.status, 201); assert.equal(stored.length, 1); assert.deepEqual(stored[0].content, { type: "doc" }); assert.equal(stored[0].imageAlt, "Grafik"); assert.equal(stored[0].correctAnswer, "AA,BB"); assert.deepEqual(stored[0].options, bank.questions[0].options); });
test("stale bank revision is rejected without copying questions", async () => { stored = []; const response = await create({ bankRevision: 2 }); assert.equal(response.status, 409); assert.equal(stored.length, 0); });
test("unknown question ID is rejected", async () => { stored = []; const response = await create({ questionIds: ["44444444-4444-4444-8444-444444444444"] }); assert.equal(response.status, 400); assert.equal(stored.length, 0); });
