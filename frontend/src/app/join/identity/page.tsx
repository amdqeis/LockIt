"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Mock exam info (derived from valid code entered before)
const mockExamInfo = {
  title: "UTS Pemrograman Web 2026",
  duration: 90,
  questionCount: 25,
  accessCode: "WEB2026",
};

export default function IdentityPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", nim: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const err: Record<string, string> = {};
    if (!form.name || form.name.length < 3) err.name = "Nama lengkap wajib diisi (minimal 3 karakter)";
    if (!form.nim) err.nim = "NIM wajib diisi";
    else if (!/^[a-zA-Z0-9]+$/.test(form.nim)) err.nim = "NIM hanya boleh berisi huruf dan angka";
    return err;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = validate();
    if (Object.keys(v).length > 0) { setErrors(v); return; }
    setErrors({});
    setLoading(true);
    await new Promise(r => setTimeout(r, 1000));
    setLoading(false);
    router.push("/exam/waiting");
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, var(--color-primary-light) 0%, var(--color-neutral-50) 100%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px"
    }}>
      <div style={{ width: "100%", maxWidth: "440px" }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
            <div className="logo-icon">🔒</div>
            <span style={{ fontSize: "22px", fontWeight: 800 }}>LockIt</span>
          </div>
        </div>

        {/* Exam Info Card */}
        <div style={{
          background: "var(--color-primary)",
          borderRadius: "var(--radius-lg)",
          padding: "20px 24px",
          marginBottom: "20px",
          color: "white"
        }}>
          <div style={{ fontSize: "13px", opacity: 0.8, marginBottom: "4px" }}>Kamu akan mengikuti:</div>
          <div style={{ fontSize: "18px", fontWeight: 700, marginBottom: "12px" }}>{mockExamInfo.title}</div>
          <div style={{ display: "flex", gap: "20px", fontSize: "13px", opacity: 0.9 }}>
            <span>⏱ {mockExamInfo.duration} menit</span>
            <span>📝 {mockExamInfo.questionCount} soal</span>
          </div>
        </div>

        {/* Form Card */}
        <div className="card">
          <div className="card-body" style={{ padding: "32px 28px" }}>
            <h1 style={{ fontSize: "22px", fontWeight: 700, textAlign: "center", marginBottom: "6px" }}>
              Masukkan Identitasmu
            </h1>
            <p style={{ textAlign: "center", color: "var(--color-neutral-500)", marginBottom: "28px", fontSize: "14px" }}>
              Pastikan data yang kamu masukkan benar
            </p>

            <form onSubmit={handleSubmit} noValidate>
              <div className="form-group" style={{ marginBottom: "16px" }}>
                <label className="form-label">Nama Lengkap <span className="required">*</span></label>
                <input
                  className={`form-input${errors.name ? " error" : ""}`}
                  type="text"
                  placeholder="Masukkan nama lengkap"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  autoComplete="name"
                />
                {errors.name && <span className="form-error">⚠️ {errors.name}</span>}
              </div>

              <div className="form-group" style={{ marginBottom: "24px" }}>
                <label className="form-label">NIM <span className="required">*</span></label>
                <input
                  className={`form-input form-input-mono${errors.nim ? " error" : ""}`}
                  type="text"
                  placeholder="1301210001"
                  value={form.nim}
                  onChange={e => setForm(f => ({ ...f, nim: e.target.value }))}
                  style={{ fontSize: "18px" }}
                  autoComplete="off"
                />
                {errors.nim && <span className="form-error">⚠️ {errors.nim}</span>}
              </div>

              <button type="submit" className="btn btn-primary btn-lg btn-full" disabled={loading}>
                {loading
                  ? <><span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⟳</span> Memproses...</>
                  : "Bergabung →"}
              </button>
            </form>
          </div>
        </div>

        <div style={{ textAlign: "center", marginTop: "16px" }}>
          <button
            className="btn btn-ghost btn-md"
            onClick={() => router.push("/join")}
          >
            ← Kembali ke Kode Akses
          </button>
        </div>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
