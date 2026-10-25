"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { mockResults, mockResultStats, mockExams } from "@/lib/mockData";
import DashboardShell from "@/app/components/DashboardShell";

function ResultsPage() {
  const params = useParams();
  const exam = mockExams.find(e => e.id === params.id) ?? mockExams[2];
  const [sortBy, setSortBy] = useState<{ col: string; dir: "asc" | "desc" }>({ col: "score", dir: "desc" });
  const [toast, setToast] = useState<{ msg: string } | null>(null);

  const showToast = (msg: string) => { setToast({ msg }); setTimeout(() => setToast(null), 3000); };

  const sorted = [...mockResults].sort((a, b) => {
    const dir = sortBy.dir === "asc" ? 1 : -1;
    if (sortBy.col === "score") return (a.score - b.score) * dir;
    if (sortBy.col === "name") return a.name.localeCompare(b.name) * dir;
    if (sortBy.col === "violations") return (a.violations - b.violations) * dir;
    return 0;
  });

  const toggleSort = (col: string) => {
    setSortBy(s => ({ col, dir: s.col === col && s.dir === "desc" ? "asc" : "desc" }));
  };

  const passingScore = 70;

  const ranges = [
    { label: "0–59", color: "#EF4444", count: mockResults.filter(r => r.score < 60).length },
    { label: "60–69", color: "#F59E0B", count: mockResults.filter(r => r.score >= 60 && r.score < 70).length },
    { label: "70–79", color: "#3B82F6", count: mockResults.filter(r => r.score >= 70 && r.score < 80).length },
    { label: "80–89", color: "#8B5CF6", count: mockResults.filter(r => r.score >= 80 && r.score < 90).length },
    { label: "90–100", color: "#10B981", count: mockResults.filter(r => r.score >= 90).length },
  ];
  const maxCount = Math.max(...ranges.map(r => r.count));

  const SortIcon = ({ col }: { col: string }) => {
    if (sortBy.col !== col) return <span style={{ color: "#D1D5DB" }}>↕</span>;
    return <span style={{ color: "#2563EB" }}>{sortBy.dir === "asc" ? "↑" : "↓"}</span>;
  };

  return (
    <DashboardShell>
      {/* Header */}
      <header style={{
        background: "white", borderBottom: "1px solid #E9ECF0",
        padding: "16px 32px", position: "sticky", top: 0, zIndex: 50,
        display: "flex", alignItems: "center", justifyContent: "space-between"
      }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#9CA3AF", marginBottom: "4px" }}>
            <Link href="/dashboard" style={{ color: "#9CA3AF", textDecoration: "none" }}>Dashboard</Link>
            <span>›</span>
            <Link href={`/dashboard/exams/${exam.id}`} style={{ color: "#9CA3AF", textDecoration: "none" }}>{exam.title}</Link>
            <span>›</span>
            <span style={{ color: "#111827" }}>Hasil Ujian</span>
          </div>
          <h1 style={{ fontSize: "20px", fontWeight: 700, color: "#111827" }}>🏆 Hasil Ujian</h1>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={() => showToast("File CSV berhasil didownload")}
            style={{ height: "38px", paddingLeft: "14px", paddingRight: "14px", border: "1.5px solid #E5E7EB", borderRadius: "10px", background: "white", color: "#374151", cursor: "pointer", fontSize: "14px", display: "flex", alignItems: "center", gap: "6px" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Export CSV
          </button>
          <button
            onClick={() => showToast("File Excel berhasil didownload")}
            style={{ height: "38px", paddingLeft: "14px", paddingRight: "14px", border: "1.5px solid #E5E7EB", borderRadius: "10px", background: "white", color: "#374151", cursor: "pointer", fontSize: "14px", display: "flex", alignItems: "center", gap: "6px" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Export Excel
          </button>
        </div>
      </header>

      <div style={{ padding: "24px 32px" }}>
        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "14px", marginBottom: "24px" }}>
          {[
            { label: "Rata-rata", val: mockResultStats.average, icon: "📊", bg: "#EFF6FF", color: "#2563EB" },
            { label: "Nilai Tertinggi", val: mockResultStats.highest, icon: "🏆", bg: "#DCFCE7", color: "#16A34A" },
            { label: "Nilai Terendah", val: mockResultStats.lowest, icon: "📉", bg: "#FEE2E2", color: "#DC2626" },
            { label: "Total Submit", val: mockResultStats.totalSubmit, icon: "👥", bg: "#DBEAFE", color: "#1D4ED8" },
            { label: "Persentase Lulus", val: `${mockResultStats.passPercentage}%`, icon: "✅", bg: "#DCFCE7", color: "#16A34A" },
          ].map(s => (
            <div key={s.label} style={{
              background: "white", borderRadius: "12px", border: "1px solid #E9ECF0",
              padding: "16px", textAlign: "center",
              boxShadow: "0 1px 4px rgba(0,0,0,0.04)"
            }}>
              <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: s.bg, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 8px", fontSize: "18px" }}>{s.icon}</div>
              <div style={{ fontSize: "24px", fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.val}</div>
              <div style={{ fontSize: "12px", color: "#9CA3AF", marginTop: "4px" }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Distribution Chart */}
        <div style={{ background: "white", borderRadius: "14px", border: "1px solid #E9ECF0", overflow: "hidden", marginBottom: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #F3F4F6", fontWeight: 600, color: "#111827" }}>
            📊 Distribusi Nilai
          </div>
          <div style={{ padding: "24px", display: "flex", alignItems: "flex-end", gap: "20px", justifyContent: "center", height: "180px" }}>
            {ranges.map(r => (
              <div key={r.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", flex: 1 }}>
                <span style={{ fontSize: "14px", fontWeight: 700, color: "#374151" }}>{r.count}</span>
                <div style={{
                  width: "100%", maxWidth: "60px",
                  height: `${maxCount > 0 ? (r.count / maxCount) * 100 : 0}px`,
                  background: r.color, borderRadius: "6px 6px 0 0",
                  transition: "height 0.5s ease", minHeight: r.count > 0 ? "8px" : "0"
                }} />
                <span style={{ fontSize: "12px", color: "#9CA3AF" }}>{r.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Results Table */}
        <div style={{ background: "white", borderRadius: "14px", border: "1px solid #E9ECF0", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E9ECF0" }}>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.06em", width: "40px" }}>#</th>
                <th
                  onClick={() => toggleSort("name")}
                  style={{ padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.06em", cursor: "pointer" }}
                >Nama <SortIcon col="name" /></th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.06em" }}>NIM</th>
                <th
                  onClick={() => toggleSort("score")}
                  style={{ padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.06em", cursor: "pointer" }}
                >Nilai <SortIcon col="score" /></th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.06em" }}>Benar/Total</th>
                <th
                  onClick={() => toggleSort("violations")}
                  style={{ padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.06em", cursor: "pointer" }}
                >Pelanggaran <SortIcon col="violations" /></th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.06em" }}>Submit Pada</th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.06em" }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r, idx) => (
                <tr key={r.id} style={{ borderBottom: idx < sorted.length - 1 ? "1px solid #F3F4F6" : "none" }}>
                  <td style={{ padding: "12px 16px", color: "#9CA3AF", fontSize: "13px" }}>{idx + 1}</td>
                  <td style={{ padding: "12px 16px", fontWeight: 500, color: "#111827", fontSize: "14px" }}>{r.name}</td>
                  <td style={{ padding: "12px 16px", fontFamily: "monospace", fontSize: "13px", color: "#6B7280" }}>{r.nim}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{
                      fontWeight: 800, fontSize: "16px",
                      color: r.score < passingScore ? "#DC2626" : "#16A34A"
                    }}>{r.score}</span>
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: "13px", color: "#374151" }}>{r.correct}/{r.total}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{
                      background: r.violations === 0 ? "#DCFCE7" : r.violations <= 2 ? "#FEF3C7" : "#FEE2E2",
                      color: r.violations === 0 ? "#16A34A" : r.violations <= 2 ? "#D97706" : "#DC2626",
                      padding: "2px 10px", borderRadius: "100px", fontSize: "13px", fontWeight: 700
                    }}>{r.violations}</span>
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: "13px", color: "#6B7280" }}>{r.submittedAt}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <Link
                      href={`/dashboard/exams/${exam.id}/results/${r.id}`}
                      style={{
                        height: "30px", paddingLeft: "10px", paddingRight: "10px",
                        background: "#EFF6FF", color: "#2563EB",
                        borderRadius: "6px", fontSize: "12px", fontWeight: 600,
                        display: "inline-flex", alignItems: "center", textDecoration: "none", whiteSpace: "nowrap"
                      }}
                    >Detail Jawaban</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {toast && (
        <div className="toast-container">
          <div className="toast success">
            <span className="toast-icon">✅</span>
            <div className="toast-content"><div className="toast-msg">{toast.msg}</div></div>
            <button className="toast-close" onClick={() => setToast(null)}>✕</button>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}

export default function ResultsPageWrapper() {
  return <Suspense><ResultsPage /></Suspense>;
}
