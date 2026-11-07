import assert from "node:assert/strict";
import { test } from "node:test";
import { parsePastedQuestions, invalidQuestion, legacyDoc, normalizeImportedQuestion } from "./sharedQuestionBank";

test("paste banyak soal mempertahankan kunci tanpa menebak jawaban", () => {
  const result = parsePastedQuestions("1. Hitung 2+2\nA. 3\nB. 4\nKunci: B\nBobot: 5\n2. Pilih bilangan genap\nA. 2\nB. 4\nKunci: A,B\n3. Belum lengkap\nA. Satu\nB. Dua");
  assert.equal(result.questions.length, 3);
  assert.equal(result.questions[0].correctAnswer, "b");
  assert.equal(result.questions[0].points, 5);
  assert.equal(result.questions[1].type, "multi_select");
  assert.deepEqual(result.questions[1].correctAnswers, ["a", "b"]);
  assert.equal(result.questions[2].correctAnswer, null);
  assert.ok(invalidQuestion(result.questions[2]).includes("Pilih kunci jawaban."));
});

test("persamaan kosong tidak dapat disimpan", () => {
  const { questions } = parsePastedQuestions("1. Hitung\nA. Satu\nB. Dua\nKunci: A");
  questions[0].content = { type: "doc", content: [{ type: "paragraph", content: [{ type: "equation", attrs: { latex: "" } }] }] };
  assert.ok(invalidQuestion(questions[0]).includes("Lengkapi slot persamaan."));
});

test("import lama mempertahankan persamaan, teks biasa, gambar, dan kunci", () => {
  const q = normalizeImportedQuestion({ type: "multi_select", questionText: "Jika $x^2$ = 4", options: [{ id: "a", text: "$2$", imageUrl: "https://example.invalid/a.png", imageAlt: "pilihan A" }, { id: "b", text: "-2" }], correctAnswers: ["A", "B"], points: 7 });
  assert.deepEqual(q.correctAnswers, ["a", "b"]);
  assert.equal(q.options[0].imageAlt, "pilihan A");
  assert.equal(q.content.content?.[0].content?.[1].type, "equation");
  assert.equal(legacyDoc("teks 1/2 biasa").content?.[0].content?.[0].text, "teks 1/2 biasa");
  assert.equal(legacyDoc("$$x^2$$").content?.[0].type, "equationBlock");
});
