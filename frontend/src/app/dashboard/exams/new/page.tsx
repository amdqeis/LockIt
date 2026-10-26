"use client";

import { useState, useRef, useCallback, useEffect, useId } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import DashboardShell from "@/app/components/DashboardShell";
import { mockQuestionBanks, QuestionBank } from "@/lib/mockData";

// ─── Design tokens (spec §10) ─────────────────────────────────────────────────
const T = {
  bgPage:        "#F6F8FB",
  bgCard:        "#FFFFFF",
  bgSubtle:      "#F0F3F8",
  border:        "#E1E6ED",
  borderInput:   "#8391A7",
  textPrimary:   "#172033",
  textSecondary: "#5B6778",
  textPlaceholder:"#6B7788",
  primary:       "#1B76BF",
  primaryHover:  "#155E99",
  primaryActive: "#114E80",
  primaryTint:   "#E6F1FA",
  primaryTintBorder: "#9CC7EA",
  primaryRing:   "rgba(27,118,191,0.25)",
  success:       "#177A4B",
  warningText:   "#9A5B00",
  warningBg:     "#FFF4DB",
  danger:        "#C73E3E",
  dangerBg:      "#FCE9E9",
  toggleOff:     "#8391A7",
  radiusCard:    "8px",
  radiusControl: "8px",
  shadowCard:    "0 2px 8px rgba(20,24,40,0.08)",
  shadowBar:     "0 -2px 8px rgba(20,24,40,0.06)",
};

// ─── SVG line icons ────────────────────────────────────────────────────────────
function IconInfo() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="16" x2="12" y2="12"/>
      <line x1="12" y1="8" x2="12.01" y2="8"/>
    </svg>
  );
}
function IconLibrary() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
    </svg>
  );
}
function IconSliders() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/>
      <line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/>
      <line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/>
      <line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/>
      <line x1="17" y1="16" x2="23" y2="16"/>
    </svg>
  );
}
function IconCalendar() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
      <circle cx="12" cy="16" r="1.5" fill="currentColor"/>
    </svg>
  );
}
function IconShield() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      <polyline points="9 12 11 14 15 10"/>
    </svg>
  );
}
function IconSearch() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/>
      <line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  );
}
function IconArrowLeft() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12"/>
      <polyline points="12 19 5 12 12 5"/>
    </svg>
  );
}
function IconAlert() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="8" x2="12" y2="12"/>
      <line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────
type SectionKey = "informasi" | "bank" | "pengaturan" | "jadwal" | "kebijakan";
type SectionStatus = "valid" | "incomplete" | "error";

interface FormState {
  title: string;
  description: string;
  duration: number;
  shuffleQuestions: boolean;
  displayMode: "one_by_one" | "all_at_once";
  shuffleChoices: boolean;
  allowBackNavigation: boolean;
  startsAt: string;
  endsAt: string;
  audienceIds: string[];
  passingScore: string;
  maxViolations: number;
  actionAtLimit: "warn" | "lock" | "auto_end";
  detectCopyPaste: boolean;
  detectRightClick: boolean;
  detectDevTools: boolean;
  detectTabSwitch: boolean;
  detectFullscreenExit: boolean;
}

// ─── Shared control styles ────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  height: "44px",
  borderRadius: T.radiusControl,
  border: `1px solid ${T.borderInput}`,
  padding: "0 14px",
  fontSize: "14px",
  fontFamily: "inherit",
  color: T.textPrimary,
  background: T.bgCard,
  width: "100%",
  outline: "none",
  transition: "border-color 150ms, box-shadow 150ms",
};
const labelStyle: React.CSSProperties = {
  fontSize: "13px",
  fontWeight: 500,
  color: T.textPrimary,
  display: "block",
  marginBottom: "6px",
};
const helperStyle: React.CSSProperties = {
  fontSize: "12px",
  color: T.textSecondary,
  marginTop: "6px",
  lineHeight: "18px",
};
const errorStyle: React.CSSProperties = {
  fontSize: "12px",
  color: T.danger,
  marginTop: "6px",
  display: "flex",
  alignItems: "center",
  gap: "4px",
  lineHeight: "18px",
};
const cardStyle: React.CSSProperties = {
  background: T.bgCard,
  border: `1px solid ${T.border}`,
  borderRadius: T.radiusCard,
  boxShadow: T.shadowCard,
  padding: "24px",
};
const sectionTitleStyle: React.CSSProperties = {
  fontSize: "16px",
  fontWeight: 600,
  color: T.textPrimary,
  display: "flex",
  alignItems: "center",
  gap: "8px",
  marginBottom: "20px",
};

// ─── Toggle row component ──────────────────────────────────────────────────────
function ToggleRow({
  id, label, helper, checked, onChange, disabled,
}: { id: string; label: string; helper?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label
      htmlFor={id}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: T.bgCard,
        border: `1px solid ${T.border}`,
        borderRadius: T.radiusControl,
        padding: "16px",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        gap: "16px",
        userSelect: "none",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "14px", fontWeight: 500, color: T.textPrimary, lineHeight: "20px" }}>{label}</div>
        {helper && <div style={{ fontSize: "12px", color: T.textSecondary, marginTop: "2px", lineHeight: "18px" }}>{helper}</div>}
      </div>
      {/* Switch */}
      <div style={{ position: "relative", flexShrink: 0 }}>
        <input
          id={id}
          type="checkbox"
          role="switch"
          aria-checked={checked}
          checked={checked}
          disabled={disabled}
          onChange={e => onChange(e.target.checked)}
          style={{ position: "absolute", opacity: 0, width: 0, height: 0 }}
        />
        <div
          onClick={e => { e.preventDefault(); if (!disabled) onChange(!checked); }}
          style={{
            width: "40px", height: "24px",
            borderRadius: "99px",
            background: checked ? T.primary : T.toggleOff,
            position: "relative",
            transition: "background 150ms",
            cursor: disabled ? "not-allowed" : "pointer",
          }}
        >
          <div style={{
            position: "absolute",
            top: "3px",
            left: checked ? "19px" : "3px",
            width: "18px", height: "18px",
            borderRadius: "50%",
            background: "#FFFFFF",
            boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
            transition: "left 150ms",
          }} />
        </div>
      </div>
    </label>
  );
}

// ─── Status dot ───────────────────────────────────────────────────────────────
function StatusDot({ status }: { status: SectionStatus }) {
  const map = {
    valid:      { bg: "#177A4B", border: "#177A4B" },
    incomplete: { bg: "transparent", border: "#8391A7" },
    error:      { bg: "#C73E3E", border: "#C73E3E" },
  };
  const s = map[status];
  return (
    <span aria-hidden="true" style={{
      display: "inline-block",
      width: "10px", height: "10px",
      borderRadius: "50%",
      background: s.bg,
      border: `2px solid ${s.border}`,
      flexShrink: 0,
    }} />
  );
}

// ─── Skeleton row ─────────────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <div style={{ padding: "16px", border: `1px solid ${T.border}`, borderRadius: "8px", display: "flex", gap: "12px", alignItems: "center" }}>
      <div style={{ width: "18px", height: "18px", borderRadius: "50%", background: T.bgSubtle }} />
      <div style={{ flex: 1 }}>
        <div style={{ height: "14px", borderRadius: "4px", background: T.bgSubtle, width: "55%", marginBottom: "6px" }} />
        <div style={{ height: "12px", borderRadius: "4px", background: T.bgSubtle, width: "35%" }} />
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ height: "13px", borderRadius: "4px", background: T.bgSubtle, width: "60px", marginBottom: "4px" }} />
        <div style={{ height: "12px", borderRadius: "4px", background: T.bgSubtle, width: "50px" }} />
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function NewExamPage() {
  const router = useRouter();
  const uid = useId();

  const [form, setForm] = useState<FormState>({
    title: "",
    description: "",
    duration: 90,
    shuffleQuestions: false,
    displayMode: "one_by_one",
    shuffleChoices: false,
    allowBackNavigation: true,
    startsAt: "",
    endsAt: "",
    audienceIds: [],
    passingScore: "",
    maxViolations: 3,
    actionAtLimit: "warn",
    detectCopyPaste: true,
    detectRightClick: true,
    detectDevTools: true,
    detectTabSwitch: true,
    detectFullscreenExit: true,
  });

  const set = useCallback(<K extends keyof FormState>(key: K, val: FormState[K]) => {
    setForm(f => ({ ...f, [key]: val }));
    setIsDirty(true);
  }, []);

  // Bank soal state
  const [selectedBank, setSelectedBank] = useState<QuestionBank | null>(null);
  const [bankSearch, setBankSearch] = useState("");
  const [bankFilter, setBankFilter] = useState("all");
  const [bankVisible, setBankVisible] = useState(5);
  const [bankLoading] = useState(false);

  // UI state
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [leaveTarget, setLeaveTarget] = useState<string | null>(null);

  // Refs for scroll-to-section
  const refs = {
    informasi: useRef<HTMLDivElement>(null),
    bank:      useRef<HTMLDivElement>(null),
    pengaturan:useRef<HTMLDivElement>(null),
    jadwal:    useRef<HTMLDivElement>(null),
    kebijakan: useRef<HTMLDivElement>(null),
  };

  // Unsaved-changes guard
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) { e.preventDefault(); e.returnValue = ""; }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // ── Derived state ──────────────────────────────────────────────────────────
  const subjects = ["all", ...Array.from(new Set(mockQuestionBanks.filter(b => b.status === "active").map(b => b.subject)))];

  const filteredBanks = mockQuestionBanks
    .filter(b => b.status === "active")
    .filter(b => bankFilter === "all" || b.subject === bankFilter)
    .filter(b => {
      const q = bankSearch.toLowerCase();
      return !q || b.title.toLowerCase().includes(q) || b.subject.toLowerCase().includes(q) || b.tags.some(t => t.toLowerCase().includes(q));
    });

  const visibleBanks = filteredBanks.slice(0, bankVisible);
  const totalFiltered = filteredBanks.length;

  // Section statuses for summary panel
  const getSectionStatus = (key: SectionKey): SectionStatus => {
    switch (key) {
      case "informasi":
        if (errors.title || errors.duration) return "error";
        if (!form.title) return "incomplete";
        return "valid";
      case "bank":
        if (errors.bank) return "error";
        if (!selectedBank) return "incomplete";
        return "valid";
      case "pengaturan":
        return "valid";
      case "jadwal":
        if (errors.startsAt || errors.endsAt || errors.audience) return "error";
        if (!form.startsAt || !form.endsAt) return "incomplete";
        return "valid";
      case "kebijakan":
        return "valid";
    }
  };

  const sectionLabels: Record<SectionKey, string> = {
    informasi:  "Informasi dasar",
    bank:       "Bank soal",
    pengaturan: "Pengaturan soal",
    jadwal:     "Jadwal & peserta",
    kebijakan:  "Kebijakan pelanggaran",
  };

  const statusLabels: Record<SectionStatus, string> = {
    valid:      "Lengkap",
    incomplete: "Belum lengkap",
    error:      "Ada kesalahan",
  };

  // ── Violation helper text ──────────────────────────────────────────────────
  const violationHelpers: Record<FormState["actionAtLimit"], string> = {
    warn:     `Pada pelanggaran ke-${form.maxViolations}, peserta mendapat peringatan.`,
    lock:     `Pada pelanggaran ke-${form.maxViolations}, ujian peserta dikunci sampai pengawas membukanya.`,
    auto_end: `Pada pelanggaran ke-${form.maxViolations}, ujian peserta diakhiri dan jawaban yang sudah ada langsung dinilai.`,
  };

  const allDetectionsOff = !form.detectCopyPaste && !form.detectRightClick && !form.detectDevTools && !form.detectTabSwitch && !form.detectFullscreenExit;

  // ── Validation ──────────────────────────────────────────────────────────────
  const validate = (mode: "draft" | "save") => {
    const e: Record<string, string> = {};
    if (!form.title.trim()) e.title = "Judul ujian wajib diisi.";
    else if (form.title.trim().length < 3) e.title = "Judul ujian minimal 3 karakter.";
    if (form.duration < 1 || form.duration > 600) e.duration = "Durasi harus antara 1 dan 600 menit.";

    if (mode === "save") {
      if (!selectedBank) e.bank = "Pilih satu bank soal.";
      if (!form.startsAt) e.startsAt = "Jadwal mulai wajib diisi.";
      if (!form.endsAt) e.endsAt = "Jadwal selesai wajib diisi.";
      if (form.startsAt && form.endsAt) {
        const start = new Date(form.startsAt).getTime();
        const end   = new Date(form.endsAt).getTime();
        if (end - start < form.duration * 60 * 1000)
          e.endsAt = "Rentang waktu lebih pendek dari durasi ujian.";
      }
    }
    return e;
  };

  const handleSubmit = async (mode: "save") => {
    const errs = validate(mode);
    if (Object.keys(errs).length) {
      setErrors(errs);
      // Focus first error
      const firstKey = Object.keys(errs)[0];
      const sectionMap: Record<string, SectionKey> = { title: "informasi", duration: "informasi", bank: "bank", startsAt: "jadwal", endsAt: "jadwal", audience: "jadwal" };
      const section = sectionMap[firstKey];
      if (section && refs[section].current) {
        refs[section].current.scrollIntoView({ behavior: "smooth", block: "start" });
        refs[section].current.focus();
      }
      return;
    }
    setErrors({});
    setSaving(true);
    await new Promise(r => setTimeout(r, 1200));
    setSaving(false);
    setIsDirty(false);
    setToast({ type: "success", msg: "Ujian disimpan." });
    setTimeout(() => { setToast(null); router.push("/dashboard"); }, 2000);
  };

  const tryNavigate = (href: string) => {
    if (isDirty) { setLeaveTarget(href); setShowLeaveDialog(true); }
    else router.push(href);
  };

  const focusStyle = `
    input:focus, textarea:focus, select:focus {
      border-color: ${T.primary} !important;
      box-shadow: 0 0 0 3px ${T.primaryRing} !important;
      outline: none !important;
    }
    :focus-visible {
      outline: 2px solid ${T.primary} !important;
      outline-offset: 2px !important;
    }
    .bank-row:hover { background: ${T.bgSubtle} !important; }
    .bank-row.selected { background: ${T.primaryTint} !important; border-color: ${T.primary} !important; }
    .radio-card:hover { background: ${T.bgSubtle} !important; }
    .radio-card.selected { background: ${T.primaryTint} !important; border-color: ${T.primary} !important; }
    @media (max-width: 1199px) { .summary-panel { display: none !important; } }
    @media (max-width: 767px) { .form-grid-2 { flex-direction: column !important; } }
    @media (max-width: 639px) {
      .radio-cards { flex-direction: column !important; }
      .action-bar-inner { flex-direction: column-reverse !important; align-items: stretch !important; }
      .action-bar-inner > * { width: 100% !important; justify-content: center !important; }
    }
    .btn-text:hover { color: ${T.textPrimary} !important; }
    .btn-outline:hover { background: ${T.primaryTint} !important; }
    .btn-solid:hover { background: ${T.primaryHover} !important; }
    input[type=number]::-webkit-inner-spin-button { opacity: 1; }
  `;

  // ── Summary panel data ────────────────────────────────────────────────────
  const displayTitle = form.title.trim() || null;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <DashboardShell>
      <style>{focusStyle}</style>

      {/* Page background */}
      <div style={{ background: T.bgPage, minHeight: "100vh", paddingBottom: "100px" }}>

        {/* ── Page header ─────────────────────────────────────────────────── */}
        <div style={{ background: T.bgPage, padding: "24px 32px 0", maxWidth: "1240px" }}>
          {/* Breadcrumb */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: T.textSecondary, marginBottom: "12px" }}>
            <Link href="/dashboard" style={{ color: T.textSecondary, textDecoration: "none" }}>Dashboard</Link>
            <span style={{ color: T.border }}>›</span>
            <span style={{ color: T.textPrimary }}>Buat ujian baru</span>
          </div>

          {/* Title row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <button
                type="button"
                onClick={() => tryNavigate("/dashboard")}
                aria-label="Kembali ke daftar ujian"
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  width: "36px", height: "36px",
                  border: `1px solid ${T.border}`, borderRadius: "8px",
                  background: T.bgCard, cursor: "pointer", color: T.textSecondary,
                  flexShrink: 0,
                }}
              >
                <IconArrowLeft />
              </button>
              <h1 style={{ fontSize: "26px", lineHeight: "32px", fontWeight: 600, color: T.textPrimary, margin: 0 }}>
                Buat ujian baru
              </h1>
            </div>
            <span style={{ fontSize: "12px", color: T.textSecondary }}>* wajib diisi</span>
          </div>
        </div>

        {/* ── Two-column layout ────────────────────────────────────────────── */}
        <div style={{ display: "flex", gap: "24px", padding: "0 32px", maxWidth: "1240px", alignItems: "flex-start" }}>

          {/* ── Form column ─────────────────────────────────────────────── */}
          <div style={{ flex: 1, minWidth: 0, maxWidth: "720px", display: "flex", flexDirection: "column", gap: "20px" }}>

            {/* ── Error summary (on failed submit) ─────────────────────── */}
            {Object.keys(errors).length > 0 && (
              <div role="alert" style={{ background: T.dangerBg, border: `1px solid ${T.danger}`, borderRadius: T.radiusCard, padding: "16px 20px" }}>
                <div style={{ fontSize: "14px", fontWeight: 600, color: T.danger, marginBottom: "8px" }}>Ada kolom yang perlu dilengkapi:</div>
                <ul style={{ margin: 0, paddingLeft: "18px", display: "flex", flexDirection: "column", gap: "4px" }}>
                  {Object.entries(errors).map(([k, v]) => (
                    <li key={k} style={{ fontSize: "13px", color: T.danger }}>{v}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* ─────────────────────────────────────────────────────────── */}
            {/* Section 1: Informasi dasar                                  */}
            {/* ─────────────────────────────────────────────────────────── */}
            <section aria-labelledby="sec-informasi" ref={refs.informasi} tabIndex={-1} style={{ ...cardStyle }}>
              <h2 id="sec-informasi" style={sectionTitleStyle}>
                <span style={{ color: T.primary }}><IconInfo /></span>
                Informasi dasar
              </h2>

              {/* Judul */}
              <div style={{ marginBottom: "20px" }}>
                <label htmlFor={`${uid}-title`} style={labelStyle}>
                  Judul ujian <span aria-hidden="true" style={{ color: T.danger }}>*</span>
                </label>
                <input
                  id={`${uid}-title`}
                  type="text"
                  style={{ ...inputStyle, borderColor: errors.title ? T.danger : T.borderInput }}
                  placeholder="UTS Pemrograman Web 2026"
                  value={form.title}
                  onChange={e => set("title", e.target.value)}
                  onBlur={() => {
                    if (!form.title.trim()) setErrors(p => ({ ...p, title: "Judul ujian wajib diisi." }));
                    else setErrors(p => { const n = { ...p }; delete n.title; return n; });
                  }}
                  maxLength={120}
                  aria-required="true"
                  aria-invalid={!!errors.title}
                  aria-describedby={errors.title ? `${uid}-title-err` : undefined}
                />
                {errors.title && (
                  <div id={`${uid}-title-err`} role="alert" style={errorStyle}>
                    <IconAlert />{errors.title}
                  </div>
                )}
              </div>

              {/* Deskripsi */}
              <div style={{ marginBottom: "20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "6px" }}>
                  <label htmlFor={`${uid}-desc`} style={{ ...labelStyle, marginBottom: 0 }}>Deskripsi</label>
                  <span style={{ fontSize: "12px", color: T.textSecondary, fontStyle: "italic" }}>Opsional</span>
                </div>
                <textarea
                  id={`${uid}-desc`}
                  style={{
                    ...inputStyle,
                    height: "auto",
                    minHeight: "112px",
                    padding: "12px 14px",
                    resize: "vertical",
                    lineHeight: "22px",
                  } as React.CSSProperties}
                  placeholder="Deskripsi singkat ujian ini..."
                  value={form.description}
                  onChange={e => set("description", e.target.value)}
                  maxLength={1000}
                  rows={4}
                  aria-describedby={`${uid}-desc-count`}
                />
                <div id={`${uid}-desc-count`} style={{ ...helperStyle, textAlign: "right" }}>{form.description.length}/1000</div>
              </div>

              {/* Durasi */}
              <div style={{ maxWidth: "200px" }}>
                <label htmlFor={`${uid}-dur`} style={labelStyle}>
                  Durasi <span aria-hidden="true" style={{ color: T.danger }}>*</span>
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    id={`${uid}-dur`}
                    type="number"
                    style={{
                      ...inputStyle,
                      paddingRight: "52px",
                      borderColor: errors.duration ? T.danger : T.borderInput,
                    }}
                    min={1}
                    max={600}
                    step={5}
                    value={form.duration}
                    onChange={e => set("duration", parseInt(e.target.value) || 1)}
                    aria-required="true"
                    aria-invalid={!!errors.duration}
                    aria-describedby={errors.duration ? `${uid}-dur-err` : `${uid}-dur-hint`}
                  />
                  <span style={{
                    position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)",
                    fontSize: "13px", color: T.textSecondary, pointerEvents: "none",
                  }}>menit</span>
                </div>
                {errors.duration
                  ? <div id={`${uid}-dur-err`} role="alert" style={errorStyle}><IconAlert />{errors.duration}</div>
                  : <div id={`${uid}-dur-hint`} style={helperStyle}>1–600 menit</div>
                }
              </div>
            </section>

            {/* ─────────────────────────────────────────────────────────── */}
            {/* Section 2: Bank soal                                        */}
            {/* ─────────────────────────────────────────────────────────── */}
            <section aria-labelledby="sec-bank" ref={refs.bank} tabIndex={-1} style={{ ...cardStyle }}>
              <h2 id="sec-bank" style={sectionTitleStyle}>
                <span style={{ color: T.primary }}><IconLibrary /></span>
                Bank soal
              </h2>

              {/* Toolbar */}
              <div style={{ display: "flex", gap: "12px", marginBottom: "16px", flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: "180px", position: "relative" }}>
                  <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: T.textSecondary, pointerEvents: "none" }}>
                    <IconSearch />
                  </span>
                  <input
                    type="search"
                    style={{ ...inputStyle, paddingLeft: "36px" }}
                    placeholder="Cari bank soal"
                    value={bankSearch}
                    onChange={e => { setBankSearch(e.target.value); setBankVisible(5); }}
                    aria-label="Cari bank soal"
                  />
                </div>
                <select
                  style={{ ...inputStyle, width: "auto", minWidth: "160px", cursor: "pointer" }}
                  value={bankFilter}
                  onChange={e => { setBankFilter(e.target.value); setBankVisible(5); }}
                  aria-label="Filter mata pelajaran"
                >
                  <option value="all">Semua mata pelajaran</option>
                  {subjects.filter(s => s !== "all").map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* Bank list */}
              {errors.bank && (
                <div role="alert" style={{ ...errorStyle, marginBottom: "12px" }}><IconAlert />{errors.bank}</div>
              )}

              {bankLoading ? (
                <div role="status" aria-label="Memuat bank soal" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {[1,2,3,4,5].map(i => <SkeletonRow key={i} />)}
                </div>
              ) : filteredBanks.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 24px", color: T.textSecondary, fontSize: "14px" }}>
                  {bankSearch
                    ? <>
                        Tidak ada bank soal untuk &ldquo;{bankSearch}&rdquo;.{" "}
                        <button
                          type="button"
                          onClick={() => setBankSearch("")}
                          style={{ background: "none", border: "none", color: T.primary, fontSize: "14px", cursor: "pointer", padding: 0, fontWeight: 500 }}
                        >
                          Hapus pencarian
                        </button>
                      </>
                    : <>
                        Belum ada bank soal. Buat bank soal dulu supaya bisa dipakai di ujian.{" "}
                        <Link href="/dashboard/question-bank" style={{ color: T.primary, fontWeight: 500 }}>Buat bank soal</Link>
                      </>
                  }
                </div>
              ) : (
                <>
                  <div role="radiogroup" aria-labelledby="sec-bank" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {visibleBanks.map(bank => {
                      const isSelected = selectedBank?.id === bank.id;
                      const extraTags = bank.tags.length - 3;
                      return (
                        <label
                          key={bank.id}
                          className={`bank-row${isSelected ? " selected" : ""}`}
                          style={{
                            display: "flex",
                            alignItems: "flex-start",
                            gap: "12px",
                            padding: "14px 16px",
                            border: `1px solid ${isSelected ? T.primary : T.border}`,
                            borderRadius: "8px",
                            cursor: "pointer",
                            background: isSelected ? T.primaryTint : T.bgCard,
                            minHeight: "72px",
                            transition: "background 150ms, border-color 150ms",
                          }}
                        >
                          {/* Radio */}
                          <input
                            type="radio"
                            name="bank-soal"
                            value={bank.id}
                            checked={isSelected}
                            onChange={() => {
                              setSelectedBank(bank);
                              setIsDirty(true);
                              setErrors(p => { const n = { ...p }; delete n.bank; return n; });
                            }}
                            style={{ marginTop: "2px", accentColor: T.primary, width: "18px", height: "18px", flexShrink: 0 }}
                          />
                          {/* Content */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: "14px", fontWeight: 600, color: T.textPrimary, lineHeight: "20px", marginBottom: "2px" }}>
                              {bank.title}
                            </div>
                            <div style={{ fontSize: "12px", color: T.textSecondary, marginBottom: "6px" }}>{bank.subject}</div>
                            {bank.tags.length > 0 && (
                              <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                                {bank.tags.slice(0, 3).map(tag => (
                                  <span key={tag} style={{
                                    fontSize: "11px", fontWeight: 500, lineHeight: "16px",
                                    padding: "2px 10px", borderRadius: "99px",
                                    background: T.bgSubtle, color: T.textSecondary,
                                  }}>{tag}</span>
                                ))}
                                {extraTags > 0 && (
                                  <span style={{ fontSize: "11px", fontWeight: 500, lineHeight: "16px", padding: "2px 10px", borderRadius: "99px", background: T.bgSubtle, color: T.textSecondary }}>
                                    +{extraTags}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                          {/* Counts — right column, tabular */}
                          <div style={{ textAlign: "right", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
                            <div>
                              <span style={{ fontSize: "13px", fontWeight: 600, color: T.textPrimary }}>{bank.questionCount}</span>
                              <span style={{ fontSize: "12px", color: T.textSecondary }}> soal</span>
                            </div>
                            <div>
                              <span style={{ fontSize: "13px", fontWeight: 600, color: T.textPrimary }}>{bank.totalPoints}</span>
                              <span style={{ fontSize: "12px", color: T.textSecondary }}> poin</span>
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>

                  {/* Result count + show more */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "12px" }}>
                    <span style={{ fontSize: "12px", color: T.textSecondary }}>
                      Menampilkan {visibleBanks.length} dari {totalFiltered}
                    </span>
                    {visibleBanks.length < totalFiltered && (
                      <button
                        type="button"
                        onClick={() => setBankVisible(v => v + 5)}
                        style={{
                          background: "none", border: `1px solid ${T.border}`,
                          borderRadius: T.radiusControl, padding: "6px 16px",
                          fontSize: "13px", fontWeight: 500, color: T.textSecondary,
                          cursor: "pointer",
                        }}
                      >
                        Tampilkan lebih banyak
                      </button>
                    )}
                  </div>
                </>
              )}
            </section>

            {/* ─────────────────────────────────────────────────────────── */}
            {/* Section 3: Pengaturan soal                                  */}
            {/* ─────────────────────────────────────────────────────────── */}
            <section aria-labelledby="sec-pengaturan" ref={refs.pengaturan} tabIndex={-1} style={{ ...cardStyle }}>
              <h2 id="sec-pengaturan" style={sectionTitleStyle}>
                <span style={{ color: T.primary }}><IconSliders /></span>
                Pengaturan soal
              </h2>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "20px" }}>
                <ToggleRow
                  id={`${uid}-shuffle`}
                  label="Acak urutan soal"
                  helper="Setiap peserta mendapat urutan soal berbeda"
                  checked={form.shuffleQuestions}
                  onChange={v => set("shuffleQuestions", v)}
                />
                <ToggleRow
                  id={`${uid}-shufflechoices`}
                  label="Acak urutan pilihan jawaban"
                  helper="Urutan pilihan A–D diacak untuk setiap peserta"
                  checked={form.shuffleChoices}
                  onChange={v => set("shuffleChoices", v)}
                />
              </div>

              {/* Mode tampilan soal */}
              <div style={{ marginBottom: "20px" }}>
                <div style={{ fontSize: "13px", fontWeight: 500, color: T.textPrimary, marginBottom: "10px" }}>
                  Mode tampilan soal
                </div>
                <div className="radio-cards" style={{ display: "flex", gap: "12px" }}>
                  {([
                    { val: "one_by_one" as const, label: "Satu per satu", helper: "Peserta menjawab satu soal di setiap halaman" },
                    { val: "all_at_once" as const, label: "Semua sekaligus", helper: "Semua soal tampil dalam satu halaman" },
                  ]).map(opt => {
                    const sel = form.displayMode === opt.val;
                    return (
                      <label
                        key={opt.val}
                        className={`radio-card${sel ? " selected" : ""}`}
                        style={{
                          flex: 1, display: "flex", alignItems: "flex-start", gap: "12px",
                          padding: "16px", border: `1px solid ${sel ? T.primary : T.border}`,
                          borderRadius: "8px", cursor: "pointer",
                          background: sel ? T.primaryTint : T.bgCard,
                          transition: "background 150ms, border-color 150ms",
                        }}
                      >
                        <input
                          type="radio"
                          name="displayMode"
                          value={opt.val}
                          checked={sel}
                          onChange={() => set("displayMode", opt.val)}
                          style={{ marginTop: "2px", accentColor: T.primary, width: "16px", height: "16px", flexShrink: 0 }}
                        />
                        <div>
                          <div style={{ fontSize: "14px", fontWeight: 500, color: T.textPrimary, lineHeight: "20px" }}>{opt.label}</div>
                          <div style={{ fontSize: "12px", color: T.textSecondary, marginTop: "2px", lineHeight: "18px" }}>{opt.helper}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Allow back navigation — only for one_by_one */}
              {form.displayMode === "one_by_one" && (
                <ToggleRow
                  id={`${uid}-backnav`}
                  label="Boleh kembali ke soal sebelumnya"
                  helper="Peserta dapat berpindah ke soal yang sudah dilewati"
                  checked={form.allowBackNavigation}
                  onChange={v => set("allowBackNavigation", v)}
                />
              )}
            </section>

            {/* ─────────────────────────────────────────────────────────── */}
            {/* Section 4: Jadwal & peserta (proposed)                      */}
            {/* ─────────────────────────────────────────────────────────── */}
            <section aria-labelledby="sec-jadwal" ref={refs.jadwal} tabIndex={-1} style={{ ...cardStyle }}>
              <h2 id="sec-jadwal" style={sectionTitleStyle}>
                <span style={{ color: T.primary }}><IconCalendar /></span>
                Jadwal &amp; peserta
              </h2>

              <div className="form-grid-2" style={{ display: "flex", gap: "16px", marginBottom: "20px" }}>
                {/* Mulai */}
                <div style={{ flex: 1 }}>
                  <label htmlFor={`${uid}-starts`} style={labelStyle}>
                    Mulai <span aria-hidden="true" style={{ color: T.danger }}>*</span>
                  </label>
                  <input
                    id={`${uid}-starts`}
                    type="datetime-local"
                    style={{ ...inputStyle, borderColor: errors.startsAt ? T.danger : T.borderInput, colorScheme: "light" }}
                    value={form.startsAt}
                    onChange={e => set("startsAt", e.target.value)}
                    aria-required="true"
                    aria-invalid={!!errors.startsAt}
                    aria-describedby={errors.startsAt ? `${uid}-starts-err` : undefined}
                  />
                  {errors.startsAt && (
                    <div id={`${uid}-starts-err`} role="alert" style={errorStyle}><IconAlert />{errors.startsAt}</div>
                  )}
                </div>

                {/* Selesai */}
                <div style={{ flex: 1 }}>
                  <label htmlFor={`${uid}-ends`} style={labelStyle}>
                    Selesai (batas akses) <span aria-hidden="true" style={{ color: T.danger }}>*</span>
                  </label>
                  <input
                    id={`${uid}-ends`}
                    type="datetime-local"
                    style={{ ...inputStyle, borderColor: errors.endsAt ? T.danger : T.borderInput, colorScheme: "light" }}
                    value={form.endsAt}
                    onChange={e => set("endsAt", e.target.value)}
                    aria-required="true"
                    aria-invalid={!!errors.endsAt}
                    aria-describedby={errors.endsAt ? `${uid}-ends-err` : `${uid}-ends-hint`}
                  />
                  {errors.endsAt
                    ? <div id={`${uid}-ends-err`} role="alert" style={errorStyle}><IconAlert />{errors.endsAt}</div>
                    : <div id={`${uid}-ends-hint`} style={helperStyle}>Harus paling pendek selama durasi ujian</div>
                  }
                </div>
              </div>

              {/* Peserta (simplified: text input as placeholder) */}
              <div style={{ marginBottom: "20px" }}>
                <label htmlFor={`${uid}-audience`} style={labelStyle}>
                  Peserta <span aria-hidden="true" style={{ color: T.danger }}>*</span>
                </label>
                <input
                  id={`${uid}-audience`}
                  type="text"
                  style={{ ...inputStyle }}
                  placeholder="Ketik nama kelas atau kelompok…"
                  aria-describedby={`${uid}-audience-hint`}
                />
                <div id={`${uid}-audience-hint`} style={helperStyle}>
                  Pilih kelas atau kelompok peserta ujian. Minimal satu.
                </div>
              </div>

              {/* Nilai ketuntasan */}
              <div style={{ maxWidth: "160px" }}>
                <label htmlFor={`${uid}-passing`} style={labelStyle}>Nilai ketuntasan</label>
                <div style={{ position: "relative" }}>
                  <input
                    id={`${uid}-passing`}
                    type="number"
                    style={{ ...inputStyle, paddingRight: "14px" }}
                    min={0} max={100}
                    placeholder="—"
                    value={form.passingScore}
                    onChange={e => set("passingScore", e.target.value)}
                    aria-describedby={`${uid}-passing-hint`}
                  />
                </div>
                <div id={`${uid}-passing-hint`} style={helperStyle}>Dipakai untuk menandai peserta yang tuntas.</div>
              </div>
            </section>

            {/* ─────────────────────────────────────────────────────────── */}
            {/* Section 5: Kebijakan pelanggaran                            */}
            {/* ─────────────────────────────────────────────────────────── */}
            <section aria-labelledby="sec-kebijakan" ref={refs.kebijakan} tabIndex={-1} style={{ ...cardStyle }}>
              <h2 id="sec-kebijakan" style={sectionTitleStyle}>
                <span style={{ color: T.primary }}><IconShield /></span>
                Kebijakan pelanggaran
              </h2>

              {/* Max violations + action */}
              <div className="form-grid-2" style={{ display: "flex", gap: "16px", marginBottom: "8px" }}>
                <div style={{ flex: 1 }}>
                  <label htmlFor={`${uid}-maxv`} style={labelStyle}>Maksimal pelanggaran</label>
                  <input
                    id={`${uid}-maxv`}
                    type="number"
                    style={{ ...inputStyle }}
                    min={1} max={10}
                    value={form.maxViolations}
                    onChange={e => set("maxViolations", parseInt(e.target.value) || 1)}
                    aria-describedby={`${uid}-violation-helper`}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label htmlFor={`${uid}-action`} style={labelStyle}>Tindakan setelah batas tercapai</label>
                  <select
                    id={`${uid}-action`}
                    style={{ ...inputStyle, cursor: "pointer" }}
                    value={form.actionAtLimit}
                    onChange={e => set("actionAtLimit", e.target.value as FormState["actionAtLimit"])}
                    aria-describedby={`${uid}-violation-helper`}
                  >
                    <option value="warn">Beri peringatan</option>
                    <option value="lock">Kunci sementara</option>
                    <option value="auto_end">Akhiri ujian otomatis</option>
                  </select>
                </div>
              </div>

              {/* Dynamic helper */}
              <div id={`${uid}-violation-helper`} style={{ ...helperStyle, marginBottom: "24px" }}>
                {violationHelpers[form.actionAtLimit]}
              </div>

              {/* Detection toggles */}
              <div style={{ fontSize: "13px", fontWeight: 500, color: T.textPrimary, marginBottom: "10px" }}>
                Aktivitas yang dicatat
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <ToggleRow
                  id={`${uid}-cp`}
                  label="Deteksi copy-paste"
                  helper="Catat jika peserta mencoba menyalin teks"
                  checked={form.detectCopyPaste}
                  onChange={v => set("detectCopyPaste", v)}
                />
                <ToggleRow
                  id={`${uid}-rc`}
                  label="Deteksi klik kanan"
                  helper="Catat jika peserta klik kanan di halaman ujian"
                  checked={form.detectRightClick}
                  onChange={v => set("detectRightClick", v)}
                />
                <ToggleRow
                  id={`${uid}-dt`}
                  label="Deteksi DevTools"
                  helper="Catat jika peserta membuka developer tools"
                  checked={form.detectDevTools}
                  onChange={v => set("detectDevTools", v)}
                />
                <ToggleRow
                  id={`${uid}-tab`}
                  label="Deteksi pindah tab atau keluar aplikasi"
                  helper="Catat jika peserta meninggalkan halaman ujian"
                  checked={form.detectTabSwitch}
                  onChange={v => set("detectTabSwitch", v)}
                />
                <ToggleRow
                  id={`${uid}-fs`}
                  label="Deteksi keluar layar penuh"
                  helper="Catat jika peserta keluar dari mode layar penuh"
                  checked={form.detectFullscreenExit}
                  onChange={v => set("detectFullscreenExit", v)}
                />
              </div>

              {/* Inline hint */}
              <div style={{ marginTop: "12px", fontSize: "12px", color: T.textSecondary, lineHeight: "18px", borderTop: `1px solid ${T.border}`, paddingTop: "12px" }}>
                Deteksi klik kanan, copy-paste, dan DevTools hanya berlaku di browser desktop.
              </div>

              {/* All-off amber note */}
              {allDetectionsOff && (
                <div role="note" style={{
                  marginTop: "12px", background: T.warningBg, border: `1px solid #E6C16B`,
                  borderRadius: "8px", padding: "12px 16px",
                  fontSize: "13px", color: T.warningText, lineHeight: "20px",
                }}>
                  Belum ada aktivitas yang dicatat, jadi batas pelanggaran tidak akan terpakai.
                </div>
              )}
            </section>
          </div>

          {/* ── Summary panel (sticky, ≥1200px) ─────────────────────── */}
          <aside
            className="summary-panel"
            aria-label="Ringkasan ujian"
            style={{
              width: "296px",
              flexShrink: 0,
              position: "sticky",
              top: "24px",
              alignSelf: "flex-start",
            }}
          >
            <nav aria-label="Status seksi form" style={{ ...cardStyle }}>
              <div style={{ fontSize: "14px", fontWeight: 600, color: T.textPrimary, marginBottom: "16px" }}>Ringkasan</div>

              {/* Key facts */}
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "20px", paddingBottom: "20px", borderBottom: `1px solid ${T.border}` }}>
                {/* Title */}
                <div>
                  <div style={{ fontSize: "11px", color: T.textSecondary, marginBottom: "2px" }}>Judul</div>
                  <div style={{
                    fontSize: "14px", fontWeight: 500, color: displayTitle ? T.textPrimary : T.textPlaceholder,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {displayTitle || "Belum diisi"}
                  </div>
                </div>
                {/* Duration */}
                <div>
                  <div style={{ fontSize: "11px", color: T.textSecondary, marginBottom: "2px" }}>Durasi</div>
                  <div style={{ fontSize: "14px", fontWeight: 500, color: T.textPrimary }}>{form.duration} menit</div>
                </div>
                {/* Questions / Points */}
                {selectedBank && (
                  <>
                    <div>
                      <div style={{ fontSize: "11px", color: T.textSecondary, marginBottom: "2px" }}>Jumlah soal</div>
                      <div style={{ fontSize: "14px", fontWeight: 500, color: T.textPrimary, fontVariantNumeric: "tabular-nums" }}>
                        {selectedBank.questionCount} soal
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: "11px", color: T.textSecondary, marginBottom: "2px" }}>Total poin</div>
                      <div style={{ fontSize: "14px", fontWeight: 500, color: T.textPrimary, fontVariantNumeric: "tabular-nums" }}>
                        {selectedBank.totalPoints} poin
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Section checklist */}
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {(Object.keys(sectionLabels) as SectionKey[]).map(key => {
                  const status = getSectionStatus(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        refs[key].current?.scrollIntoView({ behavior: "smooth", block: "start" });
                        refs[key].current?.focus();
                      }}
                      style={{
                        display: "flex", alignItems: "center", gap: "10px",
                        background: "none", border: "none", padding: "4px 0",
                        cursor: "pointer", textAlign: "left", width: "100%",
                        borderRadius: "4px",
                      }}
                      aria-label={`${sectionLabels[key]}: ${statusLabels[status]}`}
                    >
                      <StatusDot status={status} />
                      <span style={{ fontSize: "13px", color: T.textPrimary, flex: 1 }}>{sectionLabels[key]}</span>
                      <span style={{
                        fontSize: "11px",
                        color: status === "error" ? T.danger : status === "valid" ? T.success : T.textSecondary,
                      }}>
                        {statusLabels[status]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </nav>
          </aside>
        </div>
      </div>

      {/* ── Sticky action bar ────────────────────────────────────────────── */}
      <div
        role="toolbar"
        aria-label="Aksi form"
        style={{
          position: "fixed", bottom: 0, left: "248px", right: 0,
          background: T.bgCard,
          borderTop: `1px solid ${T.border}`,
          boxShadow: T.shadowBar,
          padding: "12px 32px",
          zIndex: 50,
        }}
      >
        {/* Mobile compact facts */}
        {selectedBank && (
          <div style={{
            display: "none", // shown via CSS on mobile via separate check
            fontSize: "12px", color: T.textSecondary, marginBottom: "8px", textAlign: "center",
          }} aria-hidden="true">
            {selectedBank.questionCount} soal · {selectedBank.totalPoints} poin · {form.duration} menit
          </div>
        )}
        <div
          className="action-bar-inner"
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}
        >
          {/* Batal */}
          <button
            type="button"
            className="btn-text"
            onClick={() => tryNavigate("/dashboard")}
            disabled={saving}
            style={{
              background: "none", border: "none",
              fontSize: "14px", fontWeight: 500, color: T.textSecondary,
              cursor: "pointer", height: "44px", padding: "0 16px",
              borderRadius: T.radiusControl,
            }}
          >
            Batal
          </button>

          {/* Right group */}
          <div style={{ display: "flex", gap: "12px" }}>
            {/* Simpan & lihat detail */}
            <button
              type="button"
              className="btn-solid"
              onClick={() => handleSubmit("save")}
              disabled={saving}
              style={{
                height: "44px", borderRadius: T.radiusControl,
                background: saving ? T.primaryHover : T.primary,
                color: "#FFFFFF",
                border: "none",
                fontSize: "14px", fontWeight: 500,
                cursor: saving ? "not-allowed" : "pointer",
                padding: "0 20px",
                display: "flex", alignItems: "center", gap: "8px",
                transition: "background 150ms",
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"
                    style={{ animation: "spin 1s linear infinite" }}/>
                </svg>
              )}
              {saving ? "Menyimpan…" : "Simpan & lihat detail"}
            </button>
          </div>
        </div>
      </div>

      {/* ── Leave dialog ─────────────────────────────────────────────────── */}
      {showLeaveDialog && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="leave-dialog-title"
          onClick={() => setShowLeaveDialog(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 300,
            background: "rgba(20,24,40,0.45)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "24px",
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ ...cardStyle, maxWidth: "400px", width: "100%" }}
          >
            <h2 id="leave-dialog-title" style={{ fontSize: "16px", fontWeight: 600, color: T.textPrimary, marginBottom: "8px" }}>
              Perubahan belum disimpan.
            </h2>
            <p style={{ fontSize: "14px", color: T.textSecondary, lineHeight: "22px", marginBottom: "20px" }}>
              Jika keluar sekarang, semua perubahan yang belum disimpan akan hilang.
            </p>
            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setShowLeaveDialog(false)}
                style={{
                  height: "40px", padding: "0 16px", borderRadius: T.radiusControl,
                  border: `1px solid ${T.border}`, background: T.bgCard,
                  fontSize: "14px", fontWeight: 500, color: T.textPrimary, cursor: "pointer",
                }}
              >
                Tetap di sini
              </button>
              <button
                type="button"
                onClick={() => { setIsDirty(false); router.push(leaveTarget || "/dashboard"); }}
                style={{
                  height: "40px", padding: "0 16px", borderRadius: T.radiusControl,
                  border: "none", background: T.danger,
                  fontSize: "14px", fontWeight: 500, color: "#FFFFFF", cursor: "pointer",
                }}
              >
                Buang perubahan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ────────────────────────────────────────────────────────── */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: "fixed", bottom: "80px", right: "24px", zIndex: 400,
            background: toast.type === "success" ? T.success : T.danger,
            color: "#FFFFFF",
            borderRadius: "8px",
            padding: "12px 20px",
            fontSize: "14px", fontWeight: 500,
            boxShadow: "0 4px 16px rgba(20,24,40,0.18)",
            display: "flex", alignItems: "center", gap: "10px",
          }}
        >
          {toast.type === "success"
            ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            : <IconAlert />
          }
          {toast.msg}
          <button
            type="button"
            onClick={() => setToast(null)}
            aria-label="Tutup notifikasi"
            style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", padding: "0 0 0 8px", fontSize: "16px", lineHeight: 1 }}
          >
            ✕
          </button>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @media (max-width: 1199px) { .summary-panel { display: none !important; } }
        @media (max-width: 767px) { .form-grid-2 { flex-direction: column !important; } }
        @media (max-width: 639px) {
          .radio-cards { flex-direction: column !important; }
          .action-bar-inner { flex-direction: column-reverse !important; }
          .action-bar-inner > * { width: 100% !important; }
        }
      `}</style>
    </DashboardShell>
  );
}
