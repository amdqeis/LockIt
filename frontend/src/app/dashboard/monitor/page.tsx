"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/apiClient";
import DashboardShell from "@/app/components/DashboardShell";

const T = {
  bgPage: "#F6F8FB",
  bgCard: "#FFFFFF",
  bgSubtle: "#F0F3F8",
  border: "#E1E6ED",
  textPrimary: "#172033",
  textSecondary: "#5B6778",
  primary: "#1B76BF",
  primaryTint: "#E6F1FA",
  success: "#177A4B",
  successBg: "#E6F7EF",
  radiusCard: "8px",
  radiusControl: "8px",
  shadowCard: "0 2px 8px rgba(20,24,40,0.08)",
  shadowCardHover: "0 4px 14px rgba(20,24,40,0.14)",
};

interface ActiveExam {
  id: string;
  title: string;
  accessCode: string;
  startTime?: string;
  onlineCount: number;
  totalEnrolled: number;
  flagCount: number;
}

function ElapsedTime({ startTime }: { startTime?: string }) {
  const [elapsed, setElapsed] = useState("");

  useEffect(() => {
    if (!startTime) return;
    const calc = () => {
      const diff = Math.floor((Date.now() - new Date(startTime).getTime()) / 1000);
      if (diff < 60) return `${diff}d`;
      if (diff < 3600) return `${Math.floor(diff / 60)}m`;
      const h = Math.floor(diff / 3600);
      const m = Math.floor((diff % 3600) / 60);
      return `${h}j ${m}m`;
    };
    setElapsed(calc());
    const t = setInterval(() => setElapsed(calc()), 30_000);
    return () => clearInterval(t);
  }, [startTime]);

  return <span>{elapsed || "—"}</span>;
}

export default function MonitorSelectionPage() {
  const [exams, setExams] = useState<ActiveExam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setError(null);
    try {
      const res = await apiFetch<any>("/api/exams?status=active");
      if (res.success && res.data) {
        const raw: any[] = res.data.exams ?? res.data ?? [];
        setExams(
          raw.map((e: any) => ({
            id: e.id,
            title: e.title,
            accessCode: e.access_code ?? e.accessCode ?? "—",
            startTime: e.start_time ?? e.startTime,
            onlineCount: e.online ?? e.onlineCount ?? 0,
            totalEnrolled: e.enrolled ?? e.totalParticipants ?? 0,
            flagCount: e.flagCount ?? e.violation_count ?? 0,
          }))
        );
      } else {
        setError(res.error?.message ?? "Gagal memuat data ujian.");
      }
    } catch {
      setError("Tidak dapat terhubung ke server.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <DashboardShell>
      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.5; transform: scale(0.85); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .exam-monitor-card {
          display: block;
          background: ${T.bgCard};
          border: 1px solid ${T.border};
          border-radius: ${T.radiusCard};
          padding: 20px 24px;
          text-decoration: none;
          transition: box-shadow 160ms ease, border-color 160ms ease, transform 160ms ease;
          cursor: pointer;
        }
        .exam-monitor-card:hover {
          box-shadow: ${T.shadowCardHover};
          border-color: ${T.primary};
          transform: translateY(-1px);
        }
        .exam-monitor-card:focus-visible {
          outline: 2px solid ${T.primary};
          outline-offset: 2px;
        }
      `}</style>

      <div
        style={{
          padding: "32px",
          maxWidth: "900px",
          margin: "0 auto",
          fontFamily: "var(--font-family, 'Poppins', sans-serif)",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            marginBottom: "28px",
            gap: "16px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1
              style={{
                fontSize: "22px",
                fontWeight: 700,
                color: T.textPrimary,
                margin: 0,
                letterSpacing: "-0.01em",
              }}
            >
              Monitoring Live
            </h1>
            <p style={{ fontSize: "14px", color: T.textSecondary, margin: "4px 0 0" }}>
              Pilih ujian yang sedang berlangsung untuk dipantau secara real-time.
            </p>
          </div>

          {!loading && exams.length > 0 && (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                background: T.successBg,
                color: T.success,
                padding: "6px 12px",
                borderRadius: "20px",
                fontSize: "13px",
                fontWeight: 600,
                whiteSpace: "nowrap",
              }}
            >
              <span
                style={{
                  width: "7px",
                  height: "7px",
                  borderRadius: "50%",
                  background: T.success,
                  display: "inline-block",
                  animation: "pulse-dot 1.4s ease-in-out infinite",
                }}
              />
              {exams.length} ujian aktif
            </div>
          )}
        </div>

        {/* Loading */}
        {loading && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              padding: "64px 0",
              gap: "16px",
              color: T.textSecondary,
            }}
          >
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke={T.primary}
              strokeWidth="2"
              strokeLinecap="round"
              style={{ animation: "spin 1s linear infinite" }}
            >
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
            <span style={{ fontSize: "14px" }}>Memuat daftar ujian aktif…</span>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div
            style={{
              background: "#FCE9E9",
              border: "1px solid #F5BABA",
              borderRadius: T.radiusCard,
              padding: "16px 20px",
              color: "#C73E3E",
              fontSize: "14px",
            }}
          >
            {error}
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && exams.length === 0 && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              padding: "64px 0",
              gap: "12px",
              color: T.textSecondary,
            }}
          >
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke={T.border}
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "15px", fontWeight: 600, color: T.textPrimary, marginBottom: "4px" }}>
                Tidak ada ujian yang sedang berlangsung
              </div>
              <div style={{ fontSize: "13px" }}>
                Ujian dengan status aktif akan muncul di sini secara otomatis.
              </div>
            </div>
            <Link
              href="/dashboard/exams"
              style={{
                marginTop: "8px",
                padding: "8px 16px",
                background: T.primaryTint,
                color: T.primary,
                borderRadius: T.radiusControl,
                textDecoration: "none",
                fontSize: "13px",
                fontWeight: 600,
              }}
            >
              Kelola Ujian →
            </Link>
          </div>
        )}

        {/* Exam cards */}
        {!loading && !error && exams.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {exams.map((exam) => (
              <Link
                key={exam.id}
                href={`/dashboard/exams/${exam.id}/monitor`}
                className="exam-monitor-card"
                aria-label={`Monitor ujian ${exam.title}`}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "16px",
                    flexWrap: "wrap",
                  }}
                >
                  {/* Live indicator */}
                  <div
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "50%",
                      background: T.successBg,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <span
                      style={{
                        width: "10px",
                        height: "10px",
                        borderRadius: "50%",
                        background: T.success,
                        display: "block",
                        animation: "pulse-dot 1.4s ease-in-out infinite",
                      }}
                    />
                  </div>

                  {/* Title + meta */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: "15px",
                        fontWeight: 600,
                        color: T.textPrimary,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {exam.title}
                    </div>
                    <div style={{ fontSize: "12px", color: T.textSecondary, marginTop: "2px" }}>
                      Kode:{" "}
                      <span style={{ fontWeight: 600, letterSpacing: "0.04em" }}>
                        {exam.accessCode}
                      </span>
                      {exam.startTime && (
                        <>
                          {" · Berjalan "}
                          <ElapsedTime startTime={exam.startTime} />
                        </>
                      )}
                    </div>
                  </div>

                  {/* Stats */}
                  <div style={{ display: "flex", gap: "24px", flexShrink: 0 }}>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "18px", fontWeight: 700, color: T.success, lineHeight: 1 }}>
                        {exam.onlineCount}
                      </div>
                      <div style={{ fontSize: "11px", color: T.textSecondary, marginTop: "2px" }}>
                        Online
                      </div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "18px", fontWeight: 700, color: T.textPrimary, lineHeight: 1 }}>
                        {exam.totalEnrolled}
                      </div>
                      <div style={{ fontSize: "11px", color: T.textSecondary, marginTop: "2px" }}>
                        Peserta
                      </div>
                    </div>
                    {exam.flagCount > 0 && (
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: "18px", fontWeight: 700, color: "#DC2626", lineHeight: 1 }}>
                          {exam.flagCount}
                        </div>
                        <div style={{ fontSize: "11px", color: T.textSecondary, marginTop: "2px" }}>
                          Pelanggaran
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Arrow */}
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={T.textSecondary}
                    strokeWidth="2"
                    strokeLinecap="round"
                    style={{ flexShrink: 0 }}
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
