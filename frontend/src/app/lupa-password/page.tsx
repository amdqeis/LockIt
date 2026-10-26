"use client";

import { useState } from "react";
import Link from "next/link";

// Spec §8 & §7 Unified Design Tokens
const T = {
  bgPage: "#F6F8FB",
  bgCard: "#FFFFFF",
  border: "#E1E6ED",
  borderInput: "#8391A7",
  textPrimary: "#172033",
  textSecondary: "#5B6778",
  textPlaceholder: "#6B7788",
  primary: "#1B76BF",
  primaryHover: "#155E99",
  primaryActive: "#114E80",
  primaryRing: "rgba(27, 118, 191, 0.25)",
  success: "#177A4B",
  radiusCard: "8px",
  radiusControl: "8px",
  shadowCard: "0 2px 8px rgba(20, 24, 40, 0.08)",
};

export default function LupaPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    await new Promise((r) => setTimeout(r, 600));
    setLoading(false);
    setSubmitted(true);
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
              Lupa password
            </h1>

            <p
              style={{
                margin: "0 0 24px",
                fontSize: "14px",
                lineHeight: "20px",
                color: T.textSecondary,
              }}
            >
              Masukkan alamat email akun gurumu untuk menerima tautan pemulihan kata sandi.
            </p>

            {submitted ? (
              <div style={{ textAlign: "center", padding: "12px 0" }}>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    color: T.success,
                    fontSize: "14px",
                    lineHeight: "22px",
                    marginBottom: "20px",
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>Jika email terdaftar, kami kirim tautan reset.</span>
                </div>
                <div>
                  <Link
                    href="/login"
                    style={{
                      display: "inline-block",
                      color: T.primary,
                      fontSize: "14px",
                      fontWeight: 500,
                      textDecoration: "none",
                    }}
                  >
                    ← Kembali ke halaman login
                  </Link>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: "20px" }}>
                  <label
                    htmlFor="reset-email"
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
                    id="reset-email"
                    type="email"
                    required
                    placeholder="nama@kampus.ac.id"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={{
                      width: "100%",
                      height: "44px",
                      padding: "0 14px",
                      background: "#FFFFFF",
                      border: `1px solid ${T.borderInput}`,
                      borderRadius: T.radiusControl,
                      fontSize: "14px",
                      color: T.textPrimary,
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    width: "100%",
                    height: "44px",
                    borderRadius: T.radiusControl,
                    background: T.primary,
                    color: "#FFFFFF",
                    fontSize: "14px",
                    fontWeight: 500,
                    border: "none",
                    cursor: "pointer",
                    marginBottom: "20px",
                  }}
                >
                  {loading ? "Mengirim…" : "Kirim tautan reset"}
                </button>

                <div style={{ textAlign: "center" }}>
                  <Link
                    href="/login"
                    style={{
                      color: T.textSecondary,
                      fontSize: "13px",
                      textDecoration: "none",
                    }}
                  >
                    ← Kembali ke login
                  </Link>
                </div>
              </form>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
