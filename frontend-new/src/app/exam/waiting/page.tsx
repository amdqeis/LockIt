"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { clearSessionHint } from "@/lib/examSession";
import { io as socketIO, Socket } from "socket.io-client";

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

type StudentState = "waiting" | "accepted" | "active" | "kicked";
type ConnectionStatus = "connected" | "reconnecting" | "offline";

export default function WaitingPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/exam/lobby");
  }, [router]);

  const [participant, setParticipant] = useState<ParticipantInfo>(DEFAULT_PARTICIPANT);
  const [studentStatus, setStudentStatus] = useState<StudentState>("waiting");
  const [kickReason, setKickReason] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>("Menunggu pengawas menerima kamu ke ruang ujian...");
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connected");
  const [secondsWaited, setSecondsWaited] = useState(0);

  // Timer counter for seconds waited
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsWaited((s) => s + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Poll waiting room status via HTTP endpoint
  useEffect(() => {
    let cancelled = false;

    const checkWaitingStatus = async () => {
      try {
        const res = await fetch("/api/exam-session/waiting", {
          cache: "no-store",
          credentials: "include",
        });

        if (cancelled) return;

        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) {
            setConnectionStatus("connected");
            const { student, exam } = json.data;

            setParticipant((prev) => ({
              ...prev,
              name: student.name || prev.name,
              nisn: student.nisn || prev.nisn,
              exam: exam.title || prev.exam,
              accessCode: exam.accessCode || prev.accessCode,
              duration: exam.durationMinutes || prev.duration,
              questionCount: exam.questionCount ?? prev.questionCount,
            }));

            if (student.status === "active") {
              router.push("/exam/session");
              return;
            }

            if (student.status === "kicked") {
              setStudentStatus("kicked");
              setKickReason(student.kickReason || "Dikeluarkan oleh pengawas");
              clearSessionHint();
              setTimeout(() => {
                sessionStorage.setItem("exam_already_submitted", "true");
                router.push("/");
              }, 3000);
              return;
            }

            if (student.status === "accepted") {
              setStudentStatus("accepted");
              setStatusMessage("Kamu telah diterima oleh pengawas! Menunggu ujian dimulai.");
            } else if (student.status === "waiting") {
              setStudentStatus("waiting");
              setStatusMessage("Menunggu pengawas menerima kamu ke ruang ujian...");
            }
          }
        } else if (res.status === 401 || res.status === 403) {
          const json = await res.json().catch(() => null);
          if (json?.error?.code === "ALREADY_SUBMITTED" || json?.error?.code === "EXAM_ALREADY_SUBMITTED") {
            router.replace("/exam/done");
            return;
          }
          setConnectionStatus("offline");
        } else {
          setConnectionStatus("reconnecting");
        }
      } catch {
        if (!cancelled) setConnectionStatus("reconnecting");
      }
    };

    checkWaitingStatus();
    const interval = setInterval(checkWaitingStatus, 3000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [router]);

  // Socket.IO real-time listener (best effort)
  useEffect(() => {
    let socket: Socket | null = null;
    try {
      socket = socketIO("/student-session", {
        withCredentials: true,
        transports: ["websocket", "polling"],
        reconnectionAttempts: 5,
        timeout: 5000,
      });

      socket.on("connect", () => {
        setConnectionStatus("connected");
      });

      socket.on("student_accepted", (data: { message?: string }) => {
        setStudentStatus("accepted");
        if (data?.message) {
          setStatusMessage(data.message);
        }
      });

      socket.on("exam_started", () => {
        setStudentStatus("active");
        router.push("/exam/session");
      });

      socket.on("student_kicked", (data: { reason?: string }) => {
        setStudentStatus("kicked");
        setKickReason(data?.reason || "Dikeluarkan oleh pengawas ujian");
        clearSessionHint();
        setTimeout(() => {
          sessionStorage.setItem("exam_already_submitted", "true");
          router.push("/");
        }, 3000);
      });

      socket.on("connect_error", () => {
        // Fallback silently to HTTP polling
      });
    } catch {
      // Ignore socket setup error, rely on HTTP polling
    }

    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [router]);

  const formatWaited = (s: number) => {
    if (s < 60) return `${s} dtk`;
    return `${Math.floor(s / 60)} mnt ${s % 60} dtk`;
  };

  const connConfig = {
    connected: { dot: "#22C55E", bg: "rgba(34,197,94,0.12)", color: "#42654F", text: "Terhubung ke server" },
    reconnecting: { dot: "#F59E0B", bg: "rgba(245,158,11,0.12)", color: "#C28A3D", text: "Menghubungkan ulang..." },
    offline: { dot: "#EF4444", bg: "rgba(239,68,68,0.12)", color: "#DC2626", text: "Sesi tidak aktif" },
  }[connectionStatus];

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(160deg, #DCE8F0 0%, #EDF3F4 50%, #F8FCFF 100%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
      fontFamily: "Poppins, sans-serif",
    }}>
      <div style={{ width: "100%", maxWidth: "480px" }}>

        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", marginBottom: "32px" }}>
          <div style={{
            width: "38px", height: "38px",
            background: "linear-gradient(135deg, #0284C7, #4F6B80)",
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
          border: "1.5px solid #D9E9F2",
          boxShadow: "0 8px 32px rgba(41,171,226,0.10)",
          overflow: "hidden",
        }}>
          {/* Animated top stripe */}
          <div style={{
            height: "4px",
            background: studentStatus === "accepted"
              ? "linear-gradient(90deg, #10B981, #34D399, #059669)"
              : studentStatus === "kicked"
              ? "linear-gradient(90deg, #EF4444, #F87171, #DC2626)"
              : "linear-gradient(90deg, #4F6B80, #4F6B80, #7FA9C9, #4F6B80)",
            backgroundSize: "200% 100%",
            animation: "stripe 2s linear infinite",
          }} />

          <div style={{ padding: "36px 32px 32px", textAlign: "center" }}>
            {/* Status animation icon */}
            <div style={{ position: "relative", display: "inline-flex", marginBottom: "24px" }}>
              {studentStatus === "accepted" ? (
                <div style={{
                  width: "90px", height: "90px", borderRadius: "50%",
                  background: "#ECFDF5", border: "3px solid #10B981",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "40px", boxShadow: "0 0 20px rgba(16,185,129,0.25)",
                }}>
                  ✅
                </div>
              ) : studentStatus === "kicked" ? (
                <div style={{
                  width: "90px", height: "90px", borderRadius: "50%",
                  background: "#FEF2F2", border: "3px solid #EF4444",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "40px", boxShadow: "0 0 20px rgba(239,68,68,0.25)",
                }}>
                  🚫
                </div>
              ) : (
                <div style={{
                  width: "90px", height: "90px", borderRadius: "50%",
                  border: "3px solid #C5D8E2",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  position: "relative",
                }}>
                  <div style={{
                    position: "absolute", inset: "-3px", borderRadius: "50%",
                    border: "3px solid transparent",
                    borderTopColor: "#4F6B80",
                    borderRightColor: "#7FA9C9",
                    animation: "spin 1.4s linear infinite",
                  }} />
                  <div style={{
                    width: "60px", height: "60px", borderRadius: "50%",
                    background: "linear-gradient(135deg, #DCE8F0, #C5D8E2)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "26px",
                  }}>
                    ⏳
                  </div>
                </div>
              )}
            </div>

            {studentStatus === "accepted" ? (
              <>
                <h1 style={{ fontSize: "21px", fontWeight: 700, color: "#065F46", marginBottom: "8px" }}>
                  Kamu Telah Diterima!
                </h1>
                <p style={{ color: "#047857", fontSize: "14px", lineHeight: 1.6, marginBottom: "24px" }}>
                  {statusMessage}<br />
                  <span style={{ fontSize: "13px", color: "#6E8EA0" }}>Halaman akan otomatis beralih saat pengawas menekan Mulai Ujian.</span>
                </p>
              </>
            ) : studentStatus === "kicked" ? (
              <>
                <h1 style={{ fontSize: "21px", fontWeight: 700, color: "#991B1B", marginBottom: "8px" }}>
                  Dikeluarkan dari Ujian
                </h1>
                <p style={{ color: "#DC2626", fontSize: "14px", lineHeight: 1.6, marginBottom: "12px" }}>
                  Alasan: <strong>{kickReason || "Dikeluarkan oleh pengawas"}</strong>
                </p>
                <p style={{ color: "#6E8EA0", fontSize: "12px", marginBottom: "24px" }}>
                  Mengalihkan kembali ke halaman utama...
                </p>
              </>
            ) : (
              <>
                <h1 style={{ fontSize: "21px", fontWeight: 700, color: "#1C303D", marginBottom: "8px" }}>
                  Menunggu Pengawas
                </h1>
                <p style={{ color: "#6E8EA0", fontSize: "14px", lineHeight: 1.6, marginBottom: "24px" }}>
                  Pengawas sedang meninjau peserta di ruang tunggu.<br />
                  Mohon tetap di halaman ini.
                </p>
              </>
            )}

            {/* Participant info */}
            <div style={{
              background: "#F8FCFF",
              border: "1.5px solid #D9E9F2",
              borderRadius: "14px",
              padding: "16px 18px",
              textAlign: "left",
              marginBottom: "18px",
            }}>
              <div style={{ fontSize: "10px", color: "#98B4C4", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "12px" }}>
                Info Peserta &amp; Ujian
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "9px" }}>
                {[
                  { label: "Nama", value: participant.name },
                  { label: "NISN", value: participant.nisn, mono: true },
                  { label: "Ujian", value: participant.exam },
                  { label: "Kode Akses", value: participant.accessCode || "-", mono: true, badge: true },
                  {
                    label: "Status Ruang Tunggu",
                    value: studentStatus === "accepted" ? "Diterima" : studentStatus === "kicked" ? "Dikeluarkan" : "Menunggu Konfirmasi",
                    badge: true,
                    statusBadge: studentStatus,
                  },
                ].map(({ label, value, mono, badge, statusBadge }) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "13px", color: "#6E8EA0", flexShrink: 0 }}>{label}</span>
                    {badge ? (
                      <span style={{
                        fontSize: "11px", fontWeight: 700,
                        background: statusBadge === "accepted" ? "#ECFDF5" : statusBadge === "kicked" ? "#FEF2F2" : "#DCE8F0",
                        color: statusBadge === "accepted" ? "#059669" : statusBadge === "kicked" ? "#DC2626" : "#0284C7",
                        padding: "2px 10px", borderRadius: "999px",
                        fontFamily: mono ? "monospace" : undefined, letterSpacing: "0.04em",
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
                background: "#F0F9FF", border: "1px solid #C5D8E2",
                display: "flex", flexDirection: "column", alignItems: "center", gap: "2px",
              }}>
                <span style={{ fontSize: "18px", fontWeight: 700, color: "#4F6B80" }}>{participant.questionCount}</span>
                <span style={{ fontSize: "11px", color: "#6E8EA0" }}>Soal</span>
              </div>
              <div style={{
                flex: 1, padding: "10px 14px", borderRadius: "12px",
                background: "#F0F9FF", border: "1px solid #C5D8E2",
                display: "flex", flexDirection: "column", alignItems: "center", gap: "2px",
              }}>
                <span style={{ fontSize: "18px", fontWeight: 700, color: "#4F6B80" }}>{participant.duration}</span>
                <span style={{ fontSize: "11px", color: "#6E8EA0" }}>Menit</span>
              </div>
              <div style={{
                flex: 1, padding: "10px 14px", borderRadius: "12px",
                background: "#F0F9FF", border: "1px solid #C5D8E2",
                display: "flex", flexDirection: "column", alignItems: "center", gap: "2px",
              }}>
                <span style={{ fontSize: "18px", fontWeight: 700, color: "#4F6B80" }}>{formatWaited(secondsWaited)}</span>
                <span style={{ fontSize: "11px", color: "#6E8EA0" }}>Waktu Tunggu</span>
              </div>
            </div>

            {/* Connection status */}
            <div style={{
              display: "inline-flex", alignItems: "center", gap: "8px",
              padding: "7px 16px", borderRadius: "999px",
              background: connConfig.bg,
              color: connConfig.color,
              fontSize: "12px", fontWeight: 500,
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
            Pastikan jaringan internetmu stabil dan browser dalam kondisi terbuka penuh. Jangan membuka aplikasi lain selama menunggu.
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
