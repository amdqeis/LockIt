"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));

  const validate = () => {
    const err: Record<string, string> = {};
    if (!form.name) err.name = "Nama wajib diisi";
    else if (form.name.length < 3) err.name = "Nama minimal 3 karakter";
    if (!form.email) err.email = "Email wajib diisi";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) err.email = "Format email tidak valid";
    if (!form.password) err.password = "Password wajib diisi";
    else if (form.password.length < 8) err.password = "Password minimal 8 karakter";
    if (!form.confirm) err.confirm = "Konfirmasi password wajib diisi";
    else if (form.confirm !== form.password) err.confirm = "Password tidak cocok";
    return err;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = validate();
    if (Object.keys(v).length > 0) { setErrors(v); return; }
    setErrors({});
    setLoading(true);
    await new Promise(r => setTimeout(r, 1500));
    setLoading(false);
    router.push("/login");
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", marginBottom: "8px" }}>
            <div className="logo-icon">🔒</div>
            <span style={{ fontSize: "26px", fontWeight: 800 }}>LockIt</span>
          </div>
          <h1 style={{ fontSize: "22px", fontWeight: 700, color: "var(--color-neutral-900)", marginBottom: "4px" }}>Buat Akun Guru</h1>
          <p style={{ fontSize: "14px", color: "var(--color-neutral-500)" }}>Isi data di bawah untuk mulai menggunakan LockIt</p>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
            {/* Nama */}
            <div className="form-group">
              <label className="form-label">Nama Lengkap <span className="required">*</span></label>
              <input className={`form-input${errors.name ? " error" : ""}`} type="text" placeholder="Ahmad Fauzi, S.T." value={form.name} onChange={set("name")} />
              {errors.name && <span className="form-error">⚠️ {errors.name}</span>}
            </div>

            {/* Email */}
            <div className="form-group">
              <label className="form-label">Email <span className="required">*</span></label>
              <input className={`form-input${errors.email ? " error" : ""}`} type="email" placeholder="ahmad@kampus.ac.id" value={form.email} onChange={set("email")} />
              {errors.email && <span className="form-error">⚠️ {errors.email}</span>}
            </div>

            {/* Password */}
            <div className="form-group">
              <label className="form-label">Password <span className="required">*</span></label>
              <div className="input-wrapper">
                <input className={`form-input${errors.password ? " error" : ""}`} type={showPwd ? "text" : "password"} placeholder="Min. 8 karakter" value={form.password} onChange={set("password")} />
                <button type="button" className="input-toggle-btn" onClick={() => setShowPwd(s => !s)}>
                  {showPwd ? "🙈" : "👁"}
                </button>
              </div>
              {errors.password && <span className="form-error">⚠️ {errors.password}</span>}
            </div>

            {/* Confirm Password */}
            <div className="form-group">
              <label className="form-label">Konfirmasi Password <span className="required">*</span></label>
              <div className="input-wrapper">
                <input className={`form-input${errors.confirm ? " error" : ""}`} type={showConfirm ? "text" : "password"} placeholder="Ulangi password" value={form.confirm} onChange={set("confirm")} />
                <button type="button" className="input-toggle-btn" onClick={() => setShowConfirm(s => !s)}>
                  {showConfirm ? "🙈" : "👁"}
                </button>
              </div>
              {errors.confirm && <span className="form-error">⚠️ {errors.confirm}</span>}
            </div>

            <button type="submit" className="btn btn-primary btn-lg btn-full" disabled={loading}>
              {loading ? <><span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⟳</span> Mendaftar...</> : "Daftar Sekarang"}
            </button>
          </div>
        </form>

        <p style={{ textAlign: "center", marginTop: "24px", fontSize: "14px", color: "var(--color-neutral-500)" }}>
          Sudah punya akun?{" "}
          <Link href="/login" style={{ fontWeight: 600, color: "var(--color-primary)" }}>Masuk</Link>
        </p>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
