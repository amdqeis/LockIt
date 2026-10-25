"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const newErrors: { email?: string; password?: string } = {};
    if (!email) newErrors.email = "Email wajib diisi";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) newErrors.email = "Format email tidak valid";
    if (!password) newErrors.password = "Password wajib diisi";
    return newErrors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = validate();
    if (Object.keys(v).length > 0) { setErrors(v); return; }
    setErrors({});
    setLoading(true);
    // Simulate API call
    await new Promise(r => setTimeout(r, 1200));
    setLoading(false);
    router.push("/dashboard");
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", marginBottom: "12px" }}>
            <div className="logo-icon">🔒</div>
            <span style={{ fontSize: "26px", fontWeight: 800, color: "var(--color-neutral-900)" }}>LockIt</span>
          </div>
          <p style={{ fontSize: "14px", color: "var(--color-neutral-500)" }}>Platform Ujian Online dengan Proctoring</p>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {/* Email */}
            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                className={`form-input${errors.email ? " error" : ""}`}
                type="email"
                placeholder="email@kampus.ac.id"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
              />
              {errors.email && <span className="form-error">⚠️ {errors.email}</span>}
            </div>

            {/* Password */}
            <div className="form-group">
              <label className="form-label">Password</label>
              <div className="input-wrapper">
                <input
                  className={`form-input${errors.password ? " error" : ""}`}
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
                <button type="button" className="input-toggle-btn" onClick={() => setShowPassword(s => !s)} tabIndex={-1}>
                  {showPassword ? "🙈" : "👁"}
                </button>
              </div>
              {errors.password && <span className="form-error">⚠️ {errors.password}</span>}
            </div>

            {/* Submit */}
            <button
              type="submit"
              className="btn btn-primary btn-lg btn-full"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⟳</span>
                  Masuk...
                </>
              ) : "Masuk"}
            </button>
          </div>
        </form>

        <p style={{ textAlign: "center", marginTop: "24px", fontSize: "14px", color: "var(--color-neutral-500)" }}>
          Belum punya akun?{" "}
          <Link href="/register" style={{ fontWeight: 600, color: "var(--color-primary)" }}>
            Daftar di sini
          </Link>
        </p>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
