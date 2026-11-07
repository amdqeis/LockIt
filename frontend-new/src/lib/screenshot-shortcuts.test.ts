import assert from "node:assert/strict";
import test from "node:test";
import { matchScreenshotShortcut } from "./screenshot-shortcuts";

test("matches a PrintScreen key without confusing print or focus changes", () => {
  assert.equal(matchScreenshotShortcut({ key: "PrintScreen", code: "PrintScreen", metaKey: false, shiftKey: false }), "print_screen");
  assert.equal(matchScreenshotShortcut({ key: "Print", code: "KeyP", metaKey: false, shiftKey: false }), null);
  assert.equal(matchScreenshotShortcut({ key: "a", code: "KeyA", metaKey: false, shiftKey: false }), null);
});

test("matches explicit OS screenshot shortcuts only", () => {
  assert.equal(matchScreenshotShortcut({ key: "s", code: "KeyS", metaKey: true, shiftKey: true }), "windows_snipping");
  assert.equal(matchScreenshotShortcut({ key: "#", code: "Digit3", metaKey: true, shiftKey: true }), "macos_capture");
  assert.equal(matchScreenshotShortcut({ key: "s", code: "KeyS", metaKey: false, shiftKey: true }), null);
  assert.equal(matchScreenshotShortcut({ key: "g", code: "KeyG", metaKey: true, shiftKey: false }), null);
});
