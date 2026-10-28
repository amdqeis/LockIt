"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useTeacherAuth } from "@/contexts/AuthContext";

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
  dangerBorder: "#FCA5A5",
  warningText: "#9A5B00",
  radiusCard: "8px",
  radiusControl: "8px",
  shadowCard: "0 2px 8px rgba(20, 24, 40, 0.08)",
};

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, isAuthenticated } = useTeacherAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [capsLockActive, setCapsLockActive] = useState(false);

  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [alertError, setAlertError] = useState("");
  const [loading, setLoading] = useState(false);

  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  // If already signed in, redirect to /dashboard per Spec §4.5
  useEffect(() => {
    if (isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [isAuthenticated, router]);

  // Validate email format
  const validateEmailFormat = (val: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());
  };

  const handleEmailBlur = () => {
    const trimmed = email.trim();
    if (!trimmed) {
      setEmailError("Masukkan email yang valid.");
    } else if (!validateEmailFormat(trimmed)) {
      setEmailError("Masukkan email yang valid.");
    } else {
      setEmailError("");
    }
  };

  const handlePasswordBlur = () => {
    if (!password) {
      setPasswordError("Masukkan password.");
    } else {
      setPasswordError("");
    }
  };

  // Detect Caps Lock state per Spec §4.3
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.getModifierState) {
      setCapsLockActive(e.getModifierState("CapsLock"));
    }
  };

  const handleKeyUp = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.getModifierState) {
      setCapsLockActive(e.getModifierState("CapsLock"));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAlertError("");

    // Trim and lowercase email per Spec §4.3
    const cleanEmail = email.trim().toLowerCase();

    let hasFieldErrors = false;
    if (!cleanEmail || !validateEmailFormat(cleanEmail)) {
      setEmailError("Masukkan email yang valid.");
      hasFieldErrors = true;
    } else {
      setEmailError("");
    }

    if (!password) {
      setPasswordError("Masukkan password.");
      hasFieldErrors = true;
    } else {
      setPasswordError("");
    }

    if (hasFieldErrors) {
      if (!cleanEmail || !validateEmailFormat(cleanEmail)) {
        emailRef.current?.focus();
      } else {
        passwordRef.current?.focus();
      }
      return;
    }

    setLoading(true);
    // Automatic re-hide password on submit per Spec §4.3
    setShowPassword(false);

    // Minimum visible time 300 ms per Spec §4.3
    const startTime = Date.now();

    // Call real backend authentication via useTeacherAuth
    const res = await login(cleanEmail, password);
    const elapsed = Date.now() - startTime;
    if (elapsed < 300) {
      await new Promise((r) => setTimeout(r, 300 - elapsed));
    }

    setLoading(false);

    if (!res.success) {
      setAlertError(res.error || "Email atau password salah.");
      // Email stays filled, password is cleared, focus goes to password field per Spec §4.4
      setPassword("");
      passwordRef.current?.focus();
      return;
    }

    // Redirect to 'next' query param if same-origin relative path per Spec §4.5
    const nextParam = searchParams.get("next");
    if (nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//")) {
      router.push(nextParam);
    } else {
      router.push("/dashboard");
    }
  };

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
        .login-input {
          width: 100%;
          height: 44px;
          padding: 0 14px;
          background: #FFFFFF;
          border: 1px solid ${T.borderInput};
          border-radius: ${T.radiusControl};
          font-size: 14px;
          color: ${T.textPrimary};
          outline: none;
          transition: border-color 150ms ease, box-shadow 150ms ease;
          box-sizing: border-box;
        }
        .login-input::placeholder {
          color: ${T.textPlaceholder};
        }
        .login-input:focus {
          border-color: ${T.primary};
          box-shadow: 0 0 0 3px ${T.primaryRing};
        }
        .login-input.has-error {
          border-color: ${T.danger} !important;
        }
        .login-input.has-error:focus {
          box-shadow: 0 0 0 3px rgba(199, 62, 62, 0.20) !important;
        }
        .login-input:read-only {
          background: ${T.bgSubtle};
          cursor: not-allowed;
        }

        .login-btn-primary {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          height: 44px;
          border-radius: ${T.radiusControl};
          background-color: ${T.primary};
          color: #FFFFFF;
          font-size: 14px;
          font-weight: 500;
          border: none;
          cursor: pointer;
          outline: none;
          transition: background-color 150ms ease;
        }
        .login-btn-primary:hover:not(:disabled) {
          background-color: ${T.primaryHover};
        }
        .login-btn-primary:active:not(:disabled) {
          background-color: ${T.primaryActive};
        }
        .login-btn-primary:focus-visible {
          outline: 2px solid ${T.primary};
          outline-offset: 2px;
        }
        .login-btn-primary:disabled {
          background-color: ${T.borderInput};
          cursor: not-allowed;
          opacity: 0.7;
        }

        .password-toggle-btn {
          position: absolute;
          right: 0;
          top: 0;
          width: 44px;
          height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: transparent;
          border: none;
          cursor: pointer;
          color: ${T.textSecondary};
          border-radius: 0 ${T.radiusControl} ${T.radiusControl} 0;
          outline: none;
          transition: color 150ms ease;
        }
        .password-toggle-btn:hover {
          color: ${T.textPrimary};
        }
        .password-toggle-btn:focus-visible {
          outline: 2px solid ${T.primary};
          outline-offset: -2px;
        }

        .login-link {
          color: ${T.primary};
          font-weight: 500;
          text-decoration: none;
          outline: none;
        }
        .login-link:hover {
          text-decoration: underline;
        }
        .login-link:focus-visible {
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
          SHARED HEADER (Spec §2: Brand top left, nothing on right)
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
          aria-label="LockIt Beranda"
        >
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
            LockIt
          </span>
        </Link>
      </header>

      {/* ============================================================
          MAIN LOGIN VIEW (Spec §4: 400px wide card, centered, ~45% top)
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
        <div style={{ width: "100%", maxWidth: "400px" }}>
          {/* Card Container (Spec §4.2: max width 400px, 1px border, 8px radius, soft shadow, 32px padding) */}
          <div
            style={{
              background: T.bgCard,
              border: `1px solid ${T.border}`,
              borderRadius: T.radiusCard,
              boxShadow: T.shadowCard,
              padding: "32px",
              width: "100%",
              boxSizing: "border-box",
            }}
          >
            {/* Title (h1): Masuk sebagai guru */}
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
              Masuk sebagai guru
            </h1>

            {/* Subtitle */}
            <p
              style={{
                margin: "0 0 24px",
                fontSize: "14px",
                lineHeight: "20px",
                color: T.textSecondary,
              }}
            >
              Gunakan akun guru untuk membuat dan mengawasi ujian.
            </p>

            {/* Form */}
            <form onSubmit={handleSubmit} noValidate>
              {/* Error Alert Slot (Spec §4.3: Reserved only when needed, inline alert, danger bg, role="alert") */}
              {alertError && (
                <div
                  role="alert"
                  style={{
                    background: T.dangerBg,
                    border: `1px solid ${T.dangerBorder}`,
                    borderRadius: T.radiusControl,
                    padding: "12px 16px",
                    marginBottom: "20px",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    color: T.danger,
                    fontSize: "13px",
                    lineHeight: "18px",
                  }}
                >
                  <svg
                    width="16"
                    height="16"
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
                  <span>{alertError}</span>
                </div>
              )}

              {/* Email Field */}
              <div style={{ marginBottom: "20px" }}>
                <label
                  htmlFor="teacher-email-input"
                  style={{
                    display: "block",
                    fontSize: "13px",
                    lineHeight: "20px",
                    fontWeight: 500,
                    color: T.textPrimary,
                    marginBottom: "6px",
                  }}
                >
                  Email
                </label>
                <input
                  ref={emailRef}
                  id="teacher-email-input"
                  type="email"
                  inputMode="email"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder="nama@kampus.ac.id"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (emailError) setEmailError("");
                  }}
                  onBlur={handleEmailBlur}
                  readOnly={loading}
                  aria-invalid={Boolean(emailError)}
                  aria-describedby={emailError ? "email-error-message" : undefined}
                  className={`login-input ${emailError ? "has-error" : ""}`}
                />
                {emailError && (
                  <div
                    id="email-error-message"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      marginTop: "6px",
                      fontSize: "13px",
                      lineHeight: "18px",
                      color: T.danger,
                    }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <span>{emailError}</span>
                  </div>
                )}
              </div>

              {/* Password Field */}
              <div style={{ marginBottom: "20px" }}>
                {/* Label Row: Password on left, Lupa password? on right */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "6px",
                  }}
                >
                  <label
                    htmlFor="teacher-password-input"
                    style={{
                      fontSize: "13px",
                      lineHeight: "20px",
                      fontWeight: 500,
                      color: T.textPrimary,
                    }}
                  >
                    Password
                  </label>
                  <Link href="/lupa-password" className="login-link" style={{ fontSize: "13px" }}>
                    Lupa password?
                  </Link>
                </div>

                <div style={{ position: "relative" }}>
                  <input
                    ref={passwordRef}
                    id="teacher-password-input"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (passwordError) setPasswordError("");
                    }}
                    onBlur={handlePasswordBlur}
                    onKeyDown={handleKeyDown}
                    onKeyUp={handleKeyUp}
                    readOnly={loading}
                    aria-invalid={Boolean(passwordError)}
                    aria-describedby={passwordError ? "password-error-message" : undefined}
                    className={`login-input ${passwordError ? "has-error" : ""}`}
                    style={{ paddingRight: "46px" }}
                  />
                  {/* Password Toggle: 44x44px button (Spec §4.1 problem 5) */}
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                    aria-pressed={showPassword}
                    className="password-toggle-btn"
                  >
                    {showPassword ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>

                {/* Caps Lock warning indicator */}
                {capsLockActive && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      marginTop: "6px",
                      fontSize: "12px",
                      lineHeight: "16px",
                      color: T.warningText,
                    }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                      <line x1="12" y1="9" x2="12" y2="13" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                    <span>Caps Lock sedang aktif.</span>
                  </div>
                )}

                {passwordError && (
                  <div
                    id="password-error-message"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      marginTop: "6px",
                      fontSize: "13px",
                      lineHeight: "18px",
                      color: T.danger,
                    }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <span>{passwordError}</span>
                  </div>
                )}
              </div>

              {/* Remember Me Checkbox (Spec §4.3 proposed) */}
              <div style={{ marginBottom: "24px" }}>
                <label
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    cursor: "pointer",
                    fontSize: "13px",
                    lineHeight: "20px",
                    color: T.textSecondary,
                    userSelect: "none",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    style={{
                      width: "16px",
                      height: "16px",
                      accentColor: T.primary,
                      borderRadius: "4px",
                      cursor: "pointer",
                    }}
                  />
                  <span>Tetap masuk di perangkat ini</span>
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="login-btn-primary"
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
                    <span>Masuk…</span>
                  </>
                ) : (
                  <span>Masuk</span>
                )}
              </button>
            </form>

            {/* Footer Link (inside card, 24 px under button): Belum punya akun? Buat akun */}
            <div
              style={{
                marginTop: "24px",
                textAlign: "center",
                fontSize: "14px",
                lineHeight: "20px",
                color: T.textSecondary,
              }}
            >
              Belum punya akun?{" "}
              <Link href="/daftar" className="login-link">
                Buat akun
              </Link>
            </div>
          </div>

          {/* Student Link (outside card, 24 px under card): Peserta ujian? Masukkan kode */}
          <div
            style={{
              marginTop: "24px",
              textAlign: "center",
              fontSize: "14px",
              lineHeight: "20px",
              color: T.textSecondary,
            }}
          >
            Peserta ujian?{" "}
            <Link href="/" className="login-link">
              Masukkan kode
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: "100dvh", background: T.bgPage, display: "flex", alignItems: "center", justifyContent: "center" }}>
          Memuat…
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
