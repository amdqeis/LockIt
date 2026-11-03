"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { clearSessionHint, fetchLobbyStatus, LobbyData, LobbyParticipant } from "@/lib/examSession";
import { io as socketIO, Socket } from "socket.io-client";

// Unified Design Tokens (EduQuas)
const T = {
  bgPage: "#F6F8FB",
  bgCard: "#FFFFFF",
  border: "#E1E6ED",
  borderInput: "#8391A7",
  textPrimary: "#172033",
  textSecondary: "#5B6778",
  textMuted: "#8391A7",
  primary: "#1B76BF",
  primaryLight: "#EBF5FC",
  primaryHover: "#155E99",
  success: "#16A34A",
  successBg: "#DCFCE7",
  warning: "#D97706",
  warningBg: "#FEF3C7",
  danger: "#C73E3E",
  dangerBg: "#FCE9E9",
  radiusCard: "16px",
  radiusPill: "999px",
  fontMono: "ui-monospace, SFMono-Regular, Menlo, monospace",
};

export default function ExamLobbyPage() {
  const router = useRouter();
  const [data, setData] = useState<LobbyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [secondsWaited, setSecondsWaited] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState<"connected" | "reconnecting" | "offline">("connected");
  const [isStarting, setIsStarting] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  // Timer tunggu
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsWaited((s) => s + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Format detik ke menit dan detik
  const formatWaited = (s: number) => {
    if (s < 60) return `${s} dtk`;
    return `${Math.floor(s / 60)} mnt ${s % 60} dtk`;
  };

  // Polling data lobby via HTTP
  const loadLobby = async (isInitial = false) => {
    try {
      const res = await fetchLobbyStatus();
      if (res.success && res.data) {
        setData(res.data);
        setError(null);
        setConnectionStatus("connected");

        // Jika ujian sudah dimulai dan siswa aktif -> langsung alihkan
        if (res.data.canStartExam || (res.data.exam.status === "active" && res.data.currentStudent.status === "active")) {
          setIsStarting(true);
          setTimeout(() => {
            router.replace("/exam/session");
          }, 800);
          return;
        }

        // Jika siswa dikeluarkan
        if (res.data.currentStudent.status === "kicked") {
          clearSessionHint();
          setTimeout(() => {
            sessionStorage.setItem("exam_already_submitted", "true");
            router.replace("/");
          }, 3000);
          return;
        }
      } else {
        if (res.error?.code === "ALREADY_SUBMITTED" || res.error?.code === "EXAM_ALREADY_SUBMITTED") {
          router.replace("/exam/done");
          return;
        }
        if (res.error?.code === "UNAUTHORIZED" || res.error?.code === "TOKEN_EXPIRED") {
          setConnectionStatus("offline");
          setError("Sesi tidak ditemukan atau telah kedaluwarsa. Silakan masukkan kode ujian kembali.");
        } else {
          setConnectionStatus("reconnecting");
        }
      }
    } catch {
      setConnectionStatus("reconnecting");
    } finally {
      if (isInitial) setLoading(false);
    }
  };

  useEffect(() => {
    loadLobby(true);
    const interval = setInterval(() => {
      loadLobby(false);
    }, 3000);

    return () => clearInterval(interval);
  }, [router]);

  // Socket.IO Real-time updates
  useEffect(() => {
    const socketUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
    const socket = socketIO(`${socketUrl}/student-session`, {
      withCredentials: true,
      transports: ["websocket", "polling"],
      reconnectionAttempts: 5,
      timeout: 5000,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnectionStatus("connected");
    });

    socket.on("exam_started", () => {
      setIsStarting(true);
      setTimeout(() => {
        router.replace("/exam/session");
      }, 700);
    });

    socket.on("student_joined_lobby", (newStudent: { studentId: string; name: string; nisn: string; status: string; joinedAt: string }) => {
      setData((prev) => {
        if (!prev) return prev;
        const exists = prev.participants.some((p) => p.id === newStudent.studentId);
        if (exists) return prev;
        const newParticipant: LobbyParticipant = {
          id: newStudent.studentId,
          name: newStudent.name,
          nisn: newStudent.nisn,
          status: newStudent.status,
          joinedAt: newStudent.joinedAt,
          isSelf: newStudent.studentId === prev.currentStudent.id,
        };
        return {
          ...prev,
          participants: [...prev.participants, newParticipant],
          totalParticipants: prev.totalParticipants + 1,
        };
      });
    });

    socket.on("student_accepted", (data: { studentId?: string; message?: string }) => {
      setData((prev) => {
        if (!prev) return prev;
        const updated = prev.participants.map((p) => {
          if (!data?.studentId || p.id === data.studentId) {
            return { ...p, status: "accepted" };
          }
          return p;
        });
        const currentSelfStatus = (!data?.studentId || prev.currentStudent.id === data.studentId) ? "accepted" : prev.currentStudent.status;
        return {
          ...prev,
          currentStudent: { ...prev.currentStudent, status: currentSelfStatus },
          participants: updated,
        };
      });
    });

    socket.on("student_kicked", (payload: { reason?: string }) => {
      clearSessionHint();
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          currentStudent: {
            ...prev.currentStudent,
            status: "kicked",
            kickReason: payload?.reason || "Dikeluarkan oleh pengawas ujian",
          },
        };
      });
      setTimeout(() => {
        sessionStorage.setItem("exam_already_submitted", "true");
        router.replace("/");
      }, 3000);
    });

    socket.on("connect_error", () => {
      setConnectionStatus("reconnecting");
    });

    return () => {
      socket.disconnect();
    };
  }, [router]);

  // Filter peserta berdasarkan pencarian nama atau NISN
  const filteredParticipants = useMemo(() => {
    if (!data?.participants) return [];
    if (!searchQuery.trim()) return data.participants;
    const q = searchQuery.toLowerCase();
    return data.participants.filter(
      (p) => p.name.toLowerCase().includes(q) || p.nisn.toLowerCase().includes(q)
    );
  }, [data?.participants, searchQuery]);

  const connConfig = {
    connected: { dot: "#22C55E", text: "Terhubung ke server", color: "#16A34A" },
    reconnecting: { dot: "#F59E0B", text: "Menghubungkan ulang...", color: "#D97706" },
    offline: { dot: "#EF4444", text: "Koneksi terputus", color: "#DC2626" },
  }[connectionStatus];

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100dvh",
          background: T.bgPage,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "var(--font-family, 'Poppins', sans-serif)",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: "48px",
              height: "48px",
              border: `3px solid ${T.border}`,
              borderTopColor: T.primary,
              borderRadius: "50%",
              margin: "0 auto 16px",
              animation: "spin 1s linear infinite",
            }}
          />
          <div style={{ fontSize: "15px", fontWeight: 600, color: T.textPrimary }}>
            Memasuki Ruang Tunggu...
          </div>
          <div style={{ fontSize: "13px", color: T.textSecondary, marginTop: "4px" }}>
            Menghubungkan ke ruang ujian
          </div>
        </div>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div
        style={{
          minHeight: "100dvh",
          background: T.bgPage,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          fontFamily: "var(--font-family, 'Poppins', sans-serif)",
        }}
      >
        <div
          style={{
            background: T.bgCard,
            border: `1px solid ${T.border}`,
            borderRadius: T.radiusCard,
            padding: "36px 32px",
            maxWidth: "420px",
            width: "100%",
            textAlign: "center",
            boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
          }}
        >
          <div style={{ fontSize: "40px", marginBottom: "16px" }}>⚠️</div>
          <h2 style={{ fontSize: "18px", fontWeight: 700, color: T.textPrimary, marginBottom: "8px" }}>
            Sesi Tidak Ditemukan
          </h2>
          <p style={{ fontSize: "13px", color: T.textSecondary, lineHeight: 1.6, marginBottom: "24px" }}>
            {error}
          </p>
          <button
            onClick={() => router.replace("/")}
            style={{
              width: "100%",
              height: "42px",
              background: T.primary,
              color: "#FFFFFF",
              border: "none",
              borderRadius: "8px",
              fontWeight: 600,
              fontSize: "14px",
              cursor: "pointer",
            }}
          >
            ← Kembali ke Masukkan Kode
          </button>
        </div>
      </div>
    );
  }

  const currentStudent = data?.currentStudent;
  const exam = data?.exam;
  const isKicked = currentStudent?.status === "kicked";

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: T.bgPage,
        padding: "24px 16px 48px",
        fontFamily: "var(--font-family, 'Poppins', sans-serif)",
      }}
    >
      {/* Starting transition overlay */}
      {isStarting && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(255, 255, 255, 0.94)",
            backdropFilter: "blur(6px)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "52px", marginBottom: "16px", animation: "bounce 1s infinite" }}>🚀</div>
          <h2 style={{ fontSize: "24px", fontWeight: 800, color: T.primary, margin: "0 0 8px 0" }}>
            Ujian Telah Dimulai!
          </h2>
          <p style={{ fontSize: "14px", color: T.textSecondary, margin: "0 0 20px 0" }}>
            Pengawas telah menekan tombol Mulai Ujian. Mengalihkan ke lembar soal...
          </p>
          <div
            style={{
              width: "40px",
              height: "40px",
              border: `3px solid ${T.primaryLight}`,
              borderTopColor: T.primary,
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
            }}
          />
        </div>
      )}

      <div style={{ maxWidth: "760px", margin: "0 auto" }}>
        {/* Top Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "20px",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                background: T.primary,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#FFFFFF",
                boxShadow: "0 2px 8px rgba(27, 118, 191, 0.3)",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: "20px", fontWeight: 800, color: T.textPrimary, letterSpacing: "-0.02em" }}>
                EduQuas
              </div>
              <div style={{ fontSize: "11px", color: T.textSecondary, marginTop: "-2px" }}>
                Ruang Tunggu Ujian
              </div>
            </div>
          </div>

          {/* Connection status pill */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "7px",
              padding: "5px 12px",
              borderRadius: T.radiusPill,
              background: "#FFFFFF",
              border: `1px solid ${T.border}`,
              fontSize: "12px",
              color: connConfig.color,
              fontWeight: 500,
            }}
          >
            <span
              style={{
                width: "7px",
                height: "7px",
                borderRadius: "50%",
                background: connConfig.dot,
                display: "inline-block",
              }}
            />
            {connConfig.text}
          </div>
        </div>

        {/* Main Card */}
        <div
          style={{
            background: T.bgCard,
            borderRadius: T.radiusCard,
            border: `1px solid ${T.border}`,
            boxShadow: "0 4px 20px rgba(0, 0, 0, 0.04)",
            overflow: "hidden",
            marginBottom: "20px",
          }}
        >
          {/* Animated top stripe */}
          <div
            style={{
              height: "4px",
              background: isKicked
                ? "linear-gradient(90deg, #EF4444, #F87171, #DC2626)"
                : "linear-gradient(90deg, #1B76BF, #0EA5E9, #38BDF8, #1B76BF)",
              backgroundSize: "200% 100%",
              animation: "stripe 2.5s linear infinite",
            }}
          />

          {/* Exam Summary Banner */}
          <div
            style={{
              padding: "24px 28px",
              borderBottom: `1px solid ${T.border}`,
              background: "linear-gradient(180deg, #FFFFFF 0%, #FAFBFD 100%)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: "240px" }}>
                <span
                  style={{
                    display: "inline-block",
                    fontSize: "11px",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    color: T.primary,
                    background: T.primaryLight,
                    padding: "3px 8px",
                    borderRadius: "6px",
                    marginBottom: "8px",
                  }}
                >
                  Lobby Ujian
                </span>
                <h1 style={{ fontSize: "22px", fontWeight: 700, color: T.textPrimary, margin: "0 0 6px 0", lineHeight: 1.3 }}>
                  {exam?.title || "Ujian Terjadwal"}
                </h1>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: T.textSecondary }}>
                  <span>Kode Akses:</span>
                  <span
                    style={{
                      fontFamily: T.fontMono,
                      fontWeight: 700,
                      background: "#F1F5F9",
                      padding: "2px 8px",
                      borderRadius: "6px",
                      color: T.textPrimary,
                      letterSpacing: "0.06em",
                    }}
                  >
                    {exam?.accessCode || "-"}
                  </span>
                </div>
              </div>

              {/* Quick Stat Badges */}
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <div
                  style={{
                    padding: "8px 14px",
                    borderRadius: "10px",
                    background: "#F8FAFC",
                    border: `1px solid ${T.border}`,
                    textAlign: "center",
                    minWidth: "75px",
                  }}
                >
                  <div style={{ fontSize: "17px", fontWeight: 700, color: T.primary }}>
                    {exam?.questionCount ?? 0}
                  </div>
                  <div style={{ fontSize: "11px", color: T.textSecondary }}>Soal</div>
                </div>

                <div
                  style={{
                    padding: "8px 14px",
                    borderRadius: "10px",
                    background: "#F8FAFC",
                    border: `1px solid ${T.border}`,
                    textAlign: "center",
                    minWidth: "75px",
                  }}
                >
                  <div style={{ fontSize: "17px", fontWeight: 700, color: T.primary }}>
                    {exam?.durationMinutes ?? 0}
                  </div>
                  <div style={{ fontSize: "11px", color: T.textSecondary }}>Menit</div>
                </div>

                <div
                  style={{
                    padding: "8px 14px",
                    borderRadius: "10px",
                    background: "#F8FAFC",
                    border: `1px solid ${T.border}`,
                    textAlign: "center",
                    minWidth: "85px",
                  }}
                >
                  <div style={{ fontSize: "17px", fontWeight: 700, color: T.primary }}>
                    {formatWaited(secondsWaited)}
                  </div>
                  <div style={{ fontSize: "11px", color: T.textSecondary }}>Waktu Tunggu</div>
                </div>
              </div>
            </div>
          </div>

          {/* Status Message Section */}
          <div style={{ padding: "24px 28px" }}>
            {isKicked ? (
              <div
                style={{
                  background: T.dangerBg,
                  border: `1px solid ${T.danger}`,
                  borderRadius: "12px",
                  padding: "16px 20px",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "14px",
                  marginBottom: "24px",
                }}
              >
                <div style={{ fontSize: "28px", flexShrink: 0 }}>🚫</div>
                <div>
                  <h3 style={{ fontSize: "15px", fontWeight: 700, color: T.danger, margin: "0 0 4px 0" }}>
                    Dikeluarkan dari Ruang Ujian
                  </h3>
                  <p style={{ fontSize: "13px", color: T.textPrimary, margin: "0 0 4px 0" }}>
                    Alasan: <strong>{currentStudent?.kickReason || "Dikeluarkan oleh pengawas ujian"}</strong>
                  </p>
                  <p style={{ fontSize: "12px", color: T.textSecondary, margin: 0 }}>
                    Mengalihkan kembali ke halaman utama...
                  </p>
                </div>
              </div>
            ) : (
              <div
                style={{
                  background: "#F0F9FF",
                  border: "1px solid #BAE6FD",
                  borderRadius: "12px",
                  padding: "18px 20px",
                  display: "flex",
                  alignItems: "center",
                  gap: "16px",
                  marginBottom: "24px",
                }}
              >
                <div
                  style={{
                    width: "44px",
                    height: "44px",
                    borderRadius: "50%",
                    background: "#E0F2FE",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "22px",
                    flexShrink: 0,
                    animation: "pulse 2s infinite ease-in-out",
                  }}
                >
                  ⏳
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "15px", fontWeight: 700, color: "#0369A1", marginBottom: "3px" }}>
                    Menunggu Pengawas Memulai Ujian
                  </div>
                  <div style={{ fontSize: "13px", color: "#0C4A6E", lineHeight: 1.5 }}>
                    Kamu sudah berada di lobby ujian. Halaman ini akan <strong>otomatis beralih ke lembar ujian</strong> begitu pengawas menekan tombol <em>Mulai Ujian</em>.
                  </div>
                </div>
              </div>
            )}

            {/* Self Identity Highlight */}
            {currentStudent && (
              <div
                style={{
                  background: "#FAFBFD",
                  border: `1.5px solid ${T.primary}`,
                  borderRadius: "12px",
                  padding: "16px 20px",
                  marginBottom: "24px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "12px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div
                    style={{
                      width: "42px",
                      height: "42px",
                      borderRadius: "50%",
                      background: T.primary,
                      color: "#FFFFFF",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "16px",
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {(currentStudent.name || "??").substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "15px", fontWeight: 700, color: T.textPrimary }}>
                        {currentStudent.name}
                      </span>
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 700,
                          background: T.primary,
                          color: "#FFFFFF",
                          padding: "1px 7px",
                          borderRadius: "100px",
                        }}
                      >
                        Kamu
                      </span>
                    </div>
                    <div style={{ fontSize: "12px", color: T.textSecondary, marginTop: "2px" }}>
                      NISN: <span style={{ fontFamily: T.fontMono, fontWeight: 600 }}>{currentStudent.nisn}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <span
                    style={{
                      fontSize: "12px",
                      fontWeight: 600,
                      background: currentStudent.status === "accepted" ? T.successBg : T.warningBg,
                      color: currentStudent.status === "accepted" ? T.success : T.warning,
                      padding: "4px 12px",
                      borderRadius: T.radiusPill,
                    }}
                  >
                    {currentStudent.status === "accepted" ? "✅ Disetujui Pengawas" : "⏳ Siap di Lobby"}
                  </span>
                </div>
              </div>
            )}

            {/* Participants Section */}
            <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: "20px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "16px",
                  flexWrap: "wrap",
                  gap: "12px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <h2 style={{ fontSize: "16px", fontWeight: 700, color: T.textPrimary, margin: 0 }}>
                    Peserta di Ruang Tunggu
                  </h2>
                  <span
                    style={{
                      fontSize: "12px",
                      fontWeight: 700,
                      background: T.primaryLight,
                      color: T.primary,
                      padding: "2px 8px",
                      borderRadius: "100px",
                    }}
                  >
                    {data?.totalParticipants ?? 0}
                  </span>
                </div>

                {/* Search input */}
                <div style={{ position: "relative", minWidth: "200px" }}>
                  <input
                    type="text"
                    placeholder="Cari nama peserta..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                      width: "100%",
                      height: "36px",
                      padding: "0 12px 0 32px",
                      border: `1px solid ${T.border}`,
                      borderRadius: "8px",
                      fontSize: "13px",
                      outline: "none",
                      color: T.textPrimary,
                    }}
                  />
                  <span
                    style={{
                      position: "absolute",
                      left: "10px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      fontSize: "13px",
                      color: T.textMuted,
                    }}
                  >
                    🔍
                  </span>
                </div>
              </div>

              {/* Participants List */}
              <div
                style={{
                  maxHeight: "360px",
                  overflowY: "auto",
                  border: `1px solid ${T.border}`,
                  borderRadius: "10px",
                  background: "#FFFFFF",
                }}
              >
                {filteredParticipants.length === 0 ? (
                  <div style={{ padding: "36px 20px", textAlign: "center", color: T.textSecondary }}>
                    <div style={{ fontSize: "28px", marginBottom: "8px" }}>👥</div>
                    <div style={{ fontSize: "14px", fontWeight: 600, color: T.textPrimary }}>
                      {searchQuery ? "Tidak ada peserta yang cocok" : "Belum ada peserta lain"}
                    </div>
                    <div style={{ fontSize: "12px", marginTop: "4px" }}>
                      {searchQuery ? "Coba gunakan kata kunci pencarian yang lain." : "Peserta lain yang bergabung akan otomatis muncul di sini."}
                    </div>
                  </div>
                ) : (
                  filteredParticipants.map((p, idx) => {
                    const isSelf = p.isSelf || p.id === currentStudent?.id;
                    return (
                      <div
                        key={p.id || idx}
                        style={{
                          padding: "12px 16px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "12px",
                          borderBottom: idx < filteredParticipants.length - 1 ? `1px solid ${T.border}` : "none",
                          background: isSelf ? "#F0F9FF" : "white",
                          transition: "background 0.15s ease",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                          <div
                            style={{
                              width: "34px",
                              height: "34px",
                              borderRadius: "50%",
                              background: isSelf ? T.primary : "#E2E8F0",
                              color: isSelf ? "#FFFFFF" : "#475569",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontWeight: 700,
                              fontSize: "12px",
                              flexShrink: 0,
                            }}
                          >
                            {(p.name || "??").substring(0, 2).toUpperCase()}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <span
                                style={{
                                  fontSize: "13px",
                                  fontWeight: isSelf ? 700 : 600,
                                  color: T.textPrimary,
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {p.name}
                              </span>
                              {isSelf && (
                                <span
                                  style={{
                                    fontSize: "10px",
                                    fontWeight: 700,
                                    background: T.primary,
                                    color: "#FFFFFF",
                                    padding: "0 6px",
                                    borderRadius: "100px",
                                  }}
                                >
                                  Kamu
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: "11px", color: T.textSecondary, marginTop: "2px" }}>
                              NISN: <span style={{ fontFamily: T.fontMono }}>{p.nisn}</span>
                            </div>
                          </div>
                        </div>

                        <div>
                          <span
                            style={{
                              fontSize: "11px",
                              fontWeight: 600,
                              background: p.status === "accepted" ? T.successBg : T.warningBg,
                              color: p.status === "accepted" ? T.success : T.warning,
                              padding: "2px 8px",
                              borderRadius: T.radiusPill,
                            }}
                          >
                            {p.status === "accepted" ? "✅ Siap" : "⏳ Menunggu"}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Warning Note */}
        <div
          style={{
            background: "rgba(245, 158, 11, 0.08)",
            border: "1px solid rgba(245, 158, 11, 0.3)",
            borderRadius: "12px",
            padding: "14px 18px",
            display: "flex",
            alignItems: "flex-start",
            gap: "12px",
          }}
        >
          <span style={{ fontSize: "18px", flexShrink: 0 }}>💡</span>
          <div style={{ fontSize: "12px", color: "#92400E", lineHeight: 1.6 }}>
            <strong>Petunjuk:</strong> Tetap berada pada halaman ini dan jangan menutup tab browser. Saat pengawas memulai ujian, Anda akan langsung dialihkan ke lembar pengerjaan tanpa perlu memasukkan kode lagi.
          </div>
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
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.08); opacity: 0.85; }
        }
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
      `}</style>
    </div>
  );
}
