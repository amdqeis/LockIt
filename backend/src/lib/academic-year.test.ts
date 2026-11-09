import assert from "node:assert/strict";
import test from "node:test";
import { getCurrentAcademicPeriod } from "./academic-year";

test("getCurrentAcademicPeriod handles odd semester (ganjil) for months >= 7", () => {
  // July (month index 6, month 7)
  const july = new Date(2026, 6, 15);
  assert.deepEqual(getCurrentAcademicPeriod(july), {
    academicYear: "2026/2027",
    semester: "ganjil",
  });

  // December (month index 11, month 12)
  const dec = new Date(2026, 11, 31);
  assert.deepEqual(getCurrentAcademicPeriod(dec), {
    academicYear: "2026/2027",
    semester: "ganjil",
  });
});

test("getCurrentAcademicPeriod handles even semester (genap) for months 1-6", () => {
  // January (month index 0, month 1)
  const jan = new Date(2027, 0, 1);
  assert.deepEqual(getCurrentAcademicPeriod(jan), {
    academicYear: "2026/2027",
    semester: "genap",
  });

  // June (month index 5, month 6)
  const june = new Date(2027, 5, 30);
  assert.deepEqual(getCurrentAcademicPeriod(june), {
    academicYear: "2026/2027",
    semester: "genap",
  });
});

test("getCurrentAcademicPeriod uses current date as default argument", () => {
  const period = getCurrentAcademicPeriod();
  assert.ok(typeof period.academicYear === "string");
  assert.match(period.academicYear, /^\d{4}\/\d{4}$/);
  assert.ok(period.semester === "ganjil" || period.semester === "genap");
});
