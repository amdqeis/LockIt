import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeName, formatSubjectDisplayName, formatBankDisplayName, parseLegacyClassName } from "./academic";

test("normalizeName normalizes whitespace and lowercases", () => {
  assert.equal(normalizeName("  Matematika   Wajib  "), "matematika wajib");
  assert.equal(normalizeName("Tingkat X"), "tingkat x");
  assert.equal(normalizeName("X-1"), "x-1");
});

test("formatSubjectDisplayName and formatBankDisplayName", () => {
  assert.equal(formatSubjectDisplayName("Matematika", "Tingkat X"), "Matematika · Tingkat X");
  assert.equal(formatSubjectDisplayName("Matematika", null), "Matematika");
  assert.equal(
    formatBankDisplayName("Persamaan Kuadrat", "Matematika", "Tingkat X"),
    "Persamaan Kuadrat — Matematika · Tingkat X"
  );
});

test("parseLegacyClassName parses valid class names correctly", () => {
  assert.deepEqual(parseLegacyClassName("X-1"), { gradeLevelName: "Tingkat X", classroomName: "X-1" });
  assert.deepEqual(parseLegacyClassName("Kelas X 2"), { gradeLevelName: "Tingkat X", classroomName: "X-2" });
  assert.deepEqual(parseLegacyClassName("XI-IPA-1"), { gradeLevelName: "Tingkat XI", classroomName: "XI-IPA-1" });
  assert.deepEqual(parseLegacyClassName("12.A"), { gradeLevelName: "Tingkat XII", classroomName: "XII-A" });
  assert.deepEqual(parseLegacyClassName("X"), { gradeLevelName: "Tingkat X", classroomName: "X-1" });
  assert.equal(parseLegacyClassName("RandomClass"), null);
});

