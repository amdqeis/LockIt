import assert from "node:assert/strict";
import test from "node:test";
import { groupedResultRows, resultsHeader, serializeCsv } from "./csv";

test("grouped CSV keeps all attempts in grade and subject blocks and escapes spreadsheet formulas", () => {
  const attempt = (index: number, grade: string, subject: string, pending = false) => ({
    exam: { title: `Ujian ${index}`, className: "A", subjectName: subject, subjectId: subject, academicYear: "2026/2027", semester: "ganjil", classroom: { gradeLevel: { id: grade, name: grade } }, subjectFolder: null },
    student: { name: index === 0 ? '=Siswa "uji"' : `Siswa ${index}`, nisn: `${index}`, pendingManualCount: pending ? 1 : 0, finalScore: 80, violationCount: 0, submittedAt: new Date("2026-01-01T00:00:00Z") },
  });
  const entries = Array.from({ length: 30 }, (_, i) => attempt(i, "X", "Matematika", i === 1));
  entries.push(attempt(31, "XI", "Bahasa"));
  const sameName = attempt(32, "X", "Matematika");
  sameName.exam.subjectId = "math-other";
  entries.push(sameName);
  const rows = groupedResultRows(entries);
  assert.equal(rows.filter(row => row === resultsHeader).length, 3);
  assert.equal(rows.filter(row => row[0] === "Tingkat").length, 3);
  assert.equal(rows.filter(row => row.length === resultsHeader.length).length, 35);
  assert.ok(rows.some(row => row.includes("Menunggu penilaian") && row[7] === ""));
  const csv = serializeCsv(rows);
  assert.ok(csv.startsWith("\uFEFF"));
  assert.ok(csv.includes('"\'=Siswa ""uji"""'));
  assert.ok(csv.includes("\r\n\r\n"));
});
