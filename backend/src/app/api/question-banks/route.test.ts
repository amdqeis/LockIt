import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";

process.env.JWT_ACCESS_SECRET = "test-access-secret";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
process.env.STUDENT_SESSION_SECRET = "test-student-secret";
const queries: Record<string, unknown>[] = [];
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
  questionBank: {
    findUnique: async ({ where }: { where: { id: string } }) => where.id === "one" ? { id: "one" } : null,
    findMany: async (query: Record<string, unknown>) => { queries.push(query); return [{ id: "one" }, { id: "two" }, { id: "three" }]; },
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
test("unpaginated responses retain the legacy array", async () => {
  queries.length = 0; const body = await (await request("")).json(); assert.ok(Array.isArray(body.data)); assert.equal(queries[0].take, undefined);
});
test("unauthenticated requests are rejected", async () => {
  const [{ GET }] = await dependencies; assert.equal((await GET(new NextRequest("http://localhost/api/question-banks?limit=2"))).status, 401);
});
