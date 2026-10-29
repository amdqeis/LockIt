"use client";

import { useEffect, useState } from "react";

interface SubmissionSummary {
  name: string;
  nisn: string;
  exam: string;
  answered: number;
  total: number;
  violations: number;
  duration: number;
}

const DEFAULT_SUMMARY: SubmissionSummary = {
  name: "Peserta Ujian",
  nisn: "0000000000",
  exam: "Ujian Selesai",
  answered: 0,
  total: 0,
  violations: 0,
  duration: 90,
};

export default function ExamDonePage() {
  const [summary, setSummary] = useState<SubmissionSummary>(DEFAULT_SUMMARY);
  const [show, setShow] = useState(false);
  const [submitTime, setSubmitTime] = useState("");
  const [checkmark, setCheckmark] = useState(false);
  const [confettiActive, setConfettiActive] = useState(false);
  const [confettiRotations, setConfettiRotations] = useState<number[]>([]);

  useEffect(() => {
    try {
      const stored =
        sessionStorage.getItem("eduquas_submission_summary") ||
        sessionStorage.getItem("lockit_submission_summary");
      if (stored) {
        const parsed = JSON.parse(stored);
        setSummary((prev) => ({ ...prev, ...parsed }));
      }
    } catch {}

    // Generate random rotation values for each confetti piece (client-only)
    setConfettiRotations(
      Array.from({ length: 24 }, () => (Math.random() > 0.5 ? 1 : -1) * Math.floor(Math.random() * 360 + 180))
    );

    // Stagger animations
    const t1 = setTimeout(() => setShow(true), 80);
    const t2 = setTimeout(() => setCheckmark(true), 350);
    const t3 = setTimeout(() => setConfettiActive(true), 500);
    const t4 = setTimeout(() => setConfettiActive(false), 3000);

    setSubmitTime(new Date().toLocaleTimeString("id-ID", {
      hour: "2-digit", minute: "2-digit", second: "2-digit", timeZoneName: "short",
    }));

    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, []);

  const completionRate = summary.total > 0 ? Math.round((summary.answered / summary.total) * 100) : 100;

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(160deg, #DCFCE7 0%, #F0FDF4 40%, #F8FCFF 100%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
      fontFamily: "Poppins, sans-serif",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Confetti dots */}
      {confettiActive && (
        <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}>
          {Array.from({ length: 24 }, (_, i) => (
            <div key={i} style={{
              position: "absolute",
              width: `${6 + (i % 5) * 3}px`,
              height: `${6 + (i % 5) * 3}px`,
              borderRadius: i % 3 === 0 ? "50%" : "2px",
              background: ["#29ABE2", "#10B981", "#F59E0B", "#6D28D9", "#EC4899"][i % 5],
              left: `${(i * 4.2) % 100}%`,
              top: "-10px",
              animation: `confetti-fall ${1.5 + (i % 4) * 0.4}s cubic-bezier(0.25, 0.46, 0.45, 0.94) ${(i % 6) * 0.15}s forwards`,
              opacity: 0.85,
              // Pass per-piece rotation as CSS custom property (set after hydration)
              ["--rot" as string]: `${confettiRotations[i] ?? 360}deg`,
            }} />
          ))}
        </div>
      )}

      <div style={{
        width: "100%", maxWidth: "480px",
        opacity: show ? 1 : 0,
        transform: show ? "translateY(0)" : "translateY(24px)",
        transition: "all 0.5s cubic-bezier(0.34, 1.1, 0.64, 1)",
        position: "relative", zIndex: 1,
      }}>

        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", marginBottom: "36px" }}>
          <div style={{
            width: "38px", height: "38px",
            background: "linear-gradient(135deg, #0284C7, #29ABE2)",
            borderRadius: "11px",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "18px",
            boxShadow: "0 4px 14px rgba(41,171,226,0.35)",
          }}>🔒</div>
          <span style={{ fontSize: "22px", fontWeight: 800, color: "#1C303D", letterSpacing: "-0.02em" }}>EduQuas</span>
        </div>

        {/* Main card */}
        <div style={{
          background: "white",
          borderRadius: "24px",
          border: "1.5px solid #BBF7D0",
          boxShadow: "0 8px 40px rgba(16,185,129,0.12)",
          overflow: "hidden",
        }}>
          {/* Green top stripe */}
          <div style={{
            height: "4px",
            background: "linear-gradient(90deg, #10B981, #34D399, #6EE7B7, #10B981)",
            backgroundSize: "200% 100%",
            animation: "stripe 2s linear infinite",
          }} />

          <div style={{ padding: "40px 32px 32px", textAlign: "center" }}>
            {/* Success icon */}
            <div style={{
              width: "96px", height: "96px", borderRadius: "50%",
              background: "linear-gradient(135deg, #D1FAE5, #A7F3D0)",
              border: "3px solid #10B981",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 24px",
              transform: checkmark ? "scale(1)" : "scale(0.4)",
              transition: "transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)",
              boxShadow: "0 8px 32px rgba(16,185,129,0.25)",
            }}>
              {/* Custom checkmark SVG */}
              <svg
                width="44" height="44" viewBox="0 0 44 44" fill="none"
                style={{
                  strokeDasharray: 58,
                  strokeDashoffset: checkmark ? 0 : 58,
                  transition: "stroke-dashoffset 0.5s ease 0.3s",
                }}
              >
                <path
                  d="M8 22L18 32L36 14"
                  stroke="#10B981"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            <h1 style={{
              fontSize: "28px", fontWeight: 800, color: "#065F46",
              marginBottom: "8px", letterSpacing: "-0.02em",
            }}>
              Ujian Selesai! 🎉
            </h1>
            <p style={{ color: "#6B7280", marginBottom: "28px", fontSize: "14px", lineHeight: 1.7 }}>
              Jawabanmu berhasil dikumpulkan dan tercatat.<br />
              Terima kasih sudah mengikuti ujian dengan baik.
            </p>

            {/* Stats */}
            <div style={{ display: "flex", gap: "10px", marginBottom: "24px" }}>
              <div style={{
                flex: 1, padding: "14px 10px", borderRadius: "14px",
                background: "linear-gradient(135deg, #ECFDF5, #D1FAE5)",
                border: "1.5px solid #A7F3D0",
                display: "flex", flexDirection: "column", alignItems: "center", gap: "2px",
              }}>
                <span style={{ fontSize: "22px", fontWeight: 800, color: "#059669" }}>{summary.answered}</span>
                <span style={{ fontSize: "10px", color: "#6B7280", fontWeight: 500 }}>Terjawab</span>
              </div>
              <div style={{
                flex: 1, padding: "14px 10px", borderRadius: "14px",
                background: summary.total - summary.answered > 0
                  ? "linear-gradient(135deg, #FEF3C7, #FDE68A)"
                  : "linear-gradient(135deg, #ECFDF5, #D1FAE5)",
                border: `1.5px solid ${summary.total - summary.answered > 0 ? "#FCD34D" : "#A7F3D0"}`,
                display: "flex", flexDirection: "column", alignItems: "center", gap: "2px",
              }}>
                <span style={{ fontSize: "22px", fontWeight: 800, color: summary.total - summary.answered > 0 ? "#D97706" : "#059669" }}>
                  {summary.total - summary.answered}
                </span>
                <span style={{ fontSize: "10px", color: "#6B7280", fontWeight: 500 }}>Kosong</span>
              </div>
              <div style={{
                flex: 1, padding: "14px 10px", borderRadius: "14px",
                background: summary.violations > 0
                  ? "linear-gradient(135deg, #FEF2F2, #FECACA)"
                  : "linear-gradient(135deg, #ECFDF5, #D1FAE5)",
                border: `1.5px solid ${summary.violations > 0 ? "#FCA5A5" : "#A7F3D0"}`,
                display: "flex", flexDirection: "column", alignItems: "center", gap: "2px",
              }}>
                <span style={{ fontSize: "22px", fontWeight: 800, color: summary.violations > 0 ? "#DC2626" : "#059669" }}>
                  {summary.violations}
                </span>
                <span style={{ fontSize: "10px", color: "#6B7280", fontWeight: 500 }}>Pelanggaran</span>
              </div>
            </div>

            {/* Completion bar */}
            <div style={{ marginBottom: "24px", textAlign: "left" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                <span style={{ fontSize: "12px", color: "#6B7280" }}>Kelengkapan jawaban</span>
                <span style={{ fontSize: "12px", fontWeight: 700, color: "#059669" }}>{completionRate}%</span>
              </div>
              <div style={{ height: "8px", borderRadius: "999px", background: "#E5E7EB", overflow: "hidden" }}>
                <div style={{
                  height: "100%",
                  width: `${completionRate}%`,
                  borderRadius: "999px",
                  background: "linear-gradient(90deg, #10B981, #34D399)",
                  transition: "width 1s cubic-bezier(0.34, 1.1, 0.64, 1) 0.5s",
                }} />
              </div>
            </div>

            {/* Info rows */}
            <div style={{
              background: "#F9FAFB",
              border: "1px solid #E5E7EB",
              borderRadius: "14px",
              overflow: "hidden",
              marginBottom: "20px",
            }}>
              {[
                { label: "Nama", value: summary.name },
                { label: "NISN", value: summary.nisn, mono: true },
                { label: "Ujian", value: summary.exam },
                { label: "Submitted pada", value: submitTime, green: true },
              ].map(({ label, value, mono, green }, i, arr) => (
                <div key={label} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "12px 18px",
                  borderBottom: i < arr.length - 1 ? "1px solid #F3F4F6" : "none",
                }}>
                  <span style={{ fontSize: "13px", color: "#9CA3AF" }}>{label}</span>
                  <span style={{
                    fontSize: "13px", fontWeight: 600,
                    color: green ? "#059669" : "#111827",
                    fontFamily: mono ? "monospace" : undefined,
                    textAlign: "right", maxWidth: "240px",
                  }}>{value}{green && " ✓"}</span>
                </div>
              ))}
            </div>

            {/* Footer note */}
            <div style={{
              padding: "14px 18px",
              background: "#F0FDF4",
              border: "1px solid #BBF7D0",
              borderRadius: "12px",
              fontSize: "13px",
              color: "#065F46",
              lineHeight: 1.7,
            }}>
              📋 Hasil ujian akan diumumkan oleh pengawas. Kamu sudah bisa menutup tab ini.
            </div>
          </div>
        </div>

        {/* Safe close note */}
        <p style={{ textAlign: "center", fontSize: "12px", color: "#9CA3AF", marginTop: "16px" }}>
          Halaman ini aman ditutup. Jawabanmu sudah tersimpan di server.
        </p>
      </div>

      <style>{`
        @keyframes stripe {
          from { background-position: 200% 0; }
          to { background-position: -200% 0; }
        }
        @keyframes confetti-fall {
          0% { transform: translateY(0) rotate(0deg); opacity: 0.85; }
          100% { transform: translateY(100vh) rotate(var(--rot, 360deg)); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
