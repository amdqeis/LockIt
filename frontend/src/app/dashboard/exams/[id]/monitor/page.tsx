"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { mockExams } from "@/lib/mockData";

// ─── Types ────────────────────────────────────────────────────────────────────
type ViolationKey =
  | "tab_switch"
  | "fullscreen_exit"
  | "copy_attempt"
  | "paste_attempt"
  | "window_blur"
  | "devtools"
  | "right_click";

type StudentStatus = "online" | "offline" | "blocked" | "submitted";
type ViewMode = "grid" | "list";

interface StudentFeedItem {
  studentId: string;
  name: string;
  identifier: string;
  identifierLabel: string;
  status: StudentStatus;
  activeFlags: ViolationKey[];
  violationCount: number;
  lastEventAt?: string;
}

// ─── Violation Config ─────────────────────────────────────────────────────────
const VIOLATION_CONFIG: Record<ViolationKey, { label: string; color: string; ring: string; icon: string; shortLabel: string }> = {
  tab_switch:      { label: "Ganti Tab",        shortLabel: "Tab",         color: "#DC2626", ring: "#B91C1C", icon: "🔁" },
  fullscreen_exit: { label: "Keluar Fullscreen", shortLabel: "Fullscreen",  color: "#EA580C", ring: "#C2410C", icon: "⛶"  },
  copy_attempt:    { label: "Copy-Paste",        shortLabel: "Copy",        color: "#D97706", ring: "#B45309", icon: "📋" },
  paste_attempt:   { label: "Paste Terdeteksi",  shortLabel: "Paste",       color: "#CA8A04", ring: "#A16207", icon: "📌" },
  window_blur:     { label: "Window Blur",        shortLabel: "Blur",        color: "#7C3AED", ring: "#6D28D9", icon: "🪟" },
  devtools:        { label: "Buka DevTools",      shortLabel: "DevTools",    color: "#0F172A", ring: "#020617", icon: "🔧" },
  right_click:     { label: "Klik Kanan",         shortLabel: "RightClick",  color: "#6B7280", ring: "#4B5563", icon: "🖱️" },
};

const VIOLATION_PRIORITY: ViolationKey[] = [
  "tab_switch", "devtools", "copy_attempt", "paste_attempt", "fullscreen_exit", "window_blur", "right_click"
];

const ALL_VIOLATIONS = Object.keys(VIOLATION_CONFIG) as ViolationKey[];

const FILTER_OPTIONS = [
  { value: "all",             label: "Semua" },
  { value: "blocked",         label: "🔒 Diblokir" },
  { value: "offline",         label: "⚫ Offline" },
  { value: "tab_switch",      label: "🔁 Ganti Tab" },
  { value: "fullscreen_exit", label: "⛶ Keluar Fullscreen" },
  { value: "copy_attempt",    label: "📋 Copy-Paste" },
  { value: "paste_attempt",   label: "📌 Paste" },
  { value: "window_blur",     label: "🪟 Window Blur" },
  { value: "devtools",        label: "🔧 DevTools" },
  { value: "right_click",     label: "🖱️ Klik Kanan" },
  { value: "no_violations",   label: "✅ Tidak Ada Pelanggaran" },
];

// ─── Mock Students ────────────────────────────────────────────────────────────
const MOCK_STUDENTS: StudentFeedItem[] = [
  { studentId: "s1",  name: "Siti Nurhaliza",    identifier: "1301210001", identifierLabel: "NIM", status: "online",    activeFlags: [],                                violationCount: 0, lastEventAt: undefined },
  { studentId: "s2",  name: "Budi Santoso",      identifier: "1301210023", identifierLabel: "NIM", status: "blocked",   activeFlags: ["tab_switch", "copy_attempt"],     violationCount: 4, lastEventAt: "2026-10-26T10:35:02Z" },
  { studentId: "s3",  name: "Dewi Anggraini",    identifier: "1301210045", identifierLabel: "NIM", status: "online",    activeFlags: ["fullscreen_exit"],                violationCount: 1, lastEventAt: "2026-10-26T10:32:15Z" },
  { studentId: "s4",  name: "Eko Prasetyo",      identifier: "1301210067", identifierLabel: "NIM", status: "offline",   activeFlags: [],                                violationCount: 2, lastEventAt: "2026-10-26T10:18:00Z" },
  { studentId: "s5",  name: "Fitria Handayani",  identifier: "1301210089", identifierLabel: "NIM", status: "submitted", activeFlags: [],                                violationCount: 0, lastEventAt: undefined },
  { studentId: "s6",  name: "Galih Permana",     identifier: "1301210101", identifierLabel: "NIM", status: "online",    activeFlags: ["tab_switch"],                     violationCount: 3, lastEventAt: "2026-10-26T10:33:55Z" },
  { studentId: "s7",  name: "Hani Rahmawati",    identifier: "1301210122", identifierLabel: "NIM", status: "online",    activeFlags: [],                                violationCount: 0, lastEventAt: undefined },
  { studentId: "s8",  name: "Irfan Hakim",       identifier: "1301210134", identifierLabel: "NIM", status: "online",    activeFlags: ["devtools"],                       violationCount: 1, lastEventAt: "2026-10-26T10:40:10Z" },
  { studentId: "s9",  name: "Jasmine Putri",     identifier: "1301210156", identifierLabel: "NIM", status: "online",    activeFlags: ["window_blur"],                    violationCount: 1, lastEventAt: "2026-10-26T10:30:22Z" },
  { studentId: "s10", name: "Karima Zahra",      identifier: "1301210178", identifierLabel: "NIM", status: "online",    activeFlags: [],                                violationCount: 0, lastEventAt: undefined },
  { studentId: "s11", name: "Lukman Hakim",      identifier: "1301210190", identifierLabel: "NIM", status: "blocked",   activeFlags: ["devtools", "copy_attempt"],       violationCount: 5, lastEventAt: "2026-10-26T10:41:30Z" },
  { studentId: "s12", name: "Maya Sari",         identifier: "1301210202", identifierLabel: "NIM", status: "online",    activeFlags: ["copy_attempt", "paste_attempt"],  violationCount: 2, lastEventAt: "2026-10-26T10:42:00Z" },
  { studentId: "s13", name: "Nanda Putra",       identifier: "1301210214", identifierLabel: "NIM", status: "online",    activeFlags: [],                                violationCount: 0, lastEventAt: undefined },
  { studentId: "s14", name: "Okky Firmansyah",   identifier: "1301210226", identifierLabel: "NIM", status: "offline",   activeFlags: [],                                violationCount: 1, lastEventAt: "2026-10-26T09:58:00Z" },
  { studentId: "s15", name: "Putri Ayu",         identifier: "1301210238", identifierLabel: "NIM", status: "online",    activeFlags: ["right_click"],                    violationCount: 1, lastEventAt: "2026-10-26T10:38:00Z" },
  { studentId: "s16", name: "Rizky Maulana",     identifier: "1301210250", identifierLabel: "NIM", status: "online",    activeFlags: ["fullscreen_exit", "window_blur"], violationCount: 2, lastEventAt: "2026-10-26T10:37:00Z" },
  { studentId: "s17", name: "Sinta Dewi",        identifier: "1301210262", identifierLabel: "NIM", status: "submitted", activeFlags: [],                                violationCount: 0, lastEventAt: undefined },
  { studentId: "s18", name: "Taufik Hidayat",    identifier: "1301210274", identifierLabel: "NIM", status: "online",    activeFlags: [],                                violationCount: 0, lastEventAt: undefined },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getTopFlag(flags: ViolationKey[]): ViolationKey | null {
  if (!flags.length) return null;
  for (const f of VIOLATION_PRIORITY) if (flags.includes(f)) return f;
  return flags[0];
}
function getInitials(name: string) {
  return name.split(" ").slice(0, 2).map(n => n[0]).join("").toUpperCase();
}
function getAvatarGradient(name: string) {
  const hue = name.charCodeAt(0) * 17 % 360;
  return `linear-gradient(135deg, hsl(${hue},58%,52%), hsl(${(hue + 45) % 360},68%,38%))`;
}
function formatCountdown(secs: number) {
  if (secs <= 0) return "00:00";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
  return `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
const STATUS_STYLE: Record<StudentStatus, { bg: string; color: string; label: string; dot: string }> = {
  online:    { bg: "#DCFCE7", color: "#16A34A", label: "Online",     dot: "#16A34A" },
  offline:   { bg: "#F3F4F6", color: "#6B7280", label: "Offline",    dot: "#9CA3AF" },
  blocked:   { bg: "#FEE2E2", color: "#DC2626", label: "Diblokir 🔒", dot: "#DC2626" },
  submitted: { bg: "#E0F4FD", color: "#0369A1", label: "Selesai ✓",  dot: "#29ABE2" },
};

// ─── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({ name, size, status }: { name: string; size: number; status: StudentStatus }) {
  const grayscale = status === "offline";
  const dimmed = status === "blocked";
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: getAvatarGradient(name),
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "white", fontWeight: 700, fontSize: size * 0.34,
      flexShrink: 0, userSelect: "none",
      filter: grayscale ? "grayscale(1) opacity(0.45)" : dimmed ? "opacity(0.7) saturate(0.4)" : "none",
      transition: "filter 0.2s ease",
      border: status === "blocked" ? "2.5px solid #EF4444" : status === "offline" ? "2.5px solid #D1D5DB" : "none",
      fontFamily: "var(--font-family)",
    }} aria-hidden="true">
      {getInitials(name)}
    </div>
  );
}

// ─── Violation Dot ────────────────────────────────────────────────────────────
function ViolationDot({ flagKey, size = 10 }: { flagKey: ViolationKey | null; size?: number }) {
  if (!flagKey) return <span style={{ width: size, height: size, display: "inline-block", flexShrink: 0 }} />;
  const cfg = VIOLATION_CONFIG[flagKey];
  return (
    <span title={cfg.label} style={{
      width: size, height: size, borderRadius: "50%",
      background: cfg.color, display: "inline-block", flexShrink: 0,
      border: `1.5px solid ${cfg.ring}`, boxShadow: `0 0 0 2px ${cfg.color}33`,
    }} aria-hidden="true" />
  );
}

// ─── Student Card ─────────────────────────────────────────────────────────────
function StudentCard({ student, isSelected, onClick }: {
  student: StudentFeedItem; isSelected: boolean; onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const topFlag = getTopFlag(student.activeFlags);
  const flagCfg = topFlag ? VIOLATION_CONFIG[topFlag] : null;
  const extraFlags = student.activeFlags.length - 1;
  const st = STATUS_STYLE[student.status];
  const isBlocked = student.status === "blocked";
  const isOffline = student.status === "offline";
  const isSubmitted = student.status === "submitted";

  const borderColor = isBlocked ? "#EF4444" : isSelected ? "#29ABE2" : "transparent";
  const shadow = hovered ? "0 4px 16px rgba(20,24,40,0.18)" : isSelected ? "0 0 0 4px rgba(41,171,226,0.18)" : isBlocked ? "0 0 0 3px rgba(239,68,68,0.15)" : "0 2px 8px rgba(20,24,40,0.10)";

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-pressed={isSelected}
      aria-label={`${student.name}, ${student.identifierLabel}: ${student.identifier}, status: ${st.label}${topFlag ? `, pelanggaran: ${VIOLATION_CONFIG[topFlag].label}` : ""}`}
      style={{
        position: "relative", background: isBlocked ? "#FFF5F5" : "white",
        border: `2px solid ${borderColor}`, borderRadius: 8,
        padding: "10px 10px 12px", cursor: "pointer",
        display: "flex", flexDirection: "column", alignItems: "center",
        width: "100%", textAlign: "center", outline: "none",
        minHeight: 140, boxShadow: shadow,
        transition: "box-shadow 0.18s ease, border-color 0.18s ease",
      }}
    >
      {/* Top-left: violation dot */}
      <div style={{ position: "absolute", top: 8, left: 8, display: "flex", alignItems: "center", gap: 3 }}>
        <ViolationDot flagKey={topFlag} />
        {topFlag && extraFlags > 0 && (
          <span style={{
            fontSize: 9, fontWeight: 700, color: flagCfg?.color,
            background: `${flagCfg?.color}18`, borderRadius: 99, padding: "0 4px", lineHeight: "14px",
          }}>+{extraFlags}</span>
        )}
      </div>

      {/* Top-right: blocked icon */}
      {isBlocked && (
        <div style={{ position: "absolute", top: 7, right: 8, fontSize: 14 }} title="Diblokir">🔒</div>
      )}

      {/* Violation count badge */}
      {student.violationCount > 0 && !isBlocked && (
        <div style={{
          position: "absolute", top: 7, right: 8,
          background: student.violationCount >= 3 ? "#DC2626" : "#D97706",
          color: "white", fontSize: 9, fontWeight: 700,
          borderRadius: 99, padding: "1px 5px", lineHeight: "14px",
          minWidth: 16, textAlign: "center",
        }} title={`${student.violationCount} pelanggaran`}>
          {student.violationCount}
        </div>
      )}

      {/* Avatar */}
      <div style={{ marginTop: 18, marginBottom: 8, position: "relative" }}>
        <Avatar name={student.name} size={44} status={student.status} />
        {/* Status indicator dot */}
        <div style={{
          position: "absolute", bottom: -1, right: -1, width: 13, height: 13, borderRadius: "50%",
          background: st.dot, border: "2px solid white",
        }} />
      </div>

      {/* Name */}
      <div style={{
        fontSize: 12, fontWeight: 700,
        color: isBlocked ? "#DC2626" : isOffline ? "#9CA3AF" : "#1F2430",
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        width: "100%", paddingInline: 4, lineHeight: 1.3, marginBottom: 2,
      }} title={student.name}>
        {student.name.length > 13 ? student.name.slice(0, 13) + "…" : student.name}
      </div>

      {/* ID */}
      <div style={{
        fontSize: 10, color: "#8A8F99", lineHeight: 1.3,
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        width: "100%", paddingInline: 4, marginBottom: 5,
      }}>
        {student.identifierLabel}: {student.identifier}
      </div>

      {/* Status / violation chip */}
      {isBlocked ? (
        <div style={{
          fontSize: 9, fontWeight: 700, color: "#DC2626",
          background: "#FEE2E2", borderRadius: 99, padding: "2px 8px", lineHeight: "15px",
        }}>🔒 Diblokir</div>
      ) : isOffline ? (
        <div style={{
          fontSize: 9, fontWeight: 600, color: "#6B7280",
          background: "#F3F4F6", borderRadius: 99, padding: "2px 8px", lineHeight: "15px",
        }}>⚫ Offline</div>
      ) : isSubmitted ? (
        <div style={{
          fontSize: 9, fontWeight: 600, color: "#0369A1",
          background: "#E0F4FD", borderRadius: 99, padding: "2px 8px", lineHeight: "15px",
        }}>✓ Selesai</div>
      ) : topFlag ? (
        <div style={{
          fontSize: 9, fontWeight: 600, color: flagCfg?.color,
          background: `${flagCfg?.color}15`, borderRadius: 99, padding: "2px 8px", lineHeight: "15px",
          display: "flex", alignItems: "center", gap: 3, maxWidth: "calc(100% - 8px)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          <span>{VIOLATION_CONFIG[topFlag].icon}</span>
          {VIOLATION_CONFIG[topFlag].shortLabel}
        </div>
      ) : (
        <div style={{
          fontSize: 9, color: "#86EFAC", background: "#F0FDF4",
          borderRadius: 99, padding: "2px 8px", lineHeight: "15px",
        }}>✓ Aman</div>
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
  const st = STATUS_STYLE[student.status];

  return (
    <button onClick={onClick} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex", alignItems: "center", gap: 12,
        width: "100%", padding: "0 20px", height: 50,
        border: "none", borderBottom: "1px solid #F0F2F5",
        background: isSelected ? "rgba(41,171,226,0.07)" : hovered ? "#F8FAFC" : index % 2 === 0 ? "white" : "#FAFBFC",
        cursor: "pointer", textAlign: "left", outline: "none", transition: "background 0.12s ease",
      }}
    >
      <ViolationDot flagKey={topFlag} />
      <Avatar name={student.name} size={30} status={student.status} />
      <div style={{ flex: 2, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: student.status === "blocked" ? "#DC2626" : student.status === "offline" ? "#9CA3AF" : "#1F2430", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {student.name}
        </div>
        <div style={{ fontSize: 11, color: "#8A8F99" }}>{student.identifier}</div>
      </div>
      <div style={{ flex: 1, minWidth: 80 }}>
        <span style={{
          fontSize: 11, fontWeight: 600, padding: "2px 9px", borderRadius: 99,
          background: st.bg, color: st.color,
        }}>{st.label}</span>
      </div>
      <div style={{ flex: 1.5, minWidth: 0 }}>
        {topFlag ? (
          <span style={{
            fontSize: 11, fontWeight: 600, color: VIOLATION_CONFIG[topFlag].color,
            background: `${VIOLATION_CONFIG[topFlag].color}15`, borderRadius: 99, padding: "2px 9px",
            display: "inline-flex", alignItems: "center", gap: 4,
          }}>
            <span>{VIOLATION_CONFIG[topFlag].icon}</span>{VIOLATION_CONFIG[topFlag].shortLabel}
          </span>
        ) : <span style={{ fontSize: 11, color: "#9CA3AF" }}>—</span>}
      </div>
      <div style={{ flex: 0.6, textAlign: "center" }}>
        {student.violationCount > 0 ? (
          <span style={{
            fontSize: 12, fontWeight: 700,
            color: student.violationCount >= 3 ? "#DC2626" : "#D97706",
          }}>{student.violationCount}×</span>
        ) : <span style={{ fontSize: 11, color: "#9CA3AF" }}>—</span>}
      </div>
      <div style={{ flex: 1, fontSize: 11, color: "#8A8F99", textAlign: "right", whiteSpace: "nowrap" }}>
        {student.lastEventAt
          ? new Date(student.lastEventAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
          : "—"}
      </div>
    </button>
  );
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────
function DetailPanel({ student, onClose }: { student: StudentFeedItem; onClose: () => void }) {
  const topFlag = getTopFlag(student.activeFlags);
  const st = STATUS_STYLE[student.status];

  const mockHistory = [
    ...(student.activeFlags.map((f, i) => ({ flag: f, time: "10:41", status: "active" as const }))),
    { flag: "fullscreen_exit" as ViolationKey, time: "10:32", status: "cleared" as const },
    { flag: "window_blur" as ViolationKey, time: "10:28", status: "cleared" as const },
  ].slice(0, 4);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 300, display: "flex", justifyContent: "flex-end" }} onClick={onClose}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(15,24,40,0.38)", backdropFilter: "blur(2px)" }} />
      <div onClick={e => e.stopPropagation()} style={{
        position: "relative", width: 380, maxWidth: "90vw", background: "white",
        boxShadow: "-8px 0 48px rgba(15,24,40,0.18)", display: "flex", flexDirection: "column", zIndex: 1,
        animation: "slideIn 0.22s ease",
      }}>
        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #E3E5EA", display: "flex", alignItems: "center", justifyContent: "space-between", background: student.status === "blocked" ? "#FFF5F5" : "white" }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: student.status === "blocked" ? "#DC2626" : "#1F2430" }}>
            {student.status === "blocked" ? "🔒 Peserta Diblokir" : "Detail Peserta"}
          </span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "#8A8F99", padding: 4, borderRadius: 6 }} aria-label="Tutup">✕</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
          {/* Profile */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, marginBottom: 20, textAlign: "center" }}>
            <Avatar name={student.name} size={68} status={student.status} />
            <div>
              <div style={{ fontSize: 17, fontWeight: 700, color: student.status === "blocked" ? "#DC2626" : "#1F2430" }}>{student.name}</div>
              <div style={{ fontSize: 13, color: "#8A8F99" }}>{student.identifierLabel}: {student.identifier}</div>
              <div style={{ marginTop: 7 }}>
                <span style={{ fontSize: 12, fontWeight: 600, padding: "3px 12px", borderRadius: 99, background: st.bg, color: st.color }}>{st.label}</span>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
            <div style={{ background: "#F8FAFC", borderRadius: 10, padding: "12px 14px", border: "1px solid #E3E5EA" }}>
              <div style={{ fontSize: 10, color: "#8A8F99", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Total Pelanggaran</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: student.violationCount >= 3 ? "#DC2626" : student.violationCount > 0 ? "#D97706" : "#16A34A" }}>{student.violationCount}</div>
            </div>
            <div style={{ background: "#F8FAFC", borderRadius: 10, padding: "12px 14px", border: "1px solid #E3E5EA" }}>
              <div style={{ fontSize: 10, color: "#8A8F99", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Flag Aktif</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: student.activeFlags.length > 0 ? "#DC2626" : "#16A34A" }}>{student.activeFlags.length}</div>
            </div>
          </div>

          {/* Active flags */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#8A8F99", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Flag Aktif Sekarang</div>
            {student.activeFlags.length === 0 ? (
              <div style={{ fontSize: 13, color: "#9CA3AF", fontStyle: "italic", padding: "10px 0" }}>Tidak ada flag aktif</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {student.activeFlags.map(flag => {
                  const cfg = VIOLATION_CONFIG[flag];
                  return (
                    <div key={flag} style={{
                      display: "flex", alignItems: "center", gap: 10, padding: "10px 13px",
                      borderRadius: 8, background: `${cfg.color}10`, border: `1px solid ${cfg.color}28`,
                    }}>
                      <span style={{ fontSize: 16 }}>{cfg.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: cfg.color }}>{cfg.label}</div>
                        {student.lastEventAt && <div style={{ fontSize: 11, color: "#8A8F99" }}>{new Date(student.lastEventAt).toLocaleTimeString("id-ID")}</div>}
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 700, color: "#DC2626", background: "#FEE2E2", padding: "1px 7px", borderRadius: 99 }}>AKTIF</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* History */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#8A8F99", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Riwayat Pelanggaran</div>
            <div style={{ borderRadius: 8, border: "1px solid #E3E5EA", overflow: "hidden" }}>
              {mockHistory.length > 0 ? mockHistory.map((evt, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "9px 13px",
                  borderBottom: i < mockHistory.length - 1 ? "1px solid #F0F2F5" : undefined,
                }}>
                  <span style={{ fontSize: 14 }}>{VIOLATION_CONFIG[evt.flag].icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: "#1F2430" }}>{VIOLATION_CONFIG[evt.flag].label}</div>
                    <div style={{ fontSize: 11, color: "#8A8F99" }}>{evt.time}</div>
                  </div>
                  <span style={{
                    fontSize: 10, fontWeight: 600, padding: "1px 7px", borderRadius: 99,
                    background: evt.status === "active" ? "#FEE2E2" : "#F0FDF4",
                    color: evt.status === "active" ? "#DC2626" : "#16A34A",
                  }}>{evt.status === "active" ? "Aktif" : "Selesai"}</span>
                </div>
              )) : (
                <div style={{ padding: "16px 13px", fontSize: 13, color: "#9CA3AF", fontStyle: "italic" }}>Belum ada riwayat</div>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ padding: "14px 20px", borderTop: "1px solid #E3E5EA", display: "flex", gap: 10 }}>
          {student.status === "blocked" ? (
            <button style={{
              flex: 1, height: 38, borderRadius: 8, border: "1.5px solid #E3E5EA",
              background: "white", color: "#1F2430", fontSize: 13, fontWeight: 600,
              cursor: "pointer", fontFamily: "var(--font-family)",
            }}>🔓 Buka Kunci</button>
          ) : (
            <button style={{
              flex: 1, height: 38, borderRadius: 8, border: "1.5px solid #E3E5EA",
              background: "white", color: "#1F2430", fontSize: 13, fontWeight: 600,
              cursor: "pointer", fontFamily: "var(--font-family)",
            }}>⚠️ Kirim Peringatan</button>
          )}
          <button style={{
            flex: 1, height: 38, borderRadius: 8, border: "none",
            background: "#DC2626", color: "white", fontSize: 13, fontWeight: 600,
            cursor: "pointer", fontFamily: "var(--font-family)",
          }}>🔒 Blokir Peserta</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function MonitorPage() {
  const params = useParams();
  const examId = (params?.id as string) ?? "exam-1";
  const exam = mockExams.find(e => e.id === examId) ?? mockExams[0];

  const [secondsLeft, setSecondsLeft] = useState(exam.duration * 60);
  const [filter, setFilter] = useState("all");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [selectedStudent, setSelectedStudent] = useState<StudentFeedItem | null>(null);
  const [students, setStudents] = useState<StudentFeedItem[]>(MOCK_STUDENTS);
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  // Countdown
  useEffect(() => {
    if (secondsLeft <= 0) return;
    const t = setInterval(() => setSecondsLeft(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [secondsLeft]);

  // Simulate real-time violations
  useEffect(() => {
    const interval = setInterval(() => {
      setStudents(prev => {
        const onlineStudents = prev.filter(s => s.status === "online");
        if (!onlineStudents.length) return prev;
        const target = onlineStudents[Math.floor(Math.random() * onlineStudents.length)];
        const shouldClear = Math.random() > 0.6 && target.activeFlags.length > 0;
        const newFlags = shouldClear
          ? target.activeFlags.slice(0, -1)
          : [...target.activeFlags, ALL_VIOLATIONS[Math.floor(Math.random() * ALL_VIOLATIONS.length)]].filter((v, i, arr) => arr.indexOf(v) === i).slice(0, 3);
        return prev.map(s =>
          s.studentId === target.studentId
            ? { ...s, activeFlags: newFlags, violationCount: shouldClear ? s.violationCount : s.violationCount + 1, lastEventAt: new Date().toISOString() }
            : s
        );
      });
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Close dropdown outside
  useEffect(() => {
    const h = (e: MouseEvent) => { if (filterRef.current && !filterRef.current.contains(e.target as Node)) setFilterOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const handleLegendClick = useCallback((key: ViolationKey) => {
    setFilter(prev => prev === key ? "all" : key);
  }, []);

  const filteredStudents = students.filter(s => {
    if (filter === "all") return true;
    if (filter === "no_violations") return s.activeFlags.length === 0 && s.status === "online";
    if (filter === "blocked") return s.status === "blocked";
    if (filter === "offline") return s.status === "offline";
    return s.activeFlags.includes(filter as ViolationKey);
  });

  const countByViolation = (key: ViolationKey) => students.filter(s => s.activeFlags.includes(key)).length;
  const blockedCount = students.filter(s => s.status === "blocked").length;
  const offlineCount = students.filter(s => s.status === "offline").length;
  const onlineCount = students.filter(s => s.status === "online").length;
  const isTimeCritical = secondsLeft <= 5 * 60;
  const isTimeUp = secondsLeft <= 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "#F6F7F9", fontFamily: "var(--font-family)" }}>

      {/* Accent bar */}
      <div style={{ height: 4, background: "linear-gradient(90deg, #C9C3F2, #A8B4F8, #7DD3FC, #A8B4F8, #C9C3F2)", flexShrink: 0 }} />

      {/* Page Header */}
      <header style={{
        background: "white", borderBottom: "1px solid #E3E5EA",
        height: 48, display: "flex", alignItems: "center",
        padding: "0 24px", gap: 12, flexShrink: 0,
        position: "sticky", top: 0, zIndex: 100,
      }}>
        <Link href={`/dashboard/exams/${examId}`} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: 8, color: "#4A6678", textDecoration: "none" }} aria-label="Kembali">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
        </Link>
        <div>
          <h1 style={{ fontSize: 15, fontWeight: 700, color: "#1F2430", margin: 0, lineHeight: 1.1 }}>Proctoring – Live Feed</h1>
          <div style={{ fontSize: 11, color: "#8A8F99", marginTop: 1 }}>{exam.title}</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 14 }}>
          {/* Blocked alert */}
          {blockedCount > 0 && (
            <button onClick={() => setFilter("blocked")} style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "#FEE2E2", border: "1px solid #FECACA", borderRadius: 8,
              padding: "4px 10px", cursor: "pointer", fontFamily: "var(--font-family)",
            }}>
              <span style={{ fontSize: 12 }}>🔒</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#DC2626" }}>{blockedCount} Diblokir</span>
            </button>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#16A34A", display: "inline-block" }} className="live-pulse" />
            <span style={{ fontSize: 12, fontWeight: 600, color: "#16A34A" }}>Live</span>
          </div>
          <span style={{ fontSize: 12, color: "#8A8F99" }}>
            <span style={{ color: "#16A34A", fontWeight: 600 }}>{onlineCount}</span> online · <span style={{ color: "#9CA3AF" }}>{offlineCount}</span> offline · {students.length} total
          </span>
        </div>
      </header>

      {/* Assessment Bar */}
      <div style={{
        background: "#F6F7F9", borderBottom: "1px solid #E3E5EA",
        height: 54, display: "flex", alignItems: "center", padding: "0 24px", flexShrink: 0,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#1F2430" }}>{exam.title}</div>
          <div style={{ fontSize: 11, color: "#8A8F99" }}>Maks. pelanggaran: {exam.violationPolicy.maxViolations} · Tindakan: {exam.violationPolicy.action === "auto-lock" ? "Auto-lock" : exam.violationPolicy.action}</div>
        </div>
        {[
          { label: "Deteksi Copy-Paste", value: exam.violationPolicy.detectCopyPaste ? "Aktif" : "Nonaktif", active: exam.violationPolicy.detectCopyPaste },
          { label: "Deteksi Klik Kanan", value: exam.violationPolicy.detectRightClick ? "Aktif" : "Nonaktif", active: exam.violationPolicy.detectRightClick },
          { label: "Deteksi DevTools",   value: exam.violationPolicy.detectDevTools ? "Aktif" : "Nonaktif", active: exam.violationPolicy.detectDevTools },
        ].map(meta => (
          <div key={meta.label} style={{ borderLeft: "1px solid #E3E5EA", padding: "0 16px", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div style={{ fontSize: 10, color: "#8A8F99", lineHeight: 1.2, marginBottom: 2 }}>{meta.label}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: meta.active ? "#16A34A" : "#9CA3AF", lineHeight: 1.2 }}>{meta.value}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{
        background: "white", borderBottom: "1px solid #E3E5EA",
        padding: "0 24px", display: "flex", alignItems: "center", gap: 12,
        minHeight: 48, flexShrink: 0, flexWrap: "wrap",
        position: "sticky", top: 48, zIndex: 90,
      }}>
        {/* Countdown */}
        <div style={{ display: "flex", alignItems: "center", gap: 7, flexShrink: 0, marginRight: 4 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={isTimeCritical ? "#DC2626" : "#4A6678"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
          </svg>
          <span style={{
            fontSize: 14, fontWeight: 700, fontFamily: "monospace", letterSpacing: "0.04em",
            color: isTimeCritical ? "#DC2626" : "#1F2430", transition: "color 0.3s",
          }}>
            {isTimeUp ? "Waktu Habis" : `${formatCountdown(secondsLeft)} Sisa`}
          </span>
        </div>

        <div style={{ width: 1, height: 20, background: "#E3E5EA", flexShrink: 0 }} />

        {/* Special status badges */}
        <button onClick={() => setFilter(f => f === "blocked" ? "all" : "blocked")} aria-pressed={filter === "blocked"}
          style={{
            display: "flex", alignItems: "center", gap: 5, borderRadius: 20, padding: "3px 9px 3px 6px",
            background: filter === "blocked" ? "#FEE2E2" : "transparent",
            border: filter === "blocked" ? "1px solid #FECACA" : "1px solid transparent",
            cursor: "pointer", fontFamily: "var(--font-family)",
          }}>
          <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#DC2626", display: "inline-block", border: "1.5px solid #B91C1C" }} />
          <span style={{ fontSize: 12, color: filter === "blocked" ? "#DC2626" : "#4A6678", fontWeight: filter === "blocked" ? 700 : 400 }}>🔒 Diblokir</span>
          {blockedCount > 0 && <span style={{ fontSize: 10, fontWeight: 700, background: "#DC2626", color: "white", borderRadius: 99, padding: "0 5px", lineHeight: "16px" }}>{blockedCount}</span>}
        </button>

        <button onClick={() => setFilter(f => f === "offline" ? "all" : "offline")} aria-pressed={filter === "offline"}
          style={{
            display: "flex", alignItems: "center", gap: 5, borderRadius: 20, padding: "3px 9px 3px 6px",
            background: filter === "offline" ? "#F3F4F6" : "transparent",
            border: filter === "offline" ? "1px solid #D1D5DB" : "1px solid transparent",
            cursor: "pointer", fontFamily: "var(--font-family)",
          }}>
          <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#9CA3AF", display: "inline-block", border: "1.5px solid #6B7280" }} />
          <span style={{ fontSize: 12, color: filter === "offline" ? "#6B7280" : "#4A6678", fontWeight: filter === "offline" ? 700 : 400 }}>⚫ Offline</span>
          {offlineCount > 0 && <span style={{ fontSize: 10, fontWeight: 700, background: "#9CA3AF", color: "white", borderRadius: 99, padding: "0 5px", lineHeight: "16px" }}>{offlineCount}</span>}
        </button>

        <div style={{ width: 1, height: 20, background: "#E3E5EA", flexShrink: 0 }} />

        {/* Violation legend buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {(Object.entries(VIOLATION_CONFIG) as [ViolationKey, typeof VIOLATION_CONFIG[ViolationKey]][]).map(([key, cfg]) => {
            const count = countByViolation(key);
            const active = filter === key;
            return (
              <button key={key} onClick={() => handleLegendClick(key)} aria-pressed={active}
                style={{
                  display: "flex", alignItems: "center", gap: 5, borderRadius: 20, padding: "3px 8px 3px 5px",
                  background: active ? `${cfg.color}15` : "transparent",
                  border: active ? `1px solid ${cfg.color}50` : "1px solid transparent",
                  cursor: "pointer", transition: "all 0.15s", fontFamily: "var(--font-family)",
                }}>
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: cfg.color, display: "inline-block", border: `1.5px solid ${cfg.ring}`, flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: active ? cfg.color : "#4A6678", fontWeight: active ? 700 : 400, whiteSpace: "nowrap" }}>
                  {cfg.icon} {cfg.shortLabel}
                </span>
                {count > 0 && <span style={{ fontSize: 10, fontWeight: 700, background: cfg.color, color: "white", borderRadius: 99, padding: "0 4px", lineHeight: "15px" }}>{count}</span>}
              </button>
            );
          })}
        </div>

        {/* Right: filter + view toggle */}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
          <div ref={filterRef} style={{ position: "relative" }}>
            <button onClick={() => setFilterOpen(v => !v)} style={{
              display: "flex", alignItems: "center", gap: 6, background: "none",
              border: "none", borderBottom: "1.5px solid #C8DCE8", padding: "4px 2px",
              cursor: "pointer", fontSize: 13, color: "#1F2430", fontFamily: "var(--font-family)",
            }}>
              <span>{FILTER_OPTIONS.find(o => o.value === filter)?.label ?? "Semua"}</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8A8F99" strokeWidth="2.5"><polyline points="6 9 12 15 18 9" /></svg>
            </button>
            {filterOpen && (
              <div style={{
                position: "absolute", top: "calc(100% + 6px)", right: 0,
                background: "white", border: "1px solid #E3E5EA", borderRadius: 8,
                boxShadow: "0 6px 20px rgba(15,24,40,0.12)", padding: 4, zIndex: 200, minWidth: 190,
              }}>
                {FILTER_OPTIONS.map(opt => (
                  <button key={opt.value} onClick={() => { setFilter(opt.value); setFilterOpen(false); }}
                    style={{
                      display: "block", width: "100%", padding: "8px 12px", fontSize: 13,
                      color: filter === opt.value ? "#29ABE2" : "#1F2430",
                      fontWeight: filter === opt.value ? 600 : 400,
                      background: filter === opt.value ? "#E0F4FD" : "transparent",
                      border: "none", borderRadius: 6, cursor: "pointer", textAlign: "left",
                      fontFamily: "var(--font-family)",
                    }}>{opt.label}</button>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: "flex", border: "1px solid #E3E5EA", borderRadius: 8, overflow: "hidden" }}>
            {(["list", "grid"] as ViewMode[]).map(mode => {
              const isActive = viewMode === mode;
              return (
                <button key={mode} onClick={() => setViewMode(mode)} aria-pressed={isActive} aria-label={`${mode} view`}
                  style={{
                    width: 34, height: 32, border: "none",
                    background: isActive ? "#1F2430" : "white", color: isActive ? "white" : "#8A8F99",
                    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "background 0.15s",
                  }}>
                  {mode === "list" ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
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

      {/* Time-up banner */}
      {isTimeUp && (
        <div style={{ background: "#FEE2E2", borderBottom: "1px solid #FECACA", padding: "10px 24px", fontSize: 14, fontWeight: 600, color: "#DC2626", display: "flex", alignItems: "center", gap: 8 }}>
          ⏰ Waktu habis! Ujian telah berakhir.
        </div>
      )}

      {/* Grid / List */}
      <div style={{ flex: 1, padding: 20, overflowY: "auto" }}>
        <div style={{ fontSize: 12, color: "#8A8F99", marginBottom: 12, display: "flex", alignItems: "center", gap: 0 }}>
          Menampilkan {filteredStudents.length} dari {students.length} peserta
          {filter !== "all" && (
            <button onClick={() => setFilter("all")} style={{ marginLeft: 10, color: "#29ABE2", background: "none", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "var(--font-family)" }}>
              Tampilkan semua →
            </button>
          )}
        </div>

        {filteredStudents.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "64px 24px", gap: 12 }}>
            <div style={{ fontSize: 40 }}>🔍</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "#1F2430" }}>Tidak ada peserta yang sesuai filter</div>
            <button onClick={() => setFilter("all")} style={{ padding: "9px 20px", background: "#29ABE2", color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-family)" }}>
              Tampilkan Semua
            </button>
          </div>
        ) : viewMode === "grid" ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 14 }}>
            {filteredStudents.map(student => (
              <StudentCard key={student.studentId} student={student}
                isSelected={selectedStudent?.studentId === student.studentId}
                onClick={() => setSelectedStudent(selectedStudent?.studentId === student.studentId ? null : student)}
              />
            ))}
          </div>
        ) : (
          <div style={{ background: "white", borderRadius: 10, border: "1px solid #E3E5EA", overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "0 20px", height: 40, background: "#F8FAFC", borderBottom: "1px solid #E3E5EA", fontSize: 11, fontWeight: 700, color: "#8A8F99", textTransform: "uppercase", letterSpacing: "0.06em", position: "sticky", top: 0 }}>
              <span style={{ width: 10 }} /><span style={{ width: 30 }} />
              <span style={{ flex: 2 }}>Nama</span>
              <span style={{ flex: 1, minWidth: 80 }}>Status</span>
              <span style={{ flex: 1.5 }}>Pelanggaran Aktif</span>
              <span style={{ flex: 0.6, textAlign: "center" }}>Total</span>
              <span style={{ flex: 1, textAlign: "right" }}>Waktu</span>
            </div>
            {filteredStudents.map((student, i) => (
              <StudentListRow key={student.studentId} student={student} index={i}
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

      <div aria-live="polite" aria-atomic="true" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap" }} />

      <style>{`
        .live-pulse { animation: livePulse 2s infinite; }
        @keyframes livePulse {
          0%,100% { box-shadow: 0 0 0 3px rgba(22,163,74,0.22); }
          50% { box-shadow: 0 0 0 6px rgba(22,163,74,0.06); }
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(24px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        button:focus-visible { outline: 2px solid #29ABE2; outline-offset: 2px; }
      `}</style>
    </div>
  );
}
