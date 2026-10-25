"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { mockParticipants, mockMonitorStats, mockExams } from "@/lib/mockData";
import DashboardShell from "@/app/components/DashboardShell";

const STATUS_BADGE_STYLE: Record<string, { bg: string; color: string }> = {
  online: { bg: "#DCFCE7", color: "#16A34A" },
  offline: { bg: "#F3F4F6", color: "#6B7280" },
  submitted: { bg: "#E0F4FD", color: "#0EA5E9" },
  locked: { bg: "#FEE2E2", color: "#DC2626" },
  waiting: { bg: "#FEF3C7", color: "#D97706" },
};

const STATUS_LABEL: Record<string, string> = {
  online: "Online",
  offline: "Offline",
  submitted: "Submitted",
  locked: "Terkunci 🔒",
  waiting: "Menunggu",
};

function MonitorPage() {
  const params = useParams();
  const exam = mockExams.find(e => e.id === params.id) ?? mockExams[0];
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [participants] = useState(mockParticipants);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [warningModal, setWarningModal] = useState<{ id: string; name: string; nim: string; violations: number } | null>(null);
  const [warningMsg, setWarningMsg] = useState("");
  const [unlockModal, setUnlockModal] = useState<{ id: string; name: string; nim: string } | null>(null);
  const [toast, setToast] = useState<{ type: string; msg: string } | null>(null);
  const [timeLeft] = useState(83 * 60 + 12);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  const showToast = (type: string, msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  const filtered = participants.filter(p => {
    const matchFilter = filter === "all" || p.status === filter || (filter === "bermasalah" && p.violations >= 3);
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.nim.includes(search);
    return matchFilter && matchSearch;
  });

  const violationBg = (n: number) => n === 0 ? "#DCFCE7" : n <= 2 ? "#FEF3C7" : "#FEE2E2";
  const violationColor = (n: number) => n === 0 ? "#16A34A" : n <= 2 ? "#D97706" : "#DC2626";

  return (
    <DashboardShell>
      {/* Sticky Header */}
      <header style={{
        background: "white", borderBottom: "1px solid #E9ECF0",
        padding: "0 32px", position: "sticky", top: 0, zIndex: 50,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        height: "64px"
      }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#9CA3AF", marginBottom: "2px" }}>
            <Link href="/dashboard" style={{ color: "#9CA3AF", textDecoration: "none" }}>Dashboard</Link>
            <span>›</span>
            <Link href={`/dashboard/exams/${exam.id}`} style={{ color: "#9CA3AF", textDecoration: "none" }}>{exam.title}</Link>
            <span>›</span>
            <span style={{ color: "#111827" }}>Monitor Live</span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#16A34A", display: "inline-block", animation: "pulse 1.5s infinite" }} />
            <span style={{ fontSize: "13px", color: "#16A34A", fontWeight: 600 }}>Live</span>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "10px", color: "#9CA3AF", marginBottom: "1px" }}>SISA WAKTU</div>
            <div style={{
              fontSize: "22px", fontWeight: 800, fontFamily: "monospace",
              color: timeLeft < 5 * 60 ? "#DC2626" : "#29ABE2",
              letterSpacing: "0.05em"
            }}>{formatTime(timeLeft)}</div>
          </div>
          <button
            onClick={() => setConfirmEnd(true)}
            style={{
              height: "40px", paddingLeft: "16px", paddingRight: "16px",
              background: "#DC2626", color: "white", border: "none",
              borderRadius: "10px", cursor: "pointer", fontWeight: 600, fontSize: "14px",
              display: "flex", alignItems: "center", gap: "6px",
              boxShadow: "0 2px 8px rgba(220,38,38,0.3)"
            }}
          >
            ⛔ Akhiri Ujian
          </button>
        </div>
      </header>

      <div style={{ padding: "24px 32px" }}>
        <div style={{ marginBottom: "4px" }}>
          <h1 style={{ fontSize: "20px", fontWeight: 700, color: "#111827" }}>{exam.title}</h1>
          <p style={{ fontSize: "13px", color: "#9CA3AF" }}>Monitoring peserta secara real-time</p>
        </div>

        {/* Overview Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "14px", margin: "20px 0" }}>
          {[
            { label: "Total Join", val: mockMonitorStats.totalJoin, bg: "#F8FAFC", color: "#374151", icon: "👥" },
            { label: "Online", val: mockMonitorStats.online, bg: "#DCFCE7", color: "#16A34A", icon: "🟢" },
            { label: "Offline/Putus", val: mockMonitorStats.offline, bg: "#FEE2E2", color: "#DC2626", icon: "🔴" },
            { label: "Sudah Submit", val: mockMonitorStats.submitted, bg: "#E0F4FD", color: "#0EA5E9", icon: "✅" },
            { label: "Belum Submit", val: mockMonitorStats.notSubmitted, bg: "#FEF3C7", color: "#D97706", icon: "⏳" },
          ].map(s => (
            <div key={s.label} style={{
              background: "white", borderRadius: "12px", border: "1px solid #E9ECF0",
              padding: "16px", textAlign: "center",
              boxShadow: "0 1px 4px rgba(0,0,0,0.04)"
            }}>
              <div style={{
                width: "40px", height: "40px", borderRadius: "10px", background: s.bg,
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 8px", fontSize: "18px"
              }}>{s.icon}</div>
              <div style={{ fontSize: "26px", fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.val}</div>
              <div style={{ fontSize: "12px", color: "#9CA3AF", marginTop: "4px" }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filter Row */}
        <div style={{ display: "flex", gap: "10px", marginBottom: "16px", alignItems: "center" }}>
          <div style={{ position: "relative", flex: 1 }}>
            <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#9CA3AF" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </span>
            <input
              className="form-input"
              placeholder="Cari nama atau NIM..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: "40px" }}
            />
          </div>
          <select
            className="form-select"
            style={{ width: "200px" }}
            value={filter}
            onChange={e => setFilter(e.target.value)}
          >
            <option value="all">Semua Peserta</option>
            <option value="online">Online</option>
            <option value="offline">Offline</option>
            <option value="submitted">Submitted</option>
            <option value="locked">Terkunci</option>
            <option value="bermasalah">Bermasalah (≥3)</option>
          </select>
          <button
            onClick={() => showToast("success", "Data berhasil diperbarui")}
            style={{
              height: "42px", paddingLeft: "14px", paddingRight: "14px",
              border: "1.5px solid #E5E7EB", borderRadius: "10px",
              background: "white", color: "#374151", cursor: "pointer", fontSize: "14px",
              display: "flex", alignItems: "center", gap: "6px", whiteSpace: "nowrap"
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
            Refresh
          </button>
        </div>

        {/* Table */}
        <div style={{ background: "white", borderRadius: "14px", border: "1px solid #E9ECF0", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E9ECF0" }}>
                {["Nama Peserta", "NIM", "Status", "Pelanggaran", "Progress", "Last Aktif", "Aksi"].map(h => (
                  <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => (
                <tr key={p.id} style={{
                  borderBottom: i < filtered.length - 1 ? "1px solid #F3F4F6" : "none",
                  background: p.status === "locked" ? "#FFF5F5" : p.status === "offline" ? "#FAFAFA" : "white"
                }}>
                  <td style={{ padding: "12px 16px", fontWeight: 500, color: "#111827", fontSize: "14px" }}>{p.name}</td>
                  <td style={{ padding: "12px 16px", fontFamily: "monospace", fontSize: "13px", color: "#6B7280" }}>{p.nim}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{
                      ...STATUS_BADGE_STYLE[p.status],
                      padding: "3px 10px", borderRadius: "100px",
                      fontSize: "12px", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "5px"
                    }}>
                      {p.status === "online" && <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#16A34A", display: "inline-block" }} />}
                      {STATUS_LABEL[p.status]}
                    </span>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{
                      background: violationBg(p.violations), color: violationColor(p.violations),
                      padding: "2px 10px", borderRadius: "100px", fontSize: "13px", fontWeight: 700
                    }}>
                      {p.violations}
                    </span>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "13px", fontWeight: 500, minWidth: "32px" }}>{p.progress}/{p.totalQ}</span>
                      <div style={{ width: "60px", height: "5px", background: "#E5E7EB", borderRadius: "100px", overflow: "hidden" }}>
                        <div style={{ width: `${(p.progress / p.totalQ) * 100}%`, height: "100%", background: "#29ABE2", borderRadius: "100px" }} />
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: "13px", color: p.lastActivity.includes("12 mnt") ? "#DC2626" : "#9CA3AF" }}>{p.lastActivity}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", gap: "4px" }}>
                      <button
                        onClick={() => setWarningModal({ id: p.id, name: p.name, nim: p.nim, violations: p.violations })}
                        style={{
                          height: "30px", paddingLeft: "10px", paddingRight: "10px",
                          background: "#FEF3C7", color: "#D97706", border: "none",
                          borderRadius: "6px", cursor: "pointer", fontSize: "12px", fontWeight: 600, whiteSpace: "nowrap"
                        }}
                      >⚠ Warning</button>
                      {p.locked && (
                        <button
                          onClick={() => setUnlockModal({ id: p.id, name: p.name, nim: p.nim })}
                          style={{
                            height: "30px", paddingLeft: "10px", paddingRight: "10px",
                            background: "#DCFCE7", color: "#16A34A", border: "none",
                            borderRadius: "6px", cursor: "pointer", fontSize: "12px", fontWeight: 600, whiteSpace: "nowrap"
                          }}
                        >🔓 Unlock</button>
                      )}
                      <Link
                        href={`/dashboard/exams/${exam.id}/violations/${p.id}`}
                        style={{
                          height: "30px", paddingLeft: "10px", paddingRight: "10px",
                          background: "#F3F4F6", color: "#374151",
                          borderRadius: "6px", fontSize: "12px", fontWeight: 500,
                          display: "inline-flex", alignItems: "center", textDecoration: "none", whiteSpace: "nowrap"
                        }}
                      >👁 Detail</Link>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: "60px", textAlign: "center", color: "#9CA3AF", fontSize: "15px" }}>
                    <div style={{ fontSize: "40px", marginBottom: "12px" }}>👥</div>
                    Belum ada peserta yang bergabung.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* End Exam Modal */}
      {confirmEnd && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }} onClick={() => setConfirmEnd(false)}>
          <div style={{ background: "white", borderRadius: "16px", maxWidth: "440px", width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid #F3F4F6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "17px", fontWeight: 700, color: "#111827" }}>Akhiri Ujian?</span>
              <button onClick={() => setConfirmEnd(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", fontSize: "18px" }}>✕</button>
            </div>
            <div style={{ padding: "20px 24px" }}>
              <div style={{ background: "#FEE2E2", borderRadius: "10px", padding: "12px 16px", marginBottom: "16px", fontSize: "14px", color: "#DC2626", fontWeight: 500 }}>
                ⚠️ Tindakan ini <strong>tidak bisa dibatalkan</strong>.
              </div>
              <p style={{ color: "#6B7280", lineHeight: 1.7, fontSize: "15px" }}>
                Ujian akan diakhiri. Semua peserta yang belum submit akan di-auto-submit dengan jawaban terakhir yang tersimpan.
              </p>
            </div>
            <div style={{ padding: "16px 24px", borderTop: "1px solid #F3F4F6", display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button onClick={() => setConfirmEnd(false)} className="btn btn-secondary btn-md">Batal</button>
              <button
                className="btn btn-danger btn-md"
                onClick={() => { showToast("success", "Ujian telah diakhiri. Semua jawaban tersimpan."); setConfirmEnd(false); }}
              >Akhiri Ujian</button>
            </div>
          </div>
        </div>
      )}

      {/* Warning Modal */}
      {warningModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }} onClick={() => setWarningModal(null)}>
          <div style={{ background: "white", borderRadius: "16px", maxWidth: "480px", width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid #F3F4F6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "17px", fontWeight: 700, color: "#111827" }}>Kirim Peringatan</span>
              <button onClick={() => setWarningModal(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", fontSize: "18px" }}>✕</button>
            </div>
            <div style={{ padding: "20px 24px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 16px", background: "#F8FAFC", borderRadius: "10px", marginBottom: "16px" }}>
                <div style={{
                  width: "40px", height: "40px", borderRadius: "50%",
                  background: "linear-gradient(135deg, #29ABE2, #0EA5E9)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "white", fontWeight: 700, flexShrink: 0
                }}>{warningModal.name.charAt(0)}</div>
                <div>
                  <div style={{ fontWeight: 600, color: "#111827" }}>{warningModal.name}</div>
                  <div style={{ fontSize: "13px", color: "#9CA3AF", fontFamily: "monospace" }}>{warningModal.nim}</div>
                </div>
                <span style={{ marginLeft: "auto", background: "#FEE2E2", color: "#DC2626", padding: "3px 10px", borderRadius: "100px", fontSize: "12px", fontWeight: 600 }}>
                  ⚠ {warningModal.violations} pelanggaran
                </span>
              </div>
              <div className="form-group">
                <label className="form-label">Pesan Peringatan <span style={{ color: "#DC2626" }}>*</span></label>
                <textarea
                  className="form-textarea"
                  placeholder="Mohon perhatikan aturan ujian..."
                  value={warningMsg}
                  onChange={e => setWarningMsg(e.target.value)}
                  maxLength={500}
                  rows={4}
                />
                <div style={{ fontSize: "12px", color: "#9CA3AF", textAlign: "right" }}>{warningMsg.length}/500</div>
              </div>
            </div>
            <div style={{ padding: "16px 24px", borderTop: "1px solid #F3F4F6", display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button onClick={() => setWarningModal(null)} className="btn btn-secondary btn-md">Batal</button>
              <button
                className="btn btn-primary btn-md"
                onClick={() => { showToast("success", `Peringatan berhasil dikirim ke ${warningModal.name}`); setWarningModal(null); setWarningMsg(""); }}
              >Kirim Peringatan</button>
            </div>
          </div>
        </div>
      )}

      {/* Unlock Modal */}
      {unlockModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }} onClick={() => setUnlockModal(null)}>
          <div style={{ background: "white", borderRadius: "16px", maxWidth: "400px", width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid #F3F4F6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "17px", fontWeight: 700, color: "#111827" }}>Buka Kunci Peserta?</span>
              <button onClick={() => setUnlockModal(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", fontSize: "18px" }}>✕</button>
            </div>
            <div style={{ padding: "20px 24px" }}>
              <p style={{ color: "#6B7280", lineHeight: 1.7, fontSize: "15px" }}>
                <strong style={{ color: "#111827" }}>{unlockModal.name}</strong> ({unlockModal.nim}) saat ini terkunci. Kamu yakin ingin membuka kuncinya?
              </p>
            </div>
            <div style={{ padding: "16px 24px", borderTop: "1px solid #F3F4F6", display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button onClick={() => setUnlockModal(null)} className="btn btn-secondary btn-md">Batal</button>
              <button
                className="btn btn-primary btn-md"
                onClick={() => { showToast("success", `${unlockModal.name} berhasil di-unlock`); setUnlockModal(null); }}
              >Ya, Buka Kunci</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="toast-container">
          <div className={`toast ${toast.type}`}>
            <span className="toast-icon">{toast.type === "success" ? "✅" : "ℹ️"}</span>
            <div className="toast-content"><div className="toast-msg">{toast.msg}</div></div>
            <button className="toast-close" onClick={() => setToast(null)}>✕</button>
          </div>
        </div>
      )}

      <style>{`@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }`}</style>
    </DashboardShell>
  );
}

export default function MonitorPageWrapper() {
  return <Suspense><MonitorPage /></Suspense>;
}
