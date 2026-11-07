import assert from "node:assert/strict";
import { test } from "node:test";
import { getStoredQuestionBanks, getStoredQuestions } from "./questionBank";

test("bank soal baru kosong dan data tersimpan tidak diganti data contoh", () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
  Object.assign(globalThis, { window: {}, localStorage: storage });
  try {
    assert.deepEqual(getStoredQuestionBanks(), []);
    assert.deepEqual(getStoredQuestions(), []);
    assert.equal(values.size, 0);
    values.set("eduquas_question_banks_v2", JSON.stringify([{ id: "existing" }]));
    values.set("eduquas_bank_questions_v2", JSON.stringify([{ id: "q1", bankId: "existing" }]));
    assert.equal(getStoredQuestionBanks()[0].id, "existing");
    assert.equal(getStoredQuestions("existing")[0].id, "q1");
    values.set("eduquas_question_banks_v2", "[]");
    assert.deepEqual(getStoredQuestionBanks(), []);
  } finally {
    Reflect.deleteProperty(globalThis, "window");
    Reflect.deleteProperty(globalThis, "localStorage");
  }
});
