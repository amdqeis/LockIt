"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { validateExamCode } from "@/lib/examSession";

// Spec §8 & §7 Unified Design Tokens
const T = {
  bgPage: "#F6F8FB",
  bgCard: "#FFFFFF",
  bgSubtle: "#F0F3F8",
  border: "#E1E6ED",
  borderInput: "#8391A7",
  textPrimary: "#172033",
  textSecondary: "#5B6778",
  textPlaceholder: "#6B7788",
  primary: "#1B76BF",
  primaryHover: "#155E99",
  primaryActive: "#114E80",
  primaryRing: "rgba(27, 118, 191, 0.25)",
  danger: "#C73E3E",
  dangerBg: "#FCE9E9",
  radiusControl: "8px",
  fontMono: "ui-monospace, SFMono-Regular, Menlo, monospace",
};

type ResultStatus = "idle" | "error" | "notice" | "rate_limited";

function JoinContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [code, setCode] = useState("");
  const [resultStatus, setResultStatus] = useState<ResultStatus>("idle");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [attemptCount, setAttemptCount] = useState(0);
  const [rateLimitTimer, setRateLimitTimer] = useState(0);
  const [isTeacherSignedIn, setIsTeacherSignedIn] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Check if teacher is signed in (cookie or localStorage)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const hasCookie =
        document.cookie.includes("hasTeacherSession=1") ||
        document.cookie.includes("eduquas_teacher_session=active");
      const hasLocal =
        localStorage.getItem("eduquas_teacher_session") === "active";
      if (hasCookie || hasLocal) {
        setIsTeacherSignedIn(true);
      }
    }
  }, []);

  // Handle ?code=ABC1234 query parameter pre-fill
  useEffect(() => {
    const codeParam = searchParams.get("code");
    if (codeParam) {
      const normalized = codeParam.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
      setCode(normalized);
      // Move focus to the button and remove query parameter from address bar
      setTimeout(() => {
        buttonRef.current?.focus();
      }, 50);
      window.history.replaceState(null, "", window.location.pathname);
    } else {
      // Autofocus on desktop (pointer: fine) per Spec §3.2
      if (typeof window !== "undefined" && window.matchMedia("(pointer: fine)").matches) {
        inputRef.current?.focus();
      }
    }
  }, [searchParams]);

  // Rate limit countdown tick
  useEffect(() => {
    if (rateLimitTimer <= 0) return;
    const timer = setInterval(() => {
      setRateLimitTimer((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setResultStatus("idle");
          setMessage("");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [rateLimitTimer]);

  // Input normalization (Spec §3.2: uppercase, non-alphanumeric removed immediately)
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const normalized = raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
    setCode(normalized);
    // Clear previous error on typing
    if (resultStatus !== "rate_limited") {
      setResultStatus("idle");
      setMessage("");
    }
  };

  const handleJoin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (rateLimitTimer > 0) return;

    // Normalization check
    const normalized = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");

    // Situation 1: Empty or too short (< 6 chars)
    if (!normalized || normalized.length < 6) {
      setResultStatus("error");
      setMessage("Masukkan kode ujian.");
      inputRef.current?.focus();
      return;
    }

    setLoading(true);
    setResultStatus("idle");
    setMessage("");

    // Minimum visible time 300 ms to avoid flicker per Spec §3.3
    const startTime = Date.now();

    // Check rate limit (simulated > 4 consecutive failed attempts)
    if (attemptCount >= 4) {
      const elapsed = Date.now() - startTime;
      if (elapsed < 350) await new Promise((r) => setTimeout(r, 350 - elapsed));
      setLoading(false);
      setResultStatus("rate_limited");
      setRateLimitTimer(30);
      setMessage("Terlalu banyak percobaan. Coba lagi dalam 30 detik.");
      setAttemptCount(0);
      return;
    }

    try {
      const res = await validateExamCode(normalized);
      const elapsed = Date.now() - startTime;
      if (elapsed < 300) await new Promise((r) => setTimeout(r, 300 - elapsed));
      setLoading(false);

      if (res.success && res.data?.exam) {
        if (typeof window !== "undefined") {
          sessionStorage.setItem("eduquas_exam_preview", JSON.stringify(res.data.exam));
        }
        router.push(`/join/identity?code=${encodeURIComponent(normalized)}`);
        return;
      }

      // Check backend error codes
      const errCode = res.error?.code;
      if (errCode === "EXAM_NOT_FOUND") {
        setAttemptCount((prev) => prev + 1);
        setResultStatus("error");
        setMessage("Kode tidak ditemukan. Periksa lagi kode dari pengawas.");
        inputRef.current?.select();
      } else if (errCode === "EXAM_NOT_STARTED") {
        setResultStatus("notice");
        setMessage("Ujian belum dimulai.");
      } else if (errCode === "EXAM_ENDED" || errCode === "EXAM_TIME_EXPIRED") {
        setResultStatus("notice");
        setMessage("Ujian ini sudah berakhir.");
      } else if (errCode === "TOO_MANY_REQUESTS") {
        setResultStatus("rate_limited");
        setRateLimitTimer((res.error?.details as any)?.retryAfter || 30);
        setMessage("Terlalu banyak percobaan. Coba lagi dalam beberapa saat.");
      } else {
        setAttemptCount((prev) => prev + 1);
        setResultStatus("error");
        setMessage(res.error?.message || "Kode tidak ditemukan. Periksa lagi kode dari pengawas.");
        inputRef.current?.select();
      }
    } catch {
      setLoading(false);
      setResultStatus("error");
      setMessage("Terjadi kesalahan jaringan. Coba lagi.");
    }
  };

  const isError = resultStatus === "error";
  const isNotice = resultStatus === "notice";
  const isRateLimited = resultStatus === "rate_limited";

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: T.bgPage,
        display: "flex",
        flexDirection: "column",
        fontFamily: "var(--font-family, 'Poppins', sans-serif)",
      }}
    >
      <style>{`
        .eduquas-code-input {
          width: 100%;
          height: 56px;
          padding: 0 16px;
          background: #FFFFFF;
          border: 1px solid ${isError ? T.danger : T.borderInput};
          border-radius: ${T.radiusControl};
          font-family: ${T.fontMono};
          font-size: 22px;
          line-height: 28px;
          font-weight: 600;
          letter-spacing: 0.12em;
          text-align: left;
          text-transform: uppercase;
          color: ${T.textPrimary};
          outline: none;
          transition: border-color 150ms ease, box-shadow 150ms ease;
          box-sizing: border-box;
        }
        .eduquas-code-input::placeholder {
          color: ${T.textPlaceholder};
          font-weight: 500;
          letter-spacing: 0.12em;
        }
        .eduquas-code-input:focus {
          border-color: ${isError ? T.danger : T.primary};
          box-shadow: 0 0 0 3px ${isError ? "rgba(199, 62, 62, 0.20)" : T.primaryRing};
        }
        .eduquas-code-input:read-only {
          background: ${T.bgSubtle};
          cursor: not-allowed;
        }

        .join-btn-primary {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          height: 48px;
          min-width: 140px;
          padding: 0 32px;
          border-radius: ${T.radiusControl};
          background-color: ${T.primary};
          color: #FFFFFF;
          font-size: 14px;
          font-weight: 500;
          border: none;
          cursor: pointer;
          outline: none;
          transition: background-color 150ms ease;
          text-decoration: none;
        }
        .join-btn-primary:hover:not(:disabled) {
          background-color: ${T.primaryHover};
        }
        .join-btn-primary:active:not(:disabled) {
          background-color: ${T.primaryActive};
        }
        .join-btn-primary:focus-visible {
          outline: 2px solid ${T.primary};
          outline-offset: 2px;
        }
        .join-btn-primary:disabled {
          background-color: ${T.borderInput};
          cursor: not-allowed;
          opacity: 0.7;
        }

        .teacher-switch-link {
          font-size: 14px;
          line-height: 20px;
          font-weight: 500;
          color: ${T.primary};
          text-decoration: none;
          outline: none;
        }
        .teacher-switch-link:hover {
          text-decoration: underline;
        }
        .teacher-switch-link:focus-visible {
          outline: 2px solid ${T.primary};
          outline-offset: 2px;
          border-radius: 4px;
        }

        @keyframes spinner-rotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* ============================================================
          SHARED HEADER (Spec §2: Brand top left, nothing on right, height 72px)
          ============================================================ */}
      <header
        style={{
          height: "72px",
          padding: "0 32px",
          display: "flex",
          alignItems: "center",
          flexShrink: 0,
        }}
      >
        <Link
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            textDecoration: "none",
            outline: "none",
          }}
          aria-label="EduQuas Beranda"
        >
          {/* 32px rounded square in --primary with white line-style lock (SVG, not emoji) */}
          <div
            style={{
              width: "32px",
              height: "32px",
              background: T.primary,
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <span
            style={{
              fontSize: "16px",
              fontWeight: 600,
              color: T.textPrimary,
              letterSpacing: "-0.01em",
            }}
          >
            EduQuas
          </span>
        </Link>
      </header>

      {/* ============================================================
          MAIN JOIN VIEW (Spec §3: No card, 360px wide, centered, ~45% top)
          ============================================================ */}
      <main
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 24px 64px",
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "360px",
            textAlign: "center",
          }}
        >
          {/* Heading (h1): Masukkan kode untuk bergabung */}
          <h1
            style={{
              margin: "0 0 8px",
              fontSize: "26px",
              lineHeight: "32px",
              fontWeight: 600,
              color: T.textPrimary,
              letterSpacing: "-0.01em",
            }}
          >
            Masukkan kode untuk bergabung
          </h1>

          {/* Help text: Kode diberikan oleh pengawas ujian. */}
          <p
            style={{
              margin: "0 0 32px",
              fontSize: "14px",
              lineHeight: "20px",
              color: T.textSecondary,
            }}
          >
            Kode diberikan oleh pengawas ujian.
          </p>

          {/* Form */}
          <form onSubmit={handleJoin} noValidate>
            {/* Code Input */}
            <div style={{ marginBottom: "8px", position: "relative" }}>
              <input
                ref={inputRef}
                type="text"
                inputMode="text"
                autoCapitalize="characters"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="go"
                aria-label="Kode ujian"
                aria-describedby="code-feedback-message"
                aria-invalid={isError}
                placeholder="ABC1234"
                value={code}
                onChange={handleInputChange}
                readOnly={loading}
                className="eduquas-code-input"
              />
            </div>

            {/* Reserved message area (min-height 24px per Spec §3.4: nothing jumps) */}
            <div
              id="code-feedback-message"
              aria-live="polite"
              style={{
                minHeight: "24px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "24px",
              }}
            >
              {(isError || isRateLimited) && (
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    fontSize: "13px",
                    lineHeight: "18px",
                    color: T.danger,
                    textAlign: "center",
                  }}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                    style={{ flexShrink: 0 }}
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span>
                    {isRateLimited
                      ? `Terlalu banyak percobaan. Coba lagi dalam ${rateLimitTimer} detik.`
                      : message}
                  </span>
                </div>
              )}

              {isNotice && (
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    fontSize: "13px",
                    lineHeight: "18px",
                    color: T.textSecondary,
                    background: T.bgSubtle,
                    padding: "4px 10px",
                    borderRadius: "6px",
                    textAlign: "center",
                  }}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                    style={{ flexShrink: 0 }}
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                  <span>{message}</span>
                </div>
              )}
            </div>

            {/* Submit Button: Gabung (Spec §3.3: never disabled while empty) */}
            <div style={{ marginBottom: "40px" }}>
              <button
                ref={buttonRef}
                type="submit"
                disabled={loading || rateLimitTimer > 0}
                className="join-btn-primary"
              >
                {loading ? (
                  <>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      style={{ animation: "spinner-rotate 0.8s linear infinite" }}
                      aria-hidden="true"
                    >
                      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                    </svg>
                    <span>Memeriksa…</span>
                  </>
                ) : (
                  <span>Gabung</span>
                )}
              </button>
            </div>
          </form>

          {/* Teacher link: 40 px under button (Spec §3.6) */}
          <div>
            {isTeacherSignedIn ? (
              <Link href="/dashboard" className="teacher-switch-link">
                Buka dashboard
              </Link>
            ) : (
              <Link href="/login" className="teacher-switch-link">
                Login sebagai guru?
              </Link>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: "100dvh", background: T.bgPage, display: "flex", alignItems: "center", justifyContent: "center" }}>
          Memuat…
        </div>
      }
    >
      <JoinContent />
    </Suspense>
  );
}
