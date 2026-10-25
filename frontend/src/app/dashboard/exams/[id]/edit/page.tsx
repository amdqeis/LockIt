"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { mockExams } from "@/lib/mockData";
import DashboardShell from "@/app/components/DashboardShell";

function EditExamPage() {
  const params = useParams();
  const exam = mockExams.find(e => e.id === params.id) ?? mockExams[0];
  const isActive = exam.status === "active";

  const [form, setForm] = useState({
    title: exam.title,
    description: exam.description ?? "",
    duration: String(exam.duration),
    shuffleQuestions: exam.shuffleQuestions,
    questionMode: exam.questionMode,
    maxViolations: String(exam.violationPolicy.maxViolations),
    violationAction: exam.violationPolicy.action,
    detectCopyPaste: exam.violationPolicy.detectCopyPaste,
    detectRightClick: exam.violationPolicy.detectRightClick,
    detectDevTools: exam.violationPolicy.detectDevTools,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ type: string; msg: string } | null>(null);
  const [cancelConfirm, setCancelConfirm] = useState(false);

  const set = (key: string, val: unknown) => setForm(f => ({ ...f, [key]: val }));
  const showToast = (type: string, msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };
  const validate = () => {
    const err: Record<string, string> = {};
    if (!form.title) err.title = "Judul ujian wajib diisi";
    if (!form.duration) err.duration = "Durasi wajib diisi";
    else if (parseInt(form.duration) < 1 || parseInt(form.duration) > 480)
      err.duration = "Durasi harus antara 1-480 menit";
    return err;
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = validate();
    if (Object.keys(v).length > 0) { setErrors(v); return; }
    setErrors({});
    setLoading(true);
    await new Promise(r => setTimeout(r, 1200));
    setLoading(false);
    showToast("success", "Perubahan berhasil disimpan!");
  };

  return (
    <DashboardShell>
      <header style={{ background: "white", borderBottom: "1px solid #E9ECF0", padding: "16px 32px", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#9CA3AF" }}>
          <Link href="/dashboard" style={{ color: "#9CA3AF", textDecoration: "none" }}>Dashboard</Link>
          <span>›</span>
          <Link href={`/dashboard/exams/${exam.id}`} style={{ color: "#9CA3AF", textDecoration: "none" }}>{exam.title}</Link>
          <span>›</span>
          <span style={{ color: "#111827", fontWeight: 500 }}>Edit Ujian</span>
        </div>
      </header>

      <div style={{ padding: "24px 32px", maxWidth: "860px" }}>
        <div style={{ marginBottom: "20px" }}>
          <h1 style={{ fontSize: "22px", fontWeight: 700, color: "#111827" }}>✏️ Edit Ujian</h1>
        </div>

        {isActive && (
          <div className="alert alert-warning" style={{ marginBottom: "24px" }}>
            <span className="alert-icon">⚠️</span>
            <div>
              <strong>Ujian sedang berlangsung.</strong> Kamu sedang mengedit ujian yang aktif.
              Hanya kebijakan pelanggaran yang bisa diubah.
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="card">
            <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: "32px" }}>

              {/* Section 1: Info Dasar */}
              <div className="form-section">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
                  <div className="form-section-title" style={{ marginBottom: 0 }}>📋 Informasi Dasar</div>
                  {isActive && <span className="badge badge-yellow">🔒 Hanya baca</span>}
                </div>
                <div className="form-group">
                  <label className="form-label">Judul Ujian <span className="required">*</span></label>
                  <input className={`form-input${errors.title ? " error" : ""}`} type="text" value={form.title}
                    onChange={e => set("title", e.target.value)} maxLength={200} disabled={isActive} />
                  {errors.title && <span className="form-error">⚠️ {errors.title}</span>}
                </div>
                <div className="form-group">
                  <label className="form-label">Deskripsi (Opsional)</label>
                  <textarea className="form-textarea" value={form.description}
                    onChange={e => set("description", e.target.value)} maxLength={1000} rows={3} disabled={isActive} />
                  <div className="char-count">{form.description.length}/1000</div>
                </div>
                <div className="form-group" style={{ maxWidth: "280px" }}>
                  <label className="form-label">Durasi (menit) <span className="required">*</span></label>
                  <input className={`form-input${errors.duration ? " error" : ""}`} type="number"
                    min={1} max={480} value={form.duration} onChange={e => set("duration", e.target.value)} disabled={isActive} />
                  {errors.duration && <span className="form-error">⚠️ {errors.duration}</span>}
                </div>
              </div>

              {/* Section 2: Bank Soal */}
              <div className="form-section">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
                  <div className="form-section-title" style={{ marginBottom: 0 }}>📁 Bank Soal</div>
                  {isActive && <span className="badge badge-yellow">🔒 Hanya baca</span>}
                </div>
                <div className="file-upload-success">
                  <span style={{ fontSize: "24px" }}>✅</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, color: "var(--color-success)" }}>{exam.questionCount} soal tersimpan</div>
                    <div style={{ fontSize: "13px", color: "var(--color-neutral-500)" }}>
                      soal-{exam.id}.json · Total poin: {exam.questionCount * 10}
                    </div>
                  </div>
                  {!isActive && (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => showToast("info", "Pilih file baru")}>
                      🔄 Ganti File
                    </button>
                  )}
                </div>
              </div>

              {/* Section 3: Pengaturan Soal */}
              <div className="form-section">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
                  <div className="form-section-title" style={{ marginBottom: 0 }}>⚙️ Pengaturan Soal</div>
                  {isActive && <span className="badge badge-yellow">🔒 Hanya baca</span>}
                </div>
                <label className="toggle-wrapper" htmlFor="shuffle-edit" style={isActive ? { opacity: 0.6, pointerEvents: "none" } : {}}>
                  <div className="toggle-info">
                    <div className="toggle-title">Acak Urutan Soal</div>
                    <div className="toggle-desc">Setiap peserta mendapat urutan soal berbeda</div>
                  </div>
                  <div className="toggle-switch">
                    <input id="shuffle-edit" type="checkbox" checked={form.shuffleQuestions}
                      onChange={e => set("shuffleQuestions", e.target.checked)} disabled={isActive} />
                    <span className="toggle-track" />
                  </div>
                </label>
                <div className="form-group" style={{ marginTop: "16px" }}>
                  <label className="form-label">Mode Tampilan Soal</label>
                  <div className="radio-group">
                    {[
                      { val: "one-by-one", label: "Satu per satu", desc: "Peserta menjawab soal satu demi satu" },
                      { val: "all-at-once", label: "Semua sekaligus", desc: "Semua soal tampil dalam satu halaman" },
                    ].map(opt => (
                      <label key={opt.val}
                        className={`radio-option${form.questionMode === opt.val ? " selected" : ""}`}
                        style={isActive ? { opacity: 0.6, pointerEvents: "none" } : {}}
                      >
                        <input type="radio" name="questionModeEdit" value={opt.val}
                          checked={form.questionMode === opt.val} onChange={() => set("questionMode", opt.val)} disabled={isActive} />
                        <div className="radio-circle" />
                        <div>
                          <div className="radio-label">{opt.label}</div>
                          <div style={{ fontSize: "12px", color: "var(--color-neutral-400)" }}>{opt.desc}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Section 4: Kebijakan Pelanggaran */}
              <div className="form-section">
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
                  <div className="form-section-title" style={{ marginBottom: 0 }}>🛡️ Kebijakan Pelanggaran</div>
                  {isActive && <span className="badge badge-green">✏️ Dapat diedit</span>}
                </div>
                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label">Maksimal Pelanggaran</label>
                    <input className="form-input" type="number" min={1} max={20}
                      value={form.maxViolations} onChange={e => set("maxViolations", e.target.value)} />
                    <span className="form-helper">Jumlah pelanggaran sebelum tindakan diambil</span>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Tindakan Setelah Batas</label>
                    <select className="form-select" value={form.violationAction} onChange={e => set("violationAction", e.target.value)}>
                      <option value="warning">Beri Peringatan</option>
                      <option value="review">Tandai untuk Review Manual</option>
                      <option value="auto-lock">Kunci Peserta (Auto-lock)</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "16px" }}>
                  {[
                    { key: "detectCopyPaste", label: "Deteksi Copy-Paste", desc: "Catat jika peserta mencoba menyalin teks" },
                    { key: "detectRightClick", label: "Deteksi Klik Kanan", desc: "Catat jika peserta klik kanan di halaman ujian" },
                    { key: "detectDevTools", label: "Deteksi DevTools", desc: "Catat jika peserta membuka developer tools" },
                  ].map(t => (
                    <label key={t.key} className="toggle-wrapper" htmlFor={`edit-${t.key}`}>
                      <div className="toggle-info">
                        <div className="toggle-title">{t.label}</div>
                        <div className="toggle-desc">{t.desc}</div>
                      </div>
                      <div className="toggle-switch">
                        <input id={`edit-${t.key}`} type="checkbox"
                          checked={form[t.key as keyof typeof form] as boolean}
                          onChange={e => set(t.key, e.target.checked)} />
                        <span className="toggle-track" />
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="card-footer">
              <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
                <button type="button" className="btn btn-secondary btn-md" onClick={() => setCancelConfirm(true)}>
                  Batal
                </button>
                <button type="submit" className="btn btn-primary btn-md" disabled={loading}>
                  {loading ? "Menyimpan..." : "Simpan Perubahan"}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>

      {cancelConfirm && (
        <div className="modal-overlay" onClick={() => setCancelConfirm(false)}>
          <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Buang Perubahan?</span>
              <button className="modal-close" onClick={() => setCancelConfirm(false)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ color: "var(--color-neutral-600)", lineHeight: 1.7 }}>
                Semua perubahan yang belum disimpan akan hilang. Yakin ingin kembali?
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary btn-md" onClick={() => setCancelConfirm(false)}>Tetap di Sini</button>
              <Link href={`/dashboard/exams/${exam.id}`} className="btn btn-danger btn-md">Ya, Buang Perubahan</Link>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="toast-container">
          <div className={`toast ${toast.type}`}>
            <span className="toast-icon">{toast.type === "success" ? "✅" : "ℹ️"}</span>
            <div className="toast-content"><div className="toast-msg">{toast.msg}</div></div>
            <button className="toast-close" onClick={() => setToast(null)}>✕</button>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}

export default function EditExamPageWrapper() {
  return <Suspense><EditExamPage /></Suspense>;
}
