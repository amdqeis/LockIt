"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

// ─── Types ────────────────────────────────────────────────────────────────────
type FlagKey =
  | "tab_switch"
  | "copy_paste"
  | "duplicate_screen"
  | "right_click"
  | "fullscreen_exit"
  | "devtools_open";

type ViewMode = "grid" | "list";
type Connection = "online" | "offline";
type StudentStatus = "active" | "blocked" | "offline";

interface StudentFeedItem {
  studentId: string;
  name: string;
  identifier: string;
  identifierLabel: string;
  connection: Connection;
  status: StudentStatus;
  activeFlags: FlagKey[];
  lastEventAt?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const FLAG_CONFIG: Record<FlagKey, { label: string; color: string; ring: string; icon: string }> = {
  tab_switch:       { label: "Tab Switch",       color: "#F5A24B", ring: "#D97706", icon: "🔀" },
  copy_paste:       { label: "Copy / Paste",     color: "#EF6F6C", ring: "#D94F4C", icon: "📋" },
  duplicate_screen: { label: "Duplicate Screen", color: "#D470DD", ring: "#B84FC2", icon: "🖥️" },
  right_click:      { label: "Right Click",      color: "#60A5FA", ring: "#3B82F6", icon: "🖱️" },
  fullscreen_exit:  { label: "Fullscreen Exit",  color: "#F2DC3D", ring: "#C9B800", icon: "⛶"  },
  devtools_open:    { label: "DevTools Open",    color: "#34D399", ring: "#059669", icon: "🛠️" },
};

const FLAG_PRIORITY: FlagKey[] = [
  "duplicate_screen",
  "copy_paste",
  "devtools_open",
  "tab_switch",
  "fullscreen_exit",
  "right_click",
];

const FILTER_OPTIONS = [
  { value: "all",              label: "All" },
  { value: "tab_switch",       label: "Tab Switch" },
  { value: "copy_paste",       label: "Copy / Paste" },
  { value: "duplicate_screen", label: "Duplicate Screen" },
  { value: "right_click",      label: "Right Click" },
  { value: "fullscreen_exit",  label: "Fullscreen Exit" },
  { value: "devtools_open",    label: "DevTools Open" },
  { value: "blocked",          label: "Blocked" },
  { value: "no_flags",         label: "No Flags" },
];

// ─── Mock Data ────────────────────────────────────────────────────────────────
const MOCK_STUDENTS: StudentFeedItem[] = [
  { studentId: "s1",  name: "Steffan Adm",   identifier: "5194", identifierLabel: "Admission no", connection: "online",  status: "active",  activeFlags: ["tab_switch"],                    lastEventAt: "2020-08-31T09:12:00Z" },
  { studentId: "s2",  name: "Akash Kumar",   identifier: "5198", identifierLabel: "Admission no", connection: "online",  status: "blocked", activeFlags: ["copy_paste", "duplicate_screen"], lastEventAt: "2020-08-31T09:14:00Z" },
  { studentId: "s3",  name: "Julie Marta",   identifier: "5201", identifierLabel: "Admission no", connection: "online",  status: "active",  activeFlags: [],                               lastEventAt: undefined },
  { studentId: "s4",  name: "Sani Wijaya",   identifier: "5205", identifierLabel: "Admission no", connection: "online",  status: "active",  activeFlags: [],                               lastEventAt: undefined },
  { studentId: "s5",  name: "Virat Kohlen",  identifier: "5209", identifierLabel: "Admission no", connection: "online",  status: "active",  activeFlags: ["duplicate_screen"],             lastEventAt: "2020-08-31T09:08:00Z" },
  { studentId: "s6",  name: "Sonu Verma",    identifier: "5213", identifierLabel: "Admission no", connection: "online",  status: "active",  activeFlags: [],                               lastEventAt: undefined },
  { studentId: "s7",  name: "Ravi Shankar",  identifier: "5217", identifierLabel: "Admission no", connection: "offline", status: "offline", activeFlags: [],                               lastEventAt: "2020-08-31T09:05:00Z" },
  { studentId: "s8",  name: "Priya Nair",    identifier: "5221", identifierLabel: "Admission no", connection: "online",  status: "active",  activeFlags: ["tab_switch"],                    lastEventAt: "2020-08-31T09:16:00Z" },
  { studentId: "s9",  name: "Ananya Singh",  identifier: "5225", identifierLabel: "Admission no", connection: "online",  status: "active",  activeFlags: [],                               lastEventAt: undefined },
  { studentId: "s10", name: "Kiran Patel",   identifier: "5229", identifierLabel: "Admission no", connection: "online",  status: "blocked", activeFlags: ["devtools_open"],                lastEventAt: "2020-08-31T09:11:00Z" },
  { studentId: "s11", name: "Meera Rao",     identifier: "5233", identifierLabel: "Admission no", connection: "online",  status: "active",  activeFlags: [],                               lastEventAt: undefined },
  { studentId: "s12", name: "Arjun Malhotra",identifier: "5237", identifierLabel: "Admission no", connection: "online",  status: "active",  activeFlags: ["copy_paste", "tab_switch"],      lastEventAt: "2020-08-31T09:18:00Z" },
  { studentId: "s13", name: "Divya Krishnan",identifier: "5241", identifierLabel: "Admission no", connection: "online",  status: "active",  activeFlags: [],                               lastEventAt: undefined },
  { studentId: "s14", name: "Rohit Gupta",   identifier: "5245", identifierLabel: "Admission no", connection: "online",  status: "active",  activeFlags: ["fullscreen_exit"],              lastEventAt: "2020-08-31T09:13:00Z" },
  { studentId: "s15", name: "Sneha Joshi",   identifier: "5249", identifierLabel: "Admission no", connection: "online",  status: "active",  activeFlags: [],                               lastEventAt: undefined },
  { studentId: "s16", name: "Amit Sharma",   identifier: "5253", identifierLabel: "Admission no", connection: "online",  status: "active",  activeFlags: ["right_click"],                   lastEventAt: "2020-08-31T09:20:00Z" },
  { studentId: "s17", name: "Kavya Reddy",   identifier: "5257", identifierLabel: "Admission no", connection: "online",  status: "active",  activeFlags: [],                               lastEventAt: undefined },
  { studentId: "s18", name: "Suresh Babu",   identifier: "5261", identifierLabel: "Admission no", connection: "offline", status: "offline", activeFlags: [],                               lastEventAt: undefined },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getTopFlag(flags: FlagKey[]): FlagKey | null {
  if (!flags.length) return null;
  for (const f of FLAG_PRIORITY) {
    if (flags.includes(f)) return f;
  }
  return flags[0];
}

function getInitials(name: string): string {
  return name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
}

function getAvatarGradient(name: string): string {
  const hue = name.charCodeAt(0) * 17 % 360;
  return `linear-gradient(135deg, hsl(${hue},60%,55%), hsl(${(hue + 40) % 360},70%,40%))`;
}

function formatCountdown(secs: number): string {
  if (secs <= 0) return "00:00";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ─── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({ name, size, grayscale }: { name: string; size: number; grayscale?: boolean }) {
  return (
    <div
      style={{
        width: size, height: size, borderRadius: "50%",
        background: getAvatarGradient(name),
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "white", fontWeight: 700, fontSize: size * 0.35,
        flexShrink: 0,
        filter: grayscale ? "grayscale(100%) opacity(0.5)" : "none",
        transition: "filter 0.2s ease",
        fontFamily: "var(--font-family)",
        letterSpacing: "0.02em",
        userSelect: "none",
      }}
      aria-hidden="true"
    >
      {getIni// ─── Student Card ────────────────────────────────────────────────────────────────
function StudentCard({ student, isSelected, onClick }: {
  student: StudentFeedItem; isSelected: boolean; onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const topFlag = getTopFlag(student.activeFlags);
  const flagCfg = topFlag ? FLAG_CONFIG[topFlag] : null;
  const extraFlags = student.activeFlags.length - 1;
  const isOffline = student.connection === "offline";
  const isBlocked = student.status === "blocked";
  const isDimmed = isOffline || isBlocked;

  const truncateName = (name: string, max = 14) =>
    name.length > max ? name.slice(0, max) + "…" : name;

  const ariaLabel = [
    student.name,
    `${student.identifierLabel}: ${student.identifier}`,
    isBlocked ? "Blocked"
      : isOffline ? "Offline"
      : student.activeFlags.length > 0
        ? `Violations: ${student.activeFlags.map((f) => FLAG_CONFIG[f].label).join(", ")}`
        : "No violations",
  ].join(", ");

  const borderColor = isSelected ? "#29ABE2" : isBlocked ? "#DC2626" : "transparent";
  const cardBg = isBlocked ? "#FFF5F5" : "white";
  const boxShadow = hovered
    ? "0 4px 14px rgba(20,24,40,0.16)"
    : isSelected ? "0 0 0 4px rgba(41,171,226,0.18)"
    : isBlocked ? "0 0 0 3px rgba(220,38,38,0.15)"
    : "0 2px 8px rgba(20,24,40,0.10)";

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label={ariaLabel}
      aria-pressed={isSelected}
      style={{
        position: "relative", background: cardBg,
        border: `2px solid ${borderColor}`,
        borderRadius: 8, padding: "10px 10px 12px",
        cursor: "pointer", display: "flex", flexDirection: "column",
        alignItems: "center", gap: 0,
        boxShadow,
        transition: "box-shadow 0.18s ease, border-color 0.18s ease",
        width: "100%", textAlign: "center", outline: "none", minHeight: 130,
      }}
    >
      {/* Violation dot (top-left, hidden when blocked/offline) */}
      <div style={{ position: "absolute", top: 8, left: 8, display: "flex", alignItems: "center", gap: 4 }}>
        {!isDimmed && (
          <>
            <FlagDot flagKey={topFlag} />
            {topFlag && extraFlags > 0 && (
              <span style={{
                fontSize: 9, fontWeight: 700, color: flagCfg?.color,
                background: `${flagCfg?.color}1A`, borderRadius: 99,
                padding: "0px 4px", lineHeight: "14px",
              }}>+{extraFlags}</span>
            )}
          </>
        )}
      </div>

      {/* Status badge: BLOCKED (red) or OFFLINE (gray) — top right */}
      {(isBlocked || isOffline) && (
        <div
          title={isBlocked ? "Blocked by system" : "Student offline"}
          style={{
            position: "absolute", top: 6, right: 6,
            display: "flex", alignItems: "center", gap: 3,
            padding: "2px 6px", borderRadius: 99,
            fontSize: 8.5, fontWeight: 700, letterSpacing: "0.04em", lineHeight: "14px",
            background: isBlocked ? "#DC2626" : "#6B7280",
            color: "white",
            boxShadow: isBlocked ? "0 0 0 2px rgba(220,38,38,0.25)" : "0 0 0 2px rgba(107,114,128,0.2)",
            userSelect: "none",
          }}
        >
          {isBlocked ? (
            <>
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              BLOCKED
            </>
          ) : (
            <>
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="1" y1="1" x2="23" y2="23" />
                <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
                <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
              </svg>
              OFFLINE
            </>
          )}
        </div>
      )}

      {/* Avatar + connection dot */}
      <div style={{ marginTop: 16, marginBottom: 8, position: "relative" }}>
        <Avatar name={student.name} size={44} grayscale={isDimmed} />
        <div style={{
          position: "absolute", bottom: -2, right: -2, width: 14, height: 14,
          borderRadius: "50%",
          background: student.connection === "online" ? "#16A34A" : "#9CA3AF",
          border: "2px solid white",
        }} title={student.connection === "online" ? "Online" : "Offline"} />
      </div>

      {/* Name */}
      <div style={{
        fontSize: 12, fontWeight: 700,
        color: isDimmed ? "#9CA3AF" : "#1F2430",
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        width: "100%", paddingInline: 4, lineHeight: 1.3, marginBottom: 3,
      }} title={student.name}>
        {truncateName(student.name)}
      </div>

      {/* Sub-label: ID or status */}
      <div style={{
        fontSize: 10, color: "#8A8F99",
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        width: "100%", paddingInline: 4, lineHeight: 1.3,
      }}>
        {isDimmed
          ? <span style={{ color: "#9CA3AF", fontStyle: "italic" }}>
              {isBlocked ? "Blocked" : "Offline"}
            </span>
          : `${student.identifierLabel}: ${student.identifier}`}
      </div>

      {/* Violation label chip */}
      {topFlag && !isDimmed && (
        <div style={{
          marginTop: 6, fontSize: 9, fontWeight: 600, color: flagCfg?.color,
          background: `${flagCfg?.color}18`, borderRadius: 99, padding: "1px 7px",
          lineHeight: "15px", display: "flex", alignItems: "center", gap: 3,
          maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          <span style={{ fontSize: 9 }}>{FLAG_CONFIG[topFlag].icon}</span>
          {FLAG_CONFIG[topFlag].label}
        </div>
      )}
    </button>
  );
}/}
      <div style={{
        fontSize: 10, color: "#8A8F99",
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        width: "100%", paddingInline: 4, lineHeight: 1.3,
      }}>
        {isOffline
          ? <span style={{ color: "#9CA3AF", fontStyle: "italic" }}>Offline</span>
          : `${student.identifierLabel}: ${student.identifier}`}
      </div>

      {/* Flag label chip */}
      {topFlag && !isOffline && (
        <div style={{
          marginTop: 6, fontSize: 9, fontWeight: 600, color: flagCfg?.color,
          background: `${flagCfg?.color}18`, borderRadius: 99, padding: "1px 7px",
          lineHeight: "15px", display: "flex", alignItems: "center", gap: 3,
          maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          <span style={{ fontSize: 9 }}>{FLAG_CONFIG[topFlag].icon}</span>
          {FLAG_CONFIG[topFlag].label}
        </div>
      )}
    </button>
  );
}

// ─── Student List Row ─────────────────────────────────────────────────────────
function StudentListRow({ student, index, isSelected, onClick }: {
  student: StudentFeedItem; index: number; isSelected: boolean; onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const topFlag = getTopFlag(student.activeFlags);
  const isOffline = student.connection === "offline";

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label={`${student.name}, ${student.identifierLabel}: ${student.identifier}${topFlag ? `, Flag: ${FLAG_CONFIG[topFlag].label}` : ""}`}
      style={{
        display: "flex", alignItems: "center", gap: 12,
        width: "100%", padding: "0 20px", height: 48,
        border: "none", borderBottom: "1px solid #F0F2F5",
        background: isSelected ? "rgba(41,171,226,0.07)"
          : hovered ? "#F8FAFC"
          : index % 2 === 0 ? "white" : "#FAFBFC",
        cursor: "pointer", textAlign: "left", outline: "none",
        transition: "background 0.12s ease",
      }}
    >
      <FlagDot flagKey={topFlag} />
      <Avatar name={student.name} size={28} grayscale={isOffline} />
      <div style={{ flex: 2, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: isOffline ? "#9CA3AF" : "#1F2430", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {student.name}
        </span>
      </div>
      <div style={{ flex: 1, minWidth: 0, fontSize: 12, color: "#8A8F99", whiteSpace: "nowrap" }}>{student.identifier}</div>
      <div style={{ flex: 1.5, minWidth: 0 }}>
        {topFlag ? (
          <span style={{
            fontSize: 11, fontWeight: 600, color: FLAG_CONFIG[topFlag].color,
            background: `${FLAG_CONFIG[topFlag].color}18`, borderRadius: 99,
            padding: "2px 9px", display: "inline-flex", alignItems: "center", gap: 4,
          }}>
            <span>{FLAG_CONFIG[topFlag].icon}</span>{FLAG_CONFIG[topFlag].label}
          </span>
        ) : isOffline ? (
          <span style={{ fontSize: 11, color: "#9CA3AF", fontStyle: "italic" }}>Offline</span>
        ) : (
          <span style={{ fontSize: 11, color: "#9CA3AF" }}>—</span>
        )}
      </div>
      <div style={{ flex: 1, fontSize: 11, color: "#8A8F99", textAlign: "right", whiteSpace: "nowrap" }}>
        {student.lastEventAt ? new Date(student.lastEventAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : "—"}
      </div>
    </button>
  );
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────
function DetailPanel({ student, onClose }: { student: StudentFeedItem; onClose: () => void }) {
  const topFlag = getTopFlag(student.activeFlags);

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 300, display: "flex", alignItems: "stretch", justifyContent: "flex-end" }}
      onClick={onClose}
    >
      <div style={{ position: "absolute", inset: 0, background: "rgba(15,24,40,0.35)", backdropFilter: "blur(2px)" }} />
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative", width: 360, maxWidth: "90vw",
          background: "white", boxShadow: "-8px 0 40px rgba(15,24,40,0.14)",
          display: "flex", flexDirection: "column", zIndex: 1,
          animation: "slideIn 0.22s ease",
        }}
      >
        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #E3E5EA", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: "#1F2430" }}>Student Detail</span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "#8A8F99", padding: 4, borderRadius: 6 }} aria-label="Close">✕</button>
        </div>

        {/* Body */}
        <div style={{ padding: "24px 20px", flex: 1, overflowY: "auto" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, marginBottom: 24, textAlign: "center" }}>
            <div style={{ position: "relative" }}>
              <Avatar name={student.name} size={72} grayscale={student.connection === "offline"} />
              <div style={{
                position: "absolute", bottom: 0, right: 0, width: 18, height: 18, borderRadius: "50%",
                background: student.connection === "online" ? "#16A34A" : "#9CA3AF", border: "2px solid white",
              }} />
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#1F2430" }}>{student.name}</div>
              <div style={{ fontSize: 13, color: "#8A8F99" }}>{student.identifierLabel}: {student.identifier}</div>
              <div style={{ marginTop: 6 }}>
                <span style={{
                  fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 99,
                  background: student.connection === "online" ? "#DCFCE7" : "#F3F4F6",
                  color: student.connection === "online" ? "#16A34A" : "#6B7280",
                }}>
                  {student.connection === "online" ? "● Online" : "● Offline"}
                </span>
              </div>
            </div>
          </div>

          {/* Active Flags */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#8A8F99", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Active Flags</div>
            {student.activeFlags.length === 0 ? (
              <div style={{ fontSize: 13, color: "#8A8F99", fontStyle: "italic", padding: "12px 0" }}>No active flags</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {student.activeFlags.map((flag) => {
                  const cfg = FLAG_CONFIG[flag];
                  return (
                    <div key={flag} style={{
                      display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
                      borderRadius: 8, background: `${cfg.color}12`, border: `1px solid ${cfg.color}30`,
                    }}>
                      <span style={{ fontSize: 16 }}>{cfg.icon}</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: cfg.color }}>{cfg.label}</div>
                        {student.lastEventAt && (
                          <div style={{ fontSize: 11, color: "#8A8F99" }}>{new Date(student.lastEventAt).toLocaleTimeString("en-US")}</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Flag History */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#8A8F99", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Flag History</div>
            <div style={{ borderRadius: 8, border: "1px solid #E3E5EA", overflow: "hidden" }}>
              {topFlag ? (
                [
                  { flag: topFlag, time: "09:12:03", status: "active" },
                  { flag: "switched_tabs" as FlagKey, time: "09:07:41", status: "cleared" },
                ].map((evt, i, arr) => (
                  <div key={i} style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "9px 14px",
                    borderBottom: i < arr.length - 1 ? "1px solid #F0F2F5" : undefined,
                  }}>
                    <span style={{ fontSize: 13 }}>{FLAG_CONFIG[evt.flag].icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, color: "#1F2430", fontWeight: 500 }}>{FLAG_CONFIG[evt.flag].label}</div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
                      <span style={{ fontSize: 11, color: "#8A8F99" }}>{evt.time}</span>
                      <span style={{
                        fontSize: 10, fontWeight: 600, padding: "1px 7px", borderRadius: 99,
                        background: evt.status === "active" ? "#FEE2E2" : "#F0FDF4",
                        color: evt.status === "active" ? "#DC2626" : "#16A34A",
                      }}>{evt.status === "active" ? "Active" : "Cleared"}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ padding: "16px 14px", fontSize: 13, color: "#8A8F99", fontStyle: "italic" }}>No events recorded</div>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ padding: "14px 20px", borderTop: "1px solid #E3E5EA", display: "flex", gap: 10 }}>
          <button style={{
            flex: 1, height: 38, borderRadius: 8, border: "1.5px solid #E3E5EA",
            background: "white", color: "#1F2430", fontSize: 13, fontWeight: 600,
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            fontFamily: "var(--font-family)",
          }}>⚠️ Send Warning</button>
          <button style={{
            flex: 1, height: 38, borderRadius: 8, border: "none",
            background: "#DC2626", color: "white", fontSize: 13, fontWeight: 600,
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            fontFamily: "var(--font-family)",
          }}>🔒 End Session</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function LiveFeedPage() {
  const params = useParams();
  const examId = (params?.id as string) ?? "1";

  const [secondsLeft, setSecondsLeft] = useState(24 * 60);
  const [filter, setFilter] = useState("all");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [selectedStudent, setSelectedStudent] = useState<StudentFeedItem | null>(null);
  const [students, setStudents] = useState<StudentFeedItem[]>(MOCK_STUDENTS);
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  // Countdown tick
  useEffect(() => {
    if (secondsLeft <= 0) return;
    const t = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [secondsLeft]);

  // Simulate real-time flag changes
  useEffect(() => {
    const allFlags: FlagKey[] = ["camera_off", "out_of_frame", "switched_tabs", "multiple_people"];
    const interval = setInterval(() => {
      setStudents((prev) => {
        const idx = Math.floor(Math.random() * prev.length);
        const student = prev[idx];
        const newFlags = student.activeFlags.length > 0
          ? []
          : [allFlags[Math.floor(Math.random() * allFlags.length)]];
        return prev.map((s, i) => i === idx ? { ...s, activeFlags: newFlags, lastEventAt: new Date().toISOString() } : s);
      });
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setFilterOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleLegendClick = useCallback((flagKey: FlagKey) => {
    setFilter((prev) => (prev === flagKey ? "all" : flagKey));
  }, []);

  const filteredStudents = students.filter((s) => {
    if (filter === "all") return true;
    if (filter === "no_flags") return s.activeFlags.length === 0;
    return s.activeFlags.includes(filter as FlagKey);
  });

  const countByFlag = (flag: FlagKey) => students.filter((s) => s.activeFlags.includes(flag)).length;
  const isTimeCritical = secondsLeft <= 5 * 60;
  const isTimeUp = secondsLeft <= 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "#F6F7F9", fontFamily: "var(--font-family)" }}>

      {/* Accent Bar */}
      <div style={{ height: 4, background: "linear-gradient(90deg, #C9C3F2, #A8B4F8, #7DD3FC, #A8B4F8, #C9C3F2)", flexShrink: 0 }} />

      {/* Page Header (A) */}
      <header style={{
        background: "white", borderBottom: "1px solid #E3E5EA",
        height: 48, display: "flex", alignItems: "center",
        padding: "0 24px", gap: 12, flexShrink: 0,
        position: "sticky", top: 0, zIndex: 100,
      }}>
        <Link
          href={`/dashboard/exams/${examId}`}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: 32, height: 32, borderRadius: 8,
            color: "#4A6678", textDecoration: "none",
            transition: "background 0.15s ease", flexShrink: 0,
          }}
          aria-label="Back to exam detail"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </Link>
        <h1 style={{ fontSize: 16, fontWeight: 600, color: "#1F2430", letterSpacing: "-0.01em", margin: 0 }}>
          Proctoring – Live Feed
        </h1>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            width: 8, height: 8, borderRadius: "50%", background: "#16A34A",
            display: "inline-block", boxShadow: "0 0 0 3px rgba(22,163,74,0.22)",
          }} className="live-pulse" />
          <span style={{ fontSize: 12, fontWeight: 600, color: "#16A34A" }}>Live</span>
          <span style={{ fontSize: 12, color: "#8A8F99", marginLeft: 4 }}>
            {students.filter(s => s.connection === "online").length}/{students.length} online
          </span>
        </div>
      </header>

      {/* Assessment Bar (B) */}
      <div style={{
        background: "#F6F7F9", borderBottom: "1px solid #E3E5EA",
        height: 56, display: "flex", alignItems: "center",
        padding: "0 24px", flexShrink: 0,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: "#1F2430" }}>Algebra</div>
        </div>
        {[
          { label: "Assessment Type", value: "Standard Test" },
          { label: "Due Date",         value: "Mon, 31 Aug, 2020" },
          { label: "Time",             value: "09:30 AM" },
        ].map((meta) => (
          <div key={meta.label} style={{
            borderLeft: "1px solid #E3E5EA", padding: "0 20px",
            display: "flex", flexDirection: "column", justifyContent: "center", height: "100%",
          }}>
            <div style={{ fontSize: 11, color: "#8A8F99", lineHeight: 1.2, marginBottom: 2 }}>{meta.label}</div>
            <div style={{ fontSize: 13, fontWeight: 500, color: "#1F2430", lineHeight: 1.2, whiteSpace: "nowrap" }}>{meta.value}</div>
          </div>
        ))}
      </div>

      {/* Toolbar (C) */}
      <div style={{
        background: "white", borderBottom: "1px solid #E3E5EA",
        padding: "0 24px", display: "flex", alignItems: "center", gap: 16,
        minHeight: 48, flexShrink: 0, flexWrap: "wrap",
        position: "sticky", top: 48, zIndex: 90,
      }}>
        {/* Countdown */}
        <div style={{ display: "flex", alignItems: "center", gap: 7, flexShrink: 0 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={isTimeCritical ? "#DC2626" : "#4A6678"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
          </svg>
          <span style={{
            fontSize: 14, fontWeight: 700,
            color: isTimeCritical ? "#DC2626" : "#1F2430",
            fontFamily: "monospace", letterSpacing: "0.04em", transition: "color 0.3s",
          }}>
            {isTimeUp ? "Time is up" : `${formatCountdown(secondsLeft)} Minutes Remaining`}
          </span>
        </div>

        <div style={{ width: 1, height: 20, background: "#E3E5EA", flexShrink: 0 }} />

        {/* Legend (clickable filters) */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {(Object.entries(FLAG_CONFIG) as [FlagKey, typeof FLAG_CONFIG[FlagKey]][]).map(([key, cfg]) => {
            const count = countByFlag(key);
            const active = filter === key;
            return (
              <button key={key} onClick={() => handleLegendClick(key)} aria-pressed={active}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  background: active ? `${cfg.color}15` : "transparent",
                  border: active ? `1px solid ${cfg.color}50` : "1px solid transparent",
                  borderRadius: 20, padding: "3px 8px 3px 5px",
                  cursor: "pointer", transition: "all 0.15s ease",
                  fontFamily: "var(--font-family)",
                }}
                title={`Filter by ${cfg.label}`}
              >
                <FlagDot flagKey={key} size={9} />
                <span style={{ fontSize: 12, color: active ? cfg.color : "#4A6678", fontWeight: active ? 600 : 400 }}>
                  {cfg.icon} {cfg.label}
                </span>
                {count > 0 && (
                  <span style={{
                    fontSize: 10, fontWeight: 700, background: cfg.color,
                    color: "white", borderRadius: 99, padding: "0 5px", lineHeight: "16px", minWidth: 16, textAlign: "center",
                  }}>{count}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Right: filter dropdown + view toggle */}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
          {/* Filter dropdown */}
          <div ref={filterRef} style={{ position: "relative" }}>
            <button
              onClick={() => setFilterOpen((v) => !v)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                background: "none", border: "none", borderBottom: "1.5px solid #C8DCE8",
                padding: "4px 2px", cursor: "pointer", fontSize: 13, color: "#1F2430",
                fontFamily: "var(--font-family)",
              }}
            >
              <span>{FILTER_OPTIONS.find(o => o.value === filter)?.label ?? "All"}</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8A8F99" strokeWidth="2.5">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            {filterOpen && (
              <div style={{
                position: "absolute", top: "calc(100% + 6px)", right: 0,
                background: "white", border: "1px solid #E3E5EA", borderRadius: 8,
                boxShadow: "0 6px 20px rgba(15,24,40,0.12)", padding: 4, zIndex: 200, minWidth: 170,
              }}>
                {FILTER_OPTIONS.map((opt) => (
                  <button key={opt.value} onClick={() => { setFilter(opt.value); setFilterOpen(false); }}
                    style={{
                      display: "block", width: "100%", padding: "8px 12px", fontSize: 13,
                      color: filter === opt.value ? "#29ABE2" : "#1F2430",
                      fontWeight: filter === opt.value ? 600 : 400,
                      background: filter === opt.value ? "#E0F4FD" : "transparent",
                      border: "none", borderRadius: 6, cursor: "pointer", textAlign: "left",
                      fontFamily: "var(--font-family)",
                    }}
                  >{opt.label}</button>
                ))}
              </div>
            )}
          </div>

          {/* View toggle */}
          <div style={{ display: "flex", border: "1px solid #E3E5EA", borderRadius: 8, overflow: "hidden" }}>
            {(["list", "grid"] as ViewMode[]).map((mode) => {
              const isActive = viewMode === mode;
              return (
                <button key={mode} onClick={() => setViewMode(mode)} aria-label={`${mode} view`} aria-pressed={isActive}
                  style={{
                    width: 34, height: 32, border: "none",
                    background: isActive ? "#1F2430" : "white",
                    color: isActive ? "white" : "#8A8F99",
                    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "background 0.15s ease, color 0.15s ease",
                  }}
                >
                  {mode === "list" ? (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
                    </svg>
                  ) : (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                      <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
                      <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Time is up banner */}
      {isTimeUp && (
        <div style={{
          background: "#FEE2E2", borderBottom: "1px solid #FECACA",
          padding: "10px 24px", fontSize: 14, fontWeight: 600, color: "#DC2626",
          display: "flex", alignItems: "center", gap: 8, flexShrink: 0,
        }}>
          ⏰ Time is up! The assessment has ended. The grid is now read-only.
        </div>
      )}

      {/* Student Grid / List (D) */}
      <div style={{ flex: 1, padding: 24, overflowY: "auto" }}>
        {/* Result count */}
        <div style={{ fontSize: 12, color: "#8A8F99", marginBottom: 14, display: "flex", alignItems: "center", gap: 0 }}>
          Showing {filteredStudents.length} of {students.length} students
          {filter !== "all" && (
            <button onClick={() => setFilter("all")} style={{
              marginLeft: 10, color: "#29ABE2", background: "none", border: "none",
              cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "var(--font-family)",
            }}>Show all →</button>
          )}
        </div>

        {filteredStudents.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "64px 24px", gap: 12 }}>
            <div style={{ fontSize: 40 }}>🔍</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "#1F2430" }}>No students match this filter</div>
            <div style={{ fontSize: 13, color: "#8A8F99" }}>Try a different filter or show all students</div>
            <button onClick={() => setFilter("all")} style={{
              marginTop: 8, padding: "9px 20px", background: "#29ABE2", color: "white",
              border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600,
              cursor: "pointer", fontFamily: "var(--font-family)",
            }}>Show All Students</button>
          </div>
        ) : viewMode === "grid" ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(128px, 1fr))", gap: 14 }}>
            {filteredStudents.map((student) => (
              <StudentCard
                key={student.studentId}
                student={student}
                isSelected={selectedStudent?.studentId === student.studentId}
                onClick={() => setSelectedStudent(selectedStudent?.studentId === student.studentId ? null : student)}
              />
            ))}
          </div>
        ) : (
          <div style={{ background: "white", borderRadius: 10, border: "1px solid #E3E5EA", overflow: "hidden" }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 12, padding: "0 20px", height: 40,
              background: "#F8FAFC", borderBottom: "1px solid #E3E5EA",
              fontSize: 11, fontWeight: 700, color: "#8A8F99", textTransform: "uppercase", letterSpacing: "0.06em",
              position: "sticky", top: 0,
            }}>
              <span style={{ width: 10 }} /><span style={{ width: 28 }} />
              <span style={{ flex: 2 }}>Name</span>
              <span style={{ flex: 1 }}>ID</span>
              <span style={{ flex: 1.5 }}>Flag</span>
              <span style={{ flex: 1, textAlign: "right" }}>Last Event</span>
            </div>
            {filteredStudents.map((student, i) => (
              <StudentListRow
                key={student.studentId}
                student={student}
                index={i}
                isSelected={selectedStudent?.studentId === student.studentId}
                onClick={() => setSelectedStudent(selectedStudent?.studentId === student.studentId ? null : student)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Detail Panel */}
      {selectedStudent && (
        <DetailPanel student={selectedStudent} onClose={() => setSelectedStudent(null)} />
      )}

      {/* a11y live region */}
      <div aria-live="polite" aria-atomic="true" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap" }} />

      <style>{`
        .live-pulse {
          animation: livePulse 2s infinite;
        }
        @keyframes livePulse {
          0%, 100% { box-shadow: 0 0 0 3px rgba(22,163,74,0.22); }
          50% { box-shadow: 0 0 0 6px rgba(22,163,74,0.06); }
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(20px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        button:focus-visible {
          outline: 2px solid #29ABE2;
          outline-offset: 2px;
        }
        @media (max-width: 767px) {
          .live-feed-grid { grid-template-columns: repeat(3, 1fr) !important; }
        }
        @media (max-width: 479px) {
          .live-feed-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
    </div>
  );
}
