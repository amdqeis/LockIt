export type ScreenshotShortcut = "print_screen" | "windows_snipping" | "macos_capture";

type ScreenshotKeyEvent = Pick<
  KeyboardEvent,
  "key" | "code" | "metaKey" | "shiftKey"
>;

export function matchScreenshotShortcut(event: ScreenshotKeyEvent): ScreenshotShortcut | null {
  if (event.key === "PrintScreen" || event.code === "PrintScreen") {
    return "print_screen";
  }

  if (event.metaKey && event.shiftKey && (event.code === "KeyS" || event.key.toLowerCase() === "s")) {
    return "windows_snipping";
  }

  if (event.metaKey && event.shiftKey && ["Digit3", "Digit4", "Digit5"].includes(event.code)) {
    return "macos_capture";
  }

  return null;
}
