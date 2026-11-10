import { test } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { GET } from "./route";

test("GET /api/student-profile returns null when no cookie present", async () => {
  const req = new NextRequest("http://localhost/api/student-profile");
  const res = await GET(req);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("Cache-Control"), "private, no-store");
  const body = await res.json();
  assert.equal(body.success, true);
  assert.equal(body.data, null);
});

