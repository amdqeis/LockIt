import assert from "node:assert/strict";
import test from "node:test";
import { canResumeStudent, isScreenshotDetectionEnabled, isSupportedScreenshotMetadata, shouldIgnoreLegacyProctoringEvent } from "./proctoring-events";

test("accepts only recognized keyboard screenshot evidence", () => {
  assert.equal(isSupportedScreenshotMetadata({ source: "keyboard_shortcut", shortcut: "print_screen" }), true);
  assert.equal(isSupportedScreenshotMetadata({ trigger: "OS screenshot overlay", gapMs: 400 }), false);
  assert.equal(isSupportedScreenshotMetadata({ source: "clipboard", shortcut: "print_screen" }), false);
  assert.equal(shouldIgnoreLegacyProctoringEvent("screenshot", { trigger: "OS screenshot overlay" }), true);
});

test("ignores legacy clipboard events and checks resume eligibility", () => {
  assert.equal(shouldIgnoreLegacyProctoringEvent("copy_attempt"), true);
  assert.equal(shouldIgnoreLegacyProctoringEvent("paste_attempt"), true);
  assert.equal(canResumeStudent({ studentStatus: "active", examStatus: "active", endTime: null }), true);
  assert.equal(canResumeStudent({ studentStatus: "submitted", examStatus: "active", endTime: null }), false);
  assert.equal(canResumeStudent({ studentStatus: "kicked", examStatus: "active", endTime: null }), false);
  assert.equal(canResumeStudent({ studentStatus: "active", examStatus: "ended", endTime: null }), false);
  assert.equal(canResumeStudent({ studentStatus: "active", examStatus: "active", endTime: new Date("2020-01-01"), now: new Date("2021-01-01") }), false);
});

test("respects the teacher screenshot detection policy", () => {
  assert.equal(isScreenshotDetectionEnabled({ detect_screenshot: false }), false);
  assert.equal(isScreenshotDetectionEnabled({ detect_screenshot: true }), true);
  assert.equal(isScreenshotDetectionEnabled({}), true);
});

test("isViolation handles focus loss and split screen settings with backwards compatibility", () => {
  const { isViolation } = require("./proctoring-events");
  // Legacy policy with only detect_tab_switch
  assert.equal(isViolation("window_blur", { detect_tab_switch: true }), true);
  assert.equal(isViolation("window_blur", { detect_tab_switch: false }), false);

  // Separate detect_focus_loss setting overrides
  assert.equal(isViolation("window_blur", { detect_tab_switch: true, detect_focus_loss: false }), false);
  assert.equal(isViolation("window_blur", { detect_tab_switch: false, detect_focus_loss: true }), true);

  // Split screen detection
  assert.equal(isViolation("split_screen", { detect_split_screen: true }), true);
  assert.equal(isViolation("split_screen", { detect_split_screen: false }), false);
  assert.equal(isViolation("split_screen", {}), true);
});
