"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/apiClient";
import { SkeletonBase, SkeletonTable } from "@/app/components/skeleton";
import { io } from "socket.io-client";
import { useTeacherAuth } from "@/contexts/AuthContext";

// ─── Types ────────────────────────────────────────────────────────────────────
type ViolationKey =
  | "tab_switch"
  | "fullscreen_exit"
  | "copy_attempt"
  | "paste_attempt"
  | "copy_paste"
  | "window_blur"
  | "devtools"
  | "devtools_open"
  | "right_click"
  | "ip_change"
  | "screenshot";

type StudentStatus = "online" | "offline" | "blocked" | "submitted" | "kicked";
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
  answeredCount?: number;
  totalQuestions?: number;
  score?: number | null;
}

// ─── Violation Config ─────────────────────────────────────────────────────────
const VIOLATION_CONFIG: Record<string, { label: string; color: string; ring: string; icon: string; shortLabel: string }> = {
  tab_switch:      { label: "Ganti Tab",          shortLabel: "Tab",        color: "#DC2626", ring: "#B91C1C", icon: "" },
  fullscreen_exit: { label: "Keluar Fullscreen",   shortLabel: "Fullscreen", color: "#EA580C", ring: "#C2410C", icon: ""  },
  copy_attempt:    { label: "Copy-Paste",          shortLabel: "Copy",       color: "#C28A3D", ring: "#B45309", icon: "" },
  paste_attempt:   { label: "Paste Terdeteksi",    shortLabel: "Paste",      color: "#CA8A04", ring: "#A16207", icon: "" },
  copy_paste:      { label: "Copy-Paste",          shortLabel: "Copy",       color: "#C28A3D", ring: "#B45309", icon: "" },
  window_blur:     { label: "Window Blur",         shortLabel: "Blur",       color: "#7C3AED", ring: "#6D28D9", icon: "" },
  devtools:        { label: "Buka DevTools",       shortLabel: "DevTools",   color: "#0F172A", ring: "#020617", icon: "" },
  devtools_open:   { label: "Buka DevTools",       shortLabel: "DevTools",   color: "#0F172A", ring: "#020617", icon: "" },
  right_click:     { label: "Klik Kanan",          shortLabel: "RightClick", color: "#6B7280", ring: "#4B5563", icon: "" },
  ip_change:       { label: "Perubahan IP",        shortLabel: "IP Ganti",   color: "#DC2626", ring: "#991B1B", icon: "" },
  screenshot:      { label: "Percobaan shortcut screenshot", shortLabel: "Screenshot", color: "#E11D48", ring: "#BE123C", icon: "" },
};

const VIOLATION_PRIORITY: ViolationKey[] = [
  "screenshot", "ip_change", "tab_switch", "devtools", "devtools_open", "copy_attempt", "copy_paste", "paste_attempt", "fullscreen_exit", "window_blur", "right_click"
];

const FILTER_OPTIONS = [
  { value: "all",             label: "Semua" },
  { value: "blocked",         label: " Diblokir" },
  { value: "kicked",          label: " Dikeluarkan" },
  { value: "offline",         label: " Offline" },
  { value: "screenshot",      label: " Screenshot" },
  { value: "ip_change",       label: " Ganti IP" },
  { value: "tab_switch",      label: " Ganti Tab" },
  { value: "fullscreen_exit", label: " Keluar Fullscreen" },
  { value: "copy_attempt",    label: " Copy-Paste" },
  { value: "window_blur",     label: " Window Blur" },
  { value: "devtools",        label: " DevTools" },
  { value: "right_click",     label: " Klik Kanan" },
  { value: "no_violations",   label: " Tidak Ada Pelanggaran" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getTopFlag(flags: ViolationKey[]): ViolationKey | null {
  if (!flags || !flags.length) return null;
  for (const f of VIOLATION_PRIORITY) {
    if (flags.includes(f)) return f;
  }
  return flags[0];
}

function getInitials(name: string) {
  if (!name) return "??";
  return name.split(" ").filter(Boolean).slice(0, 2).map(n => n[0]).join("").toUpperCase() || "??";
}

function getAvatarGradient(name: string) {
  void name;
  return "#4F6B80";
}

function formatCountdown(secs: number) {
  if (secs <= 0) return "00:00";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
const STATUS_STYLE: Record<StudentStatus, { bg: string; color: string; label: string; dot: string }> = {
  online:    { bg: "#DCFCE7", color: "#42654F", label: "Online",     dot: "#42654F" },
  offline:   { bg: "#F3F4F6", color: "#6B7280", label: "Offline",    dot: "#9CA3AF" },
  blocked:   { bg: "#F7E5E3", color: "#713434", label: "Diblokir", dot: "#A85A5A" },
  submitted: { bg: "#DCE8F0", color: "#0369A1", label: "Selesai ✓",  dot: "#4F6B80" },
  kicked:    { bg: "#F7E5E3", color: "#713434", label: "Dikeluarkan", dot: "#A85A5A" },
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
  const cfg = VIOLATION_CONFIG[flagKey] || { label: flagKey, color: "#DC2626", ring: "#B91C1C" };
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
  const st = STATUS_STYLE[student.status] || STATUS_STYLE.offline;
  const isBlocked = student.status === "blocked";
  const isOffline = student.status === "offline";
  const isSubmitted = student.status === "submitted";

  const borderColor = isBlocked ? "#EF4444" : isSelected ? "#4F6B80" : "transparent";
  const shadow = hovered ? "0 4px 16px rgba(20,24,40,0.18)" : isSelected ? "0 0 0 4px rgba(41,171,226,0.18)" : isBlocked ? "0 0 0 3px rgba(239,68,68,0.15)" : "0 2px 8px rgba(20,24,40,0.10)";

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-pressed={isSelected}
      aria-label={`${student.name}, ${student.identifierLabel}: ${student.identifier}, status: ${st.label}${topFlag && flagCfg ? `, pelanggaran: ${flagCfg.label}` : ""}`}
      style={{
        position: "relative", background: isBlocked ? "#FFF5F5" : "white",
        border: `2px solid ${borderColor}`, borderRadius: 8,
        padding: "10px 10px 12px", cursor: "pointer",
        display: "flex", flexDirection: "column", alignItems: "center",
        width: "100%", textAlign: "center", outline: "none",
        minHeight: 155, boxShadow: shadow,
        transition: "box-shadow 0.18s ease, border-color 0.18s ease",
      }}
    >
      {/* Top-left: violation dot */}
      <div style={{ position: "absolute", top: 8, left: 8, display: "flex", alignItems: "center", gap: 3 }}>
        <ViolationDot flagKey={topFlag} />
        {topFlag && extraFlags > 0 && flagCfg && (
          <span style={{
            fontSize: 9, fontWeight: 700, color: flagCfg.color,
            background: `${flagCfg.color}18`, borderRadius: 99, padding: "0 4px", lineHeight: "14px",
          }}>+{extraFlags}</span>
        )}
      </div>

      {/* Violation count badge */}
      {student.violationCount > 0 && !isBlocked && (
        <div style={{
          position: "absolute", top: 7, right: 8,
          background: student.violationCount >= 3 ? "#914848" : "#79531E",
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
        }}> Diblokir</div>
      ) : isOffline ? (
        <div style={{
          fontSize: 9, fontWeight: 600, color: "#6B7280",
          background: "#F3F4F6", borderRadius: 99, padding: "2px 8px", lineHeight: "15px",
        }}> Offline</div>
      ) : isSubmitted ? (
        <div style={{
          fontSize: 9, fontWeight: 600, color: "#0369A1",
          background: "#DCE8F0", borderRadius: 99, padding: "2px 8px", lineHeight: "15px",
        }}>Selesai</div>
      ) : topFlag && flagCfg ? (
        <div style={{
          fontSize: 9, fontWeight: 600, color: flagCfg.color,
          background: `${flagCfg.color}15`, borderRadius: 99, padding: "2px 8px", lineHeight: "15px",
          display: "flex", alignItems: "center", gap: 3, maxWidth: "calc(100% - 8px)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          <span>{flagCfg.icon}</span>
          {flagCfg.shortLabel}
        </div>
      ) : (
        <div style={{
          fontSize: 9, color: "#42654F", background: "#DCFCE7",
          borderRadius: 99, padding: "2px 8px", lineHeight: "15px", fontWeight: 600,
        }}>Aman</div>
      )}

      {/* Live Answer Progress & Score */}
      {isSubmitted ? (
        <div style={{ marginTop: 6, width: "100%", paddingInline: 2 }}>
          <div style={{
            fontSize: 10,
            fontWeight: 700,
            color: "#15803D",
            background: "#DCFCE7",
            border: "1px solid #86EFAC",
            borderRadius: 6,
            padding: "2px 6px",
            lineHeight: "15px",
            display: "inline-block",
          }}>
            Nilai: {student.score !== null && student.score !== undefined ? student.score : "—"}
          </div>
          {typeof student.answeredCount === "number" && typeof student.totalQuestions === "number" && (
            <div style={{ fontSize: 9, color: "#64748B", marginTop: 2 }}>
              {student.answeredCount}/{student.totalQuestions} Soal
            </div>
          )}
        </div>
      ) : typeof student.answeredCount === "number" && typeof student.totalQuestions === "number" ? (
        <div style={{ marginTop: 6, width: "100%", paddingInline: 2 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 9, color: "#64748B", marginBottom: 3 }}>
            <span> Soal</span>
            <span style={{ fontWeight: 700, color: "#1E293B" }}>
              {student.answeredCount}/{student.totalQuestions}
            </span>
          </div>
          <div style={{ width: "100%", height: 4, background: "#E2E8F0", borderRadius: 99, overflow: "hidden" }}>
            <div style={{
              width: `${student.totalQuestions > 0 ? Math.min(100, Math.round((student.answeredCount / student.totalQuestions) * 100)) : 0}%`,
              height: "100%",
              background: "#4F6B80",
              borderRadius: 99,
              transition: "width 0.3s ease",
            }} />
          </div>
        </div>
      ) : null}
    </button>
  );
}

// ─── Student List Row ─────────────────────────────────────────────────────────
function StudentListRow({ student, index, isSelected, onClick }: {
  student: StudentFeedItem; index: number; isSelected: boolean; onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const topFlag = getTopFlag(student.activeFlags);
  const flagCfg = topFlag ? VIOLATION_CONFIG[topFlag] : null;
  const st = STATUS_STYLE[student.status] || STATUS_STYLE.offline;

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
        <div style={{ fontSize: 11, color: "#8A8F99" }}>{student.identifierLabel}: {student.identifier}</div>
      </div>
      <div style={{ flex: 1, minWidth: 80 }}>
        <span style={{
          fontSize: 11, fontWeight: 600, padding: "2px 9px", borderRadius: 99,
          background: st.bg, color: st.color,
        }}>{st.label}</span>
      </div>
      {/* Progres / Nilai */}
      <div style={{ flex: 1.5, minWidth: 120 }}>
        {student.status === "submitted" ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{
              fontSize: 11,
              fontWeight: 700,
              padding: "2px 8px",
              borderRadius: 6,
              background: "#DCFCE7",
              color: "#15803D",
              border: "1px solid #86EFAC",
            }}>
              Nilai: {student.score !== null && student.score !== undefined ? student.score : "—"}
            </span>
            {typeof student.answeredCount === "number" && typeof student.totalQuestions === "number" && (
              <span style={{ fontSize: 10, color: "#64748B" }}>
                ({student.answeredCount}/{student.totalQuestions})
              </span>
            )}
          </div>
        ) : typeof student.answeredCount === "number" && typeof student.totalQuestions === "number" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 2, maxWidth: 130 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#475569" }}>
              <span>{student.answeredCount}/{student.totalQuestions} Soal</span>
              <span style={{ fontWeight: 600 }}>
                {student.totalQuestions > 0 ? Math.round((student.answeredCount / student.totalQuestions) * 100) : 0}%
              </span>
            </div>
            <div style={{ width: "100%", height: 4, background: "#E2E8F0", borderRadius: 99, overflow: "hidden" }}>
              <div style={{
                width: `${student.totalQuestions > 0 ? Math.min(100, Math.round((student.answeredCount / student.totalQuestions) * 100)) : 0}%`,
                height: "100%",
                background: "#4F6B80",
                borderRadius: 99,
                transition: "width 0.3s ease",
              }} />
            </div>
          </div>
        ) : (
          <span style={{ fontSize: 11, color: "#9CA3AF" }}>—</span>
        )}
      </div>
      <div style={{ flex: 1.5, minWidth: 0 }}>
        {topFlag && flagCfg ? (
          <span style={{
            fontSize: 11, fontWeight: 600, color: flagCfg.color,
            background: `${flagCfg.color}15`, borderRadius: 99, padding: "2px 9px",
            display: "inline-flex", alignItems: "center", gap: 4,
          }}>
            <span>{flagCfg.icon}</span>{flagCfg.shortLabel}
          </span>
        ) : <span style={{ fontSize: 11, color: "#9CA3AF" }}>—</span>}
      </div>
      <div style={{ flex: 0.6, textAlign: "center" }}>
        {student.violationCount > 0 ? (
          <span style={{
            fontSize: 12, fontWeight: 700,
            color: student.violationCount >= 3 ? "#DC2626" : "#C28A3D",
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

// ─── Detail Panel (Real Violations History) ───────────────────────────────────
function DetailPanel({
  examId,
  student,
  onClose,
  onActionDone,
  onRequestKick,
}: {
  examId: string;
  student: StudentFeedItem;
  onClose: () => void;
  onActionDone?: () => void;
  onRequestKick?: (student: StudentFeedItem) => void;
}) {
  const topFlag = getTopFlag(student.activeFlags);
  const st = STATUS_STYLE[student.status] || STATUS_STYLE.offline;

  const [history, setHistory] = useState<any[]>([]);
  const [warnings, setWarnings] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function loadViolations() {
      setLoadingHistory(true);
      try {
        const res = await apiFetch<any>(`/api/exams/${examId}/students/${student.studentId}/violations`);
        if (isMounted && res.success && res.data) {
          setHistory(res.data.events || []);
          setWarnings(res.data.warnings || []);
        }
      } catch {
        // error handling
      } finally {
        if (isMounted) setLoadingHistory(false);
      }
    }
    loadViolations();
    return () => { isMounted = false; };
  }, [examId, student.studentId]);

  const handleUnlock = async () => {
    try {
      const res = await apiFetch<any>(`/api/exams/${examId}/students/${student.studentId}/unlock`, {
        method: "POST",
      });
      if (res.success) {
        alert("Peserta berhasil di-unlock.");
        onActionDone?.();
        onClose();
      } else {
        alert(res.error?.message || "Gagal meng-unlock peserta.");
      }
    } catch {
      alert("Terjadi kesalahan jaringan.");
    }
  };

  const handleWarn = async () => {
    const msg = prompt("Pesan peringatan untuk peserta:", "Harap tetap fokus pada halaman ujian.");
    if (!msg) return;
    try {
      const res = await apiFetch<any>(`/api/exams/${examId}/students/${student.studentId}/warn`, {
        method: "POST",
        body: JSON.stringify({ message: msg }),
      });
      if (res.success) {
        alert("Peringatan terkirim ke peserta.");
        onActionDone?.();
      } else {
        alert(res.error?.message || "Gagal mengirim peringatan.");
      }
    } catch {
      alert("Terjadi kesalahan jaringan.");
    }
  };

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
            {student.status === "blocked" ? " Peserta Diblokir" : "Detail Peserta"}
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

          {/* Stats: Progres & Nilai */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
            <div style={{ background: "#F8FAFC", borderRadius: 10, padding: "12px 14px", border: "1px solid #E3E5EA" }}>
              <div style={{ fontSize: 10, color: "#8A8F99", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Soal Terjawab</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#4F6B80" }}>
                {typeof student.answeredCount === "number" && typeof student.totalQuestions === "number"
                  ? `${student.answeredCount} / ${student.totalQuestions}`
                  : "—"}
              </div>
              {typeof student.answeredCount === "number" && typeof student.totalQuestions === "number" && (
                <div style={{ width: "100%", height: 4, background: "#E2E8F0", borderRadius: 99, overflow: "hidden", marginTop: 6 }}>
                  <div style={{
                    width: `${student.totalQuestions > 0 ? Math.min(100, Math.round((student.answeredCount / student.totalQuestions) * 100)) : 0}%`,
                    height: "100%",
                    background: "#4F6B80",
                    borderRadius: 99,
                  }} />
                </div>
              )}
            </div>
            <div style={{ background: student.status === "submitted" ? "#E4EFE7" : "#F8FAFC", borderRadius: 10, padding: "12px 14px", border: student.status === "submitted" ? "1px solid #BBF7D0" : "1px solid #E3E5EA" }}>
              <div style={{ fontSize: 10, color: student.status === "submitted" ? "#166534" : "#8A8F99", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Nilai Akhir</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: student.status === "submitted" ? "#15803D" : "#94A3B8" }}>
                {student.status === "submitted"
                  ? (student.score !== null && student.score !== undefined ? `${student.score}` : "—")
                  : "Mengerjakan"}
              </div>
              <div style={{ fontSize: 10, color: student.status === "submitted" ? "#166534" : "#94A3B8", marginTop: 4 }}>
                {student.status === "submitted" ? "Terkumpul" : "Belum submit"}
              </div>
            </div>
          </div>

          {/* Stats: Pelanggaran */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
            <div style={{ background: "#F8FAFC", borderRadius: 10, padding: "12px 14px", border: "1px solid #E3E5EA" }}>
              <div style={{ fontSize: 10, color: "#8A8F99", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Total Pelanggaran</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: student.violationCount >= 3 ? "#DC2626" : student.violationCount > 0 ? "#C28A3D" : "#42654F" }}>{student.violationCount}</div>
            </div>
            <div style={{ background: "#F8FAFC", borderRadius: 10, padding: "12px 14px", border: "1px solid #E3E5EA" }}>
              <div style={{ fontSize: 10, color: "#8A8F99", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Flag Aktif</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: student.activeFlags.length > 0 ? "#DC2626" : "#42654F" }}>{student.activeFlags.length}</div>
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
                  const cfg = VIOLATION_CONFIG[flag] || { label: flag, icon: "", color: "#DC2626" };
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

          {/* Riwayat Pelanggaran Riil */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#8A8F99", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Riwayat Pelanggaran Riil</div>
            <div style={{ borderRadius: 8, border: "1px solid #E3E5EA", overflow: "hidden" }}>
              {loadingHistory ? (
                <div style={{ padding: "16px 13px", display: "flex", flexDirection: "column", gap: 8 }}>
                  <SkeletonBase width="100%" height="28px" borderRadius="4px" />
                  <SkeletonBase width="85%" height="28px" borderRadius="4px" />
                </div>
              ) : history.length > 0 ? (
                history.map((evt, i) => {
                  const cfg = VIOLATION_CONFIG[evt.eventType as ViolationKey] || {
                    label: evt.eventType,
                    icon: "",
                    color: "#DC2626",
                  };
                  return (
                    <div key={evt.id || i} style={{
                      display: "flex", alignItems: "center", gap: 10, padding: "9px 13px",
                      borderBottom: i < history.length - 1 ? "1px solid #F0F2F5" : undefined,
                    }}>
                      <span style={{ fontSize: 14 }}>{cfg.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 500, color: "#1F2430" }}>{cfg.label}</div>
                        <div style={{ fontSize: 11, color: "#8A8F99" }}>
                          {new Date(evt.timestamp).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                        </div>
                        {evt.eventType === "ip_change" && evt.metadata && (
                          <div style={{ fontSize: 11, color: "#DC2626", marginTop: 3, background: "#FEF2F2", padding: "2px 6px", borderRadius: 4, fontFamily: "monospace" }}>
                             {evt.metadata.oldIp || "?"} ➔ {evt.metadata.newIp || "?"}
                          </div>
                        )}
                        {evt.eventType === "screenshot" && evt.metadata && (
                          <div style={{ fontSize: 11, color: "#E11D48", marginTop: 3, background: "#FFF1F2", padding: "2px 6px", borderRadius: 4 }}>
                             {evt.metadata.trigger || evt.metadata.key || "PrintScreen"}
                          </div>
                        )}
                      </div>
                      <span style={{
                        fontSize: 10, fontWeight: 600, padding: "1px 7px", borderRadius: 99,
                        background: "#FEE2E2", color: "#DC2626",
                      }}>Terdeteksi</span>
                    </div>
                  );
                })
              ) : (
                <div style={{ padding: "16px 13px", fontSize: 13, color: "#9CA3AF", fontStyle: "italic" }}>Belum ada riwayat pelanggaran</div>
              )}
            </div>
          </div>

          {/* Warnings Log */}
          {warnings.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#8A8F99", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Peringatan Terkirim</div>
              <div style={{ borderRadius: 8, border: "1px solid #E3E5EA", overflow: "hidden" }}>
                {warnings.map((w, i) => (
                  <div key={w.id || i} style={{ padding: "8px 12px", borderBottom: i < warnings.length - 1 ? "1px solid #F0F2F5" : undefined, background: "#F8EAD2" }}>
                    <div style={{ fontSize: 12, color: "#92400E", fontWeight: 500 }}>"{w.message}"</div>
                    <div style={{ fontSize: 10, color: "#B45309", marginTop: 2 }}>{new Date(w.sentAt).toLocaleTimeString("id-ID")}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ padding: "14px 20px", borderTop: "1px solid #E3E5EA", display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", gap: 10 }}>
            {student.status === "submitted" ? (
              <Link
                href={`/dashboard/exams/${examId}/results/${student.studentId}`}
                style={{
                  flex: 1, height: 38, borderRadius: 8,
                  background: "#4F6B80", color: "white", fontSize: 13, fontWeight: 600,
                  textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center",
                  gap: 6, fontFamily: "var(--font-family)",
                }}
              >
                 Lihat Rincian Jawaban & Nilai
              </Link>
            ) : student.status === "blocked" ? (
              <button
                onClick={handleUnlock}
                style={{
                  flex: 1, height: 38, borderRadius: 8, border: "1.5px solid #E3E5EA",
                  background: "white", color: "#1F2430", fontSize: 13, fontWeight: 600,
                  cursor: "pointer", fontFamily: "var(--font-family)",
                }}
              > Buka Kunci</button>
            ) : (
              <button
                onClick={handleWarn}
                style={{
                  flex: 1, height: 38, borderRadius: 8, border: "1.5px solid #E3E5EA",
                  background: "white", color: "#1F2430", fontSize: 13, fontWeight: 600,
                  cursor: "pointer", fontFamily: "var(--font-family)",
                }}
              > Kirim Peringatan</button>
            )}
          </div>

          {/* Tombol Kick Siswa */}
          {student.status !== "kicked" ? (
            <button
              onClick={() => onRequestKick?.(student)}
              style={{
                width: "100%", height: 36, borderRadius: 8,
                border: "1.5px solid #FCA5A5", background: "#FEF2F2", color: "#DC2626",
                fontSize: 12, fontWeight: 600, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                fontFamily: "var(--font-family)",
              }}
            >
               Keluarkan Siswa dari Ujian (Kick)
            </button>
          ) : (
            <div style={{ textAlign: "center", fontSize: 12, fontWeight: 600, color: "#991B1B", padding: "4px 0" }}>
              Peserta Telah Dikeluarkan 
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Double Confirm Kick Modal ────────────────────────────────────────────────
function KickDoubleConfirmModal({
  examId,
  student,
  isOpen,
  onClose,
  onSuccess,
}: {
  examId: string;
  student: StudentFeedItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [reason, setReason] = useState<string>("Terbukti melakukan kecurangan (PrtScn / DevTools / Ganti Tab)");
  const [customReason, setCustomReason] = useState<string>("");
  const [acknowledged, setAcknowledged] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setReason("Terbukti melakukan kecurangan (PrtScn / DevTools / Ganti Tab)");
      setCustomReason("");
      setAcknowledged(false);
      setErrorMsg(null);
      setSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen || !student) return null;

  const PRESET_REASONS = [
    "Terbukti melakukan kecurangan (PrtScn / DevTools / Ganti Tab)",
    "Perangkat / Alamat IP tidak sah",
    "Bukan peserta resmi kelas ujian ini",
    "Pelanggaran tata tertib pengawasan berulang",
  ];

  const effectiveReason = customReason.trim() ? customReason.trim() : reason;

  const handleExecuteKick = async () => {
    if (!acknowledged) {
      setErrorMsg("Harap centang kotak persetujuan pengaman sebelum mengeluarkan peserta.");
      return;
    }
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await apiFetch<any>(`/api/exams/${examId}/students/${student.studentId}/kick`, {
        method: "POST",
        body: JSON.stringify({ reason: effectiveReason }),
      });
      if (res.success) {
        onSuccess?.();
        onClose();
      } else {
        setErrorMsg(res.error?.message || "Gagal mengeluarkan siswa.");
      }
    } catch {
      setErrorMsg("Terjadi gangguan jaringan saat memproses permintaan.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1200,
        background: "rgba(15,24,40,0.55)",
        backdropFilter: "blur(3px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "white",
          borderRadius: "14px",
          maxWidth: "480px",
          width: "100%",
          boxShadow: "0 24px 64px rgba(0,0,0,0.22)",
          overflow: "hidden",
          border: step === 2 ? "2px solid #EF4444" : "1px solid #E2E8F0",
          fontFamily: "var(--font-family, 'Poppins', sans-serif)",
          animation: "scaleIn 0.18s ease",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid #E2E8F0",
            background: step === 2 ? "#FEF2F2" : "#FFF7ED",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "18px" }}>{step === 2 ? "" : ""}</span>
            <div>
              <div style={{ fontSize: "15px", fontWeight: 700, color: step === 2 ? "#991B1B" : "#9A3412" }}>
                {step === 1 ? "Keluarkan Siswa (Tahap 1 dari 2)" : "KONFIRMASI GANDA PENGELUARAN"}
              </div>
              <div style={{ fontSize: "11px", color: step === 2 ? "#B91C1C" : "#C2410C" }}>
                {step === 1 ? "Pilih alasan pelanggaran peserta" : "Double Confirmation Safety Gate"}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: "18px", color: "#9CA3AF" }}
          >
            ✕
          </button>
        </div>

        {/* Body Modal */}
        <div style={{ padding: "20px" }}>
          {/* Identity banner */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "10px 14px",
              background: "#F8FAFC",
              borderRadius: "8px",
              border: "1px solid #E2E8F0",
              marginBottom: "16px",
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "14px", fontWeight: 700, color: "#1E293B" }}>{student.name}</div>
              <div style={{ fontSize: "11px", color: "#64748B" }}>
                {student.identifierLabel}: {student.identifier} · Pelanggaran: {student.violationCount}×
              </div>
            </div>
            <span
              style={{
                fontSize: "11px",
                fontWeight: 600,
                padding: "2px 8px",
                borderRadius: "99px",
                background: "#FEE2E2",
                color: "#DC2626",
              }}
            >
              Target Kick
            </span>
          </div>

          {step === 1 ? (
            /* TAHAP 1: PILIH ALASAN */
            <div>
              <label style={{ fontSize: "12px", fontWeight: 600, color: "#334155", display: "block", marginBottom: "8px" }}>
                Pilih Alasan Pengeluaran:
              </label>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "12px" }}>
                {PRESET_REASONS.map((p) => {
                  const isSelected = reason === p && !customReason;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => {
                        setReason(p);
                        setCustomReason("");
                      }}
                      style={{
                        textAlign: "left",
                        padding: "8px 12px",
                        borderRadius: "6px",
                        border: isSelected ? "1.5px solid #DC2626" : "1px solid #E2E8F0",
                        background: isSelected ? "#FEF2F2" : "#F8FAFC",
                        color: isSelected ? "#991B1B" : "#334155",
                        fontSize: "12px",
                        cursor: "pointer",
                        fontWeight: isSelected ? 600 : 400,
                        transition: "all 0.12s ease",
                      }}
                    >
                      {isSelected ? "● " : "○ "} {p}
                    </button>
                  );
                })}
              </div>

              <label style={{ fontSize: "11px", color: "#64748B", display: "block", marginBottom: "4px" }}>
                Atau masukkan alasan spesifik lain:
              </label>
              <input
                type="text"
                placeholder="Ketik alasan khusus di sini..."
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                style={{
                  width: "100%",
                  height: "38px",
                  padding: "0 12px",
                  borderRadius: "6px",
                  border: "1px solid #CBD5E1",
                  fontSize: "13px",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
          ) : (
            /* TAHAP 2: DOUBLE CONFIRM */
            <div>
              <div
                style={{
                  background: "#FEF2F2",
                  border: "1.5px solid #F87171",
                  borderRadius: "8px",
                  padding: "14px",
                  marginBottom: "16px",
                }}
              >
                <div style={{ fontSize: "13px", fontWeight: 700, color: "#991B1B", marginBottom: "4px" }}>
                  TINDAKAN INI TIDAK DAPAT DIBATALKAN!
                </div>
                <p style={{ fontSize: "12px", color: "#7F1D1D", margin: 0, lineHeight: 1.5 }}>
                  Sesi ujian <strong>{student.name}</strong> akan langsung diputus secara paksa dari server. Token siswa
                  akan dihapus dan lembar ujian akan dikunci.
                </p>
                <div style={{ marginTop: "8px", fontSize: "11px", color: "#991B1B", fontStyle: "italic" }}>
                  Alasan: &ldquo;{effectiveReason}&rdquo;
                </div>
              </div>

              {/* Checkbox Safety Gate */}
              <label
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "10px",
                  background: acknowledged ? "#E4EFE7" : "#F8FAFC",
                  border: acknowledged ? "1.5px solid #86EFAC" : "1px solid #CBD5E1",
                  borderRadius: "8px",
                  padding: "12px",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(e) => setAcknowledged(e.target.checked)}
                  style={{ width: "18px", height: "18px", marginTop: "2px", cursor: "pointer" }}
                />
                <span style={{ fontSize: "12px", fontWeight: 600, color: acknowledged ? "#166534" : "#1E293B", lineHeight: 1.4 }}>
                  Saya menyatakan telah memverifikasi pelanggaran ini dan bertanggung jawab penuh untuk mengeluarkan peserta dari ujian.
                </span>
              </label>

              {errorMsg && (
                <div style={{ marginTop: "12px", fontSize: "12px", color: "#DC2626", fontWeight: 600 }}>
                   {errorMsg}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: "14px 20px",
            borderTop: "1px solid #E2E8F0",
            background: "#FAFBFD",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          {step === 1 ? (
            <>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: "8px 16px",
                  borderRadius: "6px",
                  border: "1px solid #CBD5E1",
                  background: "white",
                  color: "#475569",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => setStep(2)}
                style={{
                  padding: "8px 18px",
                  borderRadius: "6px",
                  border: "none",
                  background: "#DC2626",
                  color: "white",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                Lanjut ke Konfirmasi Akhir (2/2) →
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setStep(1)}
                disabled={submitting}
                style={{
                  padding: "8px 14px",
                  borderRadius: "6px",
                  border: "1px solid #CBD5E1",
                  background: "white",
                  color: "#475569",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                ← Kembali
              </button>
              <button
                type="button"
                onClick={handleExecuteKick}
                disabled={!acknowledged || submitting}
                style={{
                  padding: "9px 20px",
                  borderRadius: "6px",
                  border: "none",
                  background: acknowledged ? "#B91C1C" : "#9CA3AF",
                  color: "white",
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: acknowledged && !submitting ? "pointer" : "not-allowed",
                  boxShadow: acknowledged ? "0 2px 8px rgba(185,28,28,0.3)" : "none",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                {submitting ? "Mengeluarkan Siswa..." : " YA, KELUARKAN SISWA SEKARANG"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Interfaces & Components for Lobby & Real-Time Logging ───────────────────
interface LobbyStudentItem {
  id: string;
  name: string;
  nisn: string;
  status: "waiting" | "accepted";
  joinedAt: string;
  acceptedAt?: string | null;
  ipAddress?: string | null;
}

interface LiveProctoringEvent {
  id?: string;
  studentId: string;
  studentName: string;
  nisn?: string;
  eventType: ViolationKey | string;
  timestamp: string;
  durationMs?: number;
  metadata?: Record<string, any>;
}

// ─── Lobby Approval Modal (Pop-Up di Proctoring) ──────────────────────────────
function LobbyApprovalModal({
  examId,
  isOpen,
  onClose,
  lobbyStudents,
  onRefresh,
}: {
  examId: string;
  isOpen: boolean;
  onClose: () => void;
  lobbyStudents: LobbyStudentItem[];
  onRefresh: () => void;
}) {
  const [tab, setTab] = useState<"all" | "waiting" | "accepted">("all");
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  if (!isOpen) return null;

  const waitingList = lobbyStudents.filter((s) => s.status === "waiting");
  const acceptedList = lobbyStudents.filter((s) => s.status === "accepted");

  const displayedList =
    tab === "waiting"
      ? waitingList
      : tab === "accepted"
      ? acceptedList
      : lobbyStudents;

  const handleAcceptOne = async (sid: string) => {
    setLoadingAction(sid);
    try {
      const res = await apiFetch<any>(`/api/exams/${examId}/students/${sid}/accept`, {
        method: "POST",
      });
      if (res.success) {
        onRefresh();
      } else {
        alert(res.error?.message || "Gagal menerima peserta");
      }
    } catch {
      alert("Terjadi kesalahan jaringan");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleStartOne = async (sid: string) => {
    setLoadingAction(`start-${sid}`);
    try {
      const res = await apiFetch<any>(`/api/exams/${examId}/students/${sid}/start`, {
        method: "POST",
      });
      if (res.success) {
        onRefresh();
      } else {
        alert(res.error?.message || "Gagal memulai ujian peserta");
      }
    } catch {
      alert("Terjadi kesalahan jaringan");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleAcceptAll = async () => {
    setLoadingAction("accept-all");
    try {
      const res = await apiFetch<any>(`/api/exams/${examId}/students/accept-all`, {
        method: "POST",
      });
      if (res.success) {
        onRefresh();
      } else {
        alert(res.error?.message || "Gagal menerima semua peserta");
      }
    } catch {
      alert("Terjadi kesalahan jaringan");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleStartAll = async () => {
    if (!confirm(`Mulai ujian sekarang untuk seluruh ${lobbyStudents.length} peserta di ruang tunggu?`)) {
      return;
    }
    setLoadingAction("start-all");
    try {
      const res = await apiFetch<any>(`/api/exams/${examId}/start`, {
        method: "POST",
      });
      if (res.success) {
        onRefresh();
        onClose();
      } else {
        alert(res.error?.message || "Gagal memulai ujian massal");
      }
    } catch {
      alert("Terjadi kesalahan jaringan");
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 500,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(15, 23, 42, 0.45)",
          backdropFilter: "blur(4px)",
        }}
      />
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          width: "100%",
          maxWidth: "700px",
          maxHeight: "88vh",
          background: "white",
          borderRadius: "14px",
          boxShadow: "0 20px 60px rgba(15, 24, 40, 0.22)",
          display: "flex",
          flexDirection: "column",
          zIndex: 1,
          overflow: "hidden",
          animation: "scaleUp 0.18s ease-out",
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: "18px 24px",
            borderBottom: "1px solid #E2E8F0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "#F8FAFC",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                background: "#E0F2FE",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "18px",
              }}
            >
              
            </div>
            <div>
              <div style={{ fontSize: "16px", fontWeight: 700, color: "#0F172A", display: "flex", alignItems: "center", gap: "8px" }}>
                <span>Persetujuan Lobby Peserta</span>
                {waitingList.length > 0 && (
                  <span
                    style={{
                      background: "#FEF3C7",
                      color: "#C28A3D",
                      fontSize: "11px",
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: "99px",
                      border: "1px solid #FCD34D",
                    }}
                  >
                    {waitingList.length} Menunggu
                  </span>
                )}
              </div>
              <div style={{ fontSize: "12px", color: "#64748B" }}>
                Peserta yang sedang berada di ruang tunggu ujian
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "#EDF2F7",
              border: "none",
              borderRadius: "8px",
              width: "32px",
              height: "32px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              fontSize: "16px",
              color: "#64748B",
            }}
            aria-label="Tutup"
          >
            ✕
          </button>
        </div>

        {/* Global Action Bar */}
        <div
          style={{
            padding: "12px 24px",
            background: "#FFFFFF",
            borderBottom: "1px solid #F1F5F9",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "10px",
          }}
        >
          {/* Tabs */}
          <div style={{ display: "flex", gap: "6px" }}>
            <button
              onClick={() => setTab("all")}
              style={{
                padding: "6px 12px",
                borderRadius: "8px",
                border: "none",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
                background: tab === "all" ? "#0F172A" : "#F1F5F9",
                color: tab === "all" ? "white" : "#64748B",
              }}
            >
              Semua ({lobbyStudents.length})
            </button>
            <button
              onClick={() => setTab("waiting")}
              style={{
                padding: "6px 12px",
                borderRadius: "8px",
                border: "none",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
                background: tab === "waiting" ? "#C28A3D" : "#F1F5F9",
                color: tab === "waiting" ? "white" : "#64748B",
              }}
            >
              Menunggu ({waitingList.length})
            </button>
            <button
              onClick={() => setTab("accepted")}
              style={{
                padding: "6px 12px",
                borderRadius: "8px",
                border: "none",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
                background: tab === "accepted" ? "#42654F" : "#F1F5F9",
                color: tab === "accepted" ? "white" : "#64748B",
              }}
            >
              Diterima ({acceptedList.length})
            </button>
          </div>

          {/* Quick Bulk Buttons */}
          <div style={{ display: "flex", gap: "8px" }}>
            {waitingList.length > 0 && (
              <button
                onClick={handleAcceptAll}
                disabled={loadingAction === "accept-all"}
                style={{
                  padding: "7px 14px",
                  borderRadius: "8px",
                  border: "1px solid #BBF7D0",
                  background: "#E4EFE7",
                  color: "#15803D",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  opacity: loadingAction === "accept-all" ? 0.6 : 1,
                }}
              >
                {loadingAction === "accept-all" ? "Memproses..." : " Terima Semua"}
              </button>
            )}
            {lobbyStudents.length > 0 && (
              <button
                onClick={handleStartAll}
                disabled={loadingAction === "start-all"}
                style={{
                  padding: "7px 14px",
                  borderRadius: "8px",
                  border: "none",
                  background: "linear-gradient(135deg, #1D4ED8, #2563EB)",
                  color: "white",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  boxShadow: "0 2px 8px rgba(37,99,235,0.25)",
                  opacity: loadingAction === "start-all" ? 0.6 : 1,
                }}
              >
                {loadingAction === "start-all" ? "Memulai..." : " Mulai Ujian Semua"}
              </button>
            )}
          </div>
        </div>

        {/* Student List Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px" }}>
          {displayedList.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "48px 16px",
                color: "#64748B",
              }}
            >
              <div style={{ fontSize: "36px", marginBottom: "12px" }}></div>
              <div style={{ fontSize: "15px", fontWeight: 700, color: "#1E293B" }}>
                Tidak ada peserta pada daftar ini
              </div>
              <div style={{ fontSize: "13px", color: "#94A3B8", marginTop: "4px" }}>
                Semua peserta telah diproses atau belum ada yang bergabung ke lobby.
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {displayedList.map((stu) => {
                const isWaiting = stu.status === "waiting";
                const isAccepting = loadingAction === stu.id;
                const isStarting = loadingAction === `start-${stu.id}`;

                return (
                  <div
                    key={stu.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "12px 16px",
                      borderRadius: "10px",
                      border: "1px solid #E2E8F0",
                      background: isWaiting ? "#F8EAD2" : "#F8FAFC",
                      gap: "12px",
                    }}
                  >
                    {/* Left: Avatar + Info */}
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
                      <div
                        style={{
                          width: "38px",
                          height: "38px",
                          borderRadius: "50%",
                          background: isWaiting
                            ? "linear-gradient(135deg, #F59E0B, #C28A3D)"
                            : "linear-gradient(135deg, #10B981, #059669)",
                          color: "white",
                          fontWeight: 700,
                          fontSize: "14px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        {getInitials(stu.name)}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: "14px",
                            fontWeight: 700,
                            color: "#1E293B",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {stu.name}
                        </div>
                        <div style={{ fontSize: "11px", color: "#64748B", display: "flex", alignItems: "center", gap: "6px" }}>
                          <span>NISN: {stu.nisn}</span>
                          <span>·</span>
                          <span>{new Date(stu.joinedAt).toLocaleTimeString("id-ID")}</span>
                          {stu.ipAddress && (
                            <>
                              <span>·</span>
                              <span style={{ fontFamily: "monospace", fontSize: "10px" }}>{stu.ipAddress}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Status badge & Actions */}
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 700,
                          padding: "3px 8px",
                          borderRadius: "99px",
                          background: isWaiting ? "#FEF3C7" : "#DCFCE7",
                          color: isWaiting ? "#B45309" : "#15803D",
                          border: `1px solid ${isWaiting ? "#FCD34D" : "#86EFAC"}`,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {isWaiting ? " Menunggu" : " Diterima"}
                      </span>

                      {isWaiting && (
                        <button
                          onClick={() => handleAcceptOne(stu.id)}
                          disabled={isAccepting || isStarting}
                          style={{
                            padding: "6px 10px",
                            borderRadius: "6px",
                            border: "1px solid #86EFAC",
                            background: "#E4EFE7",
                            color: "#15803D",
                            fontSize: "11px",
                            fontWeight: 700,
                            cursor: "pointer",
                            opacity: isAccepting ? 0.6 : 1,
                          }}
                        >
                          {isAccepting ? "..." : " Terima"}
                        </button>
                      )}

                      <button
                        onClick={() => handleStartOne(stu.id)}
                        disabled={isAccepting || isStarting}
                        style={{
                          padding: "6px 12px",
                          borderRadius: "6px",
                          border: "none",
                          background: isWaiting
                            ? "linear-gradient(135deg, #0284C7, #0369A1)"
                            : "linear-gradient(135deg, #10B981, #047857)",
                          color: "white",
                          fontSize: "11px",
                          fontWeight: 700,
                          cursor: "pointer",
                          opacity: isStarting ? 0.6 : 1,
                          boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
                        }}
                      >
                        {isStarting ? "..." : isWaiting ? " Terima & Mulai" : " Mulai Ujian"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: "12px 24px",
            borderTop: "1px solid #E2E8F0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "#F8FAFC",
            fontSize: "12px",
            color: "#64748B",
          }}
        >
          <span>
            {waitingList.length > 0
              ? `${waitingList.length} peserta belum disetujui`
              : "Semua peserta di lobby telah disetujui"}
          </span>
          <button
            onClick={onClose}
            style={{
              padding: "6px 14px",
              borderRadius: "6px",
              border: "1px solid #CBD5E1",
              background: "white",
              color: "#334155",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Sembunyikan Pop-Up
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Live Proctoring Drawer (Feed Log Real-Time) ──────────────────────────────
function LiveProctoringDrawer({
  isOpen,
  onClose,
  events,
  onSelectStudent,
}: {
  isOpen: boolean;
  onClose: () => void;
  events: LiveProctoringEvent[];
  onSelectStudent: (studentId: string) => void;
}) {
  const [filterType, setFilterType] = useState<string>("all");

  if (!isOpen) return null;

  const filtered = events.filter((ev) => {
    if (filterType === "all") return true;
    return ev.eventType === filterType;
  });

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 450,
        display: "flex",
        justifyContent: "flex-end",
      }}
      onClick={onClose}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(15, 24, 40, 0.35)",
          backdropFilter: "blur(2px)",
        }}
      />
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          width: 440,
          maxWidth: "92vw",
          background: "white",
          boxShadow: "-8px 0 48px rgba(15,24,40,0.18)",
          display: "flex",
          flexDirection: "column",
          zIndex: 1,
          animation: "slideIn 0.22s ease",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid #E2E8F0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "#F8FAFC",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 18 }}></span>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#0F172A" }}>
                Log Pelanggaran Proctoring
              </div>
              <div style={{ fontSize: 11, color: "#64748B" }}>
                Perekaman aktivitas real-time peserta ujian
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 20,
              color: "#64748B",
              padding: 4,
            }}
          >
            ✕
          </button>
        </div>

        {/* Filter Chips */}
        <div
          style={{
            padding: "10px 16px",
            background: "white",
            borderBottom: "1px solid #F1F5F9",
            display: "flex",
            gap: 6,
            overflowX: "auto",
            scrollbarWidth: "none",
          }}
        >
          {[
            { key: "all", label: "Semua" },
            { key: "screenshot", label: " Screenshot" },
            { key: "ip_change", label: " Ganti IP" },
            { key: "tab_switch", label: " Tab" },
            { key: "fullscreen_exit", label: " Fullscreen" },
            { key: "copy_attempt", label: " Copy" },
            { key: "devtools", label: " DevTools" },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFilterType(f.key)}
              style={{
                padding: "4px 10px",
                borderRadius: 99,
                fontSize: 11,
                fontWeight: 600,
                border: "none",
                cursor: "pointer",
                whiteSpace: "nowrap",
                background: filterType === f.key ? "#0F172A" : "#F1F5F9",
                color: filterType === f.key ? "white" : "#64748B",
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Events Feed */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 16px", color: "#94A3B8" }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}></div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Belum ada log pelanggaran</div>
              <div style={{ fontSize: 12 }}>Aktivitas pelanggaran peserta akan muncul di sini secara langsung.</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {filtered.map((ev, idx) => {
                const cfg = VIOLATION_CONFIG[ev.eventType as ViolationKey] || {
                  label: ev.eventType,
                  icon: "",
                  color: "#DC2626",
                };

                return (
                  <div
                    key={ev.id || idx}
                    onClick={() => {
                      if (ev.studentId) onSelectStudent(ev.studentId);
                    }}
                    style={{
                      padding: "10px 14px",
                      borderRadius: 10,
                      border: `1px solid ${cfg.color}25`,
                      background: `${cfg.color}08`,
                      cursor: "pointer",
                      transition: "transform 0.12s ease",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 15 }}>{cfg.icon}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: cfg.color }}>
                          {cfg.label}
                        </span>
                      </div>
                      <span style={{ fontSize: 11, color: "#64748B", fontFamily: "monospace" }}>
                        {new Date(ev.timestamp).toLocaleTimeString("id-ID", {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </span>
                    </div>

                    <div style={{ fontSize: 13, fontWeight: 600, color: "#1E293B", marginBottom: 2 }}>
                      {ev.studentName || "Peserta"}
                      {ev.nisn ? ` (NISN: ${ev.nisn})` : ""}
                    </div>

                    {/* Metadata details */}
                    {ev.eventType === "ip_change" && ev.metadata && (
                      <div
                        style={{
                          marginTop: 4,
                          fontSize: 11,
                          color: "#DC2626",
                          background: "#FEE2E2",
                          padding: "3px 8px",
                          borderRadius: 6,
                          fontFamily: "monospace",
                        }}
                      >
                         IP Lama: <strong>{ev.metadata.oldIp || "?"}</strong> IP Baru: <strong>{ev.metadata.newIp || "?"}</strong>
                      </div>
                    )}

                    {ev.eventType === "screenshot" && ev.metadata && (
                      <div
                        style={{
                          marginTop: 4,
                          fontSize: 11,
                          color: "#E11D48",
                          background: "#FFE4E6",
                          padding: "3px 8px",
                          borderRadius: 6,
                        }}
                      >
                         Metode: <strong>{ev.metadata.trigger || ev.metadata.key || "PrintScreen"}</strong>
                      </div>
                    )}

                    {ev.durationMs ? (
                      <div style={{ marginTop: 4, fontSize: 11, color: "#64748B" }}>
                        Durasi di luar: {(ev.durationMs / 1000).toFixed(1)}s
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
function MonitorPageContent() {
  const params = useParams();
  const examId = (params?.id as string) ?? "";
  const { accessToken } = useTeacherAuth();
  const [exam, setExam] = useState({
    id: examId,
    title: "Monitoring Ujian",
    accessCode: "",
    duration: 90,
    violationPolicy: {
      maxViolations: 3,
      action: "auto-lock",
      detectRightClick: true,
      detectDevTools: true,
    },
  });

  const [loading, setLoading] = useState(true);
  const [secondsLeft, setSecondsLeft] = useState(90 * 60);
  const [filter, setFilter] = useState("all");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [selectedStudent, setSelectedStudent] = useState<StudentFeedItem | null>(null);
  const [kickTargetStudent, setKickTargetStudent] = useState<StudentFeedItem | null>(null);
  const [kickToast, setKickToast] = useState<{ id: string; msg: string } | null>(null);
  const [students, setStudents] = useState<StudentFeedItem[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  // Lobby modal & real-time logging state
  const [lobbyStudents, setLobbyStudents] = useState<LobbyStudentItem[]>([]);
  const [lobbyModalOpen, setLobbyModalOpen] = useState(false);
  const [hasAutoOpenedLobby, setHasAutoOpenedLobby] = useState(false);
  const [eventsLog, setEventsLog] = useState<LiveProctoringEvent[]>([]);
  const [logDrawerOpen, setLogDrawerOpen] = useState(false);
  const [urgentToast, setUrgentToast] = useState<{
    id: string;
    type: "screenshot" | "ip_change" | "violation";
    title: string;
    desc: string;
    studentId: string;
  } | null>(null);

  // Countdown
  useEffect(() => {
    if (secondsLeft <= 0) return;
    const t = setInterval(() => setSecondsLeft(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [secondsLeft]);

  // Poll real-time dashboard data and student presence
  const fetchDashboardData = useCallback(async () => {
    if (!examId) return;
    try {
      const [dashRes, stuRes] = await Promise.all([
        apiFetch<any>(`/api/exams/${examId}/dashboard`),
        apiFetch<any>(`/api/exams/${examId}/students?pageSize=100`),
      ]);

      let eventsByStudent: Record<string, ViolationKey[]> = {};

      if (dashRes.success && dashRes.data) {
        const { exam: beExam, serverTime, recentEvents, lobbyStudents: beLobby } = dashRes.data;
        if (beExam) {
          setExam((prev) => ({
            ...prev,
            id: beExam.id || prev.id,
            title: beExam.title || prev.title,
            accessCode: beExam.accessCode || prev.accessCode,
            duration: beExam.durationMinutes || prev.duration,
            violationPolicy: {
              maxViolations: beExam.violationPolicy?.max_violations ?? prev.violationPolicy.maxViolations,
              action: beExam.violationPolicy?.action ?? prev.violationPolicy.action,
              detectRightClick: beExam.violationPolicy?.detect_right_click ?? prev.violationPolicy.detectRightClick,
              detectDevTools: beExam.violationPolicy?.detect_devtools ?? prev.violationPolicy.detectDevTools,
            },
          }));
          if (beExam.endTime && serverTime) {
            const diff = Math.max(
              0,
              Math.floor((new Date(beExam.endTime).getTime() - new Date(serverTime).getTime()) / 1000)
            );
            setSecondsLeft(diff);
          }
        }

        if (Array.isArray(beLobby)) {
          setLobbyStudents(beLobby);
          const waitingCount = beLobby.filter((s: any) => s.status === "waiting").length;
          if (waitingCount > 0 && !hasAutoOpenedLobby) {
            setLobbyModalOpen(true);
            setHasAutoOpenedLobby(true);
          }
        }

        if (Array.isArray(recentEvents)) {
          setEventsLog(recentEvents);
          recentEvents.forEach((ev: any) => {
            if (ev.studentId && ev.eventType) {
              if (!eventsByStudent[ev.studentId]) eventsByStudent[ev.studentId] = [];
              if (!eventsByStudent[ev.studentId].includes(ev.eventType)) {
                eventsByStudent[ev.studentId].push(ev.eventType);
              }
            }
          });
        }
      }

      if (stuRes.success && Array.isArray(stuRes.data?.students)) {
        const mapped: StudentFeedItem[] = stuRes.data.students.map((s: any) => {
          const activeFlags = eventsByStudent[s.id] || [];
          let status: StudentStatus = "offline";
          if (s.status === "kicked") status = "kicked";
          else if (s.isLocked) status = "blocked";
          else if (s.status === "active") status = "online";
          else if (s.status === "submitted") status = "submitted";

          return {
            studentId: s.id,
            name: s.name,
            identifier: s.nisn,
            identifierLabel: "NISN",
            status,
            activeFlags,
            violationCount: s.violationCount || 0,
            lastEventAt: s.joinedAt,
            answeredCount: typeof s.answeredCount === "number" ? s.answeredCount : s._count?.answers,
            totalQuestions: s.totalQuestions ?? (dashRes.success ? dashRes.data?.exam?.totalQuestions : undefined),
            score: s.score,
          };
        });
        setStudents(mapped);
      } else {
        setStudents([]);
      }
    } catch {
      // Keep existing data on polling error
    } finally {
      setLoading(false);
    }
  }, [examId, hasAutoOpenedLobby]);

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 8000);
    return () => clearInterval(interval);
  }, [fetchDashboardData]);

  // Real-time Socket.IO connection
  useEffect(() => {
    if (!examId || !accessToken) return;
    const socket = io("/teacher-dashboard", {
      auth: { token: accessToken },
      transports: ["websocket", "polling"],
    });

    socket.on("connect", () => {
      socket.emit("join_exam_dashboard", { examId });
    });

    socket.on("student_joined_waiting", () => {
      fetchDashboardData();
      setLobbyModalOpen(true);
    });

    socket.on("student_violation", (data: any) => {
      fetchDashboardData();
      const newEvt: LiveProctoringEvent = {
        id: data.event?.id || String(Date.now()),
        studentId: data.studentId,
        studentName: data.name,
        nisn: data.nisn,
        eventType: data.event?.eventType || "violation",
        timestamp: data.event?.timestamp || new Date().toISOString(),
        durationMs: data.event?.durationMs,
        metadata: data.event?.metadata,
      };
      setEventsLog((prev) => [newEvt, ...prev.slice(0, 99)]);

      if (newEvt.eventType === "screenshot") {
        setUrgentToast({
          id: String(Date.now()),
          type: "screenshot",
          title: " Percobaan shortcut screenshot",
          desc: `${data.name} (NISN: ${data.nisn}) mencoba melakukan tangkapan layar.`,
          studentId: data.studentId,
        });
        setTimeout(() => setUrgentToast(null), 7000);
      } else if (newEvt.eventType === "ip_change") {
        const oldIp = data.event?.metadata?.oldIp || "?";
        const newIp = data.event?.metadata?.newIp || "?";
        setUrgentToast({
          id: String(Date.now()),
          type: "ip_change",
          title: " Perubahan Alamat IP Terdeteksi!",
          desc: `${data.name} beralih IP dari ${oldIp} ke ${newIp}.`,
          studentId: data.studentId,
        });
        setTimeout(() => setUrgentToast(null), 7000);
      }
    });

    socket.on("screenshot_detected", (data: any) => {
      setUrgentToast({
        id: String(Date.now()),
        type: "screenshot",
        title: " Percobaan shortcut screenshot",
        desc: `${data.name} (NISN: ${data.nisn}) mencoba mengambil tangkapan layar.`,
        studentId: data.studentId,
      });
      setTimeout(() => setUrgentToast(null), 7000);
    });

    socket.on("student_answer_progress", (data: { studentId: string; answeredCount: number }) => {
      setStudents((prev) =>
        prev.map((s) =>
          s.studentId === data.studentId
            ? { ...s, answeredCount: data.answeredCount }
            : s
        )
      );
    });

    socket.on("student_submitted", (data: {
      studentId: string;
      name?: string;
      nisn?: string;
      score: number | null;
      answeredCount?: number;
      submittedAt?: string;
    }) => {
      setStudents((prev) =>
        prev.map((s) =>
          s.studentId === data.studentId
            ? {
                ...s,
                status: "submitted",
                score: data.score,
                answeredCount: data.answeredCount ?? s.answeredCount,
                lastEventAt: data.submittedAt ?? s.lastEventAt,
              }
            : s
        )
      );
    });

    socket.on("student_status_changed", () => {
      fetchDashboardData();
    });

    socket.on("student_presence", () => {
      fetchDashboardData();
    });

    return () => {
      socket.emit("leave_exam_dashboard", { examId });
      socket.disconnect();
    };
  }, [examId, accessToken, fetchDashboardData]);

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
  const waitingLobbyCount = lobbyStudents.filter(s => s.status === "waiting").length;
  const isTimeCritical = secondsLeft <= 5 * 60;
  const isTimeUp = secondsLeft <= 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "#F6F7F9", fontFamily: "var(--font-family)" }}>

      {/* Accent bar */}
      <div style={{ height: 4, background: "linear-gradient(90deg, #C9C3F2, #A8B4F8, #7FA9C9, #A8B4F8, #C9C3F2)", flexShrink: 0 }} />

      {/* Page Header */}
      <header className="monitor-page-header" style={{
        background: "white", borderBottom: "1px solid #E3E5EA",
        height: 48, display: "flex", alignItems: "center",
        padding: "0 24px", gap: 12, flexShrink: 0,
        position: "sticky", top: 0, zIndex: 100,
      }}>
        <Link href={examId ? `/dashboard/exams/${examId}` : "/dashboard"} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: 8, color: "#4A6678", textDecoration: "none" }} aria-label="Kembali">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
        </Link>
        <div>
          <h1 style={{ fontSize: 15, fontWeight: 700, color: "#1F2430", margin: 0, lineHeight: 1.1 }}>Proctoring – Live Feed</h1>
          <div style={{ fontSize: 11, color: "#8A8F99", marginTop: 1 }}>{exam.title}</div>
        </div>
        <div className="monitor-page-actions" style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
          {/* Ruang Tunggu / Lobby Button with popup trigger */}
          <button
            onClick={() => setLobbyModalOpen(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: waitingLobbyCount > 0 ? "#FEF3C7" : "#F1F5F9",
              border: waitingLobbyCount > 0 ? "1.5px solid #FCD34D" : "1px solid #CBD5E1",
              borderRadius: 8,
              padding: "5px 12px",
              cursor: "pointer",
              fontFamily: "var(--font-family)",
              color: waitingLobbyCount > 0 ? "#B45309" : "#334155",
              fontWeight: 700,
              fontSize: 12,
              boxShadow: waitingLobbyCount > 0 ? "0 2px 8px rgba(217,119,6,0.18)" : "none",
            }}
          >
            <span> Lobby</span>
            {lobbyStudents.length > 0 && (
              <span
                style={{
                  background: waitingLobbyCount > 0 ? "#C28A3D" : "#64748B",
                  color: "white",
                  fontSize: 10,
                  fontWeight: 700,
                  borderRadius: 99,
                  padding: "0 6px",
                  lineHeight: "16px",
                }}
              >
                {waitingLobbyCount > 0 ? `${waitingLobbyCount} Menunggu` : `${lobbyStudents.length} Peserta`}
              </span>
            )}
            {waitingLobbyCount > 0 && (
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#C28A3D" }} className="live-pulse" />
            )}
          </button>

          {/* Log Pelanggaran Drawer Trigger */}
          <button
            onClick={() => setLogDrawerOpen(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "#F8FAFC",
              border: "1px solid #CBD5E1",
              borderRadius: 8,
              padding: "5px 12px",
              cursor: "pointer",
              fontFamily: "var(--font-family)",
              color: "#1E293B",
              fontWeight: 700,
              fontSize: 12,
            }}
          >
            <span> Log Proctoring</span>
            {eventsLog.length > 0 && (
              <span
                style={{
                  background: "#0F172A",
                  color: "white",
                  fontSize: 10,
                  fontWeight: 700,
                  borderRadius: 99,
                  padding: "0 6px",
                  lineHeight: "16px",
                }}
              >
                {eventsLog.length}
              </span>
            )}
          </button>

          {/* Blocked alert */}
          {blockedCount > 0 && (
            <button onClick={() => setFilter("blocked")} style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "#FEE2E2", border: "1px solid #FECACA", borderRadius: 8,
              padding: "4px 10px", cursor: "pointer", fontFamily: "var(--font-family)",
            }}>
              <span style={{ fontSize: 12 }}></span>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#DC2626" }}>{blockedCount} Diblokir</span>
            </button>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#42654F", display: "inline-block" }} className="live-pulse" />
            <span style={{ fontSize: 12, fontWeight: 600, color: "#42654F" }}>Live</span>
          </div>
          {loading ? (
            <SkeletonBase width="140px" height="14px" borderRadius="4px" />
          ) : (
            <span style={{ fontSize: 12, color: "#8A8F99" }}>
              <span style={{ color: "#42654F", fontWeight: 600 }}>{onlineCount}</span> online · <span style={{ color: "#9CA3AF" }}>{offlineCount}</span> offline · {students.length} total
            </span>
          )}
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
          { label: "Deteksi Klik Kanan", value: exam.violationPolicy.detectRightClick ? "Aktif" : "Nonaktif", active: exam.violationPolicy.detectRightClick },
          { label: "Deteksi DevTools",   value: exam.violationPolicy.detectDevTools ? "Aktif" : "Nonaktif", active: exam.violationPolicy.detectDevTools },
        ].map(meta => (
          <div key={meta.label} style={{ borderLeft: "1px solid #E3E5EA", padding: "0 16px", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div style={{ fontSize: 10, color: "#8A8F99", lineHeight: 1.2, marginBottom: 2 }}>{meta.label}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: meta.active ? "#42654F" : "#9CA3AF", lineHeight: 1.2 }}>{meta.value}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="monitor-page-toolbar" style={{
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
          <span style={{ fontSize: 12, color: filter === "blocked" ? "#DC2626" : "#4A6678", fontWeight: filter === "blocked" ? 700 : 400 }}> Diblokir</span>
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
          <span style={{ fontSize: 12, color: filter === "offline" ? "#6B7280" : "#4A6678", fontWeight: filter === "offline" ? 700 : 400 }}> Offline</span>
          {offlineCount > 0 && <span style={{ fontSize: 10, fontWeight: 700, background: "#9CA3AF", color: "white", borderRadius: 99, padding: "0 5px", lineHeight: "16px" }}>{offlineCount}</span>}
        </button>

        <div style={{ width: 1, height: 20, background: "#E3E5EA", flexShrink: 0 }} />

        {/* Violation legend buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {["screenshot", "ip_change", "tab_switch", "fullscreen_exit", "copy_attempt", "window_blur", "devtools", "right_click"].map((key) => {
            const cfg = VIOLATION_CONFIG[key];
            if (!cfg) return null;
            const count = countByViolation(key as ViolationKey);
            const active = filter === key;
            return (
              <button key={key} onClick={() => handleLegendClick(key as ViolationKey)} aria-pressed={active}
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
                      color: filter === opt.value ? "#4F6B80" : "#1F2430",
                      fontWeight: filter === opt.value ? 600 : 400,
                      background: filter === opt.value ? "#DCE8F0" : "transparent",
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
          Waktu habis! Ujian telah berakhir.
        </div>
      )}

      {/* Content Area */}
      <div style={{ flex: 1, padding: 20, overflowY: "auto" }}>
        {loading ? (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <SkeletonBase width="180px" height="14px" borderRadius="4px" />
              <SkeletonBase width="80px" height="14px" borderRadius="4px" />
            </div>
            {viewMode === "grid" ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 14 }}>
                {Array.from({ length: 12 }).map((_, i) => (
                  <div
                    key={i}
                    style={{
                      position: "relative",
                      background: "white",
                      border: "2px solid #F1F5F9",
                      borderRadius: 8,
                      padding: "10px 10px 12px",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      minHeight: 140,
                      boxShadow: "0 2px 8px rgba(20,24,40,0.06)",
                    }}
                  >
                    <div style={{ marginTop: 18, marginBottom: 8 }}>
                      <SkeletonBase width="44px" height="44px" borderRadius="50%" />
                    </div>
                    <SkeletonBase width="70%" height="12px" borderRadius="4px" style={{ marginBottom: 6 }} />
                    <SkeletonBase width="50%" height="10px" borderRadius="4px" style={{ marginBottom: 10 }} />
                    <SkeletonBase width="60px" height="18px" borderRadius="99px" />
                  </div>
                ))}
              </div>
            ) : (
              <SkeletonTable rows={8} cols={6} />
            )}
          </div>
        ) : students.length === 0 ? (
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            padding: "56px 24px", background: "white", borderRadius: 12, border: "1px solid #E3E5EA",
            boxShadow: "0 2px 8px rgba(20,24,40,0.04)", textAlign: "center", maxWidth: 520, margin: "32px auto 0"
          }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#DCE8F0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, marginBottom: 16 }}>
              
            </div>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: "#1F2430", margin: "0 0 8px" }}>
              Belum Ada Peserta yang Bergabung
            </h3>
            <p style={{ fontSize: 13, color: "#6B7280", margin: "0 0 18px", maxWidth: 400, lineHeight: 1.5 }}>
              Peserta yang memasukkan kode ujian dan mulai mengerjakan akan otomatis muncul di layar pemantauan ini secara real-time.
            </p>
            {exam.accessCode && (
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 16px",
                background: "#F8FAFC", border: "1px dashed #CBD5E1", borderRadius: 8, marginBottom: 20
              }}>
                <span style={{ fontSize: 12, color: "#64748B" }}>Kode Akses:</span>
                <span style={{ fontSize: 16, fontWeight: 800, color: "#0284C7", letterSpacing: "0.08em", fontFamily: "var(--font-mono, monospace)" }}>
                  {exam.accessCode}
                </span>
              </div>
            )}
            <button
              onClick={() => { setLoading(true); fetchDashboardData(); }}
              style={{
                padding: "8px 18px", borderRadius: 8, background: "#4F6B80", color: "white",
                border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-family)"
              }}
            >
               Segarkan Data
            </button>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 12, color: "#8A8F99", marginBottom: 12, display: "flex", alignItems: "center", gap: 0 }}>
              Menampilkan {filteredStudents.length} dari {students.length} peserta
              {filter !== "all" && (
                <button onClick={() => setFilter("all")} style={{ marginLeft: 10, color: "#4F6B80", background: "none", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "var(--font-family)" }}>
                  Tampilkan semua →
                </button>
              )}
            </div>

            {filteredStudents.length === 0 ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "64px 24px", gap: 12 }}>
                <div style={{ fontSize: 40 }}></div>
                <div style={{ fontSize: 16, fontWeight: 600, color: "#1F2430" }}>Tidak ada peserta yang sesuai filter</div>
                <button onClick={() => setFilter("all")} style={{ padding: "9px 20px", background: "#4F6B80", color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-family)" }}>
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
                  <span style={{ flex: 1.5, minWidth: 120 }}>Progres / Nilai</span>
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
          </>
        )}
      </div>

      {/* Detail Panel */}
      {selectedStudent && (
        <DetailPanel
          examId={examId}
          student={students.find((s) => s.studentId === selectedStudent.studentId) || selectedStudent}
          onClose={() => setSelectedStudent(null)}
          onActionDone={fetchDashboardData}
          onRequestKick={(stu) => setKickTargetStudent(stu)}
        />
      )}

      {/* Kick Double Confirm Modal */}
      <KickDoubleConfirmModal
        examId={examId}
        student={kickTargetStudent}
        isOpen={!!kickTargetStudent}
        onClose={() => setKickTargetStudent(null)}
        onSuccess={() => {
          const kickedName = kickTargetStudent?.name || "Peserta";
          setKickTargetStudent(null);
          setSelectedStudent(null);
          fetchDashboardData();
          setKickToast({ id: String(Date.now()), msg: `Siswa ${kickedName} berhasil dikeluarkan dari ujian.` });
          setTimeout(() => setKickToast(null), 5000);
        }}
      />

      {/* Lobby Approval Pop-Up Modal */}
      <LobbyApprovalModal
        examId={examId}
        isOpen={lobbyModalOpen}
        onClose={() => setLobbyModalOpen(false)}
        lobbyStudents={lobbyStudents}
        onRefresh={fetchDashboardData}
      />

      {/* Live Proctoring Event Log Drawer */}
      <LiveProctoringDrawer
        isOpen={logDrawerOpen}
        onClose={() => setLogDrawerOpen(false)}
        events={eventsLog}
        onSelectStudent={(sid) => {
          const stu = students.find((s) => s.studentId === sid);
          if (stu) {
            setSelectedStudent(stu);
            setLogDrawerOpen(false);
          }
        }}
      />

      {/* Urgent Violation Toast (Screenshot & IP Change) */}
      {urgentToast && (
        <div
          style={{
            position: "fixed",
            top: 56,
            right: 24,
            zIndex: 600,
            background: urgentToast.type === "screenshot" ? "#FFF1F2" : "#FEF2F2",
            border: `2px solid ${urgentToast.type === "screenshot" ? "#E11D48" : "#DC2626"}`,
            borderRadius: 12,
            padding: "14px 18px",
            boxShadow: "0 10px 30px rgba(0,0,0,0.18)",
            maxWidth: 380,
            animation: "slideIn 0.2s ease",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: urgentToast.type === "screenshot" ? "#BE123C" : "#991B1B" }}>
                {urgentToast.title}
              </div>
              <div style={{ fontSize: 12, color: "#1F2430", marginTop: 4, lineHeight: 1.4 }}>
                {urgentToast.desc}
              </div>
            </div>
            <button
              onClick={() => setUrgentToast(null)}
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#64748B" }}
            >
              ✕
            </button>
          </div>
          <div style={{ marginTop: 8, display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button
              onClick={() => {
                const stu = students.find((s) => s.studentId === urgentToast.studentId);
                if (stu) setSelectedStudent(stu);
                setUrgentToast(null);
              }}
              style={{
                padding: "4px 10px",
                background: urgentToast.type === "screenshot" ? "#E11D48" : "#DC2626",
                color: "white",
                border: "none",
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Periksa Peserta →
            </button>
          </div>
        </div>
      )}

      {/* Kick Success Toast */}
      {kickToast && (
        <div
          style={{
            position: "fixed",
            top: 56,
            right: 24,
            zIndex: 600,
            background: "#E4EFE7",
            border: "1.5px solid #86EFAC",
            borderRadius: 12,
            padding: "14px 18px",
            boxShadow: "0 10px 30px rgba(0,0,0,0.14)",
            maxWidth: 380,
            display: "flex",
            alignItems: "center",
            gap: 12,
            animation: "slideIn 0.2s ease",
            fontFamily: "var(--font-family)",
          }}
        >
          <span style={{ fontSize: 20 }}></span>
          <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "#166534" }}>
            {kickToast.msg}
          </div>
          <button
            onClick={() => setKickToast(null)}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#15803D" }}
          >
            ✕
          </button>
        </div>
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
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.95); }
          to   { opacity: 1; transform: scale(1); }
        }
        button:focus-visible { outline: 2px solid #4F6B80; outline-offset: 2px; }
      `}</style>
    </div>
  );
}

export default function MonitorPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24, textAlign: "center" }}>Memuat Monitor Ujian...</div>}>
      <MonitorPageContent />
    </Suspense>
  );
}
