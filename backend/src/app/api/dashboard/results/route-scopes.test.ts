import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";

process.env.JWT_ACCESS_SECRET = "test-access-secret";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
process.env.STUDENT_SESSION_SECRET = "test-student-secret";
const queries: { exam?: Record<string, any>; student?: Record<string, any> } = {};
const exams = [
  { id: "exam-a", classroomId: "class-a", title: "Ujian A", className: "A", subjectName: "Matematika", subjectId: "math-x", academicYear: "2026/2027", semester: "ganjil", classroom: { gradeLevel: { id: "grade-x", name: "X" } }, subjectFolder: null },
  { id: "exam-b", classroomId: "class-b", title: "Ujian B", className: "A", subjectName: "Matematika", subjectId: "math-xi", academicYear: "2026/2027", semester: "ganjil", classroom: { gradeLevel: { id: "grade-xi", name: "XI" } }, subjectFolder: null },
];
const students = Array.from({ length: 31 }, (_, index) => ({ id: `student-${index}`, examId: index === 30 ? "exam-b" : "exam-a", name: index === 0 ? "=Peserta" : `Peserta ${index}`, nisn: `${index}`, status: "submitted", submittedAt: new Date("2026-01-01T00:00:00Z"), violationCount: 0, answers: [{ questionId: index === 30 ? "q-b" : "q-a", selectedOption: "jawab", isCorrect: index === 0 ? null : true }] }));
const fakePrisma = {
  teacher: { findUnique: async () => ({ id: "teacher-1", email: "teacher@example.invalid", fullName: "Teacher", role: "TEACHER", isActive: true, sessionVersion: "session-1" }) },
  exam: { findMany: async (query: Record<string, any>) => { queries.exam = query; return exams.filter(e => (!query.where.id || e.id === query.where.id) && (!query.where.classroomId || e.classroomId === query.where.classroomId)); } },
  student: {
    count: async ({ where }: { where: { examId: { in: string[] } } }) => students.filter(s => where.examId.in.includes(s.examId)).length,
    findMany: async (query: Record<string, any>) => { queries.student = query; const matches = students.filter(s => query.where.examId.in.includes(s.examId)); return query.take ? matches.slice(query.skip, query.skip + query.take) : matches; },
  },
  question: { findMany: async () => ["a", "b"].map(suffix => ({ id: `q-${suffix}`, examId: `exam-${suffix}`, type: "short_answer", points: 10, correctAnswer: "", options: [] })) },
};
(globalThis as unknown as { prisma: unknown }).prisma = fakePrisma;
const dependencies = Promise.all([import("./route"), import("@/lib/auth")]);

async function request(query: string) {
  const [{ GET }, { generateAccessToken }] = await dependencies;
  const token = generateAccessToken({ teacherId: "teacher-1", email: "teacher@example.invalid", fullName: "Teacher", role: "TEACHER", sessionVersion: "session-1" });
  return GET(new NextRequest(`http://localhost/api/dashboard/results?${query}`, { headers: { Authorization: `Bearer ${token}` } }));
}

test("CSV global includes every page and keeps pending grades and formula escaping", async () => {
  const response = await request("format=csv&csvLayout=grouped&mode=hierarchy&limit=1&page=1");
  assert.equal(response.status, 200);
  const csv = await response.text();
  assert.equal((csv.match(/"Peserta \d+"/g) || []).length, 30);
  assert.match(csv, /"'=Peserta"/);
  assert.match(csv, /Menunggu penilaian/);
  assert.match(csv, /"Tingkat","X"/);
  assert.match(csv, /"Tingkat","XI"/);
  assert.equal(queries.student?.take, undefined);
});

test("CSV class and exam scopes use IDs even when class names match", async () => {
  const byClass = await (await request("format=csv&csvLayout=grouped&mode=list&classroomId=class-a")).text();
  assert.equal(queries.exam?.where.classroomId, "class-a");
  assert.match(byClass, /Ujian A/);
  assert.doesNotMatch(byClass, /Ujian B/);
  const byExam = await (await request("format=csv&csvLayout=grouped&mode=list&examId=exam-b")).text();
  assert.equal(queries.exam?.where.id, "exam-b");
  assert.match(byExam, /Ujian B/);
  assert.doesNotMatch(byExam, /Ujian A/);
});

test("grade and search constraints are both passed to the database", async () => {
  await request("mode=list&gradeLevelId=grade-x&search=Ujian");
  assert.deepEqual(queries.exam?.where.AND, [{ OR: [{ classroom: { gradeLevelId: "grade-x" } }, { subjectFolder: { gradeLevelId: "grade-x" } }] }]);
  assert.ok(queries.exam?.where.OR);
});

test("unmapped results with no class name retain all required predicates", async () => {
  await request("mode=list&unmappedClassroom=true&unmappedGrade=true&missingClassName=true&search=Ujian");
  assert.equal(queries.exam?.where.classroomId, null);
  assert.deepEqual(queries.exam?.where.AND, [
    { classroomId: null, OR: [{ subjectId: null }, { subjectFolder: { gradeLevelId: null } }] },
    { OR: [{ className: null }, { className: "" }] },
  ]);
  assert.ok(queries.exam?.where.OR);
});
