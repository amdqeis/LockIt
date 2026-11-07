"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/apiClient";
import DashboardShell from "@/app/components/DashboardShell";
import { SkeletonBase } from "@/app/components/skeleton";

const T = {
  bgPage: "#F7F8F6",
  bgCard: "#FFFFFF",
  bgSubtle: "#EDF3F4",
  border: "#D7DEE3",
  textPrimary: "#25313B",
  textSecondary: "#5F6B75",
  primary: "#4F6B80",
  primaryTint: "#DCE8F0",
  statusFinished: "#5F6B75",
  statusFinishedBg: "#EDF3F4",
  radiusCard: "10px",
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
  className: string;
  examType: string;
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

function extractClassAndType(exam: any): { className: string; examType: string } {
  const settings = (typeof exam.settings === "object" && exam.settings !== null ? exam.settings : {}) as any;
  let className = (settings.class_name || settings.class || "").trim();
  let examType = (settings.exam_type || settings.category || "").trim();
  const title = (exam.title || "").trim();

  if (!className) {
    const match = title.match(/(?:kelas|kls)\s*([0-9a-zA-Z\s\-]+)/i);
    className = match ? `Kelas ${match[1].trim()}` : "Semua Kelas / Umum";
  }

  if (!examType) {
    if (/quiz\s*1/i.test(title)) examType = "Quiz 1";
    else if (/quiz\s*2/i.test(title)) examType = "Quiz 2";
    else if (/uts/i.test(title)) examType = "UTS";
    else if (/uas/i.test(title)) examType = "UAS";
    else if (/ulangan\s*harian/i.test(title)) examType = "Ulangan Harian";
    else examType = "Ujian Umum";
  }

  return { className, examType };
}

export default function ResultsSelectionPage() {
  const [exams, setExams] = useState<FinishedExam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedClass, setSelectedClass] = useState<string>("all");
  const [selectedExamType, setSelectedExamType] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grouped" | "flat">("grouped");

  useEffect(() => {
    const load = async () => {
      setError(null);
      try {
        const res = await apiFetch<any>("/api/exams?status=ended");
        if (res.success && res.data) {
          const raw: any[] = res.data.exams ?? res.data ?? [];
          setExams(
            raw.map((e: any) => {
              const { className, examType } = extractClassAndType(e);
              return {
                id: e.id,
                title: e.title,
                accessCode: e.access_code ?? e.accessCode ?? "—",
                endTime: e.end_time ?? e.endTime,
                totalParticipants: e.enrolled ?? e.totalParticipants ?? 0,
                submittedCount: e.submittedCount ?? e.totalParticipants ?? 0,
                avgScore: e.avgScore,
                className,
                examType,
              };
            })
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

  const distinctClasses = useMemo(() => {
    const set = new Set<string>();
    exams.forEach((e) => {
      if (e.className) set.add(e.className);
    });
    return Array.from(set).sort();
  }, [exams]);

  const distinctExamTypes = useMemo(() => {
    const set = new Set<string>();
    exams.forEach((e) => {
      if (e.examType) set.add(e.examType);
    });
    return Array.from(set).sort();
  }, [exams]);

  const filtered = useMemo(() => {
    return exams.filter((e) => {
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        e.title.toLowerCase().includes(q) ||
        e.className.toLowerCase().includes(q) ||
        e.examType.toLowerCase().includes(q) ||
        e.accessCode.toLowerCase().includes(q);

      const matchesClass = selectedClass === "all" || e.className === selectedClass;
      const matchesType = selectedExamType === "all" || e.examType === selectedExamType;

      return matchesSearch && matchesClass && matchesType;
    });
  }, [exams, search, selectedClass, selectedExamType]);

  // Hierarchical Grouping: Class Name -> Map<Exam Type, FinishedExam[]>
  const groupedData = useMemo(() => {
    const map = new Map<string, Map<string, FinishedExam[]>>();
    filtered.forEach((exam) => {
      if (!map.has(exam.className)) {
        map.set(exam.className, new Map<string, FinishedExam[]>());
      }
      const typeMap = map.get(exam.className)!;
      if (!typeMap.has(exam.examType)) {
        typeMap.set(exam.examType, []);
      }
      typeMap.get(exam.examType)!.push(exam);
    });
    return map;
  }, [filtered]);

  return (
    <DashboardShell>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .exam-result-card {
          display: block;
          background: ${T.bgCard};
          border: 1px solid ${T.border};
          border-radius: ${T.radiusCard};
          padding: 16px 20px;
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
        .filter-select {
          height: 40px;
          padding: 0 12px;
          border: 1px solid ${T.border};
          border-radius: ${T.radiusControl};
          font-size: 13px;
          font-weight: 500;
          color: ${T.textPrimary};
          background: ${T.bgCard};
          outline: none;
          cursor: pointer;
        }
        .filter-select:focus {
          border-color: ${T.primary};
        }
      `}</style>

      <div
        style={{
          padding: "32px",
          maxWidth: "960px",
          margin: "0 auto",
          fontFamily: "var(--font-family, 'Poppins', sans-serif)",
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: "24px" }}>
          <h1
            style={{
              fontSize: "22px",
              fontWeight: 700,
              color: T.textPrimary,
              margin: 0,
              letterSpacing: "-0.01em",
            }}
          >
            Rekap Hasil Ujian
          </h1>
          <p style={{ fontSize: "14px", color: T.textSecondary, margin: "4px 0 0" }}>
            Rekapitulasi hasil ujian yang telah berakhir, dikelompokkan berdasarkan Kelas dan Nama/Kategori Ujian.
          </p>
        </div>

        {/* Search & Filter Toolbar */}
        {!loading && !error && exams.length > 0 && (
          <div
            style={{
              background: "white",
              border: `1px solid ${T.border}`,
              borderRadius: T.radiusCard,
              padding: "16px",
              marginBottom: "24px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            }}
          >
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
              {/* Search */}
              <div style={{ flex: 1, minWidth: "220px", position: "relative" }}>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#8597A3"
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
                  placeholder="Cari ujian, kelas, atau kode..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  aria-label="Cari ujian"
                />
              </div>

              {/* Filter: Kelas */}
              <select
                className="filter-select"
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                aria-label="Filter berdasarkan kelas"
              >
                <option value="all">Semua Kelas ({distinctClasses.length})</option>
                {distinctClasses.map((cls) => (
                  <option key={cls} value={cls}>
                    {cls}
                  </option>
                ))}
              </select>

              {/* Filter: Nama / Kategori Ujian */}
              <select
                className="filter-select"
                value={selectedExamType}
                onChange={(e) => setSelectedExamType(e.target.value)}
                aria-label="Filter berdasarkan nama ujian"
              >
                <option value="all">Semua Kategori ({distinctExamTypes.length})</option>
                {distinctExamTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>

              {/* View Mode Toggle */}
              <div style={{ display: "flex", background: T.bgSubtle, borderRadius: "8px", padding: "2px" }}>
                <button
                  type="button"
                  onClick={() => setViewMode("grouped")}
                  style={{
                    border: "none",
                    background: viewMode === "grouped" ? "white" : "transparent",
                    color: viewMode === "grouped" ? T.primary : T.textSecondary,
                    fontWeight: 600,
                    fontSize: "12px",
                    padding: "6px 12px",
                    borderRadius: "6px",
                    cursor: "pointer",
                    boxShadow: viewMode === "grouped" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                  }}
                >
                  Grup Kelas
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("flat")}
                  style={{
                    border: "none",
                    background: viewMode === "flat" ? "white" : "transparent",
                    color: viewMode === "flat" ? T.primary : T.textSecondary,
                    fontWeight: 600,
                    fontSize: "12px",
                    padding: "6px 12px",
                    borderRadius: "6px",
                    cursor: "pointer",
                    boxShadow: viewMode === "flat" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                  }}
                >
                  Semua List
                </button>
              </div>
            </div>

            {/* Active filter pills */}
            {(selectedClass !== "all" || selectedExamType !== "all" || search) && (
              <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap", fontSize: "12px", color: T.textSecondary }}>
                <span>Filter aktif:</span>
                {selectedClass !== "all" && (
                  <span style={{ background: T.primaryTint, color: T.primary, padding: "2px 8px", borderRadius: "99px", display: "inline-flex", alignItems: "center", gap: "4px", fontWeight: 600 }}>
                    Kelas: {selectedClass}
                    <button onClick={() => setSelectedClass("all")} style={{ border: "none", background: "none", cursor: "pointer", color: T.primary, fontSize: "12px" }}>✕</button>
                  </span>
                )}
                {selectedExamType !== "all" && (
                  <span style={{ background: "#FEF3C7", color: "#B45309", padding: "2px 8px", borderRadius: "99px", display: "inline-flex", alignItems: "center", gap: "4px", fontWeight: 600 }}>
                    Tipe: {selectedExamType}
                    <button onClick={() => setSelectedExamType("all")} style={{ border: "none", background: "none", cursor: "pointer", color: "#B45309", fontSize: "12px" }}>✕</button>
                  </span>
                )}
                {search && (
                  <span style={{ background: "#E2E8F0", color: "#334155", padding: "2px 8px", borderRadius: "99px", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                    &ldquo;{search}&rdquo;
                    <button onClick={() => setSearch("")} style={{ border: "none", background: "none", cursor: "pointer", color: "#334155", fontSize: "12px" }}>✕</button>
                  </span>
                )}
                <button
                  onClick={() => { setSelectedClass("all"); setSelectedExamType("all"); setSearch(""); }}
                  style={{ background: "none", border: "none", color: T.primary, fontSize: "12px", fontWeight: 600, cursor: "pointer", textDecoration: "underline" }}
                >
                  Reset Filter
                </button>
              </div>
            )}
          </div>
        )}

        {/* Loading Skeleton */}
        {loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                style={{
                  padding: "20px",
                  background: T.bgCard,
                  border: `1px solid ${T.border}`,
                  borderRadius: T.radiusCard,
                  boxShadow: T.shadowCard,
                  display: "flex",
                  alignItems: "center",
                  gap: "16px",
                }}
              >
                <SkeletonBase width="40px" height="40px" borderRadius="8px" />
                <div style={{ flex: 1 }}>
                  <SkeletonBase width="45%" height="18px" borderRadius="4px" style={{ marginBottom: "6px" }} />
                  <SkeletonBase width="25%" height="12px" borderRadius="4px" />
                </div>
                <SkeletonBase width="80px" height="30px" borderRadius="6px" />
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div
            style={{
              background: "#F7E5E3",
              border: "1px solid #F5BABA",
              borderRadius: T.radiusCard,
              padding: "16px 20px",
              color: "#914848",
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
            <div style={{ fontSize: "40px" }}>📋</div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "16px", fontWeight: 600, color: T.textPrimary, marginBottom: "4px" }}>
                Belum ada ujian yang selesai
              </div>
              <div style={{ fontSize: "13px" }}>Ujian yang telah berakhir akan muncul di sini.</div>
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

        {/* Empty search / filter */}
        {!loading && !error && exams.length > 0 && filtered.length === 0 && (
          <div
            style={{
              padding: "48px 24px",
              textAlign: "center",
              background: "white",
              borderRadius: T.radiusCard,
              border: `1px solid ${T.border}`,
            }}
          >
            <div style={{ fontSize: "32px", marginBottom: "8px" }}>🔍</div>
            <div style={{ fontSize: "15px", fontWeight: 600, color: T.textPrimary, marginBottom: "4px" }}>
              Tidak ada ujian yang cocok dengan kriteria filter
            </div>
            <p style={{ fontSize: "13px", color: T.textSecondary, margin: "0 0 16px" }}>
              Coba reset filter kelas atau kata kunci pencarian Anda.
            </p>
            <button
              onClick={() => { setSelectedClass("all"); setSelectedExamType("all"); setSearch(""); }}
              style={{
                padding: "8px 18px",
                background: T.primary,
                color: "white",
                border: "none",
                borderRadius: T.radiusControl,
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Reset Semua Filter
            </button>
          </div>
        )}

        {/* VIEW MODE 1: HIERARCHICAL GROUPED VIEW (By Class -> By Exam Type) */}
        {!loading && !error && filtered.length > 0 && viewMode === "grouped" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
            {Array.from(groupedData.entries()).map(([className, typeMap]) => {
              // Count exams in this class
              let classExamCount = 0;
              typeMap.forEach((arr) => { classExamCount += arr.length; });

              return (
                <div
                  key={className}
                  style={{
                    background: "white",
                    border: `1px solid ${T.border}`,
                    borderRadius: T.radiusCard,
                    overflow: "hidden",
                    boxShadow: "0 2px 6px rgba(0,0,0,0.03)",
                  }}
                >
                  {/* Tingkat 1: Header Kelas */}
                  <div
                    style={{
                      padding: "16px 20px",
                      background: "#F8FAFC",
                      borderBottom: `1px solid ${T.border}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ fontSize: "20px" }}>🏫</span>
                      <div>
                        <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: T.textPrimary }}>
                          {className}
                        </h2>
                        <span style={{ fontSize: "12px", color: T.textSecondary }}>
                          {classExamCount} Ujian Tersedia
                        </span>
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 700,
                        padding: "3px 10px",
                        borderRadius: "99px",
                        background: T.primaryTint,
                        color: T.primary,
                      }}
                    >
                      {typeMap.size} Kategori Ujian
                    </span>
                  </div>

                  {/* Tingkat 2: Grup per Nama/Kategori Ujian */}
                  <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: "20px" }}>
                    {Array.from(typeMap.entries()).map(([examType, examList]) => (
                      <div key={examType}>
                        {/* Subheader Kategori / Nama Ujian */}
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                          <span style={{ fontSize: "12px", fontWeight: 700, color: "#1E293B", textTransform: "uppercase", letterSpacing: "0.06em", background: "#EFF6FF", border: "1px solid #BFDBFE", padding: "2px 8px", borderRadius: "6px" }}>
                            📝 {examType}
                          </span>
                          <span style={{ fontSize: "11px", color: T.textSecondary }}>
                            ({examList.length} pelaksanaan)
                          </span>
                        </div>

                        {/* Kartu Ujian */}
                        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                          {examList.map((exam) => (
                            <Link
                              key={exam.id}
                              href={`/dashboard/exams/${exam.id}/results`}
                              className="exam-result-card"
                              aria-label={`Lihat hasil ${exam.title}`}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
                                <div style={{ flex: 1, minWidth: "220px" }}>
                                  <div style={{ fontSize: "15px", fontWeight: 600, color: T.textPrimary, marginBottom: "3px" }}>
                                    {exam.title}
                                  </div>
                                  <div style={{ fontSize: "12px", color: T.textSecondary, display: "flex", gap: "12px" }}>
                                    <span>Selesai: {formatDate(exam.endTime)}</span>
                                    <span>Kode: <strong>{exam.accessCode}</strong></span>
                                  </div>
                                </div>

                                {/* Statistik */}
                                <div style={{ display: "flex", gap: "20px", alignItems: "center" }}>
                                  <div style={{ textAlign: "center" }}>
                                    <div style={{ fontSize: "16px", fontWeight: 700, color: T.textPrimary }}>
                                      {exam.submittedCount}
                                    </div>
                                    <div style={{ fontSize: "10px", color: T.textSecondary }}>Submit</div>
                                  </div>
                                  <div style={{ textAlign: "center" }}>
                                    <div style={{ fontSize: "16px", fontWeight: 700, color: T.textPrimary }}>
                                      {exam.totalParticipants}
                                    </div>
                                    <div style={{ fontSize: "10px", color: T.textSecondary }}>Peserta</div>
                                  </div>
                                  {exam.avgScore !== undefined && (
                                    <div style={{ textAlign: "center", minWidth: "60px" }}>
                                      <div style={{ fontSize: "16px", fontWeight: 700, color: T.primary }}>
                                        {exam.avgScore.toFixed(1)}
                                      </div>
                                      <div style={{ fontSize: "10px", color: T.textSecondary }}>Rata-rata</div>
                                    </div>
                                  )}
                                  <span style={{ color: T.primary, fontSize: "13px", fontWeight: 600, display: "flex", alignItems: "center", gap: "4px" }}>
                                    Hasil →
                                  </span>
                                </div>
                              </div>
                            </Link>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* VIEW MODE 2: FLAT LIST VIEW */}
        {!loading && !error && filtered.length > 0 && viewMode === "flat" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {filtered.map((exam) => (
              <Link
                key={exam.id}
                href={`/dashboard/exams/${exam.id}/results`}
                className="exam-result-card"
                aria-label={`Lihat rekap hasil ujian ${exam.title}`}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: "220px" }}>
                    <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "4px" }}>
                      <span style={{ fontSize: "11px", fontWeight: 600, padding: "2px 8px", borderRadius: "4px", background: "#F1F5F9", color: "#475569" }}>
                        🏫 {exam.className}
                      </span>
                      <span style={{ fontSize: "11px", fontWeight: 600, padding: "2px 8px", borderRadius: "4px", background: "#EFF6FF", color: "#2563EB" }}>
                        📝 {exam.examType}
                      </span>
                    </div>
                    <div style={{ fontSize: "15px", fontWeight: 600, color: T.textPrimary }}>
                      {exam.title}
                    </div>
                    <div style={{ fontSize: "12px", color: T.textSecondary, marginTop: "2px" }}>
                      Selesai {formatDate(exam.endTime)} · Kode: <strong>{exam.accessCode}</strong>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "24px", flexShrink: 0, alignItems: "center" }}>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "18px", fontWeight: 700, color: T.textPrimary }}>{exam.submittedCount}</div>
                      <div style={{ fontSize: "11px", color: T.textSecondary }}>Submit</div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "18px", fontWeight: 700, color: T.textPrimary }}>{exam.totalParticipants}</div>
                      <div style={{ fontSize: "11px", color: T.textSecondary }}>Peserta</div>
                    </div>
                    {exam.avgScore !== undefined && (
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: "18px", fontWeight: 700, color: T.primary }}>{exam.avgScore.toFixed(1)}</div>
                        <div style={{ fontSize: "11px", color: T.textSecondary }}>Rata-rata</div>
                      </div>
                    )}
                    <span style={{ color: T.primary, fontSize: "13px", fontWeight: 600 }}>Hasil →</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
