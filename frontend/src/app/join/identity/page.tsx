"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { joinExam } from "@/lib/examSession";

// Spec §7 Unified Design Tokens
const T = {
  bgPage: "#F6F8FB",
  bgCard: "#FFFFFF",
  border: "#E1E6ED",
  borderInput: "#8391A7",
  textPrimary: "#172033",
  textSecondary: "#5B6778",
  primary: "#1B76BF",
  primaryHover: "#155E99",
  danger: "#C73E3E",
  dangerBg: "#FCE9E9",
  radiusCard: "8px",
  radiusControl: "8px",
};

interface ExamPreview {
  title: string;
  durationMinutes: number;
  questionCount?: number;
}

function IdentityFormInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const codeParam = searchParams ? searchParams.get("code") || "" : "";

  const [code, setCode] = useState(codeParam);
  const [examPreview, setExamPreview] = useState<ExamPreview>({
    title: "Ujian Terjadwal",
    durationMinutes: 90,
  });

  const [form, setForm] = useState({ name: "", nisn: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (codeParam) {
      setCode(codeParam.toUpperCase().trim());
    }
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem("eduquas_exam_preview");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setExamPreview({
            title: parsed.title || "Ujian Terjadwal",
            durationMinutes: parsed.durationMinutes || 90,
            questionCount: parsed.questionCount,
          });
        } catch {
          // ignore parse error
        }
      }
    }
  }, [codeParam]);

  const validate = () => {
    const err: Record<string, string> = {};
    if (!form.name || form.name.trim().length < 2) {
      err.name = "Nama lengkap wajib diisi (minimal 2 karakter)";
    }
    const cleanNisn = form.nisn.trim();
    if (!cleanNisn) {
      err.nisn = "NISN wajib diisi";
    } else if (!/^\d{10}$/.test(cleanNisn)) {
      err.nisn = "NISN harus tepat 10 digit angka";
    }
    return err;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    const v = validate();
    if (Object.keys(v).length > 0) {
      setErrors(v);
      return;
    }
    setErrors({});

    const activeCode = code.trim().toUpperCase();
    if (!activeCode) {
      setServerError("Kode akses tidak valid. Silakan kembali ke halaman awal.");
      return;
    }

    setLoading(true);
    try {
      const res = await joinExam(activeCode, form.name.trim(), form.nisn.trim());

      if (res.success && res.data) {
        if (typeof window !== "undefined") {
          sessionStorage.setItem("eduquas_student_session", JSON.stringify(res.data));
        }
        router.push("/exam/session");
        return;
      }

      // Handle specific API error codes
      const errCode = res.error?.code;
      if (errCode === "ALREADY_SUBMITTED") {
        setServerError("NISN ini telah menyelesaikan dan mengumpulkan ujian.");
      } else if (errCode === "EXAM_NOT_ACTIVE" || errCode === "EXAM_ENDED" || errCode === "EXAM_TIME_EXPIRED") {
        setServerError("Ujian ini sudah berakhir atau tidak sedang aktif.");
      } else if (errCode === "TOO_MANY_REQUESTS") {
        setServerError("Terlalu banyak percobaan join yang gagal. Coba lagi dalam beberapa menit.");
      } else if (errCode === "EXAM_NOT_FOUND") {
        setServerError("Ujian tidak ditemukan. Periksa kembali kode akses.");
      } else {
        setServerError(res.error?.message || "Gagal bergabung ke ujian. Periksa kembali data Anda.");
      }
    } catch {
      // Fallback for demo/offline test
      if (typeof window !== "undefined") {
        const fallbackData = JSON.stringify({
          student: { name: form.name.trim(), nisn: form.nisn.trim(), id: "demo-student" },
          exam: { title: examPreview.title, durationMinutes: examPreview.durationMinutes },
        });
        sessionStorage.setItem("eduquas_student_session", fallbackData);
      }
      router.push("/exam/session");
    } finally {
      setLoading(false);
    }
  };

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
      <div style={{ width: "100%", maxWidth: "440px" }}>
        {/* Header / Logo */}
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={T.primary} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <span style={{ fontSize: "22px", fontWeight: 700, color: T.textPrimary }}>EduQuas</span>
          </div>
        </div>

        {/* Exam Info Card */}
        <div
          style={{
            background: T.primary,
            borderRadius: T.radiusCard,
            padding: "20px 24px",
            marginBottom: "20px",
            color: "#FFFFFF",
            boxShadow: "0 4px 12px rgba(27, 118, 191, 0.25)",
          }}
        >
          <div style={{ fontSize: "12px", opacity: 0.85, marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Kamu akan mengikuti:
          </div>
          <div style={{ fontSize: "18px", fontWeight: 700, marginBottom: "8px" }}>{examPreview.title}</div>
          <div style={{ display: "flex", gap: "16px", fontSize: "13px", opacity: 0.9 }}>
            <span>⏱ {examPreview.durationMinutes} menit</span>
            {code && <span>🔑 Kode: {code}</span>}
          </div>
        </div>

        {/* Form Card */}
        <div
          style={{
            background: T.bgCard,
            border: `1px solid ${T.border}`,
            borderRadius: T.radiusCard,
            padding: "32px 28px",
            boxShadow: "0 2px 8px rgba(20, 24, 40, 0.08)",
          }}
        >
          <h1 style={{ fontSize: "20px", fontWeight: 700, textAlign: "center", marginBottom: "6px", color: T.textPrimary }}>
            Identitas Peserta
          </h1>
          <p style={{ textAlign: "center", color: T.textSecondary, marginBottom: "24px", fontSize: "13px" }}>
            Masukkan data diri dan NISN (10 digit angka) untuk verifikasi
          </p>

          {serverError && (
            <div
              role="alert"
              style={{
                background: T.dangerBg,
                border: `1px solid ${T.danger}`,
                color: T.danger,
                borderRadius: T.radiusControl,
                padding: "10px 14px",
                fontSize: "13px",
                marginBottom: "20px",
              }}
            >
              ⚠️ {serverError}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div style={{ marginBottom: "18px" }}>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: T.textPrimary, marginBottom: "6px" }}>
                Nama Lengkap <span style={{ color: T.danger }}>*</span>
              </label>
              <input
                type="text"
                placeholder="Contoh: Ahmad Fauzi"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                autoComplete="name"
                style={{
                  width: "100%",
                  height: "44px",
                  padding: "0 14px",
                  border: `1px solid ${errors.name ? T.danger : T.borderInput}`,
                  borderRadius: T.radiusControl,
                  fontSize: "14px",
                  color: T.textPrimary,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
              {errors.name && (
                <span style={{ display: "block", fontSize: "12px", color: T.danger, marginTop: "4px" }}>
                  ⚠️ {errors.name}
                </span>
              )}
            </div>

            <div style={{ marginBottom: "24px" }}>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: T.textPrimary, marginBottom: "6px" }}>
                NISN (10 Digit Angka) <span style={{ color: T.danger }}>*</span>
              </label>
              <input
                type="text"
                placeholder="0012345678"
                maxLength={10}
                value={form.nisn}
                onChange={(e) => {
                  const cleaned = e.target.value.replace(/[^0-9]/g, "").slice(0, 10);
                  setForm((f) => ({ ...f, nisn: cleaned }));
                }}
                autoComplete="off"
                style={{
                  width: "100%",
                  height: "44px",
                  padding: "0 14px",
                  border: `1px solid ${errors.nisn ? T.danger : T.borderInput}`,
                  borderRadius: T.radiusControl,
                  fontSize: "16px",
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  letterSpacing: "0.08em",
                  color: T.textPrimary,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
              {errors.nisn && (
                <span style={{ display: "block", fontSize: "12px", color: T.danger, marginTop: "4px" }}>
                  ⚠️ {errors.nisn}
                </span>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                height: "44px",
                background: T.primary,
                color: "#FFFFFF",
                border: "none",
                borderRadius: T.radiusControl,
                fontSize: "14px",
                fontWeight: 600,
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.7 : 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                outline: "none",
                transition: "background-color 150ms ease",
              }}
            >
              {loading ? "Memverifikasi..." : "Mulai Ujian →"}
            </button>
          </form>
        </div>

        <div style={{ textAlign: "center", marginTop: "18px" }}>
          <button
            type="button"
            onClick={() => router.push("/")}
            style={{
              background: "transparent",
              border: "none",
              color: T.textSecondary,
              fontSize: "13px",
              cursor: "pointer",
              textDecoration: "underline",
              outline: "none",
            }}
          >
            ← Kembali ke halaman masukkan kode
          </button>
        </div>
      </div>
    </div>
  );
}

export default function IdentityPage() {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span>Memuat formulir...</span>
        </div>
      }
    >
      <IdentityFormInner />
    </Suspense>
  );
}
