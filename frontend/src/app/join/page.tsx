"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function JoinPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setInfo("");
    if (!code) { setError("Kode akses wajib diisi"); return; }
    if (code.length < 6) { setError("Kode terlalu pendek"); return; }
    setLoading(true);
    await new Promise(r => setTimeout(r, 1000));
    setLoading(false);
    // Mock: WEB2026 = active, BD2026X = not started
    if (code === "BD2026X") {
      setInfo("Ujian belum dimulai. Tunggu pengawas memulai ujian.");
      return;
    }
    if (code === "ENDED") {
      setError("Ujian sudah selesai.");
      return;
    }
    router.push("/join/identity");
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-neutral-50)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
      <div style={{ width: "100%", maxWidth: "400px" }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "40px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", marginBottom: "8px" }}>
            <div className="logo-icon">🔒</div>
            <span style={{ fontSize: "24px", fontWeight: 800 }}>LockIt</span>
          </div>
        </div>

        {/* Card */}
        <div className="card">
          <div className="card-body" style={{ padding: "40px 32px" }}>
            <h1 style={{ fontSize: "26px", fontWeight: 700, textAlign: "center", marginBottom: "8px" }}>Ikut Ujian</h1>
            <p style={{ textAlign: "center", color: "var(--color-neutral-500)", marginBottom: "32px", fontSize: "14px" }}>
              Masukkan kode yang diberikan oleh pengawasmu
            </p>

            <form onSubmit={handleSubmit} noValidate>
              <div className="form-group" style={{ marginBottom: "20px" }}>
                <input
                  className={`form-input form-input-mono${error ? " error" : ""}`}
                  type="text"
                  placeholder="ABCD1234"
                  value={code}
                  onChange={e => setCode(e.target.value.toUpperCase().slice(0, 8))}
                  maxLength={8}
                  autoComplete="off"
                  style={{ fontSize: "24px", height: "56px", textAlign: "center", letterSpacing: "0.15em" }}
                />
                {error && <span className="form-error" style={{ justifyContent: "center", marginTop: "8px" }}>⚠️ {error}</span>}
              </div>

              {info && (
                <div className="alert alert-info" style={{ marginBottom: "16px" }}>
                  <span className="alert-icon">ℹ️</span>
                  {info}
                </div>
              )}

              <button type="submit" className="btn btn-primary btn-lg btn-full" disabled={loading}>
                {loading ? <><span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⟳</span> Memeriksa...</> : "Masuk"}
              </button>
            </form>


          </div>
        </div>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
