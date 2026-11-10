import assert from "node:assert/strict";
import test from "node:test";
import { parseStudentAssignment, applyAssignmentToQuestions } from "../../../lib/student-assignment";
import { normalizeIp } from "../../../lib/rate-limit";
import { isViolation } from "../../../lib/proctoring-events";

test("normalizeIp handles IPv4, IPv6 localhost, and IPv4-mapped IPv6", () => {
  assert.equal(normalizeIp("::1"), "127.0.0.1");
  assert.equal(normalizeIp("::ffff:192.168.1.50"), "192.168.1.50");
  assert.equal(normalizeIp("10.0.0.1"), "10.0.0.1");
  assert.equal(normalizeIp("2001:db8::1"), "2001:db8::1");
});

test("isViolation correctly accounts for focus loss and split screen settings", () => {
  // policy default (semua aktif)
  const defaultPolicy = {
    detect_tab_switch: true,
    detect_focus_loss: true,
    detect_fullscreen_exit: true,
    detect_split_screen: true,
  };
  assert.equal(isViolation("tab_switch", defaultPolicy), true);
  assert.equal(isViolation("window_blur", defaultPolicy), true);
  assert.equal(isViolation("fullscreen_exit", defaultPolicy), true);

  // Jika detect_focus_loss false tapi detect_tab_switch true: tab_switch tetap violation, blur tidak
  const noBlurPolicy = {
    detect_tab_switch: true,
    detect_focus_loss: false,
  };
  assert.equal(isViolation("tab_switch", noBlurPolicy), true);
  assert.equal(isViolation("window_blur", noBlurPolicy), false);

  // Jika detect_tab_switch false dan detect_focus_loss true
  const noTabPolicy = {
    detect_tab_switch: false,
    detect_focus_loss: true,
  };
  assert.equal(isViolation("tab_switch", noTabPolicy), false);
  assert.equal(isViolation("window_blur", noTabPolicy), true);

  // Split screen hanya violation jika menyertai window_blur atau fullscreen_exit
  assert.equal(isViolation("fullscreen_exit", { detect_fullscreen_exit: false }), false);
});

test("parseStudentAssignment and applyAssignmentToQuestions keep question assignment stable", () => {
  const candidateQuestions = [
    { id: "q1", points: 10, options: ["A", "B"] },
    { id: "q2", points: 10, options: ["C", "D"] },
    { id: "q3", points: 10, options: ["E", "F"] },
  ];

  const savedAssignment = {
    questionIds: ["q3", "q1"],
    optionsOrder: {
      q1: ["B", "A"],
    },
  };

  const parsed = parseStudentAssignment(savedAssignment);
  assert.notEqual(parsed, null);
  assert.deepEqual(parsed?.questionIds, ["q3", "q1"]);

  const assigned = applyAssignmentToQuestions(candidateQuestions, parsed!);
  assert.equal(assigned.length, 2);
  assert.equal(assigned[0].id, "q3");
  assert.equal(assigned[1].id, "q1");

  // Soal asing (q2) tidak dimasukkan
  assert.equal(assigned.some((q) => q.id === "q2"), false);
});
