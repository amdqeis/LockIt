import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { NextRequest } from "next/server";

const enabled = process.env.EDUQUAS_TEMP_DB_TEST === "1" && process.env.DATABASE_URL?.startsWith("postgresql://key@127.0.0.1:15437/");
test("temporary database: paginated results, semester filters, permissions and safe CSV", { skip: !enabled }, async () => {
  process.env.JWT_ACCESS_SECRET = "temporary-test-access";
  const [{ prisma }, { generateAccessToken }, { GET }, facets, overview] = await Promise.all([import("@/lib/prisma"), import("@/lib/auth"), import("./route"), import("./facets/route"), import("@/app/api/dashboard/overview/route")]);
  const name = `Mata pelajaran ${randomUUID()}`;
  const teacher = await prisma.teacher.create({ data: { email: `${randomUUID()}@example.invalid`, fullName: "Guru Uji", passwordHash: "test-only" } });
  const other = await prisma.teacher.create({ data: { email: `${randomUUID()}@example.invalid`, fullName: "Guru Lain", passwordHash: "test-only" } });
  const token = generateAccessToken({ teacherId: teacher.id, email: teacher.email, fullName: teacher.fullName, role: "TEACHER" });
  const admin = generateAccessToken({ teacherId: other.id, email: other.email, fullName: other.fullName, role: "ADMIN" });
  const makeExam = async (teacherId: string, semester: string) => prisma.exam.create({ data: { teacherId, title: "Quiz 1", durationMinutes: 60, accessCode: randomUUID().slice(0, 6), status: "ended", subjectName: name, className: "X A", academicYear: "2026/2027", semester, category: "Quiz", passingScore: 75 } });
  try {
    const first = await makeExam(teacher.id, "ganjil");
    const second = await makeExam(teacher.id, "genap");
    const foreign = await makeExam(other.id, "ganjil");
    const add = async (examId: string, nisn: string, studentName: string, correct: boolean | null) => {
      const question = await prisma.question.create({ data: { examId, orderIndex: 1, questionText: "Jawab", type: "short_answer", options: [], correctAnswer: "", points: 10 } });
      const student = await prisma.student.create({ data: { examId, name: studentName, nisn, status: "submitted", sessionTokenHash: randomUUID(), submittedAt: new Date() } });
      await prisma.answer.create({ data: { studentId: student.id, questionId: question.id, selectedOption: "jawaban", isCorrect: correct } });
    };
    await add(first.id, "1000000001", "=Peserta", null);
    await add(first.id, "1000000002", "Peserta Kedua", true);
    await add(second.id, "1000000001", "=Peserta", true);
    await add(foreign.id, "1000000003", "Peserta Lain", true);
    const call = async (query: string, credential = token) => GET(new NextRequest(`http://localhost/api/dashboard/results?subject=${encodeURIComponent(name)}&${query}`, { headers: { Authorization: `Bearer ${credential}` } }));
    const filtered = await (await call("mode=list&semester=ganjil&limit=1&page=1")).json();
    assert.equal(filtered.data.total, 2); assert.equal(filtered.data.attempts.length, 1); assert.equal(filtered.data.exams.length, 1); assert.equal(filtered.data.exams[0].id, first.id);
    const matrix = await (await call("mode=matrix&limit=1&page=1")).json();
    assert.equal(matrix.data.total, 2); assert.equal(matrix.data.students.length, 1); assert.equal(matrix.data.exams.length, 2);
    assert.equal(matrix.data.students[0].scores[first.id].pendingManualCount, 1);
    assert.equal(matrix.data.students[0].scores[second.id].finalScore, 100);
    const adminResults = await (await call("mode=list&limit=10", admin)).json(); assert.equal(adminResults.data.total, 4);
    const csv = await (await call("mode=list&format=csv")).text(); assert.ok(csv.includes("'=Peserta")); assert.ok(csv.includes("Menunggu penilaian"));
    const facetResponse = await facets.GET(new NextRequest("http://localhost/api/dashboard/results/facets", { headers: { Authorization: `Bearer ${token}` } }));
    const facetData = await facetResponse.json();
    assert.ok(facetData.data.subject.includes(name)); assert.ok(facetData.data.period.includes("2026/2027 · ganjil")); assert.ok(facetData.data.period.includes("2026/2027 · genap"));
    const summary = await overview.GET(new NextRequest("http://localhost/api/dashboard/overview", { headers: { Authorization: `Bearer ${token}` } }));
    const summaryData = await summary.json(); assert.equal(summaryData.data.ungraded, 1); assert.equal(summaryData.data.activeCount, 0);
    const unauthorized = await GET(new NextRequest("http://localhost/api/dashboard/results")); assert.equal(unauthorized.status, 401);
  } finally { await prisma.$disconnect(); }
});
