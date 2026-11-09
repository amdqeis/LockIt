import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calculateScore,
  calculateMultiSelectScore,
  calculateQuestionScore,
} from "./score-calculation";

const legacyQuestions = [
  { id: "single", type: "single_choice", points: 3 },
  { id: "multi", type: "multi_select", points: 7 },
  { id: "short", type: "short_answer", points: 10 },
];

test("nilai sementara memasukkan bobot semua soal dan menandai jawaban singkat yang menunggu", () => {
  const result = calculateScore(legacyQuestions, [
    { questionId: "single", selectedOption: "A", isCorrect: true },
    { questionId: "multi", selectedOption: "A", isCorrect: false },
    { questionId: "short", selectedOption: "jawaban", isCorrect: null },
  ]);
  assert.deepEqual(result, { totalPoints: 20, earnedPoints: 3, correctCount: 1, pendingManualCount: 1, finalScore: 15 });
});

test("penilaian manual benar memberi bobot penuh dan jawaban kosong tidak menunggu", () => {
  const graded = calculateScore(legacyQuestions, [{ questionId: "short", selectedOption: "jawaban", isCorrect: true }]);
  assert.equal(graded.earnedPoints, 10);
  assert.equal(graded.finalScore, 50);
  assert.equal(graded.pendingManualCount, 0);
  assert.equal(calculateScore(legacyQuestions, [{ questionId: "short", selectedOption: "", isCorrect: null }]).pendingManualCount, 0);
});

// ─── PENGUJIAN SKOR MULTI-SELECT DENGAN RUMUS PENALTI ─────────────────────────

const sampleOptions = [
  { id: "A", label: "A", text: "Opsi A" },
  { id: "B", label: "B", text: "Opsi B" },
  { id: "C", label: "C", text: "Opsi C" },
  { id: "D", label: "D", text: "Opsi D" },
];

test("multi-select: semua opsi benar dipilih (100% skor penuh)", () => {
  // x = 2 (A, B), n = 4, points = 10
  // formula: (2/2 * 100) - (0/4 * 100) = 100% -> earned = 10
  const result = calculateMultiSelectScore("A, B", "A, B", sampleOptions, 10);
  assert.equal(result.percentage, 100);
  assert.equal(result.earnedPoints, 10);
  assert.equal(result.isFullCorrect, true);
  assert.equal(result.isPartiallyCorrect, false);
});

test("multi-select: sebagian opsi benar dipilih tanpa opsi salah (skor parsial)", () => {
  // x = 2 (A, B), n = 4, points = 10
  // formula: (1/2 * 100) - (0/4 * 100) = 50% -> earned = 5
  const result = calculateMultiSelectScore("A", "A, B", sampleOptions, 10);
  assert.equal(result.percentage, 50);
  assert.equal(result.earnedPoints, 5);
  assert.equal(result.isFullCorrect, false);
  assert.equal(result.isPartiallyCorrect, true);
});

test("multi-select: sebagian opsi benar dipilih dengan tambahan opsi salah (penalti parsial)", () => {
  // x = 2 (A, B), n = 4, points = 10
  // student memilih A (benar) dan C (salah)
  // formula: (1/2 * 100) - (1/4 * 100) = 50% - 25% = 25% -> earned = 2.5
  const result = calculateMultiSelectScore("A, C", "A, B", sampleOptions, 10);
  assert.equal(result.percentage, 25);
  assert.equal(result.earnedPoints, 2.5);
  assert.equal(result.isFullCorrect, false);
  assert.equal(result.isPartiallyCorrect, true);
});

test("multi-select: skor terpotong ke 0 jika penalti opsi salah melebihi opsi benar", () => {
  // x = 2 (A, B), n = 4, points = 10
  // student memilih A (benar) dan C, D (2 salah)
  // formula: (1/2 * 100) - (2/4 * 100) = 50% - 50% = 0% -> earned = 0
  const cutZero = calculateMultiSelectScore("A, C, D", "A, B", sampleOptions, 10);
  assert.equal(cutZero.percentage, 0);
  assert.equal(cutZero.earnedPoints, 0);
  assert.equal(cutZero.isFullCorrect, false);
  assert.equal(cutZero.isPartiallyCorrect, false);

  // student hanya memilih opsi salah (C, D)
  // formula: max(0, 0 - (2/4 * 100)) = 0% -> earned = 0
  const allWrong = calculateMultiSelectScore("C, D", "A, B", sampleOptions, 10);
  assert.equal(allWrong.percentage, 0);
  assert.equal(allWrong.earnedPoints, 0);
  assert.equal(allWrong.isFullCorrect, false);
  assert.equal(allWrong.isPartiallyCorrect, false);
});

test("multi-select: memilih seluruh opsi (benar dan salah)", () => {
  // x = 2 (A, B), n = 4, points = 10
  // student memilih A, B, C, D
  // formula: (2/2 * 100) - (2/4 * 100) = 100% - 50% = 50% -> earned = 5
  const allSelected = calculateMultiSelectScore("A, B, C, D", "A, B", sampleOptions, 10);
  assert.equal(allSelected.percentage, 50);
  assert.equal(allSelected.earnedPoints, 5);
  assert.equal(allSelected.isFullCorrect, false);
  assert.equal(allSelected.isPartiallyCorrect, true);
});

test("multi-select: jawaban kosong atau tidak dijawab bernilai 0", () => {
  assert.equal(calculateMultiSelectScore("", "A, B", sampleOptions, 10).earnedPoints, 0);
  assert.equal(calculateMultiSelectScore(null, "A, B", sampleOptions, 10).earnedPoints, 0);
  assert.equal(calculateMultiSelectScore("   ", "A, B", sampleOptions, 10).earnedPoints, 0);
});

test("multi-select: edge cases (x = 0, n = 0, points = 0) menghasilkan nilai 0", () => {
  // x = 0 (tidak ada kunci jawaban)
  assert.equal(calculateMultiSelectScore("A", "", sampleOptions, 10).earnedPoints, 0);
  // n = 0 (tidak ada daftar opsi)
  assert.equal(calculateMultiSelectScore("A", "A", [], 10).earnedPoints, 0);
  // points = 0
  assert.equal(calculateMultiSelectScore("A", "A", sampleOptions, 0).earnedPoints, 0);
});

test("multi-select: case-insensitive dan multi-character IDs", () => {
  const customOptions = [
    { id: "OPT_1", label: "OPT_1" },
    { id: "OPT_2", label: "OPT_2" },
    { id: "OPT_3", label: "OPT_3" },
  ];
  // x = 2 (opt_1, opt_2), n = 3, student selects opt_1
  // formula: (1/2 * 100) - (0/3 * 100) = 50% -> earned = 5
  const result = calculateMultiSelectScore("opt_1", "OPT_1,OPT_2", customOptions, 10);
  assert.equal(result.percentage, 50);
  assert.equal(result.earnedPoints, 5);
});

test("single choice dan short answer tetap berperilaku konsisten", () => {
  const singleQ = { id: "sq1", type: "single_choice", points: 5, correctAnswer: "B", options: sampleOptions };
  const shortQ = { id: "sh1", type: "short_answer", points: 8, correctAnswer: "", options: [] };

  // Single choice benar
  const scCorrect = calculateQuestionScore(singleQ, { questionId: "sq1", selectedOption: "B", isCorrect: null });
  assert.equal(scCorrect.earnedPoints, 5);
  assert.equal(scCorrect.isFullCorrect, true);

  // Single choice salah
  const scWrong = calculateQuestionScore(singleQ, { questionId: "sq1", selectedOption: "C", isCorrect: null });
  assert.equal(scWrong.earnedPoints, 0);
  assert.equal(scWrong.isFullCorrect, false);

  // Single choice kosong
  const scEmpty = calculateQuestionScore(singleQ, { questionId: "sq1", selectedOption: null, isCorrect: null });
  assert.equal(scEmpty.earnedPoints, 0);

  // Short answer menunggu penilaian
  const saPending = calculateQuestionScore(shortQ, { questionId: "sh1", selectedOption: "Jawaban esai", isCorrect: null });
  assert.equal(saPending.earnedPoints, 0);
  assert.equal(saPending.pendingManual, true);

  // Short answer dinilai benar
  const saCorrect = calculateQuestionScore(shortQ, { questionId: "sh1", selectedOption: "Jawaban esai", isCorrect: true });
  assert.equal(saCorrect.earnedPoints, 8);
  assert.equal(saCorrect.pendingManual, false);

  // Short answer dinilai salah
  const saWrong = calculateQuestionScore(shortQ, { questionId: "sh1", selectedOption: "Jawaban esai", isCorrect: false });
  assert.equal(saWrong.earnedPoints, 0);
  assert.equal(saWrong.pendingManual, false);
});

test("verifikasi nilai ringkasan sama dengan penjumlahan nilai per soal", () => {
  const examQuestions = [
    { id: "q1", type: "single_choice", points: 10, correctAnswer: "A", options: sampleOptions },
    { id: "q2", type: "multi_select", points: 10, correctAnswer: "A,B", options: sampleOptions },
    { id: "q3", type: "short_answer", points: 10, correctAnswer: "", options: [] },
  ];

  const studentAnswers = [
    { questionId: "q1", selectedOption: "A", isCorrect: null }, // benar (10 poin)
    { questionId: "q2", selectedOption: "A,C", isCorrect: null }, // 1 benar, 1 salah -> 25% (2.5 poin)
    { questionId: "q3", selectedOption: "Esai saya", isCorrect: true }, // dinilai benar (10 poin)
  ];

  // Hitung per soal
  const q1Score = calculateQuestionScore(examQuestions[0], studentAnswers[0]);
  const q2Score = calculateQuestionScore(examQuestions[1], studentAnswers[1]);
  const q3Score = calculateQuestionScore(examQuestions[2], studentAnswers[2]);

  assert.equal(q1Score.earnedPoints, 10);
  assert.equal(q2Score.earnedPoints, 2.5);
  assert.equal(q3Score.earnedPoints, 10);
  const sumPerQuestion = q1Score.earnedPoints + q2Score.earnedPoints + q3Score.earnedPoints;
  assert.equal(sumPerQuestion, 22.5);

  // Hitung ringkasan via calculateScore
  const summary = calculateScore(examQuestions, studentAnswers);
  assert.equal(summary.totalPoints, 30);
  assert.equal(summary.earnedPoints, 22.5);
  assert.equal(summary.correctCount, 2); // q1 (full) & q3 (full), q2 is partial
  assert.equal(summary.pendingManualCount, 0);
  // finalScore = (22.5 / 30) * 100 = 75
  assert.equal(summary.finalScore, 75);
});
