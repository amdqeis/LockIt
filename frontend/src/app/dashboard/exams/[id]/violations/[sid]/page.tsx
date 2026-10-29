"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiClient } from "@/lib/apiClient";
import DashboardShell from "@/app/components/DashboardShell";

interface ViolationEvent {
  id: string;
  type: string;
  time: string;
  detail?: string;
  duration?: string;
}

const EVENT_TYPE_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  tab_switch: { label: "Pindah Tab", icon: "🔀", color: "#F59E0B" },
  window_blur: { label: "Window Blur", icon: "👁️", color: "#F59E0B" },
  copy_attempt: { label: "Copy Text", icon: "📋", color: "#EF4444" },
  paste_attempt: { label: "Paste Text", icon: "📥", color: "#EF4444" },
  devtools: { label: "Buka DevTools", icon: "🛠️", color: "#8B5CF6" },
  reconnect: { label: "Reconnect / Relogin", icon: "🔄", color: "#3B82F6" },
  fullscreen_exit: { label: "Keluar Fullscreen", icon: "⛶", color: "#DC2626" },
  fullscreen_denied: { label: "Fullscreen Ditolak", icon: "🚫", color: "#DC2626" },
  right_click: { label: "Klik Kanan", icon: "🖱️", color: "#6B7280" },
  heartbeat_lost: { label: "Koneksi Terputus", icon: "📡", color: "#EF4444" },
};

function ViolationsDetailPage() {
  const params = useParams();
  const examId = Array.isArray(params.id) ? params.id[0] : (params.id as string);
  const sid = Array.isArray(params.sid) ? params.sid[0] : (params.sid as string);

  const [exam, setExam] = useState({
    id: examId,
    title: "Detail Ujian",
    violationPolicy: { maxViolations: 3, warnAt: 2, action: "lock" as string },
  });

  const [participant, setParticipant] = useState({
    id: sid,
    name: "Peserta",
    nisn: "-",
    status: "online",
    violations: 0,
    progress: 0,
    totalQ: 0,
    lastActivity: "Memuat...",
    isLocked: false,
  });

  const [violations, setViolations] = useState<ViolationEvent[]>([]);
  const [warningModal, setWarningModal] = useState(false);
  const [warningMsg, setWarningMsg] = useState("");
  const [warningLoading, setWarningLoading] = useState(false);
  const [unlockLoading, setUnlockLoading] = useState(false);
  const [toast, setToast] = useState<{ type: string; msg: string } | null>(null);

  const showToast = (type: string, msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      try {
        const [examRes, vioRes] = await Promise.all([
          apiClient.get<any>(`/api/exams/${examId}`),
          apiClient.get<any>(`/api/exams/${examId}/students/${sid}/violations`),
        ]);

        if (!isMounted) return;

        if (examRes.success && examRes.data?.exam) {
          const beExam = examRes.data.exam;
          setExam((prev) => ({
            ...prev,
            title: beExam.title,
            violationPolicy: beExam.violationPolicy || prev.violationPolicy,
          }));
        }

        if (vioRes.success && vioRes.data?.student) {
          const st = vioRes.data.student;
          setParticipant({
            id: st.id,
            name: st.name,
            nisn: st.nisn || "-",
            status: st.isLocked ? "locked" : st.status || "online",
            violations: st.violationCount ?? 0,
            progress: 0,
            totalQ: 25,
            lastActivity: st.submittedAt ? "Sudah submit" : "Aktif",
            isLocked: !!st.isLocked,
          });

          if (Array.isArray(vioRes.data.events) && vioRes.data.events.length > 0) {
            const mappedEvents: ViolationEvent[] = vioRes.data.events.map((e: any) => ({
              id: e.id,
              type: e.eventType,
              time: e.timestamp
                ? new Date(e.timestamp).toLocaleTimeString("id-ID", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })
                : "00:00",
              detail: e.metadata?.reason || e.metadata?.detail || undefined,
              duration: e.durationMs ? `${Math.round(e.durationMs / 1000)} detik` : undefined,
            }));
            setViolations(mappedEvents);
          }
        }
      } catch (err) {
        console.error("Failed to fetch real student violations, using fallback", err);
      }
    };

    fetchData();
    return () => {
      isMounted = false;
    };
  }, [examId, sid]);

  const handleSendWarning = async () => {
    if (!warningMsg.trim()) return;
    setWarningLoading(true);
    try {
      const res = await apiClient.post<any>(`/api/exams/${examId}/students/${sid}/warn`, {
        message: warningMsg.trim(),
      });
      if (res.success) {
        showToast("success", `✅ Peringatan berhasil dikirim ke ${participant.name}`);
        setWarningModal(false);
        setWarningMsg("");
      } else {
        showToast("error", res.error?.message || "Gagal mengirim peringatan");
      }
    } catch {
      showToast("error", "Gagal mengirim peringatan ke server");
    } finally {
      setWarningLoading(false);
    }
  };

  const handleUnlock = async () => {
    setUnlockLoading(true);
    try {
      const res = await apiClient.post<any>(`/api/exams/${examId}/students/${sid}/unlock`);
      if (res.success) {
        showToast("success", `✅ Ujian untuk ${participant.name} berhasil dibuka kembali`);
        setParticipant((prev) => ({ ...prev, status: "online", isLocked: false }));
      } else {
        showToast("error", res.error?.message || "Gagal membuka ujian");
      }
    } catch {
      showToast("error", "Gagal menghubungi server");
    } finally {
      setUnlockLoading(false);
    }
  };

  const handleExportLog = () => {
    showToast("success", "Mengunduh log pelanggaran...");
    window.open(`/api/exams/${examId}/export/violations`, "_blank");
  };

  const sorted = [...violations].sort((a, b) => a.time.localeCompare(b.time));

  const typeCounts: Record<string, number> = {};
  violations.forEach((v) => {
    typeCounts[v.type] = (typeCounts[v.type] || 0) + 1;
  });

  const statusBg: Record<string, { bg: string; color: string }> = {
    online: { bg: "#DCFCE7", color: "#16A34A" },
    offline: { bg: "#F3F4F6", color: "#6B7280" },
    submitted: { bg: "#E0F4FD", color: "#0EA5E9" },
    locked: { bg: "#FEE2E2", color: "#DC2626" },
    waiting: { bg: "#FEF3C7", color: "#D97706" },
  };
  const statusLabel: Record<string, string> = {
    online: "Online",
    offline: "Offline",
    submitted: "Submitted",
    locked: "Terkunci 🔒",
    waiting: "Menunggu",
  };
  const st = statusBg[participant.status] ?? statusBg.offline;
  const violationColor = (n: number) =>
    n === 0 ? "#16A34A" : n <= 2 ? "#D97706" : "#DC2626";

  return (
    <DashboardShell>
      {/* Header */}
      <header
        style={{
          background: "white",
          borderBottom: "1px solid #E9ECF0",
          padding: "0 32px",
          position: "sticky",
          top: 0,
          zIndex: 50,
          height: "64px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#9CA3AF" }}>
          <Link href="/dashboard" style={{ color: "#9CA3AF", textDecoration: "none" }}>
            Dashboard
          </Link>
          <span>›</span>
          <Link href={`/dashboard/exams/${exam.id}`} style={{ color: "#9CA3AF", textDecoration: "none" }}>
            {exam.title}
          </Link>
          <span>›</span>
          <Link href={`/dashboard/exams/${exam.id}/monitor`} style={{ color: "#9CA3AF", textDecoration: "none" }}>
            Monitor
          </Link>
          <span>›</span>
          <span style={{ color: "#111827", fontWeight: 500 }}>Detail Pelanggaran</span>
        </div>
        <Link
          href={`/dashboard/exams/${exam.id}/monitor`}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "8px 16px",
            borderRadius: "8px",
            border: "1.5px solid #E5E7EB",
            color: "#374151",
            textDecoration: "none",
            fontSize: "13px",
            fontWeight: 500,
            background: "white",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Kembali ke Monitor
        </Link>
      </header>

      <div style={{ padding: "28px 32px", maxWidth: "880px" }}>
        {/* Participant Header Card */}
        <div
          style={{
            background: "white",
            borderRadius: "16px",
            border: "1px solid #E9ECF0",
            padding: "24px",
            marginBottom: "20px",
            boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
            display: "flex",
            alignItems: "center",
            gap: "20px",
            flexWrap: "wrap",
          }}
        >
          {/* Avatar */}
          <div
            style={{
              width: "64px",
              height: "64px",
              borderRadius: "50%",
              background:
                participant.status === "locked"
                  ? "linear-gradient(135deg, #DC2626, #B91C1C)"
                  : "linear-gradient(135deg, #29ABE2, #0EA5E9)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontWeight: 800,
              fontSize: "24px",
              flexShrink: 0,
            }}
          >
            {participant.name.charAt(0)}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                flexWrap: "wrap",
                marginBottom: "6px",
              }}
            >
              <h1 style={{ fontSize: "22px", fontWeight: 700, color: "#111827" }}>{participant.name}</h1>
              <span
                style={{
                  padding: "3px 10px",
                  borderRadius: "100px",
                  fontSize: "12px",
                  fontWeight: 600,
                  background: st.bg,
                  color: st.color,
                }}
              >
                {statusLabel[participant.status]}
              </span>
            </div>
            <div style={{ fontSize: "14px", color: "#6B7280", fontFamily: "monospace", marginBottom: "6px" }}>
              NISN: {participant.nisn}
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                fontSize: "13px",
                color: "#9CA3AF",
              }}
            >
              <span>Total pelanggaran: {participant.violations}</span>
              <span>·</span>
              <span>Status: {participant.lastActivity}</span>
            </div>
          </div>

          <div style={{ display: "flex", gap: "10px", flexShrink: 0, flexWrap: "wrap" }}>
            {participant.isLocked && (
              <button
                onClick={handleUnlock}
                disabled={unlockLoading}
                style={{
                  padding: "9px 16px",
                  borderRadius: "8px",
                  border: "1.5px solid #22C55E",
                  background: "#F0FDF4",
                  color: "#16A34A",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                {unlockLoading ? "Membuka..." : "Buka Kunci"}
              </button>
            )}
            <button
              onClick={() => setWarningModal(true)}
              style={{
                padding: "9px 16px",
                borderRadius: "8px",
                border: "1.5px solid #FCD34D",
                background: "#FFFBEB",
                color: "#D97706",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              Kirim Warning
            </button>
            <button
              onClick={handleExportLog}
              style={{
                padding: "9px 16px",
                borderRadius: "8px",
                border: "1.5px solid #E5E7EB",
                background: "white",
                color: "#374151",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Export Log
            </button>
          </div>
        </div>

        {/* Violation Summary Card */}
        <div style={{
          background: "white",
          borderRadius: "16px",
          border: "1px solid #E9ECF0",
          padding: "20px 24px",
          marginBottom: "20px",
          boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
            <div>
              <div style={{ fontSize: "12px", color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "4px" }}>
                Total Pelanggaran
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
                <span style={{ fontSize: "36px", fontWeight: 800, color: violationColor(participant.violations), lineHeight: 1 }}>
                  {participant.violations}
                </span>
                <span style={{ fontSize: "14px", color: "#6B7280" }}>
                  dari batas {exam.violationPolicy.maxViolations}
                </span>
              </div>
            </div>

            {/* Breakdown chips */}
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {Object.entries(typeCounts).map(([type, count]) => {
                const vi = EVENT_TYPE_LABELS[type] ?? { label: type, icon: "⚠️", color: "#6B7280" };
                return vi ? (
                  <div key={type} style={{
                    display: "flex", alignItems: "center", gap: "6px",
                    padding: "6px 12px", borderRadius: "8px",
                    background: "#F8FAFC", border: "1px solid #E9ECF0",
                    fontSize: "13px",
                  }}>
                    <span style={{ fontSize: "14px" }}>{vi.icon}</span>
                    <span style={{ fontWeight: 700 }}>{count}×</span>
                    <span style={{ color: "#6B7280" }}>{vi.label}</span>
                  </div>
                ) : null;
              })}
            </div>
          </div>

          {/* Progress bar */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#9CA3AF", marginBottom: "6px" }}>
              <span>Progress pelanggaran terhadap batas</span>
              <span style={{ fontWeight: 600, color: violationColor(participant.violations) }}>
                {Math.round((participant.violations / exam.violationPolicy.maxViolations) * 100)}%
              </span>
            </div>
            <div style={{ height: "8px", background: "#F3F4F6", borderRadius: "100px", overflow: "hidden" }}>
              <div style={{
                height: "100%",
                width: `${Math.min(100, (participant.violations / exam.violationPolicy.maxViolations) * 100)}%`,
                background: violationColor(participant.violations),
                borderRadius: "100px",
                transition: "width 0.5s ease",
              }} />
            </div>
            {participant.violations >= exam.violationPolicy.maxViolations && (
              <div style={{
                marginTop: "8px", padding: "8px 12px", borderRadius: "8px",
                background: "#FEE2E2", color: "#DC2626", fontSize: "13px", fontWeight: 500,
              }}>
                ⚠️ Batas pelanggaran telah tercapai. Tindakan: <strong>{exam.violationPolicy.action === "auto-lock" ? "Auto-lock" : exam.violationPolicy.action}</strong>
              </div>
            )}
          </div>
        </div>

        {/* Timeline */}
        <div style={{
          background: "white",
          borderRadius: "16px",
          border: "1px solid #E9ECF0",
          overflow: "hidden",
          boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
        }}>
          <div style={{
            padding: "16px 24px",
            borderBottom: "1px solid #F3F4F6",
            display: "flex", alignItems: "center", gap: "8px",
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#29ABE2" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
            <h2 style={{ fontSize: "15px", fontWeight: 700, color: "#111827" }}>Timeline Pelanggaran</h2>
            <span style={{
              marginLeft: "auto", fontSize: "12px", fontWeight: 600,
              padding: "2px 8px", borderRadius: "100px",
              background: sorted.length > 0 ? "#FEE2E2" : "#DCFCE7",
              color: sorted.length > 0 ? "#DC2626" : "#16A34A",
            }}>
              {sorted.length} event
            </span>
          </div>

          {sorted.length === 0 ? (
            <div style={{ padding: "60px 40px", textAlign: "center" }}>
              <div style={{ fontSize: "48px", marginBottom: "16px" }}>✅</div>
              <div style={{ fontSize: "18px", fontWeight: 600, color: "#16A34A", marginBottom: "8px" }}>Bersih!</div>
              <div style={{ fontSize: "14px", color: "#9CA3AF" }}>Tidak ada pelanggaran yang tercatat untuk peserta ini.</div>
            </div>
          ) : (
            <div style={{ padding: "20px 24px" }}>
              {sorted.map((v, idx) => {
                const vi = EVENT_TYPE_LABELS[v.type] ?? { icon: "⚠️", label: v.type, color: "#6B7280" };
                return (
                  <div key={v.id} style={{
                    display: "flex", gap: "16px",
                    position: "relative",
                    paddingBottom: idx < sorted.length - 1 ? "24px" : "0",
                  }}>
                    {/* Connecting line */}
                    {idx < sorted.length - 1 && (
                      <div style={{
                        position: "absolute",
                        left: "15px", top: "32px", bottom: "0",
                        width: "2px", background: "#E9ECF0",
                      }} />
                    )}
                    {/* Icon bubble */}
                    <div style={{
                      width: "32px", height: "32px", borderRadius: "50%",
                      background: vi.color + "18",
                      border: `2px solid ${vi.color}40`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0, fontSize: "14px", zIndex: 1,
                    }}>
                      {vi.icon}
                    </div>
                    {/* Content */}
                    <div style={{ flex: 1, paddingTop: "4px" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                        <span style={{ fontWeight: 600, color: vi.color, fontSize: "14px" }}>{vi.label}</span>
                        <span style={{ fontFamily: "monospace", fontSize: "12px", color: "#9CA3AF" }}>
                          {v.time} WIB
                        </span>
                      </div>
                      {v.detail && (
                        <div style={{
                          fontSize: "13px", color: "#6B7280",
                          background: "#F8FAFC", padding: "6px 10px", borderRadius: "6px",
                          marginBottom: "4px",
                        }}>
                          {v.detail}
                        </div>
                      )}
                      {v.duration && (
                        <div style={{ fontSize: "12px", color: "#6B7280" }}>
                          ⏱ Durasi: {v.duration}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Warning Modal */}
      {warningModal && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 1000, padding: "20px",
          }}
          onClick={() => setWarningModal(false)}
        >
          <div
            style={{
              background: "white", borderRadius: "16px", padding: "0",
              width: "100%", maxWidth: "480px",
              boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
              overflow: "hidden",
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "20px 24px", borderBottom: "1px solid #F3F4F6",
            }}>
              <h2 style={{ fontSize: "17px", fontWeight: 700, color: "#111827" }}>Kirim Peringatan</h2>
              <button
                onClick={() => setWarningModal(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", fontSize: "20px" }}
              >✕</button>
            </div>

            <div style={{ padding: "20px 24px" }}>
              {/* Participant info */}
              <div style={{
                display: "flex", alignItems: "center", gap: "12px",
                background: "#F8FAFC", borderRadius: "10px", padding: "14px",
                marginBottom: "20px",
              }}>
                <div style={{
                  width: "40px", height: "40px", borderRadius: "50%",
                  background: "linear-gradient(135deg, #29ABE2, #0EA5E9)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "white", fontWeight: 700, fontSize: "16px", flexShrink: 0,
                }}>
                  {participant.name.charAt(0)}
                </div>
                <div>
                  <div style={{ fontSize: "14px", fontWeight: 600, color: "#111827" }}>{participant.name}</div>
                  <div style={{ fontSize: "12px", color: "#6B7280", fontFamily: "monospace" }}>NISN: {participant.nisn}</div>
                </div>
                <div style={{
                  marginLeft: "auto", fontSize: "12px", fontWeight: 700,
                  color: "#DC2626", background: "#FEE2E2",
                  padding: "3px 8px", borderRadius: "6px",
                }}>
                  {participant.violations} pelanggaran
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#374151", marginBottom: "8px" }}>
                  Pesan Peringatan <span style={{ color: "#DC2626" }}>*</span>
                </label>
                <textarea
                  placeholder="Mohon perhatikan aturan ujian..."
                  value={warningMsg}
                  onChange={e => setWarningMsg(e.target.value.slice(0, 500))}
                  rows={4}
                  style={{
                    width: "100%", padding: "12px", borderRadius: "8px",
                    border: "1.5px solid #E5E7EB", fontSize: "14px",
                    outline: "none", resize: "vertical",
                    fontFamily: "var(--font-family)",
                    color: "#374151", boxSizing: "border-box",
                  }}
                />
                <div style={{ fontSize: "11px", color: "#9CA3AF", textAlign: "right", marginTop: "4px" }}>
                  {warningMsg.length}/500
                </div>
              </div>
            </div>

            <div style={{
              display: "flex", gap: "10px", justifyContent: "flex-end",
              padding: "16px 24px", borderTop: "1px solid #F3F4F6",
            }}>
              <button
                onClick={() => setWarningModal(false)}
                style={{
                  padding: "10px 20px", borderRadius: "8px",
                  border: "1.5px solid #E5E7EB", background: "white",
                  color: "#374151", fontSize: "14px", fontWeight: 500, cursor: "pointer",
                }}
              >Batal</button>
              <button
                onClick={handleSendWarning}
                disabled={!warningMsg.trim() || warningLoading}
                style={{
                  padding: "10px 20px", borderRadius: "8px",
                  background: warningLoading || !warningMsg.trim() ? "#7DD3FC" : "#29ABE2",
                  color: "white",
                  fontSize: "14px", fontWeight: 600,
                  cursor: warningLoading || !warningMsg.trim() ? "not-allowed" : "pointer",
                  border: "none",
                  display: "flex", alignItems: "center", gap: "8px",
                }}
              >
                {warningLoading && (
                  <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⟳</span>
                )}
                {warningLoading ? "Mengirim..." : "Kirim Peringatan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", bottom: "24px", right: "24px", zIndex: 2000,
          background: toast.type === "success" ? "#DCFCE7" : "#FEE2E2",
          border: `1px solid ${toast.type === "success" ? "#86EFAC" : "#FCA5A5"}`,
          color: toast.type === "success" ? "#16A34A" : "#DC2626",
          padding: "12px 20px", borderRadius: "12px",
          fontSize: "14px", fontWeight: 500,
          boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
          display: "flex", alignItems: "center", gap: "8px",
          animation: "slideIn 0.2s ease",
        }}>
          {toast.msg}
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes slideIn { from { transform: translateY(10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>
    </DashboardShell>
  );
}

export default function ViolationsDetailPageWrapper() {
  return <Suspense><ViolationsDetailPage /></Suspense>;
}
