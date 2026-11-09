import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";

process.env.JWT_ACCESS_SECRET = "test-access-secret";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
process.env.STUDENT_SESSION_SECRET = "test-student-secret";

const queries: Record<string, unknown>[] = [];
const fakePrisma = {
  exam: {
    findFirst: async ({ where }: { where: { id?: string; teacherId?: string } }) => where.id === "owned" && where.teacherId === "teacher-1" ? { id: "owned" } : null,
    findMany: async (query: Record<string, unknown>) => {
      queries.push(query);
      return [{ id: "one" }, { id: "two" }, { id: "three" }];
    },
  },
};
(globalThis as unknown as { prisma: unknown }).prisma = fakePrisma;

const dependencies = Promise.all([import("./route"), import("@/lib/auth")]);

async function request(url: string, role: "TEACHER" | "ADMIN" = "TEACHER") {
  const [{ GET }, { generateAccessToken }] = await dependencies;
  const token = generateAccessToken({ teacherId: "teacher-1", email: "teacher@example.invalid", fullName: "Teacher", role });
  return GET(new NextRequest(`http://localhost/api/exams${url}`, { headers: { Authorization: `Bearer ${token}` } }));
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
