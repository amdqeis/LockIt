"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import DashboardShell from "@/app/components/DashboardShell";
import {
  mockQuestionBanks,
  QuestionBank,
  QuestionBankStatus,
  DifficultyLevel,
} from "@/lib/mockData";

// ─── Helpers ────────────────────────────────────────────────────────────────

const DIFFICULTY_META: Record<DifficultyLevel, { label: string; color: string; bg: string }> = {
  easy:   { label: "Mudah",    color: "#059669", bg: "#D1FAE5" },
  medium: { label: "Sedang",   color: "#D97706", bg: "#FEF3C7" },
  hard:   { label: "Sulit",    color: "#DC2626", bg: "#FEE2E2" },
  mixed:  { label: "Campuran", color: "#7C3AED", bg: "#EDE9FE" },
};

const STATUS_META: Record<QuestionBankStatus, { label: string; color: string; bg: string; dot: string }> = {
  active:   { label: "Aktif",  color: "#059669", bg: "#D1FAE5", dot: "#10B981" },
  draft:    { label: "Draft",  color: "#D97706", bg: "#FEF3C7", dot: "#F59E0B" },
  archived: { label: "Arsip",  color: "#64748B", bg: "#F1F5F9", dot: "#94A3B8" },
};

const COLOR = "#29ABE2";

function DiffBadge({ d }: { d: DifficultyLevel }) {
  const m = DIFFICULTY_META[d];
  return (
    <span style={{ fontSize: "11px", fontWeight: 600, padding: "2px 8px", borderRadius: "99px", background: m.bg, color: m.color }}>
      {m.label}
    </span>
  );
}

function StatusBadge({ s }: { s: QuestionBankStatus }) {
  const m = STATUS_META[s];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "12px", fontWeight: 600, padding: "3px 10px", borderRadius: "99px", background: m.bg, color: m.color }}>
      <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: m.dot, flexShrink: 0 }} />
      {m.label}
    </span>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────────
function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "72px 24px", gap: "16px" }}>
      <div style={{ fontSize: "52px" }}>📚</div>
      <div style={{ fontSize: "18px", fontWeight: 700, color: "#0F172A" }}>Belum ada bank soal</div>
      <div style={{ fontSize: "14px", color: "#64748B", textAlign: "center", maxWidth: "340px" }}>
        Buat bank soal pertama Anda untuk mulai menyusun ujian lebih cepat dan terorganisir.
      </div>
      <button className="btn btn-primary btn-md" onClick={onAdd}>+ Buat Bank Soal</button>
    </div>
  );
}

// ─── Modal: Create / Edit ─────────────────────────────────────────────────────
interface ModalFormProps {
  initial?: QuestionBank | null;
  onClose: () => void;
  onSave: (data: Partial<QuestionBank>) => void;
}

function BankModal({ initial, onClose, onSave }: ModalFormProps) {
  const [form, setForm] = useState({
    title: initial?.title ?? "",
    subject: initial?.subject ?? "",
    description: initial?.description ?? "",
    tags: initial?.tags.join(", ") ?? "",
    difficulty: (initial?.difficulty ?? "medium") as DifficultyLevel,
    status: (initial?.status ?? "draft") as QuestionBankStatus,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.title.trim()) e.title = "Judul wajib diisi";
    if (!form.subject.trim()) e.subject = "Mata pelajaran wajib diisi";
    return e;
  };

  const submit = () => {
    const e = validate();
    if (Object.keys(e).length > 0) { setErrors(e); return; }
    onSave({
      title: form.title.trim(),
      subject: form.subject.trim(),
      description: form.description.trim() || null,
      tags: form.tags.split(",").map(t => t.trim()).filter(Boolean),
      difficulty: form.difficulty,
      status: form.status,
    });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()} style={{ maxWidth: "580px" }}>
        <div className="modal-header">
          <span className="modal-title">{initial ? "✏️ Edit Bank Soal" : "➕ Buat Bank Soal Baru"}</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div className="form-group">
            <label className="form-label">Judul Bank Soal <span className="required">*</span></label>
            <input className={`form-input${errors.title ? " error" : ""}`} placeholder="Soal UTS Pemrograman Web" value={form.title} onChange={e => set("title", e.target.value)} maxLength={200} />
            {errors.title && <span className="form-error">⚠️ {errors.title}</span>}
          </div>
          <div className="form-group">
            <label className="form-label">Mata Pelajaran / Mata Kuliah <span className="required">*</span></label>
            <input className={`form-input${errors.subject ? " error" : ""}`} placeholder="Pemrograman Web" value={form.subject} onChange={e => set("subject", e.target.value)} maxLength={100} />
            {errors.subject && <span className="form-error">⚠️ {errors.subject}</span>}
          </div>
          <div className="form-group">
            <label className="form-label">Deskripsi (Opsional)</label>
            <textarea className="form-textarea" placeholder="Deskripsi singkat tentang bank soal ini..." value={form.description} onChange={e => set("description", e.target.value)} rows={3} maxLength={500} />
            <div className="char-count">{form.description.length}/500</div>
          </div>
          <div className="form-group">
            <label className="form-label">Tags (pisahkan dengan koma)</label>
            <input className="form-input" placeholder="HTML, CSS, JavaScript" value={form.tags} onChange={e => set("tags", e.target.value)} />
            <span className="form-helper">Contoh: HTML, CSS, JavaScript</span>
          </div>
          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">Tingkat Kesulitan</label>
              <select className="form-select" value={form.difficulty} onChange={e => set("difficulty", e.target.value)}>
                <option value="easy">Mudah</option>
                <option value="medium">Sedang</option>
                <option value="hard">Sulit</option>
                <option value="mixed">Campuran</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="form-select" value={form.status} onChange={e => set("status", e.target.value)}>
                <option value="draft">Draft</option>
                <option value="active">Aktif</option>
                <option value="archived">Arsip</option>
              </select>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary btn-md" onClick={onClose}>Batal</button>
          <button className="btn btn-primary btn-md" onClick={submit}>{initial ? "Simpan Perubahan" : "Buat Bank Soal"}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal: Delete Confirm ────────────────────────────────────────────────────
function DeleteModal({ bank, onClose, onConfirm }: { bank: QuestionBank; onClose: () => void; onConfirm: () => void }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: "440px" }}>
        <div className="modal-header">
          <span className="modal-title" style={{ color: "#DC2626" }}>🗑️ Hapus Bank Soal</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: "14px", color: "#475569", lineHeight: 1.7 }}>
            Anda akan menghapus bank soal <strong style={{ color: "#0F172A" }}>&ldquo;{bank.title}&rdquo;</strong>.
            {bank.usedInExams > 0 && (
              <><br /><span style={{ color: "#DC2626" }}>⚠️ Bank soal ini digunakan oleh <strong>{bank.usedInExams} ujian</strong>. Menghapus tidak akan mempengaruhi ujian yang sudah ada.</span></>
            )}
          </p>
          <p style={{ fontSize: "13px", color: "#94A3B8", marginTop: "8px" }}>Tindakan ini tidak dapat dibatalkan.</p>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary btn-md" onClick={onClose}>Batal</button>
          <button style={{ background: "#DC2626", color: "white", borderRadius: "var(--radius-md)", padding: "0 20px", height: "40px", fontWeight: 600, border: "none", cursor: "pointer", fontSize: "14px" }} onClick={onConfirm}>
            Ya, Hapus
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Detail Drawer ────────────────────────────────────────────────────────────
function DetailDrawer({ bank, onClose, onEdit, onDelete }: {
  bank: QuestionBank;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.3)", zIndex: 150, backdropFilter: "blur(2px)" }} />
      <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: "420px", background: "white", zIndex: 200, boxShadow: "-8px 0 32px rgba(15,23,42,0.15)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #E2E8F0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: "12px", color: "#94A3B8", fontWeight: 500, marginBottom: "6px" }}>Detail Bank Soal</div>
            <StatusBadge s={bank.status} />
          </div>
          <button onClick={onClose} style={{ width: "32px", height: "32px", borderRadius: "6px", border: "1px solid #E2E8F0", background: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", color: "#64748B" }}>✕</button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 800, color: "#0F172A", marginBottom: "6px", lineHeight: 1.4 }}>{bank.title}</h2>
          <div style={{ fontSize: "13px", color: "#64748B", marginBottom: "20px" }}>📚 {bank.subject}</div>
          {bank.description && (
            <p style={{ fontSize: "14px", color: "#475569", lineHeight: 1.7, background: "#F8FAFC", borderRadius: "8px", padding: "12px 14px", marginBottom: "20px" }}>{bank.description}</p>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "20px" }}>
            {[
              { label: "Jumlah Soal",  value: bank.questionCount, icon: "📝" },
              { label: "Total Poin",   value: bank.totalPoints,   icon: "⭐" },
              { label: "Digunakan",    value: `${bank.usedInExams} ujian`, icon: "📋" },
              { label: "Kesulitan",    value: DIFFICULTY_META[bank.difficulty].label, icon: "🎯" },
            ].map(s => (
              <div key={s.label} style={{ background: "#F8FAFC", borderRadius: "10px", padding: "14px", border: "1px solid #E2E8F0" }}>
                <div style={{ fontSize: "18px", marginBottom: "6px" }}>{s.icon}</div>
                <div style={{ fontSize: "20px", fontWeight: 800, color: "#0F172A" }}>{s.value}</div>
                <div style={{ fontSize: "11px", color: "#94A3B8", marginTop: "2px" }}>{s.label}</div>
              </div>
            ))}
          </div>
          {bank.tags.length > 0 && (
            <div style={{ marginBottom: "20px" }}>
              <div style={{ fontSize: "12px", fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "8px" }}>TAGS</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {bank.tags.map(tag => (
                  <span key={tag} style={{ fontSize: "12px", padding: "3px 10px", borderRadius: "99px", background: "#E0F4FD", color: "#0369A1", fontWeight: 500 }}>{tag}</span>
                ))}
              </div>
            </div>
          )}
          <div style={{ borderTop: "1px solid #E2E8F0", paddingTop: "16px" }}>
            <div style={{ fontSize: "12px", fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "10px" }}>INFO</div>
            {[
              { label: "Dibuat oleh", value: bank.createdBy },
              { label: "Tanggal dibuat", value: new Date(bank.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) },
              { label: "Terakhir diupdate", value: new Date(bank.updatedAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) },
            ].map(m => (
              <div key={m.label} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid #F1F5F9", fontSize: "13px" }}>
                <span style={{ color: "#94A3B8" }}>{m.label}</span>
                <span style={{ color: "#0F172A", fontWeight: 500 }}>{m.value}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ padding: "16px 24px", borderTop: "1px solid #E2E8F0", display: "flex", gap: "10px" }}>
          <button className="btn btn-secondary btn-md" style={{ flex: 1 }} onClick={onDelete}>🗑️ Hapus</button>
          <button className="btn btn-primary btn-md" style={{ flex: 2 }} onClick={onEdit}>✏️ Edit Bank Soal</button>
        </div>
      </div>
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function QuestionBankPage() {
  const [banks, setBanks] = useState<QuestionBank[]>(mockQuestionBanks);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | QuestionBankStatus>("all");
  const [filterDiff, setFilterDiff] = useState<"all" | DifficultyLevel>("all");
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<QuestionBank | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<QuestionBank | null>(null);
  const [detailTarget, setDetailTarget] = useState<QuestionBank | null>(null);
  const [toast, setToast] = useState<{ type: string; msg: string } | null>(null);

  const showToast = (msg: string, type = "success") => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  };

  const stats = useMemo(() => ({
    total: banks.length,
    active: banks.filter(b => b.status === "active").length,
    draft: banks.filter(b => b.status === "draft").length,
    totalQuestions: banks.reduce((acc, b) => acc + b.questionCount, 0),
  }), [banks]);

  const filtered = useMemo(() => {
    return banks.filter(b => {
      const q = search.toLowerCase();
      const matchSearch = !q || b.title.toLowerCase().includes(q) || b.subject.toLowerCase().includes(q) || b.tags.some(t => t.toLowerCase().includes(q));
      const matchStatus = filterStatus === "all" || b.status === filterStatus;
      const matchDiff = filterDiff === "all" || b.difficulty === filterDiff;
      return matchSearch && matchStatus && matchDiff;
    });
  }, [banks, search, filterStatus, filterDiff]);

  const handleSave = (data: Partial<QuestionBank>, existing?: QuestionBank | null) => {
    if (existing) {
      setBanks(prev => prev.map(b => b.id === existing.id ? { ...b, ...data, updatedAt: new Date().toISOString().slice(0, 10) } : b));
      showToast("Bank soal berhasil diperbarui");
    } else {
      const newBank: QuestionBank = {
        id: `qb-${Date.now()}`,
        title: data.title!,
        subject: data.subject!,
        description: data.description ?? null,
        tags: data.tags ?? [],
        difficulty: data.difficulty ?? "medium",
        status: data.status ?? "draft",
        questionCount: 0,
        totalPoints: 0,
        usedInExams: 0,
        createdAt: new Date().toISOString().slice(0, 10),
        updatedAt: new Date().toISOString().slice(0, 10),
        createdBy: "Dr. Ahmad Fauzi, S.T.",
      };
      setBanks(prev => [newBank, ...prev]);
      showToast("Bank soal berhasil dibuat!");
    }
  };

  const handleDelete = (id: string) => {
    setBanks(prev => prev.filter(b => b.id !== id));
    setDeleteTarget(null);
    setDetailTarget(null);
    showToast("Bank soal dihapus");
  };

  const handleArchive = (bank: QuestionBank) => {
    const next: QuestionBankStatus = bank.status === "archived" ? "active" : "archived";
    setBanks(prev => prev.map(b => b.id === bank.id ? { ...b, status: next, updatedAt: new Date().toISOString().slice(0, 10) } : b));
    showToast(next === "archived" ? "Bank soal diarsipkan" : "Bank soal diaktifkan kembali");
  };

  return (
    <DashboardShell>
      <div style={{ padding: "32px", maxWidth: "1100px" }}>
        <div className="breadcrumb">
          <Link href="/dashboard">Dashboard</Link>
          <span className="breadcrumb-sep">›</span>
          <span className="breadcrumb-current">Bank Soal</span>
        </div>

        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "28px", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h1 className="text-h1" style={{ marginBottom: "4px" }}>📚 Bank Soal</h1>
            <p style={{ fontSize: "14px", color: "#64748B", margin: 0 }}>Kelola kumpulan soal yang dapat digunakan untuk membuat ujian baru.</p>
          </div>
          <button className="btn btn-primary btn-md" onClick={() => setShowCreate(true)}>+ Buat Bank Soal</button>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "14px", marginBottom: "24px" }}>
          {[
            { label: "Total Bank",   value: stats.total,          icon: "📚", color: COLOR,     bg: "#E0F4FD" },
            { label: "Aktif",        value: stats.active,         icon: "✅", color: "#059669",  bg: "#D1FAE5" },
            { label: "Draft",        value: stats.draft,          icon: "✏️", color: "#D97706",  bg: "#FEF3C7" },
            { label: "Total Soal",   value: stats.totalQuestions, icon: "📝", color: "#7C3AED",  bg: "#EDE9FE" },
          ].map(s => (
            <div key={s.label} className="card" style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: "14px" }}>
              <div style={{ width: "44px", height: "44px", borderRadius: "10px", background: s.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px", flexShrink: 0 }}>{s.icon}</div>
              <div>
                <div style={{ fontSize: "22px", fontWeight: 800, color: "#0F172A" }}>{s.value}</div>
                <div style={{ fontSize: "12px", color: "#64748B", marginTop: "2px" }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="card" style={{ marginBottom: "20px" }}>
          <div style={{ padding: "14px 20px", display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ position: "relative", flex: "1 1 220px" }}>
              <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", fontSize: "14px", color: "#94A3B8", pointerEvents: "none" }}>🔍</span>
              <input className="form-input" style={{ paddingLeft: "36px", height: "38px" }} placeholder="Cari judul, mata pelajaran, atau tag..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="form-select" style={{ width: "160px", height: "38px" }} value={filterStatus} onChange={e => setFilterStatus(e.target.value as typeof filterStatus)}>
              <option value="all">Semua Status</option>
              <option value="active">Aktif</option>
              <option value="draft">Draft</option>
              <option value="archived">Arsip</option>
            </select>
            <select className="form-select" style={{ width: "170px", height: "38px" }} value={filterDiff} onChange={e => setFilterDiff(e.target.value as typeof filterDiff)}>
              <option value="all">Semua Kesulitan</option>
              <option value="easy">Mudah</option>
              <option value="medium">Sedang</option>
              <option value="hard">Sulit</option>
              <option value="mixed">Campuran</option>
            </select>
            {(search || filterStatus !== "all" || filterDiff !== "all") && (
              <button className="btn btn-ghost btn-sm" onClick={() => { setSearch(""); setFilterStatus("all"); setFilterDiff("all"); }}>✕ Reset</button>
            )}
            <span style={{ marginLeft: "auto", fontSize: "13px", color: "#64748B", whiteSpace: "nowrap" }}>{filtered.length} dari {banks.length} bank soal</span>
          </div>
        </div>

        {/* List */}
        {filtered.length === 0 ? (
          banks.length === 0
            ? <div className="card"><EmptyState onAdd={() => setShowCreate(true)} /></div>
            : <div className="card" style={{ padding: "48px", textAlign: "center" }}>
                <div style={{ fontSize: "32px", marginBottom: "12px" }}>🔍</div>
                <div style={{ fontSize: "16px", fontWeight: 700, color: "#0F172A", marginBottom: "6px" }}>Tidak ada hasil</div>
                <div style={{ fontSize: "14px", color: "#64748B" }}>Coba ubah filter atau kata kunci pencarian.</div>
              </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {filtered.map(bank => (
              <div
                key={bank.id}
                className="card"
                style={{ cursor: "pointer", transition: "box-shadow 0.15s ease" }}
                onClick={() => setDetailTarget(bank)}
                onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 4px 16px rgba(41,171,226,0.12)")}
                onMouseLeave={e => (e.currentTarget.style.boxShadow = "")}
              >
                <div style={{ padding: "18px 22px", display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
                  <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: "#E0F4FD", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px", flexShrink: 0 }}>📚</div>
                  <div style={{ flex: 1, minWidth: "200px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px", flexWrap: "wrap" }}>
                      <span style={{ fontSize: "15px", fontWeight: 700, color: "#0F172A" }}>{bank.title}</span>
                      <StatusBadge s={bank.status} />
                      <DiffBadge d={bank.difficulty} />
                    </div>
                    <div style={{ fontSize: "13px", color: "#64748B", marginBottom: "6px" }}>📚 {bank.subject}</div>
                    {bank.tags.length > 0 && (
                      <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                        {bank.tags.slice(0, 4).map(t => (
                          <span key={t} style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "99px", background: "#F1F5F9", color: "#475569" }}>{t}</span>
                        ))}
                        {bank.tags.length > 4 && <span style={{ fontSize: "11px", color: "#94A3B8" }}>+{bank.tags.length - 4}</span>}
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: "24px", alignItems: "center", flexShrink: 0 }}>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "18px", fontWeight: 800, color: "#0F172A" }}>{bank.questionCount}</div>
                      <div style={{ fontSize: "11px", color: "#94A3B8" }}>Soal</div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "18px", fontWeight: 800, color: "#0F172A" }}>{bank.usedInExams}</div>
                      <div style={{ fontSize: "11px", color: "#94A3B8" }}>Ujian</div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "18px", fontWeight: 800, color: "#0F172A" }}>{bank.totalPoints}</div>
                      <div style={{ fontSize: "11px", color: "#94A3B8" }}>Poin</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "6px", flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                    <button title="Edit" className="btn btn-ghost btn-sm" style={{ padding: "6px 10px" }} onClick={() => setEditTarget(bank)}>✏️</button>
                    <button title={bank.status === "archived" ? "Aktifkan" : "Arsipkan"} className="btn btn-ghost btn-sm" style={{ padding: "6px 10px" }} onClick={() => handleArchive(bank)}>
                      {bank.status === "archived" ? "↩️" : "📦"}
                    </button>
                    <button title="Hapus" className="btn btn-ghost btn-sm" style={{ padding: "6px 10px", color: "#DC2626" }} onClick={() => setDeleteTarget(bank)}>🗑️</button>
                  </div>
                </div>
                <div style={{ padding: "8px 22px", borderTop: "1px solid #F1F5F9", display: "flex", gap: "16px", fontSize: "12px", color: "#94A3B8" }}>
                  <span>Dibuat: {new Date(bank.createdAt).toLocaleDateString("id-ID")}</span>
                  <span>·</span>
                  <span>Diupdate: {new Date(bank.updatedAt).toLocaleDateString("id-ID")}</span>
                  <span>·</span>
                  <span>oleh {bank.createdBy}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreate && <BankModal onClose={() => setShowCreate(false)} onSave={data => handleSave(data, null)} />}
      {editTarget && <BankModal initial={editTarget} onClose={() => setEditTarget(null)} onSave={data => handleSave(data, editTarget)} />}
      {deleteTarget && <DeleteModal bank={deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={() => handleDelete(deleteTarget.id)} />}
      {detailTarget && !editTarget && !deleteTarget && (
        <DetailDrawer bank={detailTarget} onClose={() => setDetailTarget(null)} onEdit={() => { setEditTarget(detailTarget); setDetailTarget(null); }} onDelete={() => { setDeleteTarget(detailTarget); setDetailTarget(null); }} />
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
    </DashboardShell>
  );
}
