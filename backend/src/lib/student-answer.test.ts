import assert from "node:assert/strict";
import test from "node:test";
import { validateChoiceAnswer } from "./student-answer";

const options = [{ id: "a", label: "A" }, { id: "long-id", label: "AA" }, { id: "c", label: "C" }];

test("single choice uses the option's stable label", () => {
  assert.deepEqual(validateChoiceAnswer(options, "long-id", false), { ok: true, value: "AA" });
  assert.deepEqual(validateChoiceAnswer([options[2], options[0], options[1]], "AA", false), { ok: true, value: "AA" });
});

test("multiple selections are validated, deduplicated and saved canonically", () => {
  assert.deepEqual(validateChoiceAnswer(options, "c,aa,A,a", true), { ok: true, value: "A,AA,C" });
  assert.equal(validateChoiceAnswer(options, "A,C", false).ok, false);
  assert.equal(validateChoiceAnswer(options, "Z", true).ok, false);
});

test("ambiguous comma IDs are rejected instead of corrupting answers", () => {
  const result = validateChoiceAnswer([{ id: "A,B", label: "A,B" }], "A,B", true);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.message, /koma/);
});
