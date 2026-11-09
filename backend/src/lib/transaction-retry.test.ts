import assert from "node:assert/strict";
import test from "node:test";
import { retrySerializable } from "./transaction-retry";

test("retries serialization conflicts and keeps the successful result", async () => {
  let calls = 0;
  const result = await retrySerializable(async () => { calls++; if (calls < 3) throw { code: "P2034" }; return "saved"; });
  assert.equal(result, "saved");
  assert.equal(calls, 3);
});
test("does not retry unrelated failures or retry indefinitely", async () => {
  let calls = 0;
  await assert.rejects(retrySerializable(async () => { calls++; throw new Error("invalid input"); }), /invalid input/);
  assert.equal(calls, 1);
  calls = 0;
  await assert.rejects(retrySerializable(async () => { calls++; throw Object.assign(new Error("conflict"), { code: "P2034" }); }), /conflict/);
  assert.equal(calls, 3);
});
