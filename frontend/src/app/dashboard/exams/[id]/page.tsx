"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/apiClient";
import DashboardShell from "@/app/components/DashboardShell";
import { SkeletonBase, MotionFade } from "@/app/components/skeleton";
import { getStoredQuestionBanks, getStoredQuestions, QuestionBank } from "@/lib/questionBank";
import { io } from "socket.io-client";
import { useTeacherAuth } from "@/contexts/AuthContext";

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
  const { accessToken } = useTeacherAuth();
  const [exam, setExam] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [confirmType, setConfirmType] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: string; msg: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // Bank soal & preview state
  const [allBanks, setAllBanks] = useState<QuestionBank[]>([]);
  const [selectedBankToAttach, setSelectedBankToAttach] = useState<string>("");
  const [attaching, setAttaching] = useState(false);
  const [previewQuestions, setPreviewQuestions] = useState<any[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Ruang Tunggu (Waiting Room) state
  const [students, setStudents] = useState<any[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [kickModalStudent, setKickModalStudent] = useState<any | null>(null);
  const [kickReasonInput, setKickReasonInput] = useState("Bukan murid kelas ini");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    setAllBanks(getStoredQuestionBanks());
  }, []);

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
          bankId: beExam.settings?.bank_id || null,
          bankTitle: beExam.settings?.bank_title || null,
          shuffleQuestions: beExam.settings?.randomize_questions ?? true,
          shuffleChoices: beExam.settings?.randomize_choices ?? true,
          questionMode: beExam.settings?.display_mode === "one_by_one" ? "one-by-one" : "all-at-once",
          createdAt: new Date(beExam.createdAt).toLocaleDateString("id-ID", {
            day: "numeric",
            month: "short",
            year: "numeric",
          }),
          violationPolicy: {
            maxViolations: beExam.violationPolicy?.max_violations || 3,
            action: beExam.violationPolicy?.action === "lock" ? "auto-lock" : "warning",
            detectRightClick: beExam.violationPolicy?.detect_right_click ?? false,
            detectDevTools: beExam.violationPolicy?.detect_devtools ?? false,
            detectTabSwitch: beExam.violationPolicy?.detect_tab_switch ?? true,
            detectFullscreenExit: beExam.violationPolicy?.detect_fullscreen_exit ?? true,
            detectScreenshot: beExam.violationPolicy?.detect_screenshot ?? true,
            detectIpChange: beExam.violationPolicy?.detect_ip_change ?? true,
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

  const fetchStudents = useCallback(async () => {
    if (!examId) return;
    try {
      const res = await apiFetch<any>(`/api/exams/${examId}/students?pageSize=200`);
      if (res.success && Array.isArray(res.data?.students)) {
        setStudents(res.data.students);
      }
    } catch {
      // ignore
    }
  }, [examId]);

  useEffect(() => {
    fetchStudents();
    const interval = setInterval(fetchStudents, 4000);
    return () => clearInterval(interval);
  }, [fetchStudents]);

  useEffect(() => {
    if (!examId || !accessToken) return;
    const socket = io("/teacher-dashboard", {
      auth: { token: accessToken },
      transports: ["websocket", "polling"],
    });

    socket.on("connect", () => {
      socket.emit("join_exam_dashboard", { examId });
    });

    socket.on("student_joined_waiting", () => {
      fetchStudents();
    });

    socket.on("student_status_changed", () => {
      fetchStudents();
    });

    socket.on("student_presence", () => {
      fetchStudents();
    });

    socket.on("student_accepted", () => {
      fetchStudents();
    });

    socket.on("student_kicked", () => {
      fetchStudents();
    });

    return () => {
      socket.emit("leave_exam_dashboard", { examId });
      socket.disconnect();
    };
  }, [examId, accessToken, fetchStudents]);

  const handleAcceptStudent = async (sid: string) => {
    setActionLoading(sid);
    try {
      const res = await apiFetch<any>(`/api/exams/${examId}/students/${sid}/accept`, {
        method: "POST",
      });
      if (res.success) {
        showToast("success", "Siswa berhasil disetujui masuk ujian");
        fetchStudents();
      } else {
        showToast("error", res.error?.message || "Gagal menyetujui siswa");
      }
    } catch {
      showToast("error", "Terjadi kesalahan jaringan");
    } finally {
      setActionLoading(null);
    }
  };

  const handleAcceptAll = async () => {
    setActionLoading("accept-all");
    try {
      const res = await apiFetch<any>(`/api/exams/${examId}/students/accept-all`, {
        method: "POST",
      });
      if (res.success) {
        showToast("success", `Berhasil menyetujui ${res.data?.acceptedCount ?? "semua"} siswa`);
        fetchStudents();
      } else {
        showToast("error", res.error?.message || "Gagal menyetujui semua siswa");
      }
    } catch {
      showToast("error", "Terjadi kesalahan jaringan");
    } finally {
      setActionLoading(null);
    }
  };

  const handleStartStudent = async (sid: string) => {
    setActionLoading(sid);
    try {
      const res = await apiFetch<any>(`/api/exams/${examId}/students/${sid}/start`, {
        method: "POST",
      });
      if (res.success) {
        showToast("success", res.data?.message || "Siswa berhasil dimulai ujiannya");
        fetchExamDetail();
        fetchStudents();
      } else {
        showToast("error", res.error?.message || "Gagal memulai ujian peserta");
      }
    } catch {
      showToast("error", "Terjadi kesalahan jaringan");
    } finally {
      setActionLoading(null);
    }
  };

  const handleKickStudent = async () => {
    if (!kickModalStudent) return;
    const sid = kickModalStudent.id;
    setActionLoading(sid);
    try {
      const res = await apiFetch<any>(`/api/exams/${examId}/students/${sid}/kick`, {
        method: "POST",
        body: JSON.stringify({ reason: kickReasonInput || "Bukan murid kelas ini" }),
      });
      if (res.success) {
        showToast("success", `Siswa ${kickModalStudent.name} dikeluarkan`);
        setKickModalStudent(null);
        fetchStudents();
      } else {
        showToast("error", res.error?.message || "Gagal mengeluarkan siswa");
      }
    } catch {
      showToast("error", "Terjadi kesalahan jaringan");
    } finally {
      setActionLoading(null);
    }
  };

  const handleCopy = () => {
    if (!exam) return;
    navigator.clipboard.writeText(exam.accessCode).catch(() => {});
    setCopied(true);
    showToast("success", "✅ Kode disalin ke clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenPreview = async () => {
    setConfirmType("preview");
    setLoadingPreview(true);
    try {
      const res = await apiFetch<any>(`/api/exams/${exam.id}/questions`);
      if (res.success && res.data?.questions) {
        setPreviewQuestions(res.data.questions);
      } else {
        setPreviewQuestions([]);
      }
    } catch {
      setPreviewQuestions([]);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleAttachBank = async () => {
    if (!selectedBankToAttach) {
      showToast("error", "Pilih bank soal terlebih dahulu");
      return;
    }
    setAttaching(true);
    try {
      const qs = getStoredQuestions(selectedBankToAttach);
      const chosenBank = allBanks.find(b => b.id === selectedBankToAttach);
      const res = await apiFetch<any>(`/api/exams/${exam.id}`, {
        method: "PUT",
        body: JSON.stringify({
          settings: {
            bank_id: selectedBankToAttach,
            bank_title: chosenBank?.title || undefined,
          },
          questions: qs,
        }),
      });
      if (res.success) {
        showToast("success", `✅ Berhasil mengaitkan ${qs.length} butir soal ke ujian!`);
        setConfirmType(null);
        fetchExamDetail();
      } else {
        showToast("error", res.error?.message || "Gagal mengaitkan bank soal");
      }
    } catch {
      showToast("error", "Terjadi kesalahan jaringan");
    } finally {
      setAttaching(false);
    }
  };

  const handleModalConfirm = async () => {
    if (!confirmType || !exam) return;
    const type = confirmType;

    try {
      if (type === "start") {
        // If 0 questions in DB, try auto-attaching from linked bankId or prompt attach modal
        if (exam.questionCount === 0) {
          if (exam.bankId) {
            const qs = getStoredQuestions(exam.bankId);
            if (qs.length > 0) {
              const res = await apiFetch<any>(`/api/exams/${exam.id}/status`, {
                method: "PUT",
                body: JSON.stringify({ status: "active", questions: qs, bankId: exam.bankId }),
              });
              if (res.success) {
                setConfirmType(null);
                showToast("success", "Soal berhasil disinkronkan & ujian dimulai!");
                fetchExamDetail();
                return;
              }
            }
          }
          // No linked bank or empty questions -> open attach modal
          setSelectedBankToAttach(exam.bankId || allBanks[0]?.id || "");
          setConfirmType("attach-bank");
          showToast("error", "Ujian belum memiliki soal. Silakan pilih Bank Soal untuk dikaitkan.");
          return;
        }

        setConfirmType(null);
        let res = await apiFetch<any>(`/api/exams/${exam.id}/start`, {
          method: "POST",
        });
        if (!res.success) {
          res = await apiFetch<any>(`/api/exams/${exam.id}/status`, {
            method: "PUT",
            body: JSON.stringify({ status: "active" }),
          });
        }
        if (res.success) {
          showToast("success", "Ujian berhasil dimulai! Semua peserta yang diterima kini dapat mengerjakan.");
          fetchExamDetail();
          fetchStudents();
        } else {
          showToast("error", res.error?.message || "Gagal memulai ujian (pastikan ujian memiliki soal)");
        }
      } else if (type === "end") {
        setConfirmType(null);
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
        setConfirmType(null);
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
        setConfirmType(null);
        const res = await apiFetch<any>(`/api/exams/${exam.id}/regenerate-code`, {
          method: "POST",
        });
        if (res.success && res.data?.accessCode) {
          setExam((prev: any) => ({ ...prev, accessCode: res.data.accessCode }));
          showToast("success", "Kode akses berhasil diperbarui!");
        } else {
          showToast("error", res.error?.message || "Gagal memperbarui kode akses");
        }
      } else if (type === "duplicate") {
        setConfirmType(null);
        const res = await apiFetch<any>(`/api/exams/${exam.id}/duplicate`, {
          method: "POST",
        });
        if (res.success && res.data?.exam?.id) {
          showToast("success", `Ujian berhasil diduplikasi sebagai "${res.data.exam.title}"!`);
          setTimeout(() => {
            router.push(`/dashboard/exams/${res.data.exam.id}`);
          }, 1000);
        } else {
          showToast("error", res.error?.message || "Gagal menduplikasi ujian");
        }
      }
    } catch {
      showToast("error", "Terjadi kesalahan jaringan.");
    }
  };

  if (!exam) {
    if (loading) {
      return (
        <DashboardShell>
          <ExamDetailSkeleton />
        </DashboardShell>
      );
    }
    return (
      <DashboardShell>
        <div style={{ padding: "64px 32px", textAlign: "center", color: "#6B7280" }}>
          <div style={{ fontSize: "16px", fontWeight: 600, marginBottom: "8px" }}>Ujian tidak ditemukan</div>
          <Link href="/dashboard/exams" style={{ color: "#1B76BF", textDecoration: "underline", fontSize: "14px" }}>
            Kembali ke daftar ujian
          </Link>
        </div>
      </DashboardShell>
    );
  }

  const sc = STATUS_COLORS[exam.status as ExamStatus] || STATUS_COLORS.draft;

  const waitingCount = students.filter(s => s.status === "waiting").length;
  const acceptedCount = students.filter(s => s.status === "accepted").length;
  const activeCount = students.filter(s => s.status === "active").length;
  const kickedCount = students.filter(s => s.status === "kicked").length;

  const actionButtons: Record<ExamStatus, React.ReactNode> = {
    draft: (
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
        <button className="btn btn-primary btn-md" onClick={() => setConfirmType("start")}>
          🚀 Mulai Ujian
        </button>
        <Link href={`/dashboard/exams/${exam.id}/edit`} className="btn btn-secondary btn-md">
          ✏️ Edit Ujian
        </Link>
        <button className="btn btn-secondary btn-md" onClick={() => setConfirmType("duplicate")}>
          📋 Duplikat
        </button>
        {exam.questionCount === 0 && (
          <button
            className="btn btn-secondary btn-md"
            onClick={() => {
              setSelectedBankToAttach(exam.bankId || allBanks[0]?.id || "");
              setConfirmType("attach-bank");
            }}
          >
            ⚡ Kaitkan Bank Soal
          </button>
        )}
        <button className="btn btn-ghost btn-md" onClick={handleOpenPreview}>
          👁 Preview Soal
        </button>
        <button className="btn btn-danger btn-md" onClick={() => setConfirmType("delete")}>
          🗑️ Hapus
        </button>
      </div>
    ),
    active: (
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
        {(waitingCount > 0 || acceptedCount > 0) && (
          <button
            className="btn btn-primary btn-md"
            onClick={() => setConfirmType("start")}
            style={{ background: "#16A34A", boxShadow: "0 2px 6px rgba(22, 163, 74, 0.3)" }}
          >
            🚀 Mulai Ujian untuk Peserta Baru ({waitingCount + acceptedCount})
          </button>
        )}
        <Link href={`/dashboard/exams/${exam.id}/monitor`} className="btn btn-primary btn-md">
          📊 Monitor Live
        </Link>
        <button className="btn btn-secondary btn-md" onClick={() => setConfirmType("duplicate")}>
          📋 Duplikat
        </button>
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
        <button className="btn btn-secondary btn-md" onClick={() => setConfirmType("duplicate")}>
          📋 Duplikat
        </button>
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
        <button className="btn btn-secondary btn-md" onClick={() => setConfirmType("duplicate")}>
          📋 Duplikat
        </button>
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
        {/* Warning Banner if exam has 0 questions */}
        {exam.status === "draft" && exam.questionCount === 0 && (
          <div style={{
            background: "#FFFBEB", border: "1px solid #FCD34D", borderRadius: "12px",
            padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between",
            gap: "16px", marginBottom: "20px"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span style={{ fontSize: "24px" }}>⚠️</span>
              <div>
                <div style={{ fontWeight: 600, color: "#92400E", fontSize: "14px" }}>
                  Ujian Belum Memiliki Butir Soal
                </div>
                <div style={{ color: "#B45309", fontSize: "13px" }}>
                  {exam.bankTitle
                    ? `Bank soal terdaftar: "${exam.bankTitle}". Butir soal belum tersimpan ke database ujian ini.`
                    : "Ujian ini belum memiliki butir soal. Silakan kaitkan Bank Soal agar ujian dapat dimulai."}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
              <button
                onClick={() => {
                  setSelectedBankToAttach(exam.bankId || allBanks[0]?.id || "");
                  setConfirmType("attach-bank");
                }}
                style={{
                  background: "#D97706", color: "white", border: "none", borderRadius: "8px",
                  padding: "8px 16px", fontWeight: 600, fontSize: "13px", cursor: "pointer", whiteSpace: "nowrap"
                }}
              >
                ⚡ Kaitkan Bank Soal
              </button>
              <Link
                href={`/dashboard/exams/${exam.id}/edit`}
                style={{
                  background: "white", color: "#92400E", border: "1px solid #FCD34D", borderRadius: "8px",
                  padding: "8px 16px", fontWeight: 600, fontSize: "13px", textDecoration: "none", display: "inline-flex", alignItems: "center"
                }}
              >
                ✏️ Edit Ujian
              </Link>
            </div>
          </div>
        )}

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
                    {
                      label: "JUMLAH SOAL",
                      value: `${exam.questionCount} soal${exam.bankTitle ? ` · ${exam.bankTitle}` : ""}`,
                      icon: "📝",
                    },
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
                    {exam.violationPolicy.detectRightClick && <span style={{ background: "#FEF9C3", color: "#78350F", padding: "3px 10px", borderRadius: "100px", fontSize: "12px" }}>Klik Kanan ✓</span>}
                    {exam.violationPolicy.detectDevTools && <span style={{ background: "#FEF9C3", color: "#78350F", padding: "3px 10px", borderRadius: "100px", fontSize: "12px" }}>DevTools ✓</span>}
                    {exam.violationPolicy.detectTabSwitch && <span style={{ background: "#FEF9C3", color: "#78350F", padding: "3px 10px", borderRadius: "100px", fontSize: "12px" }}>Pindah Tab ✓</span>}
                    {exam.violationPolicy.detectFullscreenExit && <span style={{ background: "#FEF9C3", color: "#78350F", padding: "3px 10px", borderRadius: "100px", fontSize: "12px" }}>Layar Penuh ✓</span>}
                    {exam.violationPolicy.detectScreenshot && <span style={{ background: "#FEE2E2", color: "#991B1B", padding: "3px 10px", borderRadius: "100px", fontSize: "12px", fontWeight: 600 }}>Screenshot ✓</span>}
                    {exam.violationPolicy.detectIpChange && <span style={{ background: "#FEF9C3", color: "#78350F", padding: "3px 10px", borderRadius: "100px", fontSize: "12px" }}>Ganti IP ✓</span>}
                  </div>
                </div>
              </div>
            </div>

            {/* Actions Card */}
            <div style={{ background: "white", borderRadius: "16px", border: "1px solid #E9ECF0", padding: "20px 24px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
              <div style={{ fontSize: "13px", fontWeight: 600, color: "#9CA3AF", marginBottom: "16px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Aksi Ujian</div>
              {actionButtons[exam.status as ExamStatus]}
            </div>

            {/* Ruang Tunggu Peserta (Waiting Room) */}
            <div style={{ background: "white", borderRadius: "16px", border: "1px solid #E9ECF0", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
              <div style={{
                padding: "20px 24px",
                borderBottom: "1px solid #F1F5F9",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "12px",
                background: "#FAFBFD"
              }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#111827", margin: 0 }}>
                      🚪 Ruang Tunggu Peserta (Waiting Room)
                    </h2>
                    <span style={{ fontSize: "12px", background: "#EFF6FF", color: "#1D4ED8", padding: "2px 8px", borderRadius: "100px", fontWeight: 600 }}>
                      {students.length} Total
                    </span>
                  </div>
                  <div style={{ color: "#6B7280", fontSize: "13px", marginTop: "4px" }}>
                    Peserta menunggu persetujuan guru sebelum ujian dimulai. Anda dapat menerima satu per satu atau sekaligus.
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <button
                    onClick={() => fetchStudents()}
                    style={{
                      background: "white", border: "1px solid #D1D5DB", color: "#374151",
                      padding: "6px 12px", borderRadius: "8px", fontSize: "12px", fontWeight: 500,
                      cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px"
                    }}
                  >
                    🔄 Refresh
                  </button>
                  {waitingCount > 0 && (
                    <button
                      onClick={handleAcceptAll}
                      disabled={actionLoading === "accept-all"}
                      style={{
                        background: "#16A34A", color: "white", border: "none",
                        padding: "7px 14px", borderRadius: "8px", fontSize: "12px", fontWeight: 600,
                        cursor: actionLoading === "accept-all" ? "wait" : "pointer",
                        display: "inline-flex", alignItems: "center", gap: "6px",
                        boxShadow: "0 1px 3px rgba(22, 163, 74, 0.25)"
                      }}
                    >
                      {actionLoading === "accept-all" ? "Memproses..." : `✅ Terima Semua (${waitingCount})`}
                    </button>
                  )}
                  {(exam.status === "draft" || waitingCount > 0 || acceptedCount > 0) && (
                    <button
                      onClick={() => setConfirmType("start")}
                      style={{
                        background: "#16A34A", color: "white", border: "none",
                        padding: "7px 18px", borderRadius: "8px", fontSize: "13px", fontWeight: 700,
                        cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px",
                        boxShadow: "0 2px 8px rgba(22, 163, 74, 0.35)"
                      }}
                    >
                      🚀 Mulai Ujian Sekarang ({acceptedCount > 0 ? `${acceptedCount} Siswa Siap` : `${students.filter(s => s.status !== "kicked").length} Peserta`})
                    </button>
                  )}
                </div>
              </div>

              {/* Status Counters */}
              <div style={{
                display: "flex", gap: "10px", padding: "12px 24px",
                borderBottom: "1px solid #F1F5F9", background: "white", flexWrap: "wrap", fontSize: "12px"
              }}>
                <span style={{ color: "#B45309", fontWeight: 600, background: "#FFFBEB", padding: "4px 10px", borderRadius: "6px", border: "1px solid #FDE68A" }}>
                  ⏳ Menunggu: {waitingCount}
                </span>
                <span style={{ color: "#15803D", fontWeight: 600, background: "#F0FDF4", padding: "4px 10px", borderRadius: "6px", border: "1px solid #BBF7D0" }}>
                  ✅ Diterima: {acceptedCount}
                </span>
                {kickedCount > 0 && (
                  <span style={{ color: "#B91C1C", fontWeight: 600, background: "#FEF2F2", padding: "4px 10px", borderRadius: "6px", border: "1px solid #FECACA" }}>
                    🚫 Dikeluarkan: {kickedCount}
                  </span>
                )}
              </div>

              {/* Action Banner saat ada siswa yang sudah diterima di lobby */}
              {acceptedCount > 0 && (
                <div style={{
                  padding: "14px 24px",
                  background: "#F0FDF4",
                  borderBottom: "1px solid #BBF7D0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "12px",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontSize: "22px" }}>🎉</span>
                    <div>
                      <div style={{ fontSize: "13px", fontWeight: 700, color: "#166534" }}>
                        Ada {acceptedCount} siswa yang telah diterima di lobby dan siap mengerjakan!
                      </div>
                      <div style={{ fontSize: "12px", color: "#15803D", marginTop: "2px" }}>
                        Klik tombol di sebelah kanan untuk memperbolehkan mereka serentak mulai mengerjakan soal.
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setConfirmType("start")}
                    style={{
                      background: "#16A34A",
                      color: "white",
                      border: "none",
                      padding: "8px 20px",
                      borderRadius: "8px",
                      fontSize: "13px",
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      boxShadow: "0 2px 8px rgba(22, 163, 74, 0.35)",
                    }}
                  >
                    🚀 Mulai Ujian untuk {acceptedCount} Siswa
                  </button>
                </div>
              )}

              {/* List of Students */}
              <div style={{ maxHeight: "400px", overflowY: "auto" }}>
                {students.length === 0 ? (
                  <div style={{ padding: "36px 24px", textAlign: "center", color: "#6B7280" }}>
                    <div style={{ fontSize: "32px", marginBottom: "8px" }}>👥</div>
                    <div style={{ fontWeight: 600, color: "#111827", fontSize: "14px" }}>Belum Ada Siswa di Ruang Tunggu</div>
                    <div style={{ fontSize: "13px", color: "#9CA3AF", marginTop: "4px" }}>
                      Siswa akan muncul di sini secara real-time setelah memasukkan kode akses <strong>{exam.accessCode}</strong>.
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    {students.map((s: any, idx: number) => {
                      const isWaiting = s.status === "waiting";
                      const isAccepted = s.status === "accepted";
                      const isKicked = s.status === "kicked";
                      const isActive = s.status === "active";
                      const isSubmitted = s.status === "submitted";

                      return (
                        <div
                          key={s.id || idx}
                          style={{
                            padding: "14px 20px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: "12px",
                            borderBottom: idx < students.length - 1 ? "1px solid #F3F4F6" : "none",
                            background: isWaiting ? "#FFFDF5" : isKicked ? "#FFF5F5" : "white",
                            transition: "background 0.15s ease"
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
                            <div style={{
                              width: "36px", height: "36px", borderRadius: "50%",
                              background: isKicked ? "#FEE2E2" : isAccepted || isActive ? "#DCFCE7" : "#FEF3C7",
                              color: isKicked ? "#DC2626" : isAccepted || isActive ? "#16A34A" : "#D97706",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontWeight: 700, fontSize: "13px", flexShrink: 0
                            }}>
                              {(s.name || "??").substring(0, 2).toUpperCase()}
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                                <span style={{ fontWeight: 600, fontSize: "14px", color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {s.name}
                                </span>
                                {s.ipAddress && (
                                  <span style={{ fontSize: "11px", color: "#6B7280", background: "#F3F4F6", padding: "1px 6px", borderRadius: "4px" }}>
                                    🌐 {s.ipAddress}
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: "12px", color: "#6B7280", marginTop: "2px" }}>
                                NISN: <span style={{ fontFamily: "monospace", color: "#374151" }}>{s.nisn}</span>
                                {s.kickReason && (
                                  <span style={{ color: "#DC2626", marginLeft: "8px" }}>
                                    (Alasan: {s.kickReason})
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                            {/* Status Tag */}
                            {isWaiting && (
                              <span style={{ fontSize: "11px", fontWeight: 600, background: "#FEF3C7", color: "#92400E", padding: "3px 8px", borderRadius: "6px" }}>
                                ⏳ Menunggu
                              </span>
                            )}
                            {isAccepted && (
                              <span style={{ fontSize: "11px", fontWeight: 600, background: "#DCFCE7", color: "#166534", padding: "3px 8px", borderRadius: "6px" }}>
                                ✅ Diterima
                              </span>
                            )}
                            {isActive && (
                              <span style={{ fontSize: "11px", fontWeight: 600, background: "#DCFCE7", color: "#166534", padding: "3px 8px", borderRadius: "6px" }}>
                                🟢 Mengerjakan
                              </span>
                            )}
                            {isSubmitted && (
                              <span style={{ fontSize: "11px", fontWeight: 600, background: "#E0F2FE", color: "#0369A1", padding: "3px 8px", borderRadius: "6px" }}>
                                🏁 Selesai
                              </span>
                            )}
                            {isKicked && (
                              <span style={{ fontSize: "11px", fontWeight: 600, background: "#FEE2E2", color: "#991B1B", padding: "3px 8px", borderRadius: "6px" }}>
                                🚫 Dikeluarkan
                              </span>
                            )}

                            {/* Action Buttons */}
                            {isWaiting && (
                              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                <button
                                  onClick={() => handleAcceptStudent(s.id)}
                                  disabled={actionLoading === s.id}
                                  style={{
                                    background: "#16A34A", color: "white", border: "none",
                                    padding: "5px 12px", borderRadius: "6px", fontSize: "12px", fontWeight: 600,
                                    cursor: actionLoading === s.id ? "wait" : "pointer"
                                  }}
                                >
                                  {actionLoading === s.id ? "..." : "Terima"}
                                </button>
                                <button
                                  onClick={() => handleStartStudent(s.id)}
                                  disabled={actionLoading === s.id}
                                  style={{
                                    background: "#1B76BF", color: "white", border: "none",
                                    padding: "5px 12px", borderRadius: "6px", fontSize: "12px", fontWeight: 700,
                                    cursor: actionLoading === s.id ? "wait" : "pointer",
                                    display: "inline-flex", alignItems: "center", gap: "4px",
                                    boxShadow: "0 1px 3px rgba(27, 118, 191, 0.25)"
                                  }}
                                >
                                  {actionLoading === s.id ? "..." : "🚀 Mulai"}
                                </button>
                                <button
                                  onClick={() => {
                                    setKickModalStudent(s);
                                    setKickReasonInput("Bukan murid kelas ini");
                                  }}
                                  disabled={actionLoading === s.id}
                                  style={{
                                    background: "white", color: "#DC2626", border: "1px solid #FECACA",
                                    padding: "5px 10px", borderRadius: "6px", fontSize: "12px", fontWeight: 500,
                                    cursor: "pointer"
                                  }}
                                >
                                  Keluarkan
                                </button>
                              </div>
                            )}

                            {isAccepted && (
                              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                <button
                                  onClick={() => handleStartStudent(s.id)}
                                  disabled={actionLoading === s.id}
                                  style={{
                                    background: "#16A34A", color: "white", border: "none",
                                    padding: "6px 14px", borderRadius: "6px", fontSize: "12px", fontWeight: 700,
                                    cursor: actionLoading === s.id ? "wait" : "pointer",
                                    display: "inline-flex", alignItems: "center", gap: "4px",
                                    boxShadow: "0 1px 3px rgba(22, 163, 74, 0.25)"
                                  }}
                                >
                                  {actionLoading === s.id ? "..." : "🚀 Mulai Ujian"}
                                </button>
                                <button
                                  onClick={() => {
                                    setKickModalStudent(s);
                                    setKickReasonInput("Bukan murid kelas ini");
                                  }}
                                  disabled={actionLoading === s.id}
                                  style={{
                                    background: "white", color: "#DC2626", border: "1px solid #FECACA",
                                    padding: "5px 10px", borderRadius: "6px", fontSize: "12px", fontWeight: 500,
                                    cursor: "pointer"
                                  }}
                                >
                                  Keluarkan
                                </button>
                              </div>
                            )}

                            {isKicked && (
                              <button
                                onClick={() => handleAcceptStudent(s.id)}
                                disabled={actionLoading === s.id}
                                style={{
                                  background: "#F0FDF4", color: "#16A34A", border: "1px solid #BBF7D0",
                                  padding: "5px 10px", borderRadius: "6px", fontSize: "12px", fontWeight: 500,
                                  cursor: "pointer"
                                }}
                              >
                                Terima Kembali
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
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
                  { label: "Acak Urutan Soal", value: exam.shuffleQuestions ? "✅ Aktif" : "❌ Nonaktif" },
                  { label: "Acak Pilihan Jawaban", value: exam.shuffleChoices ? "✅ Aktif" : "❌ Nonaktif" },
                  { label: "Bank Soal", value: exam.bankTitle || (exam.bankId ? "Terkait" : "Belum dipilih") },
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

      {/* Confirm & Action Modals */}
      {confirmType && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000,
          display: "flex", alignItems: "center", justifyContent: "center", padding: "24px"
        }} onClick={() => setConfirmType(null)}>
          <div style={{
            background: "white", borderRadius: "16px", maxWidth: confirmType === "preview" ? "680px" : "480px", width: "100%",
            boxShadow: "0 20px 60px rgba(0,0,0,0.2)", maxHeight: "85vh", display: "flex", flexDirection: "column"
          }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "17px", fontWeight: 700, color: "#111827" }}>
                {confirmType === "start" ? "Mulai Ujian?" :
                 confirmType === "end" ? "Akhiri Ujian?" :
                 confirmType === "delete" ? "Hapus Ujian?" :
                 confirmType === "regen" ? "Generate Ulang Kode?" :
                 confirmType === "attach-bank" ? "Kaitkan Bank Soal ke Ujian" :
                 confirmType === "duplicate" ? "Duplikat Ujian?" :
                 "Preview Soal Ujian"}
              </span>
              <button onClick={() => setConfirmType(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", fontSize: "18px" }}>✕</button>
            </div>

            <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1 }}>
              {confirmType === "start" && (
                <p style={{ color: "#6B7280", lineHeight: 1.7, fontSize: "15px" }}>
                  Ujian akan dimulai. Peserta yang sudah menunggu di waiting room akan langsung bisa mengerjakan. Pastikan seluruh peserta dan jadwal sudah siap.
                </p>
              )}

              {confirmType === "end" && (
                <p style={{ color: "#6B7280", lineHeight: 1.7, fontSize: "15px" }}>
                  Ujian akan diakhiri. Semua peserta yang belum submit akan di-auto-submit dan jawaban dinilai. Tindakan ini tidak bisa dibatalkan.
                </p>
              )}

              {confirmType === "delete" && (
                <p style={{ color: "#6B7280", lineHeight: 1.7, fontSize: "15px" }}>
                  Ujian akan dihapus secara permanen dan tidak bisa dipulihkan.
                </p>
              )}

              {confirmType === "regen" && (
                <p style={{ color: "#6B7280", lineHeight: 1.7, fontSize: "15px" }}>
                  Kode lama akan tidak valid. Peserta yang belum join perlu menggunakan kode baru. Lanjutkan?
                </p>
              )}

              {confirmType === "duplicate" && (
                <p style={{ color: "#6B7280", lineHeight: 1.7, fontSize: "15px" }}>
                  Salinan baru dari ujian <strong>&ldquo;{exam.title}&rdquo;</strong> beserta seluruh butir soalnya akan dibuat berstatus draft dengan kode akses baru. Lanjutkan?
                </p>
              )}

              {confirmType === "attach-bank" && (
                <div>
                  <p style={{ color: "#4B5563", fontSize: "14px", marginBottom: "16px", lineHeight: 1.6 }}>
                    Pilih bank soal dari daftar untuk disinkronkan langsung ke database ujian ini:
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "280px", overflowY: "auto", paddingRight: "4px" }}>
                    {allBanks.filter(b => b.status === "active").map((b) => {
                      const isSel = selectedBankToAttach === b.id;
                      return (
                        <div
                          key={b.id}
                          onClick={() => setSelectedBankToAttach(b.id)}
                          style={{
                            border: `2px solid ${isSel ? "#2563EB" : "#E5E7EB"}`,
                            background: isSel ? "#EFF6FF" : "#F9FAFB",
                            borderRadius: "10px", padding: "12px 14px", cursor: "pointer",
                            transition: "all 0.15s ease", display: "flex", justifyContent: "space-between", alignItems: "center"
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 600, color: "#111827", fontSize: "14px" }}>{b.title}</div>
                            <div style={{ fontSize: "12px", color: "#6B7280", marginTop: "2px" }}>
                              {b.questionCount} butir soal · {b.totalPoints} poin · {b.subject}
                            </div>
                          </div>
                          <div style={{
                            width: "20px", height: "20px", borderRadius: "50%",
                            border: `2px solid ${isSel ? "#2563EB" : "#D1D5DB"}`,
                            background: isSel ? "#2563EB" : "white",
                            display: "flex", alignItems: "center", justifyContent: "center"
                          }}>
                            {isSel && <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "white" }} />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {confirmType === "preview" && (
                <div>
                  {loadingPreview ? (
                    <div style={{ textAlign: "center", padding: "32px", color: "#6B7280" }}>
                      Memuat preview butir soal...
                    </div>
                  ) : previewQuestions.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "32px" }}>
                      <div style={{ fontSize: "36px", marginBottom: "8px" }}>📭</div>
                      <div style={{ fontWeight: 600, color: "#111827", marginBottom: "4px" }}>Belum Ada Butir Soal</div>
                      <div style={{ fontSize: "13px", color: "#6B7280", marginBottom: "16px" }}>
                        Ujian ini belum memiliki soal di database. Silakan kaitkan Bank Soal terlebih dahulu.
                      </div>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => {
                          setSelectedBankToAttach(exam.bankId || allBanks[0]?.id || "");
                          setConfirmType("attach-bank");
                        }}
                      >
                        ⚡ Kaitkan Bank Soal Sekarang
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                      <div style={{ fontSize: "13px", color: "#6B7280", fontWeight: 500 }}>
                        Total: {previewQuestions.length} butir soal
                      </div>
                      {previewQuestions.map((q: any, idx: number) => {
                        const opts = Array.isArray(q.options) ? q.options : [];
                        return (
                          <div key={q.id || idx} style={{
                            background: "#F9FAFB", borderRadius: "10px", padding: "14px 16px",
                            border: "1px solid #E5E7EB"
                          }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                              <span style={{ fontWeight: 700, fontSize: "14px", color: "#111827" }}>
                                #{q.orderIndex || idx + 1}. {q.questionText}
                              </span>
                              <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                                {q.type === "short_answer" && (
                                  <span style={{ fontSize: "11px", background: "#CCFBF1", color: "#0F766E", padding: "2px 8px", borderRadius: "6px", fontWeight: 600 }}>
                                    ✍️ Jawaban Singkat
                                  </span>
                                )}
                                <span style={{ fontSize: "11px", background: "#E0F2FE", color: "#0369A1", padding: "2px 8px", borderRadius: "6px", fontWeight: 600 }}>
                                  {q.points || 10} poin
                                </span>
                              </div>
                            </div>
                            {q.type === "short_answer" ? (
                              <div style={{ marginTop: "8px", padding: "8px 12px", borderRadius: "6px", background: "#F0FDFA", border: "1px dashed #0D9488", color: "#0F766E", fontSize: "12px", fontStyle: "italic" }}>
                                ✍️ Soal Jawaban Singkat (dinilai manual oleh pengawas)
                              </div>
                            ) : (
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginTop: "10px" }}>
                                {opts.map((opt: any, oIdx: number) => {
                                  const optLabel = (opt.label || opt.id || String.fromCharCode(65 + oIdx)).toUpperCase();
                                  const isCorrect = optLabel === (q.correctAnswer || "").toUpperCase();
                                  return (
                                    <div key={optLabel} style={{
                                      fontSize: "13px", padding: "6px 10px", borderRadius: "6px",
                                      background: isCorrect ? "#DCFCE7" : "white",
                                      border: `1px solid ${isCorrect ? "#86EFAC" : "#E5E7EB"}`,
                                      color: isCorrect ? "#166534" : "#374151",
                                      fontWeight: isCorrect ? 600 : 400
                                    }}>
                                      <strong>{optLabel}.</strong> {opt.text || opt.label} {isCorrect && "✓ (Kunci)"}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div style={{ padding: "16px 24px", borderTop: "1px solid #F3F4F6", display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button onClick={() => setConfirmType(null)} className="btn btn-secondary btn-md">
                {confirmType === "preview" ? "Tutup" : "Batal"}
              </button>

              {confirmType === "attach-bank" && (
                <button
                  disabled={attaching || !selectedBankToAttach}
                  className="btn btn-primary btn-md"
                  onClick={handleAttachBank}
                >
                  {attaching ? "Menyinkronkan..." : "Kaitkan Soal Sekarang"}
                </button>
              )}

              {confirmType !== "attach-bank" && confirmType !== "preview" && (
                <button
                  className={`btn ${confirmType === "end" || confirmType === "delete" ? "btn-danger" : "btn-primary"} btn-md`}
                  onClick={handleModalConfirm}
                >
                  {confirmType === "start" ? "Mulai Sekarang" : confirmType === "end" ? "Akhiri Ujian" : confirmType === "delete" ? "Hapus Permanen" : confirmType === "duplicate" ? "Ya, Duplikat Ujian" : "Ya, Generate Ulang"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Kick Confirmation Modal */}
      {kickModalStudent && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1100,
          display: "flex", alignItems: "center", justifyContent: "center", padding: "24px"
        }} onClick={() => setKickModalStudent(null)}>
          <div style={{
            background: "white", borderRadius: "16px", maxWidth: "460px", width: "100%",
            boxShadow: "0 20px 60px rgba(0,0,0,0.2)", overflow: "hidden"
          }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "17px", fontWeight: 700, color: "#111827" }}>
                Keluarkan Siswa dari Ujian?
              </span>
              <button onClick={() => setKickModalStudent(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", fontSize: "18px" }}>✕</button>
            </div>

            <div style={{ padding: "20px 24px" }}>
              <p style={{ color: "#4B5563", fontSize: "14px", lineHeight: 1.6, marginBottom: "16px" }}>
                Anda akan mengeluarkan <strong>{kickModalStudent.name}</strong> (NISN: {kickModalStudent.nisn}) dari ruang tunggu. Siswa tidak akan dapat mengakses soal ujian ini.
              </p>

              <label style={{ fontSize: "12px", fontWeight: 600, color: "#374151", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: "8px" }}>
                Alasan Pengeluaran:
              </label>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "14px" }}>
                {[
                  "Bukan murid kelas ini",
                  "Nama / NISN tidak terdaftar",
                  "Mencoba masuk di luar jadwal",
                ].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setKickReasonInput(preset)}
                    style={{
                      textAlign: "left", padding: "8px 12px", borderRadius: "8px",
                      border: kickReasonInput === preset ? "2px solid #EF4444" : "1px solid #E5E7EB",
                      background: kickReasonInput === preset ? "#FEF2F2" : "#F9FAFB",
                      color: kickReasonInput === preset ? "#991B1B" : "#374151",
                      fontSize: "13px", cursor: "pointer", fontWeight: kickReasonInput === preset ? 600 : 400
                    }}
                  >
                    {preset}
                  </button>
                ))}
              </div>

              <input
                type="text"
                value={kickReasonInput}
                onChange={(e) => setKickReasonInput(e.target.value)}
                placeholder="Atau ketik alasan lain..."
                style={{
                  width: "100%", padding: "10px 12px", borderRadius: "8px",
                  border: "1px solid #D1D5DB", fontSize: "13px", outline: "none",
                  boxSizing: "border-box"
                }}
              />
            </div>

            <div style={{ padding: "16px 24px", borderTop: "1px solid #F3F4F6", display: "flex", justifyContent: "flex-end", gap: "10px", background: "#FAFBFD" }}>
              <button onClick={() => setKickModalStudent(null)} className="btn btn-secondary btn-md">
                Batal
              </button>
              <button
                disabled={actionLoading === kickModalStudent.id}
                className="btn btn-danger btn-md"
                onClick={handleKickStudent}
              >
                {actionLoading === kickModalStudent.id ? "Mengeluarkan..." : "Ya, Keluarkan Siswa"}
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

function ExamDetailSkeleton() {
  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "24px 32px 48px" }}>
      {/* Back button skeleton */}
      <div style={{ marginBottom: "20px" }}>
        <SkeletonBase width="140px" height="16px" borderRadius="4px" />
      </div>

      {/* Main header card skeleton */}
      <div
        style={{
          background: "var(--bg-card, #FFFFFF)",
          border: "1px solid var(--border, #E1E6ED)",
          borderRadius: "var(--radius-card, 8px)",
          padding: "24px",
          marginBottom: "24px",
          boxShadow: "var(--shadow-card, 0 2px 8px rgba(20, 24, 40, 0.08))",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
          <SkeletonBase width="80px" height="24px" borderRadius="999px" />
          <SkeletonBase width="120px" height="14px" borderRadius="4px" />
        </div>
        <SkeletonBase width="55%" height="28px" borderRadius="6px" style={{ marginBottom: "12px" }} />
        <SkeletonBase width="85%" height="16px" borderRadius="4px" style={{ marginBottom: "20px" }} />

        {/* Action buttons */}
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <SkeletonBase width="120px" height="40px" borderRadius="8px" />
          <SkeletonBase width="100px" height="40px" borderRadius="8px" />
          <SkeletonBase width="110px" height="40px" borderRadius="8px" />
        </div>
      </div>

      {/* Grid of detail sections */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "24px",
        }}
      >
        <div
          style={{
            background: "var(--bg-card, #FFFFFF)",
            border: "1px solid var(--border, #E1E6ED)",
            borderRadius: "var(--radius-card, 8px)",
            padding: "20px",
            boxShadow: "var(--shadow-card, 0 2px 8px rgba(20, 24, 40, 0.08))",
          }}
        >
          <SkeletonBase width="140px" height="18px" borderRadius="4px" style={{ marginBottom: "16px" }} />
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <SkeletonBase width="100px" height="14px" borderRadius="4px" />
              <SkeletonBase width="60px" height="14px" borderRadius="4px" />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <SkeletonBase width="110px" height="14px" borderRadius="4px" />
              <SkeletonBase width="70px" height="14px" borderRadius="4px" />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <SkeletonBase width="90px" height="14px" borderRadius="4px" />
              <SkeletonBase width="50px" height="14px" borderRadius="4px" />
            </div>
          </div>
        </div>

        <div
          style={{
            background: "var(--bg-card, #FFFFFF)",
            border: "1px solid var(--border, #E1E6ED)",
            borderRadius: "var(--radius-card, 8px)",
            padding: "20px",
            boxShadow: "var(--shadow-card, 0 2px 8px rgba(20, 24, 40, 0.08))",
          }}
        >
          <SkeletonBase width="160px" height="18px" borderRadius="4px" style={{ marginBottom: "16px" }} />
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <SkeletonBase width="120px" height="14px" borderRadius="4px" />
              <SkeletonBase width="80px" height="14px" borderRadius="4px" />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <SkeletonBase width="100px" height="14px" borderRadius="4px" />
              <SkeletonBase width="90px" height="14px" borderRadius="4px" />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <SkeletonBase width="130px" height="14px" borderRadius="4px" />
              <SkeletonBase width="60px" height="14px" borderRadius="4px" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ExamDetailPageWrapper() {
  return <Suspense><ExamDetailPage /></Suspense>;
}

