import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";

process.env.JWT_ACCESS_SECRET = "test-access-secret";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
process.env.STUDENT_SESSION_SECRET = "test-student-secret";

interface UpdateManyArgs {
  where?: unknown;
  data?: unknown;
}

let lastUpdateArgs: UpdateManyArgs | null = null;
let shouldFailDb = false;

const fakePrisma = {
  exam: {
    updateMany: async (args: UpdateManyArgs) => {
      if (shouldFailDb) {
        throw new Error("Database connection failure");
      }
      lastUpdateArgs = args;
      return { count: 7 };
    },
  },
};

(globalThis as unknown as { prisma: unknown }).prisma = fakePrisma;

const dependencies = Promise.all([import("./route"), import("@/lib/auth")]);

async function makePostRequest(token?: string, cookieToken?: string) {
  const [{ POST }] = await dependencies;
  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  if (cookieToken) {
    headers["cookie"] = `accessToken=${cookieToken}`;
  }
  return POST(
    new NextRequest("http://localhost/api/admin/academic-year/rollover", {
      method: "POST",
      headers,
    })
  );
}

test("rollover rejects unauthenticated requests with 401", async () => {
  const response = await makePostRequest();
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.equal(body.success, false);
  assert.equal(body.error.code, "UNAUTHORIZED");
});

test("rollover rejects non-admin teacher with 403 Forbidden", async () => {
  const [, { generateAccessToken }] = await dependencies;
  const teacherToken = generateAccessToken({
    teacherId: "teacher-123",
    email: "teacher@example.invalid",
    fullName: "Regular Teacher",
    role: "TEACHER",
  });

  const response = await makePostRequest(teacherToken);
  const body = await response.json();

  assert.equal(response.status, 403);
  assert.equal(body.success, false);
  assert.equal(body.error.code, "FORBIDDEN");
});

test("rollover successfully archives non-archived exams for ADMIN caller (Bearer header)", async () => {
  lastUpdateArgs = null;
  shouldFailDb = false;
  const [, { generateAccessToken }] = await dependencies;
  const adminToken = generateAccessToken({
    teacherId: "admin-1",
    email: "admin@example.invalid",
    fullName: "Administrator",
    role: "ADMIN",
  });

  const response = await makePostRequest(adminToken);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.data.archivedCount, 7);
  assert.ok(typeof body.data.period.academicYear === "string");
  assert.ok(body.data.period.semester === "ganjil" || body.data.period.semester === "genap");

  assert.deepEqual(lastUpdateArgs, {
    where: {
      status: {
        in: ["draft", "active", "ended"],
      },
    },
    data: {
      status: "archived",
    },
  });
});

test("rollover successfully authenticates ADMIN via cookie", async () => {
  lastUpdateArgs = null;
  shouldFailDb = false;
  const [, { generateAccessToken }] = await dependencies;
  const adminToken = generateAccessToken({
    teacherId: "admin-2",
    email: "admin2@example.invalid",
    fullName: "Admin Two",
    role: "ADMIN",
  });

  const response = await makePostRequest(undefined, adminToken);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.data.archivedCount, 7);
});

test("rollover returns 500 when database update fails", async () => {
  shouldFailDb = true;
  const [, { generateAccessToken }] = await dependencies;
  const adminToken = generateAccessToken({
    teacherId: "admin-1",
    email: "admin@example.invalid",
    fullName: "Administrator",
    role: "ADMIN",
  });

  const response = await makePostRequest(adminToken);
  const body = await response.json();

  assert.equal(response.status, 500);
  assert.equal(body.success, false);
  assert.equal(body.error.code, "INTERNAL_SERVER_ERROR");
  shouldFailDb = false;
});
