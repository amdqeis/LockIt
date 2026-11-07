export const SCREENSHOT_SHORTCUTS = [
  "print_screen",
  "windows_snipping",
  "macos_capture",
] as const;

export type ScreenshotShortcut = (typeof SCREENSHOT_SHORTCUTS)[number];

export function isScreenshotDetectionEnabled(policy: unknown): boolean {
  if (!policy || typeof policy !== "object" || Array.isArray(policy)) return true;
  return (policy as Record<string, unknown>).detect_screenshot !== false;
}

export function isSupportedScreenshotMetadata(metadata: unknown): metadata is {
  source: "keyboard_shortcut";
  shortcut: ScreenshotShortcut;
} {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return false;
  const value = metadata as Record<string, unknown>;
  return value.source === "keyboard_shortcut" &&
    SCREENSHOT_SHORTCUTS.includes(value.shortcut as ScreenshotShortcut);
}

export function shouldIgnoreLegacyProctoringEvent(eventType: string, metadata?: unknown): boolean {
  if (eventType === "copy_attempt" || eventType === "paste_attempt") return true;
  return eventType === "screenshot" && !isSupportedScreenshotMetadata(metadata);
}

export function canResumeStudent(input: {
  studentStatus: string;
  examStatus: string;
  endTime: Date | null;
  now?: Date;
}): boolean {
  const eligibleStudentStatus = ["waiting", "accepted", "active", "disconnected"].includes(input.studentStatus);
  const eligibleExamStatus = ["draft", "active"].includes(input.examStatus);
  const timeExpired = !!input.endTime && input.endTime.getTime() < (input.now ?? new Date()).getTime();
  return eligibleStudentStatus && eligibleExamStatus && !timeExpired;
}
