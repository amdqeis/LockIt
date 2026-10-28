"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/apiClient";
import DashboardShell from "@/app/components/DashboardShell";

type ExamStatus = "draft" | "active" | "ended" | "archived";

const STATUS_LABELS: Record<ExamStatus, string> = {
  draft: "Draft",
  active: "Sedang Berlangsung",
  ended: "Selesai",
  archived: "Diarsipkan",
};

const STATUS_COLORS: Record<ExamStatus, { bg: string; color: string }> = {
  draft: { bg: "#F3F4F6", color: "#6B7280" },
  active: { bg: "#DCFCE7", color: "#16A34A" },
  ended: { bg: "#E0F4FD", color: "#0EA5E9" },
  archived: { bg: "#F3F4F6", color: "#6B7280" },
};

function ExamDetailPage() {
  const router = useRouter();
  const params = useParams();
  const examId = (params?.id as string) || "";
  const [exam, setExam] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [confirmType, setConfirmType] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: string; msg: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const showToast = (type: string, msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchExamDetail = useCallback(async () => {
    if (!examId) return;
    try {
      const res = await apiFetch<any>(`/api/exams/${examId}`);
      if (res.success && res.data) {
        const beExam = res.data;
        const mapped = {
          id: beExam.id,
          title: beExam.title,
          description: beExam.description || "",
          status: beExam.status,
          duration: beExam.durationMinutes,
          questionCount: beExam._count?.questions ?? 0,
          totalParticipants: beExam._count?.students ?? 0,
          accessCode: beExam.accessCode,
          createdAt: new Date(beExam.createdAt).toLocaleDateString("id-ID", {
            day: "numeric",
            month: "short",
            year: "numeric",
          }),
          violationPolicy: {
            maxViolations: beExam.violationPolicy?.max_violations || 5,
            action: beExam.violationPolicy?.action === "lock" ? "auto-lock" : "warning",
            detectCopyPaste: beExam.violationPolicy?.detect_copy_paste ?? true,
            detectRightClick: beExam.violationPolicy?.detect_right_click ?? false,
            detectDevTools: beExam.violationPolicy?.detect_devtools ?? false,
          },
        };
        setExam(mapped);
      } else {
        setExam(null);
      }
    } catch {
      setExam(null);
    } finally {
      setLoading(false);
    }
  }, [examId]);

  useEffect(() => {
    fetchExamDetail();
  }, [fetchExamDetail]);

  const handleCopy = () => {
    if (!exam) return;
    navigator.clipboard.writeText(exam.accessCode).catch(() => {});
    setCopied(true);
    showToast("success", "✅ Kode disalin ke clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleModalConfirm = async () => {
    if (!confirmType || !exam) return;
    const type = confirmType;
    setConfirmType(null);

    try {
      if (type === "start") {
        const res = await apiFetch<any>(`/api/exams/${exam.id}/status`, {
          method: "PUT",
          body: JSON.stringify({ status: "active" }),
        });
        if (res.success) {
          showToast("success", "Ujian berhasil dimulai!");
          fetchExamDetail();
        } else {
          showToast("error", res.error?.message || "Gagal memulai ujian (pastikan ujian memiliki soal)");
        }
      } else if (type === "end") {
        const res = await apiFetch<any>(`/api/exams/${exam.id}/status`, {
          method: "PUT",
          body: JSON.stringify({ status: "ended" }),
        });
        if (res.success) {
          showToast("success", "Ujian telah diakhiri.");
          fetchExamDetail();
        } else {
          showToast("error", res.error?.message || "Gagal mengakhiri ujian");
        }
      } else if (type === "delete") {
        const res = await apiFetch<any>(`/api/exams/${exam.id}`, {
          method: "DELETE",
        });
        if (res.success) {
          showToast("success", "Ujian berhasil dihapus.");
          setTimeout(() => {
            router.push("/dashboard/exams");
          }, 1000);
        } else {
          showToast("error", res.error?.message || "Gagal menghapus ujian");
        }
      } else if (type === "regen") {
        const res = await apiFetch<any>(`/api/exams/${exam.id}/regenerate-code`, {
          method: "POST",
        });
        if (res.success && res.data?.accessCode) {
          setExam((prev: any) => ({ ...prev, accessCode: res.data.accessCode }));
          showToast("success", "Kode akses berhasil diperbarui!");
        } else {
          showToast("error", res.error?.message || "Gagal memperbarui kode akses");
        }
      }
    } catch {
      showToast("error", "Terjadi kesalahan jaringan.");
    }
  };

  if (!exam) {
    return (
      <DashboardShell>
        <div style={{ padding: "32px", color: "#6B7280" }}>
          {loading ? "Memuat data ujian..." : "Ujian tidak ditemukan."}
        </div>
      </DashboardShell>
    );
  }

  const sc = STATUS_COLORS[exam.status as ExamStatus] || STATUS_COLORS.draft;

  const actionButtons: Record<ExamStatus, React.ReactNode> = {
    draft: (
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
        <button className="btn btn-primary btn-md" onClick={() => setConfirmType("start")}>
          🚀 Mulai Ujian
        </button>
        <Link href={`/dashboard/exams/${exam.id}/edit`} className="btn btn-secondary btn-md">
          ✏️ Edit Ujian
        </Link>
        <button className="btn btn-ghost btn-md" onClick={() => setConfirmType("preview")}>
          👁 Preview Soal
        </button>
        <button className="btn btn-danger btn-md" onClick={() => setConfirmType("delete")}>
          🗑️ Hapus
        </button>
      </div>
    ),
    active: (
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
        <Link href={`/dashboard/exams/${exam.id}/monitor`} className="btn btn-primary btn-md">
          📊 Monitor Live
        </Link>
        <button className="btn btn-danger btn-md" onClick={() => setConfirmType("end")}>
          ⛔ Akhiri Ujian
        </button>
      </div>
    ),
    ended: (
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
        <Link href={`/dashboard/exams/${exam.id}/results`} className="btn btn-primary btn-md">
          🏆 Lihat Hasil
        </Link>
        <button className="btn btn-secondary btn-md" onClick={() => showToast("success", "File CSV berhasil didownload")}>
          📥 Export CSV
        </button>
        <button className="btn btn-secondary btn-md" onClick={() => showToast("success", "File Excel berhasil didownload")}>
          📊 Export Excel
        </button>
      </div>
    ),
    archived: (
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
        <Link href={`/dashboard/exams/${exam.id}/results`} className="btn btn-secondary btn-md">
          🏆 Lihat Hasil
        </Link>
      </div>
    ),
  };

  return (
    <DashboardShell>
      {/* Header */}
      <header style={{
        background: "white", borderBottom: "1px solid #E9ECF0",
        padding: "16px 32px", position: "sticky", top: 0, zIndex: 50
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#9CA3AF" }}>
          <Link href="/dashboard" style={{ color: "#9CA3AF", textDecoration: "none" }}>Dashboard</Link>
          <span>›</span>
          <span style={{ color: "#111827", fontWeight: 500 }}>{exam.title}</span>
        </div>
      </header>

      <div style={{ padding: "28px 32px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "24px", alignItems: "start" }}>
          {/* Left Column */}
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {/* Info Card */}
            <div style={{ background: "white", borderRadius: "16px", border: "1px solid #E9ECF0", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
              <div style={{ padding: "20px 24px", borderBottom: "1px solid #F1F5F9", display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                <h1 style={{ fontSize: "22px", fontWeight: 700, color: "#111827", flex: 1 }}>{exam.title}</h1>
                <span style={{
                  ...sc,
                  padding: "4px 12px", borderRadius: "100px", fontSize: "13px", fontWeight: 600,
                  display: "inline-flex", alignItems: "center", gap: "6px"
                }}>
                  {exam.status === "active" && <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#16A34A", animation: "pulse 1.5s infinite" }} />}
                  {STATUS_LABELS[exam.status as ExamStatus]}
                </span>
              </div>
              <div style={{ padding: "24px" }}>
                {exam.description && (
                  <p style={{ color: "#6B7280", marginBottom: "20px", lineHeight: 1.7, fontSize: "15px" }}>{exam.description}</p>
                )}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                  {[
                    { label: "DURASI", value: `${exam.duration} menit`, icon: "⏱" },
                    { label: "JUMLAH SOAL", value: `${exam.questionCount} soal`, icon: "📝" },
                    { label: "TANGGAL DIBUAT", value: exam.createdAt, icon: "📅" },
                    { label: "TOTAL PESERTA", value: `${exam.totalParticipants} orang`, icon: "👥" },
                  ].map(item => (
                    <div key={item.label} style={{ background: "#F8FAFC", borderRadius: "10px", padding: "14px" }}>
                      <div style={{ fontSize: "11px", color: "#9CA3AF", fontWeight: 600, letterSpacing: "0.06em", marginBottom: "6px" }}>{item.label}</div>
                      <div style={{ fontWeight: 600, fontSize: "15px", color: "#111827" }}>{item.icon} {item.value}</div>
                    </div>
                  ))}
                </div>

                {/* Violation Policy */}
                <div style={{ marginTop: "20px", padding: "16px", background: "#FFFBEB", borderRadius: "12px", border: "1px solid #FDE68A" }}>
                  <div style={{ fontSize: "12px", color: "#92400E", fontWeight: 600, marginBottom: "10px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    🛡️ Kebijakan Pelanggaran
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                    <span style={{ background: "#FEF3C7", color: "#92400E", padding: "3px 10px", borderRadius: "100px", fontSize: "12px", fontWeight: 600 }}>
                      Max {exam.violationPolicy.maxViolations} pelanggaran
                    </span>
                    <span style={{ background: "#FEF3C7", color: "#92400E", padding: "3px 10px", borderRadius: "100px", fontSize: "12px", fontWeight: 500 }}>
                      {exam.violationPolicy.action === "auto-lock" ? "Auto-lock" : exam.violationPolicy.action === "warning" ? "Beri Peringatan" : "Review Manual"}
                    </span>
                    {exam.violationPolicy.detectCopyPaste && <span style={{ background: "#FEF9C3", color: "#78350F", padding: "3px 10px", borderRadius: "100px", fontSize: "12px" }}>Copy-Paste ✓</span>}
                    {exam.violationPolicy.detectRightClick && <span style={{ background: "#FEF9C3", color: "#78350F", padding: "3px 10px", borderRadius: "100px", fontSize: "12px" }}>Klik Kanan ✓</span>}
                    {exam.violationPolicy.detectDevTools && <span style={{ background: "#FEF9C3", color: "#78350F", padding: "3px 10px", borderRadius: "100px", fontSize: "12px" }}>DevTools ✓</span>}
                  </div>
                </div>
              </div>
            </div>

            {/* Actions Card */}
            <div style={{ background: "white", borderRadius: "16px", border: "1px solid #E9ECF0", padding: "20px 24px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
              <div style={{ fontSize: "13px", fontWeight: 600, color: "#9CA3AF", marginBottom: "16px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Aksi Ujian</div>
              {actionButtons[exam.status as ExamStatus]}
            </div>
          </div>

          {/* Right Column */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Access Code Panel */}
            <div style={{ background: "white", borderRadius: "16px", border: "1px solid #E9ECF0", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
              <div style={{ background: "linear-gradient(135deg, #29ABE2, #0EA5E9)", padding: "24px", textAlign: "center" }}>
                <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.7)", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "10px" }}>
                  Kode Akses Ujian
                </div>
                <div style={{
                  fontFamily: "monospace", fontSize: "36px", fontWeight: 800,
                  color: "white", letterSpacing: "0.15em",
                  textShadow: "0 2px 8px rgba(0,0,0,0.2)"
                }}>
                  {exam.accessCode}
                </div>
              </div>
              <div style={{ padding: "16px", display: "flex", gap: "8px" }}>
                <button
                  onClick={handleCopy}
                  style={{
                    flex: 1, height: "40px", borderRadius: "10px",
                    background: copied ? "#DCFCE7" : "#E0F4FD",
                    color: copied ? "#16A34A" : "#29ABE2",
                    border: "none", cursor: "pointer", fontWeight: 600, fontSize: "14px",
                    transition: "all 0.2s"
                  }}>
                  {copied ? "✅ Disalin!" : "📋 Salin Kode"}
                </button>
                <button
                  disabled={exam.status === "active"}
                  onClick={() => setConfirmType("regen")}
                  style={{
                    height: "40px", paddingLeft: "12px", paddingRight: "12px",
                    borderRadius: "10px", background: "#F3F4F6", color: "#6B7280",
                    border: "none", cursor: exam.status === "active" ? "not-allowed" : "pointer",
                    fontSize: "13px", opacity: exam.status === "active" ? 0.5 : 1
                  }}
                  title={exam.status === "active" ? "Tidak bisa regenerate saat ujian berlangsung" : ""}
                >
                  🔄
                </button>
              </div>
              {exam.status === "active" && (
                <div style={{ padding: "0 16px 14px", fontSize: "12px", color: "#9CA3AF", textAlign: "center" }}>
                  ⚠️ Tidak bisa regenerate saat ujian berlangsung
                </div>
              )}
            </div>

            {/* Question Settings */}
            <div style={{ background: "white", borderRadius: "16px", border: "1px solid #E9ECF0", padding: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
              <div style={{ fontSize: "12px", fontWeight: 600, color: "#9CA3AF", marginBottom: "14px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Pengaturan Soal</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {[
                  { label: "Mode Tampilan", value: exam.questionMode === "one-by-one" ? "Satu per satu" : "Semua sekaligus" },
                  { label: "Acak Urutan", value: exam.shuffleQuestions ? "✅ Aktif" : "❌ Nonaktif" },
                ].map(item => (
                  <div key={item.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "14px", padding: "8px 0", borderBottom: "1px solid #F3F4F6" }}>
                    <span style={{ color: "#6B7280" }}>{item.label}</span>
                    <span style={{ fontWeight: 500, color: "#111827" }}>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Confirm Modals */}
      {confirmType && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000,
          display: "flex", alignItems: "center", justifyContent: "center", padding: "24px"
        }} onClick={() => setConfirmType(null)}>
          <div style={{
            background: "white", borderRadius: "16px", maxWidth: "440px", width: "100%",
            boxShadow: "0 20px 60px rgba(0,0,0,0.2)"
          }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "17px", fontWeight: 700, color: "#111827" }}>
                {confirmType === "start" ? "Mulai Ujian?" : confirmType === "end" ? "Akhiri Ujian?" : confirmType === "delete" ? "Hapus Ujian?" : confirmType === "regen" ? "Generate Ulang Kode?" : "Preview Soal"}
              </span>
              <button onClick={() => setConfirmType(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", fontSize: "18px" }}>✕</button>
            </div>
            <div style={{ padding: "20px 24px" }}>
              <p style={{ color: "#6B7280", lineHeight: 1.7, fontSize: "15px" }}>
                {confirmType === "start" && "Ujian akan dimulai. Peserta yang sudah menunggu di waiting room akan langsung bisa mengerjakan. Pastikan semua siap."}
                {confirmType === "end" && "Ujian akan diakhiri. Semua peserta yang belum submit akan di-auto-submit. Tindakan ini tidak bisa dibatalkan."}
                {confirmType === "delete" && "Ujian akan dihapus secara permanen dan tidak bisa dipulihkan."}
                {confirmType === "regen" && "Kode lama akan tidak valid. Peserta yang belum join perlu menggunakan kode baru. Lanjutkan?"}
              </p>
            </div>
            <div style={{ padding: "16px 24px", borderTop: "1px solid #F3F4F6", display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button onClick={() => setConfirmType(null)} className="btn btn-secondary btn-md">Batal</button>
              <button
                className={`btn ${confirmType === "end" || confirmType === "delete" ? "btn-danger" : "btn-primary"} btn-md`}
                onClick={handleModalConfirm}
              >
                {confirmType === "start" ? "Mulai Sekarang" : confirmType === "end" ? "Akhiri Ujian" : confirmType === "delete" ? "Hapus Permanen" : "Ya, Generate Ulang"}
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

      <style>{`@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
    </DashboardShell>
  );
}

export default function ExamDetailPageWrapper() {
  return <Suspense><ExamDetailPage /></Suspense>;
}
