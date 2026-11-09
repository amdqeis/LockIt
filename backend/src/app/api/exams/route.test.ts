import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";

process.env.JWT_ACCESS_SECRET = "test-access-secret";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
process.env.STUDENT_SESSION_SECRET = "test-student-secret";

const queries: Record<string, unknown>[] = [];
const createdExams: Record<string, unknown>[] = [];
const fakePrisma = {
  $transaction: async (fn: (tx: any) => Promise<any>) => fn(fakePrisma),
  subject: {
    findUnique: async ({ where }: { where: { id: string } }) => where.id === "sub-1" ? { id: "sub-1", name: "Matematika" } : null,
  },
  questionBank: {
    findUnique: async ({ where }: { where: { id: string } }) => where.id === "bank-1" ? { id: "bank-1", revision: 1, subjectId: "sub-1", questions: [{ id: "q-1", orderIndex: 1, questionText: "Soal 1", options: [], correctAnswer: "A", points: 10 }] } : null,
  },
  exam: {
    findFirst: async ({ where }: { where: { id?: string; teacherId?: string } }) => where.id === "owned" && where.teacherId === "teacher-1" ? { id: "owned" } : null,
    findMany: async (query: Record<string, unknown>) => {
      queries.push(query);
      return [{ id: "one" }, { id: "two" }, { id: "three" }];
    },
    create: async ({ data }: { data: Record<string, unknown> }) => {
      createdExams.push(data);
      return { id: "exam-created-1", ...data };
    },
    findUnique: async ({ where }: { where: { id?: string; accessCode?: string } }) => {
      if (where.accessCode) return null;
      return { id: where.id, title: "Test Exam", _count: { questions: 1, students: 0 } };
    },
  },
  question: {
    createMany: async () => ({ count: 1 }),
  },
};
(globalThis as unknown as { prisma: unknown }).prisma = fakePrisma;

const dependencies = Promise.all([import("./route"), import("@/lib/auth")]);

async function request(url: string, role: "TEACHER" | "ADMIN" = "TEACHER") {
  const [{ GET }, { generateAccessToken }] = await dependencies;
  const token = generateAccessToken({ teacherId: "teacher-1", email: "teacher@example.invalid", fullName: "Teacher", role });
  return GET(new NextRequest(`http://localhost/api/exams${url}`, { headers: { Authorization: `Bearer ${token}` } }));
}

async function postRequest(body: unknown, role: "TEACHER" | "ADMIN" = "TEACHER") {
  const [{ POST }, { generateAccessToken }] = await dependencies;
  const token = generateAccessToken({ teacherId: "teacher-1", email: "teacher@example.invalid", fullName: "Teacher", role });
  return POST(new NextRequest("http://localhost/api/exams", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }));
}

test("pagination returns a bounded page and preserves teacher ownership", async () => {
  queries.length = 0;
  const response = await request("?limit=2&status=active");
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(body.data.items, [{ id: "one" }, { id: "two" }]);
  assert.equal(body.data.nextCursor, "two");
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(queries[0].take, 3);
  assert.deepEqual(queries[0].where, { teacherId: "teacher-1", status: "active" });
  assert.ok(queries[0].select);
});

test("pagination rejects invalid limits and cursors outside the caller's scope", async () => {
  assert.equal((await request("?limit=51")).status, 400);
  assert.equal((await request("?limit=2&status=unknown")).status, 400);
  assert.equal((await request("?limit=2&cursor=other-teacher")).status, 400);
  assert.equal((await request("?limit=2&cursor=owned")).status, 200);
  assert.deepEqual(queries.at(-1)?.cursor, { id: "owned" });
});

test("admin pagination keeps the existing cross-teacher visibility", async () => {
  queries.length = 0;
  const response = await request("?limit=2", "ADMIN");
  assert.equal(response.status, 200);
  assert.deepEqual(queries[0].where, {});
});

test("paginated exam filters are applied before loading results", async () => {
  queries.length = 0;
  const response = await request("?limit=2&status=draft&subject=Matematika&className=X%20A&academicYear=2026%2F2027&semester=ganjil&category=Quiz&search=UTS");
  assert.equal(response.status, 200);
  assert.deepEqual(queries[0].where, {
    teacherId: "teacher-1", status: "draft", subjectName: "Matematika", className: "X A",
    academicYear: "2026/2027", semester: "ganjil", category: "Quiz",
    OR: ["title", "subjectName", "className", "category", "academicYear"].map(field => ({ [field]: { contains: "UTS", mode: "insensitive" } })),
  });
  assert.equal((await request("?limit=2&semester=lain")).status, 400);
});

test("requests without pagination retain the existing array response", async () => {
  queries.length = 0;
  const response = await request("");
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.ok(Array.isArray(body.data));
  assert.equal(queries[0].take, undefined);
});

test("unauthenticated requests cannot access exams", async () => {
  const [{ GET }] = await dependencies;
  assert.equal((await GET(new NextRequest("http://localhost/api/exams?limit=2"))).status, 401);
});

test("POST /api/exams accepts nullable optional fields and creates exam", async () => {
  createdExams.length = 0;
  const payload = {
    title: "Ujian Harian Matematika",
    description: null,
    className: "10-A",
    academicYear: "2026/2027",
    semester: "ganjil",
    category: "Quiz",
    categoryNumber: null,
    durationMinutes: 60,
    scheduledStartAt: null,
    passingScore: 75,
    subjectId: "sub-1",
    bankId: "bank-1",
    bankRevision: 1,
    questionIds: ["q-1"],
    settings: {
      bank_id: "bank-1",
      bank_title: "Aljabar",
      randomize_questions: true,
      randomize_choices: true,
      show_score_to_student: true,
      allow_answer_review: false,
      display_mode: "one_by_one",
    },
    violationPolicy: {
      max_violations: 3,
      action: "lock",
      detect_screenshot: true,
      detect_devtools: true,
      detect_tab_switch: true,
      detect_fullscreen_exit: true,
      detect_ip_change: true,
    },
  };

  const response = await postRequest(payload);
  const body = await response.json();
  assert.equal(response.status, 201);
  assert.equal(body.success, true);
  assert.equal(createdExams.length, 1);
  assert.equal(createdExams[0].title, "Ujian Harian Matematika");
  assert.equal(createdExams[0].description, null);
  assert.equal(createdExams[0].categoryNumber, null);
  assert.equal(createdExams[0].scheduledStartAt, null);
});

test("POST /api/exams returns detailed validation errors on invalid input", async () => {
  const invalidPayload = {
    title: "AB", // minimal 3 karakter
    durationMinutes: 2, // minimal 5 menit
  };

  const response = await postRequest(invalidPayload);
  const body = await response.json();
  assert.equal(response.status, 400);
  assert.equal(body.success, false);
  assert.equal(body.error.code, "VALIDATION_ERROR");
  assert.ok(body.error.message.includes("Data ujian tidak valid"));
  assert.ok(body.error.details.title);
  assert.ok(body.error.details.durationMinutes);
});
