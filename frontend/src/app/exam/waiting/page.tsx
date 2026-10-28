"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchExamSession } from "@/lib/examSession";

interface ParticipantInfo {
  name: string;
  nisn: string;
  exam: string;
  accessCode: string;
  duration: number;
  questionCount: number;
}

const DEFAULT_PARTICIPANT: ParticipantInfo = {
  name: "Peserta Ujian",
  nisn: "0000000000",
  exam: "Memuat ujian...",
  accessCode: "",
  duration: 90,
  questionCount: 0,
};

type ConnectionStatus = "connected" | "reconnecting" | "offline";

export default function WaitingPage() {
  const router = useRouter();
  const [participant, setParticipant] = useState<ParticipantInfo>(DEFAULT_PARTICIPANT);
  const [dots, setDots] = useState(".");
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connected");
  const [secondsWaited, setSecondsWaited] = useState(0);
  const [pulse, setPulse] = useState(false);

  // Poll session to verify status and redirect when teacher starts the exam
  useEffect(() => {
    let cancelled = false;

    const checkSession = async () => {
      try {
        const res = await fetchExamSession();
        if (cancelled) return;
        if (res.success && res.data) {
          const session = res.data;
          setConnectionStatus("connected");
          setParticipant((prev) => ({
            ...prev,
            name: session.student.name,
            nisn: session.student.nisn,
            exam: session.exam.title,
            accessCode: session.exam.accessCode ?? prev.accessCode,
            duration: session.exam.durationMinutes,
            questionCount: session.questions.length,
          }));
          if (!session.exam.status || session.exam.status === "active") {
            router.push("/exam/session");
          }
        } else {
          setConnectionStatus("reconnecting");
        }
      } catch {
        if (!cancelled) setConnectionStatus("reconnecting");
      }
    };

    checkSession();
    const interval = setInterval(checkSession, 4000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [router]);

  const formatWaited = (s: number) => {
    if (s < 60) return `${s} dtk`;
    return `${Math.floor(s / 60)} mnt ${s % 60} dtk`;
  };

  const connConfig = {
    connected: { dot: "#22C55E", bg: "rgba(34,197,94,0.12)", color: "#16A34A", text: "Terhubung ke server" },
    reconnecting: { dot: "#F59E0B", bg: "rgba(245,158,11,0.12)", color: "#D97706", text: "Menghubungkan ulang..." },
    offline: { dot: "#EF4444", bg: "rgba(239,68,68,0.12)", color: "#DC2626", text: "Terputus dari server" },
  }[connectionStatus];

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(160deg, #E0F4FD 0%, #EDF6FC 50%, #F8FCFF 100%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
      fontFamily: "Poppins, sans-serif",
    }}>
      <div style={{ width: "100%", maxWidth: "480px" }}>

        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", marginBottom: "40px" }}>
          <div style={{
            width: "38px", height: "38px",
            background: "linear-gradient(135deg, #0284C7, #29ABE2)",
            borderRadius: "11px",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "18px",
            boxShadow: "0 4px 14px rgba(41,171,226,0.35)",
          }}>🔒</div>
          <span style={{ fontSize: "22px", fontWeight: 800, color: "#1C303D", letterSpacing: "-0.02em" }}>LockIt</span>
        </div>

        {/* Main card */}
        <div style={{
          background: "white",
          borderRadius: "24px",
          border: "1.5px solid #D9E9F2",
          boxShadow: "0 8px 32px rgba(41,171,226,0.10)",
          overflow: "hidden",
        }}>
          {/* Animated top stripe */}
          <div style={{
            height: "4px",
            background: "linear-gradient(90deg, #29ABE2, #0EA5E9, #7DD3FC, #29ABE2)",
            backgroundSize: "200% 100%",
            animation: "stripe 2s linear infinite",
          }} />

          <div style={{ padding: "36px 32px 32px", textAlign: "center" }}>
            {/* Waiting animation */}
            <div style={{ position: "relative", display: "inline-flex", marginBottom: "28px" }}>
              {/* Outer ring */}
              <div style={{
                width: "100px", height: "100px", borderRadius: "50%",
                border: "3px solid #C8E6F5",
                display: "flex", alignItems: "center", justifyContent: "center",
                position: "relative",
              }}>
                {/* Spinning ring */}
                <div style={{
                  position: "absolute", inset: "-3px", borderRadius: "50%",
                  border: "3px solid transparent",
                  borderTopColor: "#29ABE2",
                  borderRightColor: "#7DD3FC",
                  animation: "spin 1.4s linear infinite",
                }} />
                {/* Inner icon */}
                <div style={{
                  width: "64px", height: "64px", borderRadius: "50%",
                  background: "linear-gradient(135deg, #E0F4FD, #C8E6F5)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "28px",
                  transform: pulse ? "scale(1.08)" : "scale(1)",
                  transition: "transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
                }}>
                  ⏳
                </div>
              </div>
            </div>

            <h1 style={{ fontSize: "22px", fontWeight: 700, color: "#1C303D", marginBottom: "10px", letterSpacing: "-0.02em" }}>
              Menunggu ujian dimulai{dots}
            </h1>
            <p style={{ color: "#6E8EA0", fontSize: "14px", lineHeight: 1.7, marginBottom: "28px" }}>
              Jangan tutup atau reload halaman ini.<br />
              Ujian akan dimulai secara otomatis saat pengawas mengaktifkannya.
            </p>

            {/* Participant info */}
            <div style={{
              background: "#F8FCFF",
              border: "1.5px solid #D9E9F2",
              borderRadius: "14px",
              padding: "18px 20px",
              textAlign: "left",
              marginBottom: "20px",
            }}>
              <div style={{ fontSize: "10px", color: "#98B4C4", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "14px" }}>
                Info Peserta
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {[
                  { label: "Nama", value: participant.name },
                  { label: "NISN", value: participant.nisn, mono: true },
                  { label: "Ujian", value: participant.exam },
                  { label: "Kode Akses", value: participant.accessCode || "-", mono: true, badge: true },
                ].map(({ label, value, mono, badge }) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "13px", color: "#6E8EA0", flexShrink: 0 }}>{label}</span>
                    {badge ? (
                      <span style={{
                        fontSize: "12px", fontWeight: 700,
                        background: "#E0F4FD", color: "#0284C7",
                        padding: "2px 10px", borderRadius: "999px",
                        fontFamily: "monospace", letterSpacing: "0.08em",
                      }}>{value}</span>
                    ) : (
                      <span style={{ fontSize: "13px", fontWeight: 600, color: "#1C303D", textAlign: "right", fontFamily: mono ? "monospace" : undefined }}>{value}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Exam info pills */}
            <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
              <div style={{
                flex: 1, padding: "10px 14px", borderRadius: "12px",
                background: "#F0F9FF", border: "1px solid #C8E6F5",
                display: "flex", flexDirection: "column", alignItems: "center", gap: "2px",
              }}>
                <span style={{ fontSize: "18px", fontWeight: 700, color: "#29ABE2" }}>{participant.questionCount}</span>
                <span style={{ fontSize: "11px", color: "#6E8EA0" }}>Soal</span>
              </div>
              <div style={{
                flex: 1, padding: "10px 14px", borderRadius: "12px",
                background: "#F0F9FF", border: "1px solid #C8E6F5",
                display: "flex", flexDirection: "column", alignItems: "center", gap: "2px",
              }}>
                <span style={{ fontSize: "18px", fontWeight: 700, color: "#29ABE2" }}>{participant.duration}</span>
                <span style={{ fontSize: "11px", color: "#6E8EA0" }}>Menit</span>
              </div>
              <div style={{
                flex: 1, padding: "10px 14px", borderRadius: "12px",
                background: "#F0F9FF", border: "1px solid #C8E6F5",
                display: "flex", flexDirection: "column", alignItems: "center", gap: "2px",
              }}>
                <span style={{ fontSize: "18px", fontWeight: 700, color: "#29ABE2" }}>{formatWaited(secondsWaited)}</span>
                <span style={{ fontSize: "11px", color: "#6E8EA0" }}>Menunggu</span>
              </div>
            </div>

            {/* Connection status */}
            <div style={{
              display: "inline-flex", alignItems: "center", gap: "8px",
              padding: "8px 16px", borderRadius: "999px",
              background: connConfig.bg,
              color: connConfig.color,
              fontSize: "13px", fontWeight: 500,
              transition: "all 0.3s",
            }}>
              <span style={{
                display: "inline-block", width: "7px", height: "7px",
                borderRadius: "50%",
                background: connConfig.dot,
                animation: connectionStatus === "connected" ? "none" : "blink 0.8s ease-in-out infinite",
              }} />
              {connConfig.text}
            </div>

            <p style={{ marginTop: "14px", fontSize: "11px", color: "#C8E6F5" }}>
              Demo: ujian akan dimulai otomatis dalam beberapa detik
            </p>
          </div>
        </div>

        {/* Warning note */}
        <div style={{
          marginTop: "16px",
          background: "rgba(245,158,11,0.08)",
          border: "1px solid rgba(245,158,11,0.25)",
          borderRadius: "12px",
          padding: "12px 16px",
          display: "flex",
          alignItems: "flex-start",
          gap: "10px",
        }}>
          <span style={{ fontSize: "16px", flexShrink: 0 }}>⚠️</span>
          <p style={{ fontSize: "12px", color: "#92400E", lineHeight: 1.6, margin: 0 }}>
            Pastikan jaringan internetmu stabil dan browser dalam kondisi terbuka penuh. Keluar dari halaman ini setelah ujian dimulai akan dicatat sebagai pelanggaran.
          </p>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes stripe {
          from { background-position: 200% 0; }
          to { background-position: -200% 0; }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.25; }
        }
      `}</style>
    </div>
  );
}
