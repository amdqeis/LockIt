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
  statusFinished: "#5B6778",
  statusFinishedBg: "#F0F3F8",
  radiusCard: "8px",
  radiusControl: "8px",
  shadowCard: "0 2px 8px rgba(20,24,40,0.08)",
  shadowCardHover: "0 4px 14px rgba(20,24,40,0.14)",
};

interface FinishedExam {
  id: string;
  title: string;
  accessCode: string;
  endTime?: string;
  totalParticipants: number;
  submittedCount: number;
  avgScore?: number;
}

function formatDate(dateStr?: string) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ResultsSelectionPage() {
  const [exams, setExams] = useState<FinishedExam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const load = async () => {
      setError(null);
      try {
        const res = await apiFetch<any>("/api/exams?status=ended");
        if (res.success && res.data) {
          const raw: any[] = res.data.exams ?? res.data ?? [];
          setExams(
            raw.map((e: any) => ({
              id: e.id,
              title: e.title,
              accessCode: e.access_code ?? e.accessCode ?? "—",
              endTime: e.end_time ?? e.endTime,
              totalParticipants: e.enrolled ?? e.totalParticipants ?? 0,
              submittedCount: e.submittedCount ?? e.totalParticipants ?? 0,
              avgScore: e.avgScore,
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
    load();
  }, []);

  const filtered = exams.filter((e) =>
    e.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <DashboardShell>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .exam-result-card {
          display: block;
          background: ${T.bgCard};
          border: 1px solid ${T.border};
          border-radius: ${T.radiusCard};
          padding: 20px 24px;
          text-decoration: none;
          transition: box-shadow 160ms ease, border-color 160ms ease, transform 160ms ease;
        }
        .exam-result-card:hover {
          box-shadow: ${T.shadowCardHover};
          border-color: ${T.primary};
          transform: translateY(-1px);
        }
        .exam-result-card:focus-visible {
          outline: 2px solid ${T.primary};
          outline-offset: 2px;
        }
        .search-input {
          width: 100%;
          box-sizing: border-box;
          height: 40px;
          padding: 0 12px 0 38px;
          border: 1px solid ${T.border};
          border-radius: ${T.radiusControl};
          font-size: 14px;
          color: ${T.textPrimary};
          background: ${T.bgCard};
          outline: none;
          transition: border-color 150ms ease;
        }
        .search-input:focus {
          border-color: ${T.primary};
          box-shadow: 0 0 0 3px rgba(27,118,191,0.12);
        }
        .search-input::placeholder {
          color: #8391A7;
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
        <div style={{ marginBottom: "28px" }}>
          <h1
            style={{
              fontSize: "22px",
              fontWeight: 700,
              color: T.textPrimary,
              margin: 0,
              letterSpacing: "-0.01em",
            }}
          >
            Rekap Hasil
          </h1>
          <p style={{ fontSize: "14px", color: T.textSecondary, margin: "4px 0 0" }}>
            Pilih ujian yang telah selesai untuk melihat rekap nilai dan pelanggaran.
          </p>
        </div>

        {/* Search */}
        {!loading && !error && exams.length > 0 && (
          <div style={{ position: "relative", marginBottom: "20px" }}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#8391A7"
              strokeWidth="2"
              strokeLinecap="round"
              style={{
                position: "absolute",
                left: "12px",
                top: "50%",
                transform: "translateY(-50%)",
                pointerEvents: "none",
              }}
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="search"
              className="search-input"
              placeholder="Cari ujian…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Cari ujian"
            />
          </div>
        )}

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
            <span style={{ fontSize: "14px" }}>Memuat daftar ujian selesai…</span>
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

        {/* Empty state - no exams */}
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
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "15px", fontWeight: 600, color: T.textPrimary, marginBottom: "4px" }}>
                Belum ada ujian yang selesai
              </div>
              <div style={{ fontSize: "13px" }}>
                Ujian yang telah berakhir akan muncul di sini.
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

        {/* Empty search */}
        {!loading && !error && exams.length > 0 && filtered.length === 0 && (
          <div
            style={{
              padding: "40px",
              textAlign: "center",
              color: T.textSecondary,
              fontSize: "14px",
            }}
          >
            Tidak ada ujian yang cocok dengan pencarian &ldquo;{search}&rdquo;.
          </div>
        )}

        {/* Exam cards */}
        {!loading && !error && filtered.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {filtered.map((exam) => (
              <Link
                key={exam.id}
                href={`/dashboard/exams/${exam.id}/results`}
                className="exam-result-card"
                aria-label={`Lihat rekap hasil ujian ${exam.title}`}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "16px",
                    flexWrap: "wrap",
                  }}
                >
                  {/* Icon */}
                  <div
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "8px",
                      background: T.statusFinishedBg,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={T.statusFinished}
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    >
                      <line x1="18" y1="20" x2="18" y2="10" />
                      <line x1="12" y1="20" x2="12" y2="4" />
                      <line x1="6" y1="20" x2="6" y2="14" />
                    </svg>
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
                      Selesai {formatDate(exam.endTime)}
                    </div>
                  </div>

                  {/* Stats */}
                  <div style={{ display: "flex", gap: "24px", flexShrink: 0 }}>
                    <div style={{ textAlign: "center" }}>
                      <div
                        style={{ fontSize: "18px", fontWeight: 700, color: T.textPrimary, lineHeight: 1 }}
                      >
                        {exam.submittedCount}
                      </div>
                      <div style={{ fontSize: "11px", color: T.textSecondary, marginTop: "2px" }}>
                        Submit
                      </div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div
                        style={{ fontSize: "18px", fontWeight: 700, color: T.textPrimary, lineHeight: 1 }}
                      >
                        {exam.totalParticipants}
                      </div>
                      <div style={{ fontSize: "11px", color: T.textSecondary, marginTop: "2px" }}>
                        Peserta
                      </div>
                    </div>
                    {exam.avgScore !== undefined && (
                      <div style={{ textAlign: "center" }}>
                        <div
                          style={{
                            fontSize: "18px",
                            fontWeight: 700,
                            color: T.primary,
                            lineHeight: 1,
                          }}
                        >
                          {exam.avgScore.toFixed(1)}
                        </div>
                        <div style={{ fontSize: "11px", color: T.textSecondary, marginTop: "2px" }}>
                          Rata-rata
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
