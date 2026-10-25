"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { mockTeacher, mockExams, mockDashboardStats } from "@/lib/mockData";
import DashboardShell from "../components/DashboardShell";

type ExamStatus = "draft" | "active" | "ended" | "archived";

const STATUS_LABELS: Record<ExamStatus, string> = {
  draft: "Draft",
  active: "Aktif",
  ended: "Selesai",
  archived: "Diarsipkan",
};

const EXAM_COLORS = [
  { bg: "linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)" },
  { bg: "linear-gradient(135deg, #29ABE2 0%, #0EA5E9 100%)" },
  { bg: "linear-gradient(135deg, #EC4899 0%, #DB2777 100%)" },
  { bg: "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)" },
  { bg: "linear-gradient(135deg, #10B981 0%, #059669 100%)" },
  { bg: "linear-gradient(135deg, #F97316 0%, #EA580C 100%)" },
];

function DashboardContent() {
  const searchParams = useSearchParams();
  const filterParam = searchParams.get("filter") || "all";

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState(filterParam);
  const [confirmModal, setConfirmModal] = useState<{ type: string; examId: string } | null>(null);
  const [toast, setToast] = useState<{ type: string; msg: string } | null>(null);
  const [dateStr, setDateStr] = useState("");

  // Sync filter ketika navigasi dari sidebar link (?filter=active / ?filter=ended)
  useEffect(() => {
    setFilterStatus(filterParam);
  }, [filterParam]);

  useEffect(() => {
    setDateStr(new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" }));
  }, []);

  const showToast = (type: string, msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  const filtered = mockExams.filter(e => {
    const matchSearch = e.title.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "all" || e.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const statusBadgeStyle = (status: ExamStatus): React.CSSProperties => {
    const styles: Record<ExamStatus, React.CSSProperties> = {
      draft: { background: "#F3F4F6", color: "#6B7280" },
      active: { background: "#DCFCE7", color: "#16A34A" },
      ended: { background: "#E0F4FD", color: "#0EA5E9" },
      archived: { background: "#F3F4F6", color: "#6B7280" },
    };
    return {
      ...styles[status],
      padding: "2px 10px",
      borderRadius: "100px",
      fontSize: "12px",
      fontWeight: 600,
      display: "inline-flex",
      alignItems: "center",
      gap: "4px",
    };
  };

  // Label dinamis berdasarkan filter aktif
  const sectionTitle = filterStatus === "active"
    ? "Ujian Sedang Berlangsung"
    : filterStatus === "ended"
    ? "Rekap Hasil Ujian"
    : filterStatus === "draft"
    ? "Ujian Draft"
    : "Semua Ujian";

  return (
    <DashboardShell>
      {/* Top Header */}
      <header style={{
        background: "white",
        borderBottom: "1px solid #E9ECF0",
        padding: "16px 32px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        position: "sticky",
        top: 0,
        zIndex: 50
      }}>
        <div>
          <h1 style={{ fontSize: "20px", fontWeight: 700, color: "#111827", marginBottom: "2px" }}>
            Selamat datang, {mockTeacher.name.split(" ")[1]}! 👋
          </h1>
          <div style={{ fontSize: "13px", color: "#9CA3AF" }}>
            {dateStr}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <Link href="/dashboard/exams/new" style={{
            display: "flex", alignItems: "center", gap: "6px",
            padding: "9px 18px", borderRadius: "999px",
            background: "#29ABE2", color: "white",
            textDecoration: "none", fontSize: "14px", fontWeight: 600,
            boxShadow: "0 2px 8px rgba(41,171,226,0.30)"
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Buat Ujian
          </Link>
        </div>
      </header>

      {/* Page Content */}
      <div style={{ padding: "28px 32px" }}>
        {/* Stats row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "28px" }}>
          {[
            { label: "Total Ujian", value: mockDashboardStats.totalExams, icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#29ABE2" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>, color: "#29ABE2", bg: "#E0F4FD" },
            { label: "Ujian Aktif", value: mockDashboardStats.activeExams, icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>, color: "#16A34A", bg: "#DCFCE7" },
            { label: "Total Peserta", value: mockDashboardStats.totalParticipants, icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>, color: "#7C3AED", bg: "#EDE9FE" },
            { label: "Ujian Selesai", value: mockDashboardStats.completedExams, icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>, color: "#6B7280", bg: "#F3F4F6" },
          ].map(stat => (
            <div key={stat.label} style={{
              background: "white",
              borderRadius: "6px",
              padding: "20px",
              border: "1px solid #E9ECF0",
              boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
              display: "flex", alignItems: "center", gap: "14px"
            }}>
              <div style={{
                width: "46px", height: "46px",
                background: stat.bg,
                borderRadius: "6px",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0
              }}>
                {stat.icon}
              </div>
              <div>
                <div style={{ fontSize: "28px", fontWeight: 800, color: stat.color, lineHeight: 1 }}>{stat.value}</div>
                <div style={{ fontSize: "13px", color: "#6B7280", marginTop: "4px" }}>{stat.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Page title + filter row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#111827" }}>{sectionTitle}</h2>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {/* Search */}
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#9CA3AF" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              </span>
              <input
                placeholder="Cari ujian..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  height: "38px", paddingLeft: "36px", paddingRight: "12px",
                  border: "1.5px solid #E5E7EB", borderRadius: "6px",
                  fontSize: "14px", outline: "none", background: "white", color: "#374151",
                  width: "220px"
                }}
              />
            </div>
            {/* Status filter */}
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              style={{
                height: "38px", padding: "0 12px",
                border: "1.5px solid #E5E7EB", borderRadius: "6px",
                fontSize: "14px", outline: "none", background: "white", color: "#374151",
                cursor: "pointer"
              }}
            >
              <option value="all">Semua Status</option>
              <option value="draft">Draft</option>
              <option value="active">Aktif</option>
              <option value="ended">Selesai</option>
              <option value="archived">Diarsipkan</option>
            </select>
          </div>
        </div>

        {/* Exam Grid Cards */}
        {filtered.length === 0 ? (
          <div style={{
            background: "white", borderRadius: "8px", border: "1px solid #E9ECF0",
            padding: "80px 40px", textAlign: "center"
          }}>
            <div style={{ fontSize: "56px", marginBottom: "16px" }}>📋</div>
            <div style={{ fontSize: "18px", fontWeight: 600, color: "#374151", marginBottom: "8px" }}>
              {filterStatus === "active" ? "Tidak ada ujian aktif" : filterStatus === "ended" ? "Belum ada ujian selesai" : "Belum ada ujian"}
            </div>
            <div style={{ fontSize: "14px", color: "#9CA3AF", marginBottom: "20px" }}>
              {filterStatus === "all" ? "Mulai dengan membuat ujian pertamamu!" : "Coba pilih filter lain."}
            </div>
            {filterStatus === "all" && (
              <Link href="/dashboard/exams/new" style={{
                padding: "10px 20px", borderRadius: "999px",
                background: "#29ABE2", color: "white",
                textDecoration: "none", fontWeight: 600, fontSize: "14px"
              }}>+ Buat Ujian Baru</Link>
            )}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "20px" }}>
            {filtered.map((exam, idx) => {
              const colorPair = EXAM_COLORS[idx % EXAM_COLORS.length];
              const emojis = ["📖", "💻", "🎯", "📐", "🔬", "🎓"];
              return (
                <div
                  key={exam.id}
                  style={{
                    background: "white",
                    borderRadius: "8px",
                    border: "1px solid #E9ECF0",
                    overflow: "hidden",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                    transition: "all 0.2s",
                    cursor: "pointer"
                  }}
                  onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.1)")}
                  onMouseLeave={e => (e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.04)")}
                >
                  {/* Thumbnail */}
                  <div style={{
                    height: "140px",
                    background: colorPair.bg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    position: "relative"
                  }}>
                    <span style={{ fontSize: "52px", opacity: 0.9 }}>{emojis[idx % 6]}</span>
                    {/* Status badge */}
                    <div style={{
                      position: "absolute", top: "12px", right: "12px",
                      ...statusBadgeStyle(exam.status as ExamStatus)
                    }}>
                      {exam.status === "active" && <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#16A34A", display: "inline-block" }} />}
                      {STATUS_LABELS[exam.status as ExamStatus]}
                    </div>
                  </div>

                  {/* Card Content */}
                  <div style={{ padding: "16px 18px 14px" }}>
                    <Link href={`/dashboard/exams/${exam.id}`} style={{
                      fontSize: "15px", fontWeight: 700, color: "#111827",
                      textDecoration: "none", display: "block", marginBottom: "6px",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
                    }}>
                      {exam.title}
                    </Link>

                    <div style={{ display: "flex", gap: "12px", fontSize: "12px", color: "#6B7280", marginBottom: "12px", flexWrap: "wrap" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        {exam.duration} menit
                      </span>
                      <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/></svg>
                        {exam.questionCount} soal
                      </span>
                    </div>

                    {/* Access Code */}
                    <div style={{
                      background: "#F8FAFC", borderRadius: "8px", padding: "6px 10px",
                      marginBottom: "12px", display: "flex", alignItems: "center", justifyContent: "space-between"
                    }}>
                      <span style={{ fontSize: "11px", color: "#9CA3AF" }}>Kode Akses</span>
                      <span style={{ fontFamily: "monospace", fontSize: "13px", fontWeight: 700, color: "#111827", letterSpacing: "0.08em" }}>{exam.accessCode}</span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ fontSize: "12px", color: "#9CA3AF" }}>
                        {exam.createdAt}
                      </div>
                      <div style={{ display: "flex", gap: "6px" }}>
                        {exam.status === "active" && (
                          <Link href={`/dashboard/exams/${exam.id}/monitor`} style={{
                            padding: "5px 10px", borderRadius: "999px",
                            background: "#E0F4FD", color: "#29ABE2",
                            textDecoration: "none", fontSize: "12px", fontWeight: 600,
                            display: "flex", alignItems: "center", gap: "4px"
                          }}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                            Monitor
                          </Link>
                        )}
                        {exam.status === "ended" && (
                          <Link href={`/dashboard/exams/${exam.id}/results`} style={{
                            padding: "5px 10px", borderRadius: "999px",
                            background: "#E0F4FD", color: "#29ABE2",
                            textDecoration: "none", fontSize: "12px", fontWeight: 600
                          }}>
                            Hasil
                          </Link>
                        )}
                        <Link href={`/dashboard/exams/${exam.id}`} style={{
                          padding: "5px 10px", borderRadius: "7px",
                          background: "#F3F4F6", color: "#374151",
                          textDecoration: "none", fontSize: "12px", fontWeight: 500
                        }}>Detail</Link>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Confirm Modal */}
      {confirmModal && (
        <div className="modal-overlay" onClick={() => setConfirmModal(null)}>
          <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">{confirmModal.type === "delete" ? "Hapus Ujian?" : "Arsipkan Ujian?"}</span>
              <button className="modal-close" onClick={() => setConfirmModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ color: "var(--color-neutral-600)", lineHeight: 1.7 }}>
                {confirmModal.type === "delete"
                  ? "Ujian akan dihapus secara permanen dan tidak bisa dipulihkan."
                  : "Ujian akan diarsipkan. Kamu masih bisa melihat hasilnya nanti."}
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary btn-md" onClick={() => setConfirmModal(null)}>Batal</button>
              <button
                className={`btn ${confirmModal.type === "delete" ? "btn-danger" : "btn-primary"} btn-md`}
                onClick={() => { showToast("success", confirmModal.type === "delete" ? "Ujian berhasil dihapus" : "Ujian berhasil diarsipkan"); setConfirmModal(null); }}
              >
                {confirmModal.type === "delete" ? "Ya, Hapus" : "Ya, Arsipkan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="toast-container">
          <div className={`toast ${toast.type}`}>
            <span className="toast-icon">{toast.type === "success" ? "✅" : "❌"}</span>
            <div className="toast-content"><div className="toast-msg">{toast.msg}</div></div>
            <button className="toast-close" onClick={() => setToast(null)}>✕</button>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>Memuat...</div>}>
      <DashboardContent />
    </Suspense>
  );
}
