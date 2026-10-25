"use client";

import { useState } from "react";
import Link from "next/link";
import DashboardShell from "@/app/components/DashboardShell";

export default function NewExamPage() {
  const [form, setForm] = useState({
    title: "",
    description: "",
    duration: "",
    shuffleQuestions: false,
    questionMode: "one-by-one",
    maxViolations: "3",
    violationAction: "warning",
    detectCopyPaste: false,
    detectRightClick: false,
    detectDevTools: false,
  });
  const [uploadState, setUploadState] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [fileName, setFileName] = useState("");
  const [questionCount, setQuestionCount] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewQuestion, setPreviewQuestion] = useState(0);
  const [toast, setToast] = useState<{ type: string; msg: string } | null>(null);

  const set = (key: string, val: unknown) => setForm(f => ({ ...f, [key]: val }));

  const previewQuestions = [
    { num: 1, text: "Apa yang dimaksud dengan HTML (HyperText Markup Language)?", options: ["Bahasa pemrograman untuk logika", "Bahasa markup untuk struktur web", "Framework JavaScript", "Protokol komunikasi"], correct: 1, points: 10 },
    { num: 2, text: "Properti CSS mana yang digunakan untuk mengubah warna teks?", options: ["background-color", "font-color", "color", "text-color"], correct: 2, points: 10 },
    { num: 3, text: "Dalam JavaScript, metode apa yang digunakan untuk menambahkan elemen ke akhir array?", options: ["array.add()", "array.append()", "array.insert()", "array.push()"], correct: 3, points: 10 },
  ];

  const handleFileUpload = () => {
    setUploadState("uploading");
    setTimeout(() => {
      setUploadState("success");
      setFileName("soal-uts-web.json");
      setQuestionCount(25);
    }, 1500);
  };

  const validate = () => {
    const err: Record<string, string> = {};
    if (!form.title) err.title = "Judul ujian wajib diisi";
    if (!form.duration) err.duration = "Durasi wajib diisi";
    else if (parseInt(form.duration) < 1 || parseInt(form.duration) > 480) err.duration = "Durasi harus antara 1-480 menit";
    if (uploadState !== "success") err.questions = "Bank soal wajib diupload";
    return err;
  };

  const handleSubmit = async (e: React.FormEvent, mode: "draft" | "save") => {
    e.preventDefault();
    if (mode === "save") {
      const v = validate();
      if (Object.keys(v).length > 0) { setErrors(v); return; }
    }
    setErrors({});
    setLoading(true);
    await new Promise(r => setTimeout(r, 1200));
    setLoading(false);
    setToast({ type: "success", msg: mode === "draft" ? "Ujian disimpan sebagai draft" : "Ujian berhasil dibuat!" });
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <DashboardShell>
      <div style={{ padding: "32px", maxWidth: "860px" }}>
        {/* Breadcrumb */}
        <div className="breadcrumb">
          <Link href="/dashboard">Dashboard</Link>
          <span className="breadcrumb-sep">›</span>
          <span className="breadcrumb-current">Buat Ujian Baru</span>
        </div>

        <div className="page-header" style={{ marginBottom: "24px" }}>
          <h1 className="text-h1">📋 Buat Ujian Baru</h1>
        </div>

        <form>
          <div className="card">
            <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
              {/* Section 1: Info Dasar */}
              <div className="form-section">
                <div className="form-section-title">📋 Informasi Dasar</div>
                <div className="form-group">
                  <label className="form-label">Judul Ujian <span className="required">*</span></label>
                  <input className={`form-input${errors.title ? " error" : ""}`} type="text" placeholder="UTS Pemrograman Web 2026" value={form.title} onChange={e => set("title", e.target.value)} maxLength={200} />
                  {errors.title && <span className="form-error">⚠️ {errors.title}</span>}
                </div>
                <div className="form-group">
                  <label className="form-label">Deskripsi (Opsional)</label>
                  <textarea className="form-textarea" placeholder="Deskripsi singkat ujian ini..." value={form.description} onChange={e => set("description", e.target.value)} maxLength={1000} rows={3} />
                  <div className="char-count">{form.description.length}/1000</div>
                </div>
                <div className="form-group" style={{ maxWidth: "280px" }}>
                  <label className="form-label">Durasi (menit) <span className="required">*</span></label>
                  <div style={{ position: "relative" }}>
                    <input className={`form-input${errors.duration ? " error" : ""}`} type="number" placeholder="90" min={1} max={480} value={form.duration} onChange={e => set("duration", e.target.value)} />
                    {form.duration && <span style={{ position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)", fontSize: "13px", color: "var(--color-neutral-400)" }}>menit</span>}
                  </div>
                  {errors.duration && <span className="form-error">⚠️ {errors.duration}</span>}
                </div>
              </div>

              {/* Section 2: Bank Soal */}
              <div className="form-section">
                <div className="form-section-title">📁 Bank Soal</div>
                {uploadState === "idle" && (
                  <div className="file-upload-zone" onClick={handleFileUpload}>
                    <div className="file-upload-icon">☁️</div>
                    <div className="file-upload-text">Drag file ke sini atau <strong>klik untuk pilih</strong></div>
                    <div className="file-upload-hint">Format: .json atau .xml · Maks. 5MB</div>
                  </div>
                )}
                {uploadState === "uploading" && (
                  <div style={{ padding: "24px", textAlign: "center", border: "2px dashed var(--color-primary)", borderRadius: "var(--radius-lg)", background: "var(--color-primary-light)" }}>
                    <div style={{ fontSize: "24px", marginBottom: "8px", animation: "spin 1s linear infinite", display: "inline-block" }}>⟳</div>
                    <div style={{ color: "var(--color-primary)", fontWeight: 500 }}>Mengupload soal...</div>
                    <div className="progress-bar" style={{ marginTop: "12px" }}>
                      <div className="progress-fill" style={{ width: "60%" }} />
                    </div>
                  </div>
                )}
                {uploadState === "success" && (
                  <div className="file-upload-success">
                    <span style={{ fontSize: "24px" }}>✅</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, color: "var(--color-success)" }}>{questionCount} soal berhasil diproses</div>
                      <div style={{ fontSize: "13px", color: "var(--color-neutral-500)" }}>{fileName} · Total poin: {questionCount * 10}</div>
                    </div>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button type="button" className="btn btn-ghost-primary btn-sm" onClick={() => setShowPreview(true)}>👁 Preview Soal</button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setUploadState("idle"); setFileName(""); setQuestionCount(0); }}>🔄 Ganti File</button>
                    </div>
                  </div>
                )}
                {uploadState === "error" && (
                  <div className="file-upload-error">
                    <div style={{ fontWeight: 600, color: "var(--color-danger)", marginBottom: "8px" }}>❌ File tidak valid</div>
                    <div style={{ fontSize: "13px", color: "var(--color-neutral-600)" }}>
                      <div>• Soal #3: field &apos;options&apos; wajib ada</div>
                      <div>• Soal #7: tidak ada jawaban benar</div>
                    </div>
                    <button type="button" className="btn btn-primary btn-sm" style={{ marginTop: "12px" }} onClick={() => setUploadState("idle")}>Upload Ulang</button>
                  </div>
                )}
                {errors.questions && <span className="form-error">⚠️ {errors.questions}</span>}
              </div>

              {/* Section 3: Pengaturan Soal */}
              <div className="form-section">
                <div className="form-section-title">⚙️ Pengaturan Soal</div>
                <label className="toggle-wrapper" htmlFor="shuffle">
                  <div className="toggle-info">
                    <div className="toggle-title">Acak Urutan Soal</div>
                    <div className="toggle-desc">Setiap peserta mendapat urutan soal berbeda</div>
                  </div>
                  <div className="toggle-switch">
                    <input id="shuffle" type="checkbox" checked={form.shuffleQuestions} onChange={e => set("shuffleQuestions", e.target.checked)} />
                    <span className="toggle-track" />
                  </div>
                </label>
                <div className="form-group">
                  <label className="form-label">Mode Tampilan Soal</label>
                  <div className="radio-group">
                    {[{ val: "one-by-one", label: "Satu per satu", desc: "Peserta menjawab soal satu demi satu" }, { val: "all-at-once", label: "Semua sekaligus", desc: "Semua soal tampil dalam satu halaman" }].map(opt => (
                      <label key={opt.val} className={`radio-option${form.questionMode === opt.val ? " selected" : ""}`}>
                        <input type="radio" name="questionMode" value={opt.val} checked={form.questionMode === opt.val} onChange={() => set("questionMode", opt.val)} />
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
                <div className="form-section-title">🛡️ Kebijakan Pelanggaran</div>
                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label">Maksimal Pelanggaran</label>
                    <input className="form-input" type="number" min={1} max={20} value={form.maxViolations} onChange={e => set("maxViolations", e.target.value)} />
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
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {[
                    { key: "detectCopyPaste", label: "Deteksi Copy-Paste", desc: "Catat jika peserta mencoba menyalin teks" },
                    { key: "detectRightClick", label: "Deteksi Klik Kanan", desc: "Catat jika peserta klik kanan di halaman ujian" },
                    { key: "detectDevTools", label: "Deteksi DevTools", desc: "Catat jika peserta membuka developer tools" },
                  ].map(t => (
                    <label key={t.key} className="toggle-wrapper" htmlFor={t.key}>
                      <div className="toggle-info">
                        <div className="toggle-title">{t.label}</div>
                        <div className="toggle-desc">{t.desc}</div>
                      </div>
                      <div className="toggle-switch">
                        <input id={t.key} type="checkbox" checked={form[t.key as keyof typeof form] as boolean} onChange={e => set(t.key, e.target.checked)} />
                        <span className="toggle-track" />
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="card-footer">
              <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
                <Link href="/dashboard" className="btn btn-secondary btn-md">Batal</Link>
                <div style={{ display: "flex", gap: "12px" }}>
                  <button type="button" className="btn btn-secondary btn-md" onClick={e => handleSubmit(e, "draft")} disabled={loading}>
                    Simpan sebagai Draft
                  </button>
                  <button type="button" className="btn btn-primary btn-md" onClick={e => handleSubmit(e, "save")} disabled={loading}>
                    {loading ? "Menyimpan..." : "Simpan & Lihat Detail"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <div className="modal-overlay" onClick={() => setShowPreview(false)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Preview Soal — {form.title || "Ujian Baru"}</span>
              <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                <span style={{ fontSize: "13px", color: "var(--color-neutral-400)" }}>Soal {previewQuestion + 1} dari {previewQuestions.length}</span>
                <button className="modal-close" onClick={() => setShowPreview(false)}>✕</button>
              </div>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: "8px" }}>
                <span className="badge badge-indigo">Poin: {previewQuestions[previewQuestion].points}</span>
              </div>
              <p style={{ fontSize: "17px", fontWeight: 500, color: "var(--color-neutral-800)", marginBottom: "20px", lineHeight: 1.7 }}>
                {previewQuestion + 1}. {previewQuestions[previewQuestion].text}
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {previewQuestions[previewQuestion].options.map((opt, i) => (
                  <div key={i} className={`answer-option disabled${i === previewQuestions[previewQuestion].correct ? " correct" : ""}`}>
                    <div className={`option-letter${i === previewQuestions[previewQuestion].correct ? " " : ""}`} style={i === previewQuestions[previewQuestion].correct ? { background: "var(--color-success)", borderColor: "var(--color-success)", color: "white" } : {}}>
                      {String.fromCharCode(65 + i)}
                    </div>
                    <span className="option-text">{opt}</span>
                    {i === previewQuestions[previewQuestion].correct && <span>✅</span>}
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-footer" style={{ justifyContent: "space-between" }}>
              <button className="btn btn-secondary btn-md" disabled={previewQuestion === 0} onClick={() => setPreviewQuestion(q => q - 1)}>← Sebelumnya</button>
              <button className="btn btn-secondary btn-md" onClick={() => setShowPreview(false)}>Tutup</button>
              <button className="btn btn-primary btn-md" disabled={previewQuestion === previewQuestions.length - 1} onClick={() => setPreviewQuestion(q => q + 1)}>Selanjutnya →</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="toast-container">
          <div className={`toast ${toast.type}`}>
            <span className="toast-icon">✅</span>
            <div className="toast-content"><div className="toast-msg">{toast.msg}</div></div>
            <button className="toast-close" onClick={() => setToast(null)}>✕</button>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </DashboardShell>
  );
}
