import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";

process.env.JWT_ACCESS_SECRET = "test-access-secret";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
process.env.STUDENT_SESSION_SECRET = "test-student-secret";
const queries: Record<string, unknown>[] = [];
const gradeId = "11111111-1111-4111-8111-111111111111";
const otherGradeId = "22222222-2222-4222-8222-222222222222";
const subjectId = "33333333-3333-4333-8333-333333333333";
let subject = { id: subjectId, name: "Matematika", gradeLevelId: gradeId, isArchived: false, gradeLevel: { isArchived: false } };
let created: Record<string, unknown> | undefined;
let updated: Record<string, unknown> | undefined;
(globalThis as unknown as { prisma: unknown }).prisma = {
  teacher: {
    findUnique: async ({ where }: { where: { id: string } }) => ({
      id: where.id,
      email: "teacher@example.invalid",
      fullName: "Teacher",
      role: "TEACHER",
      isActive: true,
      sessionVersion: "session-1",
    }),
  },
  subject: { findUnique: async () => subject },
  questionBank: {
    findUnique: async ({ where }: { where: { id: string } }) => where.id === "one" ? { id: "one", subjectId, subjectFolder: { gradeLevelId: gradeId } } : null,
    findMany: async (query: Record<string, unknown>) => { queries.push(query); return [{ id: "one" }, { id: "two" }, { id: "three" }]; },
    create: async ({ data }: { data: Record<string, unknown> }) => { created = data; return data; },
    updateMany: async ({ data }: { data: Record<string, unknown> }) => { updated = data; return { count: 1 }; },
  },
};
const dependencies = Promise.all([import("./route"), import("@/lib/auth")]);
async function request(query: string) {
  const [{ GET }, { generateAccessToken }] = await dependencies;
  const token = generateAccessToken({ teacherId: "teacher-1", email: "teacher@example.invalid", fullName: "Teacher", role: "TEACHER", sessionVersion: "session-1" });
  return GET(new NextRequest(`http://localhost/api/question-banks${query}`, { headers: { Authorization: `Bearer ${token}` } }));
}
test("bank pagination returns only bounded summaries", async () => {
  queries.length = 0;
  const response = await request("?limit=2"); const body = await response.json();
  assert.equal(response.status, 200); assert.deepEqual(body.data.items, [{ id: "one" }, { id: "two" }]); assert.equal(body.data.nextCursor, "two");
  assert.equal(queries[0].take, 3); assert.ok(queries[0].select); assert.equal(response.headers.get("cache-control"), "private, no-store");
});
test("invalid limits and cursors are rejected", async () => {
  assert.equal((await request("?limit=51")).status, 400); assert.equal((await request("?limit=2&cursor=missing")).status, 400); assert.equal((await request("?limit=2&cursor=one")).status, 200);
});
test("grade and subject filters are applied to the page and its cursor", async () => {
  queries.length = 0;
  assert.equal((await request(`?limit=2&gradeLevelId=${gradeId}&subjectId=${subjectId}&cursor=one`)).status, 200);
  assert.deepEqual(queries[0].where, { subjectId, subjectFolder: { gradeLevelId: gradeId } });
  assert.deepEqual(queries[0].cursor, { id: "one" });
  assert.ok((queries[0].select as Record<string, unknown>).subjectFolder);
  assert.equal((await request(`?limit=2&gradeLevelId=${otherGradeId}&cursor=one`)).status, 400);
  assert.equal((await request(`?limit=2&subjectId=unassigned&cursor=one`)).status, 400);
  assert.equal((await request("?limit=2&gradeLevelId=invalid")).status, 400);
});
test("unpaginated responses retain the legacy array", async () => {
  queries.length = 0; const body = await (await request("")).json(); assert.ok(Array.isArray(body.data)); assert.equal(queries[0].take, undefined);
  queries.length = 0;
  const filtered = await request(`?gradeLevelId=${gradeId}&subjectId=${subjectId}`);
  assert.ok(Array.isArray((await filtered.json()).data));
  assert.deepEqual(queries[0].where, { subjectId, subjectFolder: { gradeLevelId: gradeId } });
  assert.equal((await request("?gradeLevelId=invalid")).status, 400);
});
test("unauthenticated requests are rejected", async () => {
  const [{ GET }] = await dependencies; assert.equal((await GET(new NextRequest("http://localhost/api/question-banks?limit=2"))).status, 401);
});

test("bank creation rejects archived subjects and takes its name from the selected subject", async () => {
  const [{ POST }, { generateAccessToken }] = await dependencies;
  const token = generateAccessToken({ teacherId: "teacher-1", email: "teacher@example.invalid", fullName: "Teacher", role: "TEACHER", sessionVersion: "session-1" });
  const createRequest = () => new NextRequest("http://localhost/api/question-banks", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ title: "Aljabar", subject: "Nama salah", subjectId }) });
  subject = { ...subject, isArchived: true };
  assert.equal((await POST(createRequest())).status, 400);
  subject = { ...subject, isArchived: false, gradeLevel: { isArchived: true } };
  assert.equal((await POST(createRequest())).status, 400);
  subject = { ...subject, gradeLevel: { isArchived: false } };
  assert.equal((await POST(createRequest())).status, 201);
  assert.equal(created?.subject, "Matematika");
  assert.equal(created?.subjectId, subjectId);
});

test("bank metadata cannot move to another grade or an archived subject", async () => {
  const [{ PATCH }, { generateAccessToken }] = await Promise.all([import("./[id]/route"), import("@/lib/auth")]);
  const token = generateAccessToken({ teacherId: "teacher-1", email: "teacher@example.invalid", fullName: "Teacher", role: "TEACHER", sessionVersion: "session-1" });
  const patchRequest = () => new NextRequest("http://localhost/api/question-banks/one", { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ revision: 1, subjectId }) });
  const context = { params: Promise.resolve({ id: "one" }) };
  subject = { ...subject, gradeLevelId: otherGradeId };
  assert.equal((await PATCH(patchRequest(), context)).status, 400);
  subject = { ...subject, gradeLevelId: gradeId, isArchived: true };
  assert.equal((await PATCH(patchRequest(), context)).status, 400);
  subject = { ...subject, isArchived: false };
  assert.equal((await PATCH(patchRequest(), context)).status, 200);
  assert.equal(updated?.subject, "Matematika");
});
