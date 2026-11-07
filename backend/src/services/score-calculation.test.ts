import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateScore } from "./score-calculation";

const questions = [
  { id: "single", type: "single_choice", points: 3 },
  { id: "multi", type: "multi_select", points: 7 },
  { id: "short", type: "short_answer", points: 10 },
];

test("nilai sementara memasukkan bobot semua soal dan menandai jawaban singkat yang menunggu", () => {
  const result = calculateScore(questions, [
    { questionId: "single", selectedOption: "A", isCorrect: true },
    { questionId: "multi", selectedOption: "A", isCorrect: false },
    { questionId: "short", selectedOption: "jawaban", isCorrect: null },
  ]);
  assert.deepEqual(result, { totalPoints: 20, earnedPoints: 3, correctCount: 1, pendingManualCount: 1, finalScore: 15 });
});

test("penilaian manual benar memberi bobot penuh dan jawaban kosong tidak menunggu", () => {
  const graded = calculateScore(questions, [{ questionId: "short", selectedOption: "jawaban", isCorrect: true }]);
  assert.equal(graded.earnedPoints, 10);
  assert.equal(graded.finalScore, 50);
  assert.equal(graded.pendingManualCount, 0);
  assert.equal(calculateScore(questions, [{ questionId: "short", selectedOption: "", isCorrect: null }]).pendingManualCount, 0);
});
