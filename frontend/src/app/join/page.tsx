"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useActiveSession } from "@/hooks/useActiveSession";
import { clearSessionHint } from "@/lib/examSession";

export default function JoinPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [showResumePrompt, setShowResumePrompt] = useState(false);

  const { checking, sessionCheck, sessionHint, hasActiveSession } = useActiveSession();

  // Setelah backend konfirmasi sesi aktif → otomatis redirect
  useEffect(() => {
    if (!checking && hasActiveSession) {
      router.replace("/exam/session");
    }
  }, [checking, hasActiveSession, router]);

  // Tampilkan resume prompt jika ada hint di localStorage (sebelum backend merespons)
  useEffect(() => {
    if (sessionHint) {
      setShowResumePrompt(true);
    }
  }, [sessionHint]);

  // Jika backend bilang sesi tidak aktif, tutup prompt
  useEffect(() => {
    if (!checking && sessionCheck && !sessionCheck.isActive) {
      setShowResumePrompt(false);
    }
  }, [checking, sessionCheck]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setInfo("");
    if (!code) { setError("Kode akses wajib diisi"); return; }
    if (code.length < 6) { setError("Kode terlalu pendek"); return; }
    setLoading(true);
    await new Promise(r => setTimeout(r, 1000));
    setLoading(false);
    if (code === "BD2026X") {
      setInfo("Ujian belum dimulai. Tunggu pengawas memulai ujian.");
      return;
    }
    if (code === "ENDED") {
      setError("Ujian sudah selesai.");
      return;
    }
    router.push(`/join/identity?code=${encodeURIComponent(code)}`);
  };

  const handleResumeSession = () => {
    router.replace("/exam/session");
  };

  const handleDismissResume = () => {
    clearSessionHint();
    setShowResumePrompt(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-neutral-50)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
      <div style={{ width: "100%", maxWidth: "400px" }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "40px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", marginBottom: "8px" }}>
            <div className="logo-icon">🔒</div>
            <span style={{ fontSize: "24px", fontWeight: 800 }}>EduQuas</span>
          </div>
        </div>

        {/* Resume Prompt Banner */}
        {showResumePrompt && sessionHint && (
          <div style={{
            background: "linear-gradient(135deg, #E0F4FD 0%, #EDE9FE 100%)",
            border: "1.5px solid #29ABE2",
            borderRadius: "12px",
            padding: "16px 18px",
            marginBottom: "20px",
            boxShadow: "0 4px 16px rgba(41,171,226,0.12)",
          }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
              <div style={{ fontSize: "24px", flexShrink: 0 }}>📋</div>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 700, fontSize: "14px", color: "#1C303D", margin: "0 0 4px 0" }}>
                  Ada ujian yang sedang berlangsung
                </p>
                <p style={{ fontSize: "13px", color: "#3D6A7E", margin: "0 0 12px 0" }}>
                  <strong>{sessionHint.studentName}</strong> · {sessionHint.examTitle}
                </p>
                <div style={{ display: "flex", gap: "8px" }}>
                  {checking ? (
                    <span style={{ fontSize: "13px", color: "#5A8FA8" }}>
                      <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⟳</span> Memeriksa sesi...
                    </span>
                  ) : (
                    <>
                      <button
                        onClick={handleResumeSession}
                        style={{
                          background: "#29ABE2", color: "white", border: "none",
                          borderRadius: "8px", padding: "7px 14px", fontSize: "13px",
                          fontWeight: 600, cursor: "pointer",
                        }}
                      >
                        ▶ Lanjutkan Ujian
                      </button>
                      <button
                        onClick={handleDismissResume}
                        style={{
                          background: "transparent", color: "#5A8FA8", border: "1px solid #A8D4E8",
                          borderRadius: "8px", padding: "7px 12px", fontSize: "13px",
                          cursor: "pointer",
                        }}
                      >
                        Abaikan
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

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
