"use client";

import { useState, useEffect, useMemo, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/apiClient";
import { useTeacherAuth } from "@/contexts/AuthContext";
import { aggregateFlags, FlagKey } from "@/lib/proctoring";
import DashboardShell from "../components/DashboardShell";

// Spec §7 Unified Design Tokens
const T = {
  bgPage: "#F6F8FB",
  bgCard: "#FFFFFF",
  bgSubtle: "#F0F3F8",
  border: "#E1E6ED",
  borderInput: "#8391A7",
  textPrimary: "#172033",
  textSecondary: "#5B6778",
  textPlaceholder: "#6B7788",
  primary: "#1B76BF",
  primaryHover: "#155E99",
  primaryActive: "#114E80",
  primaryTint: "#E6F1FA",
  primaryTintBorder: "#9CC7EA",
  success: "#177A4B",
  warningText: "#9A5B00",
  warningBg: "#FFF4DB",
  danger: "#C73E3E",
  dangerBg: "#FCE9E9",
  statusActive: "#177A4B",
  statusScheduled: "#1B76BF",
  statusDraft: "#8391A7",
  statusFinished: "#5B6778",
  statusArchived: "#A8B2C0",
  flagTabSwitch: "#EF6F6C",
  flagCopyPaste: "#F5A24B",
  flagDevtools: "#D470DD",
  flagReconnect: "#F2DC3D",
  radiusCard: "8px",
  radiusControl: "8px",
  radiusPill: "999px",
  shadowCard: "0 2px 8px rgba(20, 24, 40, 0.08)",
  shadowCardHover: "0 4px 14px rgba(20, 24, 40, 0.14)",
};

type ExamStatus = "all" | "active" | "scheduled" | "draft" | "ended" | "archived";

interface ExamItem {
  id: string;
  title: string;
  description: string | null;
  status: "active" | "scheduled" | "draft" | "ended" | "archived";
  duration: number;
  questionCount: number;
  accessCode?: string;
  createdAt: string;
  startsAt?: string;
  endsAt?: string;
  updatedAt?: string;
  totalParticipants: number;
  online?: number;
  enrolled?: number;
  flagCount?: number;
}

function DashboardContent() {
  const searchParams = useSearchParams();
  const filterParam = searchParams ? searchParams.get("filter") : null;
  const { teacher } = useTeacherAuth();

  const [search, setSearch] = useState("");
  const [selectedTab, setSelectedTab] = useState<ExamStatus>(
    filterParam === "ended" ? "ended" : filterParam === "active" ? "active" : "all"
  );
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [openMenuExamId, setOpenMenuExamId] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ type: "delete" | "archive" | "restore"; exam: ExamItem } | null>(null);
  const [liveCountdown, setLiveCountdown] = useState<number>(1440);
  const [examsList, setExamsList] = useState<ExamItem[]>([]);
  const [loadingExams, setLoadingExams] = useState(true);
  const [activeSession, setActiveSession] = useState<{
    examId: string;
    title: string;
    online: number;
    enrolled: number;
    flags: Record<FlagKey, number>;
  } | null>(null);

  // Sync tab with URL query parameter
  useEffect(() => {
    if (filterParam === "ended") setSelectedTab("ended");
    else if (filterParam === "active") setSelectedTab("active");
  }, [filterParam]);

  // Load saved view mode from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("eduquas_dashboard_view");
    if (saved === "grid" || saved === "list") {
      setViewMode(saved);
    }
  }, []);

  const changeViewMode = (mode: "grid" | "list") => {
    setViewMode(mode);
    localStorage.setItem("eduquas_dashboard_view", mode);
  };

  // Live timer tick for live strip
  useEffect(() => {
    const interval = setInterval(() => {
      setLiveCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg((cur) => (cur === msg ? null : cur));
    }, 3000);
  };

  const copyAccessCode = (code: string) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard
        .writeText(code)
        .then(() => showToast("Kode akses disalin"))
        .catch(() => showToast("Kode akses tidak bisa disalin. Salin manual."));
    } else {
      showToast("Kode akses tidak bisa disalin. Salin manual.");
    }
  };

  // Date formatted dynamically in Indonesian sentence case
  const currentDateFormatted = useMemo(() => {
    const date = new Date();
    return date.toLocaleDateString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }, []);

  const fetchExams = useCallback(async () => {
    try {
      const res = await apiFetch<any[]>("/api/exams");
      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
        const mapped: ExamItem[] = res.data.map((e: any) => ({
          id: e.id,
          title: e.title,
          description: e.description,
          status: e.status,
          duration: e.durationMinutes,
          questionCount: e._count?.questions ?? 0,
          accessCode: e.accessCode,
          createdAt: e.createdAt,
          startsAt: e.startTime,
          endsAt: e.endTime,
          updatedAt: e.updatedAt,
          totalParticipants: e._count?.students ?? 0,
        }));
        setExamsList(mapped);
      } else {
        setExamsList([]);
      }
    } catch {
      setExamsList([]);
    } finally {
      setLoadingExams(false);
    }
  }, []);

  useEffect(() => {
    fetchExams();
  }, [fetchExams]);

  // Live session stats polling if active exam exists
  useEffect(() => {
    const activeExam = examsList.find((e) => e.status === "active");
    if (!activeExam) {
      setActiveSession(null);
      return;
    }

    let isSubscribed = true;
    const fetchLiveSession = async () => {
      try {
        const res = await apiFetch<any>(`/api/exams/${activeExam.id}/dashboard`);
        if (res.success && res.data && isSubscribed) {
          const overview = res.data.overview;
          const flags = aggregateFlags(res.data.recentEvents || []);

          if (res.data.exam?.endTime && res.data.serverTime) {
            const diff = Math.max(
              0,
              Math.floor((new Date(res.data.exam.endTime).getTime() - new Date(res.data.serverTime).getTime()) / 1000)
            );
            setLiveCountdown(diff);
          }

          setActiveSession({
            examId: activeExam.id,
            title: activeExam.title,
            online: overview?.onlineCount ?? 0,
            enrolled: overview?.totalJoined ?? 0,
            flags,
          });
        }
      } catch {
        // Ignore polling error
      }
    };

    fetchLiveSession();
    const interval = setInterval(fetchLiveSession, 15000);
    return () => {
      isSubscribed = false;
      clearInterval(interval);
    };
  }, [examsList]);

  // Counts for status tabs and total participants
  const counts = useMemo(() => {
    return {
      all: examsList.length,
      active: examsList.filter((e) => e.status === "active").length,
      scheduled: examsList.filter((e) => e.status === "scheduled").length,
      draft: examsList.filter((e) => e.status === "draft").length,
      ended: examsList.filter((e) => e.status === "ended").length,
      archived: examsList.filter((e) => e.status === "archived").length,
      totalParticipants: examsList.reduce((acc, e) => acc + (e.totalParticipants || 0), 0),
    };
  }, [examsList]);

  // Filter exams based on search query and active tab
  const filteredExams = useMemo(() => {
    return examsList.filter((exam) => {
      const matchSearch =
        search.trim() === "" ||
        exam.title.toLowerCase().includes(search.toLowerCase()) ||
        (exam.accessCode && exam.accessCode.toLowerCase().includes(search.toLowerCase()));

      let matchTab = true;
      if (selectedTab !== "all") {
        matchTab = exam.status === selectedTab;
      }

      return matchSearch && matchTab;
    });
  }, [examsList, search, selectedTab]);


  // Helper for scroll to list
  const scrollToList = () => {
    const el = document.getElementById("exam-list-region");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <DashboardShell>
      <style>{`
        .eduquas-btn-primary {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          height: 44px;
          padding: 0 18px;
          border-radius: ${T.radiusControl};
          background-color: ${T.primary};
          color: #FFFFFF;
          font-size: 14px;
          font-weight: 600;
          text-decoration: none;
          border: none;
          cursor: pointer;
          transition: background-color 150ms ease;
          outline: none;
        }
        .eduquas-btn-primary:hover {
          background-color: ${T.primaryHover};
        }
        .eduquas-btn-primary:active {
          background-color: ${T.primaryActive};
        }
        .eduquas-btn-primary:focus-visible {
          outline: 2px solid ${T.primary};
          outline-offset: 2px;
        }

        .stat-card-btn {
          background: ${T.bgCard};
          border: 1px solid ${T.border};
          border-radius: ${T.radiusCard};
          padding: 16px 20px;
          box-shadow: ${T.shadowCard};
          text-align: left;
          cursor: pointer;
          transition: box-shadow 150ms ease, transform 150ms ease;
          outline: none;
          display: flex;
          flex-direction: column;
          justifyContent: space-between;
          width: 100%;
        }
        .stat-card-btn:hover {
          box-shadow: ${T.shadowCardHover};
        }
        .stat-card-btn:focus-visible {
          outline: 2px solid ${T.primary};
          outline-offset: 2px;
        }

        .status-tab-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          height: 36px;
          padding: 0 14px;
          border-radius: ${T.radiusControl};
          border: none;
          background: transparent;
          color: ${T.textSecondary};
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: background-color 150ms ease, color 150ms ease;
          outline: none;
          white-space: nowrap;
        }
        .status-tab-btn:hover {
          background-color: ${T.bgSubtle};
          color: ${T.textPrimary};
        }
        .status-tab-btn:focus-visible {
          outline: 2px solid ${T.primary};
          outline-offset: 2px;
        }
        .status-tab-btn.selected {
          background-color: ${T.primaryTint};
          color: ${T.primary};
          font-weight: 600;
        }

        .exam-card {
          background: ${T.bgCard};
          border: 1px solid ${T.border};
          border-radius: ${T.radiusCard};
          padding: 16px;
          box-shadow: ${T.shadowCard};
          transition: box-shadow 150ms ease;
          display: flex;
          flex-direction: column;
          position: relative;
        }
        .exam-card:hover {
          box-shadow: ${T.shadowCardHover};
        }
        .exam-card.is-archived {
          opacity: 0.85;
          color: ${T.textSecondary};
        }

        .action-btn-solid {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          height: 36px;
          padding: 0 14px;
          border-radius: ${T.radiusControl};
          background-color: ${T.primary};
          color: #FFFFFF;
          font-size: 13px;
          font-weight: 600;
          text-decoration: none;
          border: none;
          cursor: pointer;
          transition: background-color 150ms ease;
          outline: none;
          white-space: nowrap;
        }
        .action-btn-solid:hover {
          background-color: ${T.primaryHover};
        }
        .action-btn-solid:focus-visible {
          outline: 2px solid ${T.primary};
          outline-offset: 2px;
        }

        .action-btn-outline {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          height: 36px;
          padding: 0 12px;
          border-radius: ${T.radiusControl};
          background-color: #FFFFFF;
          border: 1px solid ${T.border};
          color: ${T.textPrimary};
          font-size: 13px;
          font-weight: 500;
          text-decoration: none;
          cursor: pointer;
          transition: background-color 150ms ease, border-color 150ms ease;
          outline: none;
          white-space: nowrap;
        }
        .action-btn-outline:hover {
          background-color: ${T.bgSubtle};
          border-color: ${T.borderInput};
        }
        .action-btn-outline:focus-visible {
          outline: 2px solid ${T.primary};
          outline-offset: 2px;
        }

        .overflow-menu-btn {
          width: 28px;
          height: 28px;
          border-radius: 6px;
          border: none;
          background: transparent;
          color: ${T.textSecondary};
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background-color 120ms ease;
          outline: none;
        }
        .overflow-menu-btn:hover {
          background-color: ${T.bgSubtle};
          color: ${T.textPrimary};
        }
        .overflow-menu-btn:focus-visible {
          outline: 2px solid ${T.primary};
          outline-offset: 1px;
        }

        .copy-code-btn {
          width: 28px;
          height: 28px;
          border: none;
          background: transparent;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: ${T.textSecondary};
          transition: background-color 120ms ease, color 120ms ease;
          outline: none;
        }
        .copy-code-btn:hover {
          background-color: rgba(27,118,191,0.12);
          color: ${T.primary};
        }
        .copy-code-btn:focus-visible {
          outline: 2px solid ${T.primary};
          outline-offset: 1px;
        }

        .table-row-hover:hover {
          background-color: ${T.bgSubtle};
        }

        @media (prefers-reduced-motion: reduce) {
          * {
            transition: none !important;
            animation: none !important;
          }
        }
      `}</style>

      {/* Main page container (Spec §3: max width 1440px, centered beyond that) */}
      <div
        style={{
          maxWidth: "1440px",
          margin: "0 auto",
          padding: "24px 32px 48px",
        }}
      >
        {/* ============================================================
            1. TOP BAR (Spec §4.2: not sticky, greeting left, button right)
            ============================================================ */}
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "24px",
            flexWrap: "wrap",
            gap: "16px",
          }}
        >
          <div>
            <h1
              style={{
                fontSize: "26px",
                lineHeight: "32px",
                fontWeight: 600,
                color: T.textPrimary,
                margin: 0,
                letterSpacing: "-0.01em",
              }}
            >
              Selamat datang, Ahmad
            </h1>
            <div
              style={{
                fontSize: "13px",
                lineHeight: "20px",
                color: T.textSecondary,
                marginTop: "2px",
              }}
            >
              {currentDateFormatted}
            </div>
          </div>

          <div>
            {/* Spec §4.2: Solid primary button, height 44px, radius 8px, no gradient, no glow */}
            <Link href="/dashboard/exams/new" className="eduquas-btn-primary">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span>Buat ujian</span>
            </Link>
          </div>
        </header>

        {/* ============================================================
            2. LIVE STRIP (Spec §4.3: only rendered when active exam exists)
            ============================================================ */}
        {activeSession && (
          <section
            aria-label="Ujian sedang berlangsung"
            style={{
              background: T.bgCard,
              border: `1px solid ${T.border}`,
              borderLeft: `3px solid ${T.success}`,
              borderRadius: T.radiusCard,
              boxShadow: T.shadowCard,
              padding: "16px 20px",
              marginBottom: "20px",
            }}
          >
            {/* Top label: Green dot + 'Sedang berlangsung' */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "12px",
                fontWeight: 500,
                color: T.textSecondary,
                marginBottom: "8px",
              }}
            >
              <span
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  backgroundColor: T.success,
                  display: "inline-block",
                }}
              />
              <span>Sedang berlangsung</span>
            </div>

            {/* Main Strip Row */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "16px",
              }}
            >
              {/* Exam title */}
              <div style={{ minWidth: "240px", flex: "1 1 240px" }}>
                <Link
                  href={`/dashboard/exams/${activeSession.examId}`}
                  style={{
                    fontSize: "16px",
                    lineHeight: "24px",
                    fontWeight: 600,
                    color: T.textPrimary,
                    textDecoration: "none",
                  }}
                  title={activeSession.title}
                >
                  {activeSession.title}
                </Link>
              </div>

              {/* Online count */}
              <div
                style={{
                  fontSize: "13px",
                  color: T.textSecondary,
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  whiteSpace: "nowrap",
                }}
              >
                <strong style={{ color: T.textPrimary, fontWeight: 600 }}>{activeSession.online}</strong>
                <span>dari</span>
                <strong style={{ color: T.textPrimary, fontWeight: 600 }}>{activeSession.enrolled}</strong>
                <span>online</span>
              </div>

              {/* Four Flag Dots with tooltips (Spec §4.3: same order as Live Feed) */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  fontSize: "13px",
                  color: T.textPrimary,
                }}
                aria-label="Ringkasan pelanggaran live"
              >
                {/* 1. Tab Switch */}
                <span
                  title={`Pindah tab: ${activeSession.flags.tab_switch}`}
                  style={{ display: "inline-flex", alignItems: "center", gap: "5px", cursor: "help" }}
                  aria-label={`Pindah tab: ${activeSession.flags.tab_switch}`}
                >
                  <span
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      backgroundColor: T.flagTabSwitch,
                      display: "inline-block",
                    }}
                  />
                  <span style={{ fontWeight: 600 }}>{activeSession.flags.tab_switch}</span>
                </span>

                {/* 2. Copy Paste */}
                <span
                  title={`Copy/Paste: ${activeSession.flags.copy_paste}`}
                  style={{ display: "inline-flex", alignItems: "center", gap: "5px", cursor: "help" }}
                  aria-label={`Copy/Paste: ${activeSession.flags.copy_paste}`}
                >
                  <span
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      backgroundColor: T.flagCopyPaste,
                      display: "inline-block",
                    }}
                  />
                  <span style={{ fontWeight: 600 }}>{activeSession.flags.copy_paste}</span>
                </span>

                {/* 3. DevTools */}
                <span
                  title={`Buka DevTools: ${activeSession.flags.devtools}`}
                  style={{ display: "inline-flex", alignItems: "center", gap: "5px", cursor: "help" }}
                  aria-label={`Buka DevTools: ${activeSession.flags.devtools}`}
                >
                  <span
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      backgroundColor: T.flagDevtools,
                      display: "inline-block",
                    }}
                  />
                  <span style={{ fontWeight: 600 }}>{activeSession.flags.devtools}</span>
                </span>

                {/* 4. Reconnect */}
                <span
                  title={`Terputus/Reconnect: ${activeSession.flags.reconnect}`}
                  style={{ display: "inline-flex", alignItems: "center", gap: "5px", cursor: "help" }}
                  aria-label={`Terputus/Reconnect: ${activeSession.flags.reconnect}`}
                >
                  <span
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      backgroundColor: T.flagReconnect,
                      border: "1px solid #D4BF24",
                      display: "inline-block",
                    }}
                  />
                  <span style={{ fontWeight: 600 }}>{activeSession.flags.reconnect}</span>
                </span>
              </div>

              {/* Time remaining countdown */}
              <div
                style={{
                  fontSize: "13px",
                  color: T.textSecondary,
                  whiteSpace: "nowrap",
                }}
              >
                Sisa{" "}
                <span style={{ color: T.textPrimary, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                  {formatCountdown(liveCountdown)}
                </span>
              </div>

              {/* Primary action: 'Buka monitoring' */}
              <div>
                <Link
                  href={`/dashboard/exams/${activeSession.examId}/monitor`}
                  className="action-btn-solid"
                  style={{ height: "36px", padding: "0 16px" }}
                >
                  Buka monitoring
                </Link>
              </div>
            </div>
          </section>
        )}

        {/* ============================================================
            3. STAT CARDS (Spec §4.4: 4 equal cols, neutral values, filterable)
            ============================================================ */}
        <section
          aria-label="Statistik ujian"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "16px",
            marginBottom: "32px",
          }}
        >
          {/* Card 1: Total ujian (interactive button -> sets tab to 'all') */}
          <button
            type="button"
            className="stat-card-btn"
            onClick={() => {
              setSelectedTab("all");
              scrollToList();
            }}
            aria-label="Filter semua ujian"
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
              <span style={{ fontSize: "13px", color: T.textSecondary, fontWeight: 500 }}>Total ujian</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={T.textSecondary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
              </svg>
            </div>
            <div
              style={{
                fontSize: "28px",
                lineHeight: "36px",
                fontWeight: 600,
                color: T.textPrimary,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {counts.all}
            </div>
          </button>

          {/* Card 2: Ujian aktif (interactive button -> sets tab to 'active') */}
          <button
            type="button"
            className="stat-card-btn"
            onClick={() => {
              setSelectedTab("active");
              scrollToList();
            }}
            aria-label="Filter ujian aktif"
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                {counts.active > 0 && (
                  <span
                    style={{
                      width: "6px",
                      height: "6px",
                      borderRadius: "50%",
                      backgroundColor: T.success,
                      display: "inline-block",
                    }}
                  />
                )}
                <span style={{ fontSize: "13px", color: T.textSecondary, fontWeight: 500 }}>Ujian aktif</span>
              </div>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={counts.active > 0 ? T.success : T.textSecondary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
            </div>
            <div
              style={{
                fontSize: "28px",
                lineHeight: "36px",
                fontWeight: 600,
                color: counts.active > 0 ? T.success : T.textPrimary,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {counts.active}
            </div>
          </button>

          {/* Card 3: Total peserta (NOT interactive per spec §4.4) */}
          <div
            style={{
              background: T.bgCard,
              border: `1px solid ${T.border}`,
              borderRadius: T.radiusCard,
              padding: "16px 20px",
              boxShadow: T.shadowCard,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
              <span style={{ fontSize: "13px", color: T.textSecondary, fontWeight: 500 }}>Total peserta</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={T.textSecondary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <div
              style={{
                fontSize: "28px",
                lineHeight: "36px",
                fontWeight: 600,
                color: T.textPrimary,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {counts.totalParticipants}
            </div>
          </div>

          {/* Card 4: Ujian selesai (interactive button -> sets tab to 'ended') */}
          <button
            type="button"
            className="stat-card-btn"
            onClick={() => {
              setSelectedTab("ended");
              scrollToList();
            }}
            aria-label="Filter ujian selesai"
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
              <span style={{ fontSize: "13px", color: T.textSecondary, fontWeight: 500 }}>Ujian selesai</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={T.textSecondary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <div
              style={{
                fontSize: "28px",
                lineHeight: "36px",
                fontWeight: 600,
                color: T.textPrimary,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {counts.ended}
            </div>
          </button>
        </section>

        {/* ============================================================
            4. EXAM LIST SECTION (Spec §4.5)
            ============================================================ */}
        <section id="exam-list-region" aria-labelledby="exam-list-heading">
          {/* Header Row: Title on left, Search + View Toggle on right */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "16px",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <h2
              id="exam-list-heading"
              style={{
                fontSize: "18px",
                lineHeight: "24px",
                fontWeight: 600,
                color: T.textPrimary,
                margin: 0,
              }}
            >
              Semua ujian
            </h2>

            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              {/* Search input: height 44px, line search icon, placeholder 'Cari ujian' */}
              <div style={{ position: "relative", width: "280px" }}>
                <span
                  style={{
                    position: "absolute",
                    left: "14px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: T.textPlaceholder,
                    display: "flex",
                    pointerEvents: "none",
                  }}
                  aria-hidden="true"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </span>
                <input
                  type="text"
                  placeholder="Cari ujian…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  aria-label="Cari ujian"
                  style={{
                    width: "100%",
                    height: "44px",
                    paddingLeft: "40px",
                    paddingRight: search ? "36px" : "14px",
                    background: T.bgCard,
                    border: `1px solid ${T.borderInput}`,
                    borderRadius: T.radiusControl,
                    fontSize: "14px",
                    color: T.textPrimary,
                    outline: "none",
                  }}
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    aria-label="Hapus pencarian"
                    style={{
                      position: "absolute",
                      right: "10px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "transparent",
                      border: "none",
                      color: T.textSecondary,
                      cursor: "pointer",
                      padding: "4px",
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Grid / List toggle (Spec §4.5) */}
              <div
                style={{
                  display: "flex",
                  background: T.bgCard,
                  border: `1px solid ${T.border}`,
                  borderRadius: T.radiusControl,
                  padding: "2px",
                  height: "44px",
                  alignItems: "center",
                }}
                role="group"
                aria-label="Tampilan daftar ujian"
              >
                <button
                  type="button"
                  onClick={() => changeViewMode("grid")}
                  aria-label="Tampilan kisi (grid)"
                  aria-pressed={viewMode === "grid"}
                  style={{
                    width: "38px",
                    height: "38px",
                    borderRadius: "6px",
                    border: "none",
                    background: viewMode === "grid" ? T.primaryTint : "transparent",
                    color: viewMode === "grid" ? T.primary : T.textSecondary,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    outline: "none",
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7" height="7" rx="1" />
                    <rect x="14" y="3" width="7" height="7" rx="1" />
                    <rect x="14" y="14" width="7" height="7" rx="1" />
                    <rect x="3" y="14" width="7" height="7" rx="1" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => changeViewMode("list")}
                  aria-label="Tampilan tabel (list)"
                  aria-pressed={viewMode === "list"}
                  style={{
                    width: "38px",
                    height: "38px",
                    borderRadius: "6px",
                    border: "none",
                    background: viewMode === "list" ? T.primaryTint : "transparent",
                    color: viewMode === "list" ? T.primary : T.textSecondary,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    outline: "none",
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="8" y1="6" x2="21" y2="6" />
                    <line x1="8" y1="12" x2="21" y2="12" />
                    <line x1="8" y1="18" x2="21" y2="18" />
                    <line x1="3" y1="6" x2="3.01" y2="6" />
                    <line x1="3" y1="12" x2="3.01" y2="12" />
                    <line x1="3" y1="18" x2="3.01" y2="18" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Status Tabs with counts (Spec §4.5: replaces dropdown) */}
          <div
            role="tablist"
            aria-label="Filter status ujian"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              overflowX: "auto",
              paddingBottom: "4px",
              marginBottom: "20px",
            }}
          >
            {[
              { id: "all", label: "Semua", count: counts.all },
              { id: "active", label: "Aktif", count: counts.active },
              { id: "scheduled", label: "Terjadwal", count: counts.scheduled },
              { id: "draft", label: "Draft", count: counts.draft },
              { id: "ended", label: "Selesai", count: counts.ended },
              { id: "archived", label: "Diarsipkan", count: counts.archived },
            ].map((tab) => {
              const isSelected = selectedTab === tab.id;
              return (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => setSelectedTab(tab.id as ExamStatus)}
                  className={`status-tab-btn ${isSelected ? "selected" : ""}`}
                  style={{
                    opacity: tab.count === 0 && !isSelected ? 0.6 : 1,
                  }}
                >
                  <span>{tab.label}</span>
                  <span
                    style={{
                      fontSize: "12px",
                      color: isSelected ? T.primary : T.textSecondary,
                      fontWeight: isSelected ? 600 : 400,
                    }}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* ============================================================
              5. EXAM CARDS GRID / LIST VIEW (Spec §4.5 & §4.6)
              ============================================================ */}
          {filteredExams.length === 0 ? (
            /* Empty State (Spec §4.7: illustration-free message) */
            <div
              style={{
                background: T.bgCard,
                borderRadius: T.radiusCard,
                border: `1px solid ${T.border}`,
                padding: "64px 32px",
                textAlign: "center",
              }}
            >
              {search || selectedTab !== "all" ? (
                <div>
                  <div style={{ fontSize: "16px", fontWeight: 600, color: T.textPrimary, marginBottom: "6px" }}>
                    Tidak ada ujian yang cocok.
                  </div>
                  <div style={{ fontSize: "13px", color: T.textSecondary, marginBottom: "16px" }}>
                    Coba sesuaikan kata kunci pencarian atau ubah filter status ujian.
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSearch("");
                      setSelectedTab("all");
                    }}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: T.primary,
                      fontSize: "14px",
                      fontWeight: 600,
                      cursor: "pointer",
                      textDecoration: "underline",
                    }}
                  >
                    Hapus filter
                  </button>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: "16px", fontWeight: 600, color: T.textPrimary, marginBottom: "6px" }}>
                    Belum ada ujian.
                  </div>
                  <div style={{ fontSize: "13px", color: T.textSecondary, marginBottom: "20px" }}>
                    Buat ujian pertamamu untuk mulai.
                  </div>
                  <Link href="/dashboard/exams/new" className="eduquas-btn-primary">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    Buat ujian
                  </Link>
                </div>
              )}
            </div>
          ) : viewMode === "grid" ? (
            /* GRID VIEW: repeat(auto-fill, minmax(300px, 1fr)), gap 16px */
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                gap: "16px",
              }}
            >
              {filteredExams.map((exam) => (
                <ExamCard
                  key={exam.id}
                  exam={exam}
                  isMenuOpen={openMenuExamId === exam.id}
                  onToggleMenu={(id) => setOpenMenuExamId(openMenuExamId === id ? null : id)}
                  onCopyCode={copyAccessCode}
                  onActionConfirm={(type, ex) => {
                    setConfirmModal({ type, exam: ex });
                    setOpenMenuExamId(null);
                  }}
                />
              ))}
            </div>
          ) : (
            /* LIST (TABLE) VIEW (Spec §4.5) */
            <div
              style={{
                background: T.bgCard,
                border: `1px solid ${T.border}`,
                borderRadius: T.radiusCard,
                overflow: "hidden",
                boxShadow: T.shadowCard,
              }}
            >
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
                  <thead>
                    <tr
                      style={{
                        background: T.bgSubtle,
                        borderBottom: `1px solid ${T.border}`,
                        color: T.textSecondary,
                        fontSize: "12px",
                        fontWeight: 600,
                        height: "44px",
                      }}
                    >
                      <th style={{ padding: "0 16px" }}>Status</th>
                      <th style={{ padding: "0 16px" }}>Judul</th>
                      <th style={{ padding: "0 16px" }}>Durasi</th>
                      <th style={{ padding: "0 16px" }}>Soal</th>
                      <th style={{ padding: "0 16px" }}>Peserta</th>
                      <th style={{ padding: "0 16px" }}>Jadwal / Waktu</th>
                      <th style={{ padding: "0 16px" }}>Kode akses</th>
                      <th style={{ padding: "0 16px", textAlign: "right" }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredExams.map((exam) => {
                      const isArchived = exam.status === "archived";
                      return (
                        <tr
                          key={exam.id}
                          className="table-row-hover"
                          style={{
                            height: "56px",
                            borderBottom: `1px solid ${T.border}`,
                            opacity: isArchived ? 0.8 : 1,
                          }}
                        >
                          {/* Status */}
                          <td style={{ padding: "0 16px" }}>
                            <StatusIndicator status={exam.status} />
                          </td>

                          {/* Judul */}
                          <td style={{ padding: "0 16px", fontWeight: 600 }}>
                            <Link
                              href={`/dashboard/exams/${exam.id}`}
                              style={{
                                color: T.textPrimary,
                                textDecoration: "none",
                              }}
                              title={exam.title}
                            >
                              {exam.title}
                            </Link>
                          </td>

                          {/* Durasi */}
                          <td style={{ padding: "0 16px", color: T.textSecondary }}>
                            {exam.duration} menit
                          </td>

                          {/* Soal */}
                          <td style={{ padding: "0 16px", color: T.textSecondary }}>
                            {exam.questionCount}
                          </td>

                          {/* Peserta */}
                          <td style={{ padding: "0 16px", color: T.textSecondary }}>
                            {exam.status === "active" ? (
                              <span>
                                <strong style={{ color: T.textPrimary }}>{exam.online || 28}</strong>/{exam.enrolled || 34} online
                              </span>
                            ) : exam.status === "ended" ? (
                              <span>{exam.totalParticipants}</span>
                            ) : (
                              <span>–</span>
                            )}
                          </td>

                          {/* Jadwal */}
                          <td style={{ padding: "0 16px", color: T.textSecondary }}>
                            {getContextLine(exam)}
                          </td>

                          {/* Kode akses */}
                          <td style={{ padding: "0 16px" }}>
                            {exam.status === "active" || exam.status === "scheduled" ? (
                              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                <span
                                  style={{
                                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                                    fontSize: "12px",
                                    fontWeight: 600,
                                    letterSpacing: "0.04em",
                                    color: T.textPrimary,
                                  }}
                                >
                                  {exam.accessCode}
                                </span>
                                <button
                                  type="button"
                                  className="copy-code-btn"
                                  onClick={() => copyAccessCode(exam.accessCode || "")}
                                  aria-label={`Salin kode akses ${exam.accessCode}`}
                                  title="Salin kode akses"
                                >
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                  </svg>
                                </button>
                              </div>
                            ) : (
                              <span style={{ color: T.textSecondary }}>–</span>
                            )}
                          </td>

                          {/* Aksi */}
                          <td style={{ padding: "0 16px", textAlign: "right" }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "6px" }}>
                              <PrimaryActionButton exam={exam} />
                              <Link
                                href={`/dashboard/exams/${exam.id}`}
                                className="action-btn-outline"
                                style={{ height: "32px", padding: "0 10px", fontSize: "12px" }}
                              >
                                Detail
                              </Link>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        {/* ============================================================
            6. MODALS & TOAST NOTIFICATION
            ============================================================ */}
        {/* Confirm Modal */}
        {confirmModal && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-modal-title"
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(15, 23, 42, 0.45)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 300,
              padding: "20px",
            }}
            onClick={() => setConfirmModal(null)}
          >
            <div
              style={{
                background: T.bgCard,
                borderRadius: T.radiusCard,
                border: `1px solid ${T.border}`,
                boxShadow: "0 12px 32px rgba(20,24,40,0.18)",
                maxWidth: "420px",
                width: "100%",
                padding: "24px",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3
                id="confirm-modal-title"
                style={{
                  fontSize: "16px",
                  fontWeight: 600,
                  color: T.textPrimary,
                  marginTop: 0,
                  marginBottom: "8px",
                }}
              >
                {confirmModal.type === "delete"
                  ? "Hapus ujian?"
                  : confirmModal.type === "archive"
                  ? "Arsipkan ujian?"
                  : "Pulihkan ujian?"}
              </h3>
              <p
                style={{
                  fontSize: "13px",
                  color: T.textSecondary,
                  lineHeight: "20px",
                  marginBottom: "20px",
                }}
              >
                {confirmModal.type === "delete"
                  ? `Ujian "${confirmModal.exam.title}" akan dihapus permanen. Tindakan ini tidak bisa dibatalkan.`
                  : confirmModal.type === "archive"
                  ? `Ujian "${confirmModal.exam.title}" akan dipindahkan ke arsip.`
                  : `Ujian "${confirmModal.exam.title}" akan dipulihkan ke status draft.`}
              </p>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  type="button"
                  className="action-btn-outline"
                  onClick={() => setConfirmModal(null)}
                >
                  Batal
                </button>
                <button
                  type="button"
                  className={confirmModal.type === "delete" ? "eduquas-btn-primary" : "eduquas-btn-primary"}
                  style={{
                    backgroundColor: confirmModal.type === "delete" ? T.danger : T.primary,
                  }}
                  onClick={async () => {
                    const { type, exam } = confirmModal;
                    if (type === "delete") {
                      const res = await apiFetch(`/api/exams/${exam.id}`, { method: "DELETE" });
                      if (res.success) {
                        showToast("Ujian berhasil dihapus");
                        fetchExams();
                      } else {
                        showToast(res.error?.message || "Gagal menghapus ujian");
                      }
                    } else if (type === "archive") {
                      const res = await apiFetch(`/api/exams/${exam.id}/status`, {
                        method: "PUT",
                        body: JSON.stringify({ status: "archived" }),
                      });
                      if (res.success) {
                        showToast("Ujian berhasil diarsipkan");
                        fetchExams();
                      } else {
                        showToast(res.error?.message || "Gagal mengarsipkan ujian");
                      }
                    } else if (type === "restore") {
                      const res = await apiFetch(`/api/exams/${exam.id}/status`, {
                        method: "PUT",
                        body: JSON.stringify({ status: "draft" }),
                      });
                      if (res.success) {
                        showToast("Ujian berhasil dipulihkan");
                        fetchExams();
                      } else {
                        showToast(res.error?.message || "Gagal memulihkan ujian");
                      }
                    }
                    setConfirmModal(null);
                  }}
                >
                  {confirmModal.type === "delete"
                    ? "Ya, hapus"
                    : confirmModal.type === "archive"
                    ? "Ya, arsipkan"
                    : "Ya, pulihkan"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Toast Alert */}
        {toastMsg && (
          <div
            role="status"
            aria-live="polite"
            style={{
              position: "fixed",
              bottom: "24px",
              right: "24px",
              background: T.textPrimary,
              color: "#FFFFFF",
              padding: "10px 18px",
              borderRadius: T.radiusControl,
              boxShadow: "0 6px 20px rgba(15,23,42,0.20)",
              fontSize: "13px",
              fontWeight: 500,
              zIndex: 400,
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4ADE80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>{toastMsg}</span>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}

// ---------------------------------------------------------------------------
// SUB-COMPONENTS & HELPERS
// ---------------------------------------------------------------------------

function StatusIndicator({ status }: { status: ExamItem["status"] }) {
  if (status === "active") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 500, color: T.statusActive }}>
        <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: T.statusActive, display: "inline-block" }} />
        <span>Aktif</span>
      </div>
    );
  }
  if (status === "scheduled") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 500, color: T.statusScheduled }}>
        <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: T.statusScheduled, display: "inline-block" }} />
        <span>Terjadwal</span>
      </div>
    );
  }
  if (status === "draft") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 500, color: T.statusDraft }}>
        <span style={{ width: "6px", height: "6px", borderRadius: "50%", border: `1.5px solid ${T.statusDraft}`, backgroundColor: "transparent", display: "inline-block" }} />
        <span>Draft</span>
      </div>
    );
  }
  if (status === "ended") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 500, color: T.statusFinished }}>
        <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: T.statusFinished, display: "inline-block" }} />
        <span>Selesai</span>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 500, color: T.statusArchived }}>
      <span style={{ width: "6px", height: "6px", borderRadius: "50%", border: `1.5px solid ${T.statusArchived}`, backgroundColor: "transparent", display: "inline-block" }} />
      <span>Diarsipkan</span>
    </div>
  );
}

function getContextLine(exam: ExamItem): string {
  switch (exam.status) {
    case "active":
      return `${exam.online || 28} dari ${exam.enrolled || 34} online · ● ${exam.flagCount || 3} pelanggaran`;
    case "scheduled":
      return "Mulai Sen, 2 Nov · 09:00";
    case "draft":
      return exam.updatedAt ? `Diubah ${exam.updatedAt}` : "Diubah 2 hari lalu";
    case "ended":
      return `Selesai 28 Sep · ${exam.totalParticipants} peserta`;
    case "archived":
      return "Diarsipkan 15 Agu";
  }
}

function PrimaryActionButton({ exam }: { exam: ExamItem }) {
  if (exam.status === "active") {
    return (
      <Link href={`/dashboard/exams/${exam.id}/monitor`} className="action-btn-solid">
        Monitor
      </Link>
    );
  }
  if (exam.status === "scheduled") {
    return (
      <Link href={`/dashboard/exams/${exam.id}`} className="action-btn-solid">
        Detail
      </Link>
    );
  }
  if (exam.status === "draft") {
    return (
      <Link href={`/dashboard/exams/${exam.id}/edit`} className="action-btn-solid">
        Lanjutkan
      </Link>
    );
  }
  if (exam.status === "ended") {
    return (
      <Link href={`/dashboard/exams/${exam.id}/results`} className="action-btn-solid">
        Lihat hasil
      </Link>
    );
  }
  return (
    <button type="button" className="action-btn-outline">
      Pulihkan
    </button>
  );
}

function ExamCard({
  exam,
  isMenuOpen,
  onToggleMenu,
  onCopyCode,
  onActionConfirm,
}: {
  exam: ExamItem;
  isMenuOpen: boolean;
  onToggleMenu: (id: string) => void;
  onCopyCode: (code: string) => void;
  onActionConfirm: (type: "delete" | "archive" | "restore", exam: ExamItem) => void;
}) {
  const isArchived = exam.status === "archived";
  const showAccessCode = exam.status === "active" || exam.status === "scheduled";

  return (
    <article className={`exam-card ${isArchived ? "is-archived" : ""}`}>
      {/* Top Row: Status Dot + Text on left, Overflow Menu on right */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
        <StatusIndicator status={exam.status} />

        {/* Overflow Menu Button */}
        <div style={{ position: "relative" }}>
          <button
            type="button"
            className="overflow-menu-btn"
            onClick={() => onToggleMenu(exam.id)}
            aria-label={`Menu opsi untuk ${exam.title}`}
            aria-haspopup="true"
            aria-expanded={isMenuOpen}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="1" />
              <circle cx="19" cy="12" r="1" />
              <circle cx="5" cy="12" r="1" />
            </svg>
          </button>

          {isMenuOpen && (
            <div
              role="menu"
              style={{
                position: "absolute",
                top: "100%",
                right: 0,
                background: T.bgCard,
                border: `1px solid ${T.border}`,
                borderRadius: T.radiusCard,
                boxShadow: "0 4px 16px rgba(20,24,40,0.12)",
                padding: "4px",
                zIndex: 100,
                minWidth: "140px",
              }}
            >
              <button
                type="button"
                className="user-menu-item"
                role="menuitem"
                onClick={() => onToggleMenu(exam.id)}
              >
                Duplikat
              </button>
              {exam.status === "archived" ? (
                <button
                  type="button"
                  className="user-menu-item"
                  role="menuitem"
                  onClick={() => onActionConfirm("restore", exam)}
                >
                  Pulihkan
                </button>
              ) : (
                <button
                  type="button"
                  className="user-menu-item"
                  role="menuitem"
                  onClick={() => onActionConfirm("archive", exam)}
                >
                  Arsipkan
                </button>
              )}
              <button
                type="button"
                className="user-menu-item danger"
                role="menuitem"
                onClick={() => onActionConfirm("delete", exam)}
              >
                Hapus
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Exam Title: 15 / 22 / 600, max 2 lines with ellipsis */}
      <h3
        style={{
          margin: "0 0 8px 0",
          fontSize: "15px",
          lineHeight: "22px",
          fontWeight: 600,
        }}
      >
        <Link
          href={`/dashboard/exams/${exam.id}`}
          style={{
            color: T.textPrimary,
            textDecoration: "none",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
          title={exam.title}
        >
          {exam.title}
        </Link>
      </h3>

      {/* Meta Line: Duration & Question Count with 14px line icons */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "14px",
          fontSize: "12px",
          lineHeight: "18px",
          color: T.textSecondary,
          marginBottom: "12px",
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          {exam.duration} menit
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 11l3 3L22 4" />
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
          </svg>
          {exam.questionCount} soal
        </span>
      </div>

      {/* Divider */}
      <div style={{ height: "1px", background: T.border, margin: "0 0 12px 0" }} />

      {/* Access Code Row (Shown ONLY for active and scheduled per spec §4.6) */}
      {showAccessCode && (
        <div
          style={{
            background: T.bgSubtle,
            borderRadius: T.radiusControl,
            padding: "8px 12px",
            marginBottom: "12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span style={{ fontSize: "12px", color: T.textSecondary }}>Kode akses</span>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span
              style={{
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                fontSize: "13px",
                fontWeight: 600,
                letterSpacing: "0.04em",
                color: T.textPrimary,
              }}
            >
              {exam.accessCode}
            </span>
            <button
              type="button"
              className="copy-code-btn"
              onClick={() => onCopyCode(exam.accessCode || "")}
              aria-label={`Salin kode akses ${exam.accessCode}`}
              title="Salin kode akses"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Context Line: Depends on status (Spec §4.6 table) */}
      <div
        style={{
          fontSize: "12px",
          color: T.textSecondary,
          marginBottom: "16px",
          minHeight: "18px",
        }}
      >
        {exam.status === "active" ? (
          <span>
            <strong style={{ color: T.textPrimary }}>{exam.online || 0}</strong> dari {exam.totalParticipants || exam.enrolled || 0} online ·{" "}
            <span style={{ color: T.flagTabSwitch }}>●</span> {exam.flagCount || 0} pelanggaran
          </span>
        ) : (
          getContextLine(exam)
        )}
      </div>

      {/* Actions Row: Bottom, right-aligned, height 36px */}
      <div
        style={{
          marginTop: "auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: "8px",
        }}
      >
        <PrimaryActionButton exam={exam} />
        {exam.status === "scheduled" ? (
          <Link href={`/dashboard/exams/${exam.id}/edit`} className="action-btn-outline">
            Ubah
          </Link>
        ) : (
          <Link href={`/dashboard/exams/${exam.id}`} className="action-btn-outline">
            Detail
          </Link>
        )}
      </div>
    </article>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>Memuat…</div>}>
      <DashboardContent />
    </Suspense>
  );
}
