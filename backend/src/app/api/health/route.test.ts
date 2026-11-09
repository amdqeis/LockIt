import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@/lib/prisma";
import { GET } from "./route";

test("health endpoint reports database availability without leaking errors", async () => {
  const query = mock.method(prisma, "$queryRaw", async () => [{ value: 1 }] as never);
  try {
    assert.equal((await GET()).status, 200);
    query.mock.mockImplementation(async () => { throw new Error("private database details"); });
    const response = await GET();
    assert.equal(response.status, 503);
    assert.doesNotMatch(await response.text(), /private database details/);
  } finally {
    query.mock.restore();
  }
});
