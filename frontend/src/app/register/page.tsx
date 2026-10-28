"use client";

import Link from "next/link";

// Design tokens — konsisten dengan halaman auth lain
const T = {
  bgPage: "#F6F8FB",
  bgCard: "#FFFFFF",
  border: "#E1E6ED",
  textPrimary: "#172033",
  textSecondary: "#5B6778",
  primary: "#1B76BF",
  primaryTint: "#E6F1FA",
  warning: "#9A5B00",
  warningBg: "#FFF8EC",
  warningBorder: "#F0C87A",
  radiusCard: "12px",
  radiusControl: "8px",
  shadowCard: "0 2px 8px rgba(20,24,40,0.08)",
};

export default function RegisterPage() {
  return (
    <div
      style={{
        minHeight: "100dvh",
        background: T.bgPage,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        fontFamily: "var(--font-family, 'Poppins', sans-serif)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "440px",
          background: T.bgCard,
          border: `1px solid ${T.border}`,
          borderRadius: T.radiusCard,
          boxShadow: T.shadowCard,
          padding: "40px 36px 36px",
          textAlign: "center",
        }}
      >
        {/* Logo */}
        <div style={{ marginBottom: "28px" }}>
          <Link
            href="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "10px",
              textDecoration: "none",
            }}
          >
            <div
              style={{
                width: "36px",
                height: "36px",
                background: T.primary,
                borderRadius: "10px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <svg
                width="20"
                height="20"
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
                fontSize: "20px",
                fontWeight: 700,
                color: T.textPrimary,
                letterSpacing: "-0.01em",
              }}
            >
              EduQuas
            </span>
          </Link>
        </div>

        {/* Shield icon */}
        <div
          style={{
            width: "56px",
            height: "56px",
            background: T.warningBg,
            border: `1px solid ${T.warningBorder}`,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 20px",
          }}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke={T.warning}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        </div>

        <h1
          style={{
            fontSize: "20px",
            fontWeight: 700,
            color: T.textPrimary,
            margin: "0 0 8px",
          }}
        >
          Pendaftaran Ditutup
        </h1>
        <p
          style={{
            fontSize: "14px",
            color: T.textSecondary,
            lineHeight: "22px",
            margin: "0 0 24px",
          }}
        >
          Akun guru di EduQuas hanya dapat dibuat oleh{" "}
          <strong>Administrator</strong>.
          <br />
          Pendaftaran mandiri tidak diizinkan.
        </p>

        {/* Info box */}
        <div
          style={{
            background: T.primaryTint,
            border: `1px solid #C0D9F0`,
            borderRadius: T.radiusControl,
            padding: "14px 16px",
            marginBottom: "28px",
            textAlign: "left",
          }}
        >
          <p
            style={{
              fontSize: "13px",
              color: "#154F80",
              lineHeight: "20px",
              margin: 0,
            }}
          >
            💡 Hubungi Administrator institusi Anda untuk mendapatkan akun. Admin
            akan membuat akun dan mengirimkan informasi login kepada Anda.
          </p>
        </div>

        <Link
          href="/login"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            height: "42px",
            padding: "0 28px",
            background: T.primary,
            color: "#FFFFFF",
            borderRadius: T.radiusControl,
            textDecoration: "none",
            fontSize: "14px",
            fontWeight: 500,
          }}
        >
          Masuk ke akun saya
        </Link>
      </div>
    </div>
  );
}
