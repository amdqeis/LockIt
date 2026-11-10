import test from "node:test";
import assert from "node:assert/strict";
import {
  pseudoRandomShuffle,
  getOptionKey,
  parseStudentAssignment,
  applyAssignmentToQuestions,
} from "./student-assignment";
import { calculateScore } from "@/services/score-calculation";

test("pseudoRandomShuffle produces deterministic output based on seed and salt", () => {
  const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const shuffled1 = pseudoRandomShuffle(items, "1234567890", "exam-1");
  const shuffled2 = pseudoRandomShuffle(items, "1234567890", "exam-1");
  const differentStudent = pseudoRandomShuffle(items, "0987654321", "exam-1");

  assert.deepEqual(shuffled1, shuffled2);
  assert.notDeepEqual(shuffled1, differentStudent);
  assert.equal(shuffled1.length, items.length);
});

test("parseStudentAssignment handles valid and invalid assignments correctly", () => {
  assert.equal(parseStudentAssignment(null), null);
  assert.equal(parseStudentAssignment("invalid"), null);
  assert.equal(parseStudentAssignment({}), null);

  const valid = {
    questionIds: ["q1", "q2", "q3"],
    optionsOrder: {
      q1: ["B", "A", "C"],
    },
  };
  const parsed = parseStudentAssignment(valid);
  assert.deepEqual(parsed, valid);
});

test("applyAssignmentToQuestions subsets questions and preserves option orders", () => {
  const questions = [
    { id: "q1", points: 10, options: [{ key: "A", text: "Alpha" }, { key: "B", text: "Beta" }] },
    { id: "q2", points: 10, options: ["X", "Y"] },
    { id: "q3", points: 10, options: [] },
  ];

  const assignment = {
    questionIds: ["q2", "q1"],
    optionsOrder: {
      q1: ["B", "A"],
    },
  };

  const applied = applyAssignmentToQuestions(questions, assignment);
  assert.equal(applied.length, 2);
  assert.equal(applied[0].id, "q2");
  assert.equal(applied[1].id, "q1");

  // Options in q1 are reordered to B, then A
  const q1Opts = applied[1].options as Array<{ key: string }>;
  assert.equal(q1Opts[0].key, "B");
  assert.equal(q1Opts[1].key, "A");
});

test("scoring calculates points based on assigned question subset", () => {
  // Candidate pool has 4 questions, each 10 points (total 40)
  const allQuestions = [
    { id: "q1", points: 10, type: "single_choice", correctAnswer: "A" },
    { id: "q2", points: 10, type: "single_choice", correctAnswer: "B" },
    { id: "q3", points: 10, type: "single_choice", correctAnswer: "C" },
    { id: "q4", points: 10, type: "single_choice", correctAnswer: "D" },
  ];

  // Student assigned subset of 2 questions (q1, q2)
  const assigned = applyAssignmentToQuestions(allQuestions, { questionIds: ["q1", "q2"] });
  assert.equal(assigned.length, 2);

  // Student answered q1 correctly and q2 incorrectly
  const answers = [
    { questionId: "q1", selectedOption: "A", isCorrect: true },
    { questionId: "q2", selectedOption: "A", isCorrect: false },
    // Foreign answer outside assignment: not included in assigned questions
    { questionId: "q3", selectedOption: "C", isCorrect: true },
  ];

  const result = calculateScore(assigned, answers);
  // Total assigned points = 20, earned = 10, finalScore = 50%
  assert.equal(result.totalPoints, 20);
  assert.equal(result.earnedPoints, 10);
  assert.equal(result.finalScore, 50);
});

