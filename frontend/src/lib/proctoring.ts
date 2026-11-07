/**
 * EduQuas Proctoring — Browser-only violation definitions & flag mapping
 * (NO camera, face detection, or physical device detection)
 */

export type FlagKey = "tab_switch" | "devtools" | "reconnect";

export const FLAG_LABELS: Record<FlagKey, string> = {
  tab_switch: "Pindah Tab",
  devtools: "Buka DevTools",
  reconnect: "Terputus / IP Change",
};

export const FLAG_CONFIG: Record<
  FlagKey,
  { label: string; shortLabel: string; color: string; border?: string; icon: string }
> = {
  tab_switch: {
    label: "Pindah Tab",
    shortLabel: "Tab",
    color: "#EF6F6C",
    icon: "🔀",
  },
  devtools: {
    label: "Buka DevTools",
    shortLabel: "DevTools",
    color: "#D470DD",
    icon: "🛠️",
  },
  reconnect: {
    label: "Terputus / Reconnect",
    shortLabel: "Koneksi",
    color: "#F2DC3D",
    border: "#C9B800",
    icon: "⚠️",
  },
};

export function eventTypeToFlagKey(eventType: string): FlagKey | null {
  switch (eventType) {
    case "tab_switch":
    case "window_blur":
    case "fullscreen_exit":
    case "fullscreen_denied":
      return "tab_switch";
    case "devtools":
      return "devtools";
    case "reconnect":
    case "heartbeat_lost":
      return "reconnect";
    default:
      return null;
  }
}

export function aggregateFlags(events: Array<{ eventType: string }>): Record<FlagKey, number> {
  const flags: Record<FlagKey, number> = {
    tab_switch: 0,
    devtools: 0,
    reconnect: 0,
  };

  for (const event of events) {
    const key = eventTypeToFlagKey(event.eventType);
    if (key) {
      flags[key]++;
    }
  }

  return flags;
}
