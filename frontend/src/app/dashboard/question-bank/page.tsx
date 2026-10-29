"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import DashboardShell from "@/app/components/DashboardShell";
import LatexRenderer from "@/app/components/LatexRenderer";
import ImportXmlModal from "@/app/components/ImportXmlModal";
import MathQuickBar from "@/app/components/MathQuickBar";
import { formatNaturalMath, hasNaturalOrLatexMath } from "@/lib/naturalMath";
import {
  exportBankToXml,
  exportAllBanksToXml,
  downloadXmlFile,
} from "@/lib/questionBankXml";
import {
  QuestionBank,
  QuestionBankStatus,
  DifficultyLevel,
  QuestionType,
  BankQuestion,
  BankQuestionOption,
  getStoredQuestionBanks,
  saveStoredQuestionBanks,
  getStoredQuestions,
  saveStoredQuestions,
  addQuestionToBank,
  updateQuestionInBank,
  deleteQuestionFromBank,
  duplicateQuestionInBank,
  moveQuestionToBank,
} from "@/lib/questionBank";

// ─── Design Tokens & Theme ───────────────────────────────────────────────────
const THEME = {
  primary: "#1B76BF",
  primaryHover: "#155E99",
  primaryTint: "#E6F1FA",
  textPrimary: "#172033",
  textSecondary: "#5B6778",
  border: "#E1E6ED",
  bgSubtle: "#F8FAFC",
  bgCard: "#FFFFFF",
  success: "#059669",
  successBg: "#D1FAE5",
  warning: "#D97706",
  warningBg: "#FEF3C7",
  purple: "#7C3AED",
  purpleBg: "#EDE9FE",
  danger: "#DC2626",
  dangerBg: "#FEE2E2",
};

const DIFFICULTY_META: Record<DifficultyLevel, { label: string; color: string; bg: string }> = {
  easy:   { label: "Mudah",    color: "#059669", bg: "#D1FAE5" },
  medium: { label: "Sedang",   color: "#B45309", bg: "#FEF3C7" },
  hard:   { label: "Sulit",    color: "#DC2626", bg: "#FEE2E2" },
  mixed:  { label: "Campuran", color: "#7C3AED", bg: "#EDE9FE" },
};

const STATUS_META: Record<QuestionBankStatus, { label: string; color: string; bg: string; dot: string }> = {
  active:   { label: "Aktif",  color: "#059669", bg: "#D1FAE5", dot: "#10B981" },
  draft:    { label: "Draft",  color: "#B45309", bg: "#FEF3C7", dot: "#F59E0B" },
  archived: { label: "Arsip",  color: "#64748B", bg: "#F1F5F9", dot: "#94A3B8" },
};

const TYPE_META: Record<QuestionType, { label: string; color: string; bg: string; icon: string }> = {
  single_choice: { label: "Pilihan Ganda", color: "#0284C7", bg: "#E0F4FD", icon: "🔘" },
  multi_select:  { label: "Multi-Pilih",  color: "#D97706", bg: "#FEF3C7", icon: "☑️" },
  latex:         { label: "Matematika",   color: "#7C3AED", bg: "#EDE9FE", icon: "🧮" },
};

// ─── Small UI Badges ──────────────────────────────────────────────────────────
function DiffBadge({ d }: { d: DifficultyLevel }) {
  const m = DIFFICULTY_META[d] || DIFFICULTY_META.medium;
  return (
    <span style={{ fontSize: "11px", fontWeight: 600, padding: "2px 8px", borderRadius: "99px", background: m.bg, color: m.color }}>
      {m.label}
    </span>
  );
}

function StatusBadge({ s }: { s: QuestionBankStatus }) {
  const m = STATUS_META[s] || STATUS_META.active;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "12px", fontWeight: 600, padding: "3px 10px", borderRadius: "99px", background: m.bg, color: m.color }}>
      <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: m.dot, flexShrink: 0 }} />
      {m.label}
    </span>
  );
}

function QuestionTypeBadge({ type }: { type: QuestionType }) {
  const m = TYPE_META[type] || TYPE_META.single_choice;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11px", fontWeight: 600, padding: "3px 9px", borderRadius: "99px", background: m.bg, color: m.color }}>
      <span>{m.icon}</span>
      <span>{m.label}</span>
    </span>
  );
}

// ─── Modal: Image Zoom ────────────────────────────────────────────────────────
function ImageZoomModal({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(15, 23, 42, 0.8)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: "24px",
      }}
    >
      <div onClick={e => e.stopPropagation()} style={{ position: "relative", maxWidth: "90vw", maxHeight: "90vh", background: "white", padding: "12px", borderRadius: "8px", boxShadow: "0 20px 40px rgba(0,0,0,0.3)" }}>
        <button
          onClick={onClose}
          style={{
            position: "absolute", top: "-12px", right: "-12px",
            width: "32px", height: "32px", borderRadius: "50%",
            background: "#1E293B", color: "white", border: "none", cursor: "pointer",
            fontSize: "14px", display: "flex", alignItems: "center", justifyContent: "center",
          }}
          aria-label="Tutup"
        >
          ✕
        </button>
        <img src={src} alt={alt} style={{ maxWidth: "85vw", maxHeight: "80vh", objectFit: "contain", borderRadius: "6px" }} />
        {alt && <div style={{ fontSize: "12px", color: "#64748B", marginTop: "8px", textAlign: "center" }}>{alt}</div>}
      </div>
    </div>
  );
}

// ─── Modal: Bank Soal (Folder Metadata) ───────────────────────────────────────
interface BankModalProps {
  initial?: QuestionBank | null;
  onClose: () => void;
  onSave: (data: Partial<QuestionBank>) => void;
}

function BankModal({ initial, onClose, onSave }: BankModalProps) {
  const [form, setForm] = useState({
    title: initial?.title ?? "",
    subject: initial?.subject ?? "",
    description: initial?.description ?? "",
    tags: initial?.tags.join(", ") ?? "",
    difficulty: (initial?.difficulty ?? "medium") as DifficultyLevel,
    status: (initial?.status ?? "draft") as QuestionBankStatus,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.title.trim()) e.title = "Judul folder bank soal wajib diisi";
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
          <span className="modal-title">{initial ? "✏️ Edit Folder Bank Soal" : "➕ Buat Folder Bank Soal Baru"}</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          <div className="form-group">
            <label className="form-label">Judul Bank Soal <span className="required">*</span></label>
            <input
              className={`form-input${errors.title ? " error" : ""}`}
              placeholder="Contoh: Soal UTS Pemrograman Web"
              value={form.title}
              onChange={e => set("title", e.target.value)}
              maxLength={200}
            />
            {errors.title && <span className="form-error">⚠️ {errors.title}</span>}
          </div>
          <div className="form-group">
            <label className="form-label">Mata Pelajaran / Mata Kuliah <span className="required">*</span></label>
            <input
              className={`form-input${errors.subject ? " error" : ""}`}
              placeholder="Contoh: Pemrograman Web"
              value={form.subject}
              onChange={e => set("subject", e.target.value)}
              maxLength={100}
            />
            {errors.subject && <span className="form-error">⚠️ {errors.subject}</span>}
          </div>
          <div className="form-group">
            <label className="form-label">Deskripsi (Opsional)</label>
            <textarea
              className="form-textarea"
              placeholder="Deskripsi singkat mengenai bank soal ini..."
              value={form.description}
              onChange={e => set("description", e.target.value)}
              rows={3}
              maxLength={500}
            />
            <div className="char-count">{form.description.length}/500</div>
          </div>
          <div className="form-group">
            <label className="form-label">Tags (pisahkan dengan koma)</label>
            <input
              className="form-input"
              placeholder="HTML, CSS, JavaScript"
              value={form.tags}
              onChange={e => set("tags", e.target.value)}
            />
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
          <button className="btn btn-primary btn-md" onClick={submit}>
            {initial ? "Simpan Perubahan" : "Buat Folder"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal: Move / Copy Question to Another Folder ────────────────────────────
interface MoveCopyModalProps {
  question: BankQuestion;
  banks: QuestionBank[];
  onClose: () => void;
  onMove: (targetBankId: string) => void;
  onCopy: (targetBankId: string) => void;
}

function MoveCopyModal({ question, banks, onClose, onMove, onCopy }: MoveCopyModalProps) {
  const [targetBankId, setTargetBankId] = useState(
    banks.find(b => b.id !== question.bankId)?.id || banks[0]?.id || ""
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: "460px" }}>
        <div className="modal-header">
          <span className="modal-title">📁 Pindah atau Salin Soal</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <p style={{ fontSize: "14px", color: "#475569", lineHeight: 1.6, margin: 0 }}>
            Pilih folder bank soal tujuan untuk soal: <br />
            <strong style={{ color: "#0F172A" }}>
              &ldquo;{question.questionText.slice(0, 70)}...&rdquo;
            </strong>
          </p>
          <div className="form-group">
            <label className="form-label">Pilih Folder Bank Soal Tujuan <span className="required">*</span></label>
            <select
              className="form-select"
              value={targetBankId}
              onChange={e => setTargetBankId(e.target.value)}
              style={{ width: "100%" }}
            >
              {banks.map(b => (
                <option key={b.id} value={b.id} disabled={b.id === question.bankId}>
                  {b.title} ({b.subject}) {b.id === question.bankId ? "— (Folder Sekarang)" : ""}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="modal-footer" style={{ justifyContent: "space-between" }}>
          <button className="btn btn-secondary btn-md" onClick={onClose}>Batal</button>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              className="btn btn-secondary btn-md"
              onClick={() => onCopy(targetBankId)}
              disabled={!targetBankId || targetBankId === question.bankId}
              title="Gandakan soal ke folder tujuan"
            >
              📋 Salin (Duplikat)
            </button>
            <button
              className="btn btn-primary btn-md"
              onClick={() => onMove(targetBankId)}
              disabled={!targetBankId || targetBankId === question.bankId}
              title="Pindahkan soal ke folder tujuan"
            >
              📁 Pindahkan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Modal: Create / Edit Question (Full Authoring Component) ──────────────────
interface QuestionModalProps {
  initial?: BankQuestion | null;
  defaultBankId: string;
  banks: QuestionBank[];
  onClose: () => void;
  onSave: (data: Omit<BankQuestion, "id" | "createdAt" | "updatedAt">, existingId?: string) => void;
}

function QuestionModal({ initial, defaultBankId, banks, onClose, onSave }: QuestionModalProps) {
  const [bankId, setBankId] = useState(initial?.bankId || defaultBankId || banks[0]?.id || "");
  const [type, setType] = useState<QuestionType>(initial?.type || "single_choice");
  const [questionText, setQuestionText] = useState(initial?.questionText || "");
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl || "");
  const [imageAlt, setImageAlt] = useState(initial?.imageAlt || "");
  const [points, setPoints] = useState(initial?.points || 10);
  const [hint, setHint] = useState(initial?.hint || "");
  const [previewTab, setPreviewTab] = useState(false);

  // Dynamic Options (2 to 6 options)
  const [options, setOptions] = useState<BankQuestionOption[]>(
    initial?.options && initial.options.length >= 2
      ? initial.options
      : [
          { id: "a", label: "A", text: "" },
          { id: "b", label: "B", text: "" },
          { id: "c", label: "C", text: "" },
          { id: "d", label: "D", text: "" },
        ]
  );

  // Correct answer state
  const [correctAnswer, setCorrectAnswer] = useState<string>(
    initial?.correctAnswer || (initial?.correctAnswers?.[0] ?? "a")
  );
  const [correctAnswers, setCorrectAnswers] = useState<Set<string>>(
    new Set(initial?.correctAnswers || (initial?.correctAnswer ? [initial.correctAnswer] : ["a"]))
  );

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showMathBar, setShowMathBar] = useState(false);
  const [showImageSection, setShowImageSection] = useState(Boolean(initial?.imageUrl));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Helper to re-index option labels (A, B, C, D, E, F)
  const reindexOptions = (opts: BankQuestionOption[]) => {
    return opts.map((opt, idx) => {
      const char = String.fromCharCode(97 + idx); // 'a', 'b', ...
      return {
        ...opt,
        id: char,
        label: char.toUpperCase(),
      };
    });
  };

  const handleAddOption = () => {
    if (options.length >= 6) return;
    const nextIdx = options.length;
    const char = String.fromCharCode(97 + nextIdx);
    setOptions([...options, { id: char, label: char.toUpperCase(), text: "" }]);
  };

  const handleRemoveOption = (indexToRemove: number) => {
    if (options.length <= 2) return;
    const remaining = options.filter((_, idx) => idx !== indexToRemove);
    // Buat mapping ID lama ke ID baru agar kunci jawaban tidak bergeser/rusak
    const idMap = new Map(remaining.map((opt, i) => [opt.id, String.fromCharCode(97 + i)]));
    const nextOptions = reindexOptions(remaining);
    setOptions(nextOptions);

    // Update single_choice / latex correctAnswer
    const mappedCorrect = idMap.get(correctAnswer);
    setCorrectAnswer(mappedCorrect || nextOptions[0].id);

    // Update multi_select correctAnswers
    const nextCorrectSet = new Set<string>();
    correctAnswers.forEach(oldId => {
      const mapped = idMap.get(oldId);
      if (mapped) nextCorrectSet.add(mapped);
    });
    if (nextCorrectSet.size === 0) nextCorrectSet.add(nextOptions[0].id);
    setCorrectAnswers(nextCorrectSet);
  };

  const handleOptionTextChange = (idx: number, text: string) => {
    setOptions(prev => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], text };
      return copy;
    });
  };

  const toggleMultiCorrect = (optId: string) => {
    setCorrectAnswers(prev => {
      const next = new Set(prev);
      if (next.has(optId)) {
        if (next.size > 1) next.delete(optId); // Minimal 1 jawaban benar
      } else {
        next.add(optId);
      }
      return next;
    });
  };

  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setErrors(p => ({ ...p, image: "Format berkas harus berupa gambar (PNG, JPG, WEBP, SVG)" }));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrors(p => ({ ...p, image: "Ukuran berkas asli maksimal 5MB" }));
      return;
    }

    setErrors(p => { const copy = { ...p }; delete copy.image; return copy; });
    const reader = new FileReader();
    reader.onload = evt => {
      const result = evt.target?.result as string;
      if (!result) return;

      if (file.type === "image/svg+xml") {
        setImageUrl(result);
        if (!imageAlt) setImageAlt(file.name.replace(/\.[^/.]+$/, ""));
        return;
      }

      // Kompresi bitmap via HTML5 Canvas agar efisien dan aman dari kuota LocalStorage (< 100KB)
      const img = new Image();
      img.onload = () => {
        const MAX_DIM = 900;
        let { width, height } = img;
        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL("image/jpeg", 0.8);
          setImageUrl(compressed);
        } else {
          setImageUrl(result);
        }
        if (!imageAlt) setImageAlt(file.name.replace(/\.[^/.]+$/, ""));
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
  };

  const questionTextareaRef = useRef<HTMLTextAreaElement>(null);
  const selectedBank = banks.find(b => b.id === bankId) || banks[0];

  const insertAtQuestionCursor = (snippet: string) => {
    if (!questionTextareaRef.current) {
      setQuestionText(prev => prev + snippet);
      return;
    }
    const el = questionTextareaRef.current;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const next = el.value.substring(0, start) + snippet + el.value.substring(end);
    setQuestionText(next);
    setTimeout(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = start + snippet.length;
    }, 0);
  };

  const insertOptionSnippet = (idx: number, snippet: string) => {
    setOptions(prev => {
      const copy = [...prev];
      const cur = copy[idx]?.text || "";
      copy[idx] = { ...copy[idx], text: cur ? `${cur} ${snippet}` : snippet };
      return copy;
    });
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!bankId) e.bankId = "Pilih folder bank soal tujuan";
    if (!questionText.trim()) e.questionText = "Teks soal tidak boleh kosong";
    if (points <= 0) e.points = "Poin harus bernilai positif";

    if (imageUrl && !/^(https?:\/\/|data:image\/)/i.test(imageUrl.trim())) {
      e.image = "URL gambar harus diawali dengan http://, https://, atau berkas gambar yang valid";
    }

    const emptyOptIndex = options.findIndex(o => !o.text.trim());
    if (emptyOptIndex !== -1) {
      e.options = `Pilihan jawaban ${options[emptyOptIndex].label} masih kosong`;
    }

    if (type === "multi_select") {
      if (correctAnswers.size === 0) {
        e.correctAnswer = "Pilih minimal 1 kunci jawaban benar untuk soal multi-pilih";
      }
    } else {
      if (!correctAnswer) {
        e.correctAnswer = "Pilih 1 kunci jawaban yang benar";
      }
    }

    return e;
  };

  const handleSubmit = () => {
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    onSave(
      {
        bankId,
        orderIndex: initial?.orderIndex || 1,
        type,
        questionText: questionText.trim(),
        imageUrl: imageUrl.trim() || null,
        imageAlt: imageAlt.trim() || null,
        options,
        correctAnswer: type !== "multi_select" ? correctAnswer : null,
        correctAnswers: type === "multi_select" ? Array.from(correctAnswers) : null,
        points: Number(points) || 10,
        hint: hint.trim() || null,
      },
      initial?.id
    );
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: "1120px", width: "95vw", height: "88vh", maxHeight: "88vh", display: "flex", flexDirection: "column", overflow: "hidden", background: "#FFFFFF", borderRadius: "12px", boxShadow: "0 20px 45px rgba(0,0,0,0.2)" }}>
        
        {/* Header */}
        <div className="modal-header" style={{ padding: "14px 20px", borderBottom: "1px solid #E2E8F0", flexShrink: 0, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: "16px", fontWeight: 700, color: "#0F172A" }}>
              {initial ? "✏️ Edit Butir Soal" : "➕ Buat Butir Soal Baru"}
            </div>
            <div style={{ fontSize: "12px", color: "#64748B", marginTop: "2px" }}>
              Ketik soal di sebelah kiri. Tampilan nyata lembar siswa langsung muncul di sebelah kanan.
            </div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Tutup">✕</button>
        </div>

        {/* Body (Two-Window Split View - Smooth Scrollable) */}
        <div className="modal-body" style={{ flex: "1 1 auto", minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "18px 20px" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(440px, 1fr))",
              gap: "20px",
              alignItems: "start",
            }}
          >
            {/* ─── WINDOW 1: EDITOR SOAL (PANEL KIRI) ───────────────────────── */}
            <div style={{ display: "flex", flexDirection: "column", gap: "14px", background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "16px" }}>
              
              {/* Pengaturan Soal (Folder, Bobot, Format, & Petunjuk) */}
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", paddingBottom: "12px", borderBottom: "1px solid #F1F5F9" }}>
                {/* Baris 1: Folder Bank Soal & Bobot Poin */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 130px", gap: "10px" }}>
                  <div>
                    <label className="form-label" style={{ fontWeight: 700, fontSize: "12px", marginBottom: "4px", color: "#1E293B" }}>
                      Folder Bank Soal <span className="required">*</span>
                    </label>
                    <select
                      className={`form-select${errors.bankId ? " error" : ""}`}
                      value={bankId}
                      onChange={e => setBankId(e.target.value)}
                      style={{ height: "34px", fontSize: "12px", width: "100%" }}
                    >
                      {banks.map(b => (
                        <option key={b.id} value={b.id}>
                          {b.title} ({b.subject})
                        </option>
                      ))}
                    </select>
                    {errors.bankId && <span className="form-error">⚠️ {errors.bankId}</span>}
                  </div>

                  <div>
                    <label className="form-label" style={{ fontWeight: 700, fontSize: "12px", marginBottom: "4px", color: "#1E293B" }}>
                      Bobot (Poin) <span className="required">*</span>
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      className={`form-input${errors.points ? " error" : ""}`}
                      value={points}
                      onChange={e => setPoints(parseInt(e.target.value, 10) || 1)}
                      style={{ height: "34px", fontSize: "12px", width: "100%" }}
                    />
                    {errors.points && <span className="form-error">⚠️ {errors.points}</span>}
                  </div>
                </div>

                {/* Baris 2: Format Pilihan & Petunjuk Singkat */}
                <div style={{ display: "flex", gap: "12px", alignItems: "flex-end", flexWrap: "wrap" }}>
                  <div style={{ flex: "0 0 auto" }}>
                    <label style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", display: "block", marginBottom: "4px" }}>
                      Format Pilihan
                    </label>
                    <div style={{ display: "flex", gap: "6px" }}>
                      {[
                        { id: "single_choice" as QuestionType, label: "🔘 Pilihan Ganda" },
                        { id: "multi_select" as QuestionType, label: "☑️ Multi-Pilih" },
                      ].map(t => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setType(t.id)}
                          style={{
                            padding: "4px 9px",
                            borderRadius: "5px",
                            border: `1.5px solid ${type === t.id ? THEME.primary : "#CBD5E1"}`,
                            background: type === t.id ? THEME.primaryTint : "#FFFFFF",
                            color: type === t.id ? THEME.primary : "#475569",
                            fontSize: "11px",
                            fontWeight: type === t.id ? 700 : 500,
                            cursor: "pointer",
                          }}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ flex: "1 1 180px" }}>
                    <label style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", display: "block", marginBottom: "4px" }}>
                      Petunjuk / Pembahasan (Opsional)
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Catatan pembahasan jawaban..."
                      value={hint}
                      onChange={e => setHint(e.target.value)}
                      style={{ height: "32px", fontSize: "12px", width: "100%" }}
                    />
                  </div>
                </div>
              </div>

              {/* Pertanyaan Soal */}
              <div className="form-group" style={{ margin: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <label className="form-label" style={{ fontWeight: 700, fontSize: "13px", margin: 0, color: "#1E293B" }}>
                    Pertanyaan Soal <span className="required">*</span>
                  </label>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button
                      type="button"
                      onClick={() => setShowMathBar(!showMathBar)}
                      style={{
                        fontSize: "11px",
                        fontWeight: 600,
                        padding: "3px 8px",
                        borderRadius: "5px",
                        border: `1px solid ${showMathBar ? "#1B76BF" : "#CBD5E1"}`,
                        background: showMathBar ? "#EFF6FF" : "#FFFFFF",
                        color: showMathBar ? "#1B76BF" : "#475569",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                      title="Buka atau tutup tombol simbol rumus matematika"
                    >
                      <span>📐</span>
                      <span>{showMathBar ? "Tutup Rumus" : "Simbol Rumus"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowImageSection(!showImageSection)}
                      style={{
                        fontSize: "11px",
                        fontWeight: 600,
                        padding: "3px 8px",
                        borderRadius: "5px",
                        border: `1px solid ${showImageSection ? "#D97706" : "#CBD5E1"}`,
                        background: showImageSection ? "#FEF3C7" : "#FFFFFF",
                        color: showImageSection ? "#B45309" : "#475569",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                      title="Lampirkan gambar untuk butir soal ini"
                    >
                      <span>🖼️</span>
                      <span>{showImageSection ? "Tutup Gambar" : imageUrl ? "Ubah Gambar" : "Gambar"}</span>
                    </button>
                  </div>
                </div>

                <textarea
                  ref={questionTextareaRef}
                  className={`form-textarea${errors.questionText ? " error" : ""}`}
                  placeholder="Ketik pertanyaan soal di sini... (contoh: Berapakah hasil dari 1/2 + 3/4?)"
                  value={questionText}
                  onChange={e => setQuestionText(e.target.value)}
                  rows={4}
                  style={{ width: "100%", fontSize: "14px", lineHeight: 1.6, padding: "10px 12px", borderRadius: "8px" }}
                />
                {errors.questionText && <span className="form-error">⚠️ {errors.questionText}</span>}

                {/* Toolbar Simbol Rumus */}
                {showMathBar && (
                  <div style={{ marginTop: "8px" }}>
                    <MathQuickBar onInsert={insertAtQuestionCursor} onClose={() => setShowMathBar(false)} />
                  </div>
                )}
              </div>

              {/* Panel Gambar (Hanya jika dibuka / jika ada gambar) */}
              {showImageSection && (
                <div style={{ background: "#FFFBEB", padding: "12px", borderRadius: "8px", border: "1px solid #FDE68A", display: "flex", flexDirection: "column", gap: "8px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "12px", fontWeight: 700, color: "#92400E" }}>
                      🖼️ Lampiran Gambar Soal
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowImageSection(false)}
                      style={{ background: "none", border: "none", color: "#B45309", fontSize: "11px", cursor: "pointer", fontWeight: 600 }}
                    >
                      ✕ Tutup
                    </button>
                  </div>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="URL Gambar (https://...) atau klik berkas"
                      value={imageUrl}
                      onChange={e => setImageUrl(e.target.value)}
                      style={{ flex: 1, minWidth: "160px", height: "34px", fontSize: "12px" }}
                    />
                    <label
                      style={{
                        display: "inline-flex", alignItems: "center", gap: "4px",
                        padding: "0 10px", height: "34px", borderRadius: "6px",
                        background: "#FFFFFF", border: "1px solid #CBD5E1",
                        fontSize: "12px", fontWeight: 600, color: "#334155",
                        cursor: "pointer",
                      }}
                    >
                      <span>📁 Berkas</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/svg+xml"
                        onChange={handleImageFile}
                        style={{ display: "none" }}
                      />
                    </label>
                    {imageUrl && (
                      <button
                        type="button"
                        onClick={() => { setImageUrl(""); setImageAlt(""); }}
                        style={{ background: "none", border: "none", color: "#DC2626", fontSize: "12px", cursor: "pointer", fontWeight: 600 }}
                      >
                        ✕ Hapus
                      </button>
                    )}
                  </div>
                  {imageUrl && (
                    <div style={{ display: "flex", gap: "10px", alignItems: "center", marginTop: "2px" }}>
                      <img
                        src={imageUrl}
                        alt={imageAlt || "Preview"}
                        style={{ width: "70px", height: "48px", objectFit: "cover", borderRadius: "4px", border: "1px solid #CBD5E1", background: "white" }}
                      />
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Keterangan gambar (opsional)"
                        value={imageAlt}
                        onChange={e => setImageAlt(e.target.value)}
                        style={{ flex: 1, height: "30px", fontSize: "12px" }}
                      />
                    </div>
                  )}
                  {errors.image && <span className="form-error">⚠️ {errors.image}</span>}
                </div>
              )}

              {/* Pilihan Jawaban (A, B, C, D) */}
              <div className="form-group" style={{ margin: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "6px" }}>
                  <div>
                    <label className="form-label" style={{ fontWeight: 700, fontSize: "13px", margin: 0, color: "#1E293B" }}>
                      Pilihan Jawaban & Kunci Jawaban <span className="required">*</span>
                    </label>
                    <div style={{ fontSize: "11px", color: "#64748B", marginTop: "1px" }}>
                      {type === "multi_select"
                        ? "Centang kotak pada pilihan yang merupakan jawaban benar:"
                        : "Klik bulatan radio pada pilihan yang merupakan kunci jawaban benar:"}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddOption}
                    disabled={options.length >= 6}
                    style={{
                      fontSize: "11px", fontWeight: 600, padding: "3px 8px", borderRadius: "5px",
                      background: options.length >= 6 ? "#F1F5F9" : THEME.primaryTint,
                      color: options.length >= 6 ? "#94A3B8" : THEME.primary,
                      border: "1px solid " + (options.length >= 6 ? "#E2E8F0" : "#BAE6FD"),
                      cursor: options.length >= 6 ? "not-allowed" : "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    + Tambah ({options.length}/6)
                  </button>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {options.map((opt, idx) => {
                    const isCorrect = type === "multi_select"
                      ? correctAnswers.has(opt.id)
                      : correctAnswer === opt.id;

                    const optHasMath = hasNaturalOrLatexMath(opt.text);

                    return (
                      <div
                        key={opt.id}
                        style={{
                          display: "flex", flexDirection: "column", gap: "3px",
                          padding: "6px 10px", borderRadius: "6px",
                          border: `1.5px solid ${isCorrect ? "#10B981" : "#E2E8F0"}`,
                          background: isCorrect ? "#F0FDF4" : "#FFFFFF",
                          transition: "all 0.15s",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          {/* Radio / Checkbox Selector */}
                          {type === "multi_select" ? (
                            <input
                              type="checkbox"
                              checked={isCorrect}
                              onChange={() => toggleMultiCorrect(opt.id)}
                              style={{ width: "18px", height: "18px", accentColor: "#10B981", cursor: "pointer" }}
                              title="Tandai sebagai jawaban benar"
                            />
                          ) : (
                            <input
                              type="radio"
                              name="correct-option-group"
                              checked={isCorrect}
                              onChange={() => setCorrectAnswer(opt.id)}
                              style={{ width: "18px", height: "18px", accentColor: "#10B981", cursor: "pointer" }}
                              title="Tandai sebagai kunci jawaban benar"
                            />
                          )}

                          {/* Huruf Opsi (A, B, C...) */}
                          <span
                            style={{
                              width: "24px", height: "24px", borderRadius: "50%",
                              background: isCorrect ? "#10B981" : "#F1F5F9",
                              color: isCorrect ? "white" : "#475569",
                              fontSize: "11px", fontWeight: 700,
                              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                            }}
                          >
                            {opt.label}
                          </span>

                          {/* Input Teks */}
                          <div style={{ flex: 1 }}>
                            <input
                              type="text"
                              className="form-input"
                              placeholder={`Teks pilihan ${opt.label}... (misal: 1/2 atau 2x^2)`}
                              value={opt.text}
                              onChange={e => handleOptionTextChange(idx, e.target.value)}
                              style={{ height: "34px", fontSize: "13px" }}
                            />
                          </div>

                          {/* Tombol Hapus Opsi */}
                          <button
                            type="button"
                            onClick={() => handleRemoveOption(idx)}
                            disabled={options.length <= 2}
                            style={{
                              width: "26px", height: "26px", borderRadius: "5px",
                              border: "1px solid #E2E8F0", background: "white",
                              color: options.length <= 2 ? "#CBD5E1" : "#EF4444",
                              cursor: options.length <= 2 ? "not-allowed" : "pointer",
                              display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px",
                            }}
                            title={options.length <= 2 ? "Minimal 2 pilihan" : "Hapus opsi ini"}
                          >
                            ✕
                          </button>
                        </div>

                        {/* Inline preview jika opsi memuat rumus */}
                        {optHasMath && (
                          <div
                            style={{
                              marginLeft: "32px",
                              fontSize: "11px",
                              color: "#334155",
                              padding: "2px 6px",
                              background: "#F8FAFC",
                              borderRadius: "4px",
                              border: "1px dashed #CBD5E1",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              alignSelf: "flex-start",
                            }}
                          >
                            <span style={{ fontSize: "10px", color: "#1B76BF", fontWeight: 700 }}>
                              Rumus:
                            </span>
                            <LatexRenderer text={opt.text} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {errors.options && <span className="form-error">⚠️ {errors.options}</span>}
                {errors.correctAnswer && <span className="form-error">⚠️ {errors.correctAnswer}</span>}
              </div>
            </div>

            {/* ─── WINDOW 2: LEMBAR SISWA (PANEL KANAN) ─────────────────────── */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                position: "sticky",
                top: 0,
              }}
            >
              {/* Header Lembar Siswa */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "13px", fontWeight: 700, color: "#334155", display: "flex", alignItems: "center", gap: "6px" }}>
                  <span>📄 Lembar Tampilan Siswa</span>
                </span>
                <span style={{ fontSize: "11px", fontWeight: 600, background: "#EFF6FF", color: "#1D4ED8", padding: "2px 8px", borderRadius: "99px", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#2563EB" }} />
                  Hasil Nyata
                </span>
              </div>

              {/* Card Kertas Ujian Siswa */}
              <div
                style={{
                  background: "#FFFFFF",
                  border: "1.5px solid #CBD5E1",
                  borderRadius: "10px",
                  padding: "16px",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                {/* Meta Top Bar */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "8px", borderBottom: "1px solid #F1F5F9" }}>
                  <span style={{ fontSize: "12px", fontWeight: 600, color: "#64748B" }}>
                    📚 {selectedBank?.title || "Bank Soal"}
                  </span>
                  <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                    <QuestionTypeBadge type={type} />
                    <span style={{ fontSize: "11px", fontWeight: 700, background: "#F1F5F9", color: "#475569", padding: "2px 6px", borderRadius: "99px" }}>
                      {points} Poin
                    </span>
                  </div>
                </div>

                {/* Teks Pertanyaan */}
                <div
                  style={{
                    fontSize: "14px",
                    color: "#1E293B",
                    lineHeight: 1.7,
                    minHeight: "44px",
                    padding: "8px 10px",
                    background: "#F8FAFC",
                    borderRadius: "6px",
                  }}
                >
                  {questionText.trim() ? (
                    <LatexRenderer text={questionText} block />
                  ) : (
                    <span style={{ color: "#94A3B8", fontStyle: "italic", fontSize: "12px" }}>
                      Pertanyaan yang Anda ketik akan langsung tampil di sini...
                    </span>
                  )}
                </div>

                {/* Gambar (jika ada) */}
                {imageUrl && (
                  <img
                    src={imageUrl}
                    alt={imageAlt || "Lampiran Soal"}
                    style={{ maxWidth: "100%", maxHeight: "160px", objectFit: "contain", borderRadius: "6px", border: "1px solid #E2E8F0" }}
                  />
                )}

                {/* Pilihan Siswa */}
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {options.map(opt => {
                    const isCorrect = type === "multi_select"
                      ? correctAnswers.has(opt.id)
                      : correctAnswer === opt.id;

                    return (
                      <div
                        key={opt.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          padding: "6px 10px",
                          borderRadius: "6px",
                          border: `1.5px solid ${isCorrect ? "#10B981" : "#E2E8F0"}`,
                          background: isCorrect ? "#F0FDF4" : "#FFFFFF",
                          fontSize: "13px",
                        }}
                      >
                        <span
                          style={{
                            width: "20px",
                            height: "20px",
                            borderRadius: "50%",
                            background: isCorrect ? "#10B981" : "#F1F5F9",
                            color: isCorrect ? "white" : "#475569",
                            fontSize: "10px",
                            fontWeight: 700,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          {opt.label}
                        </span>
                        <div style={{ flex: 1, color: isCorrect ? "#065F46" : "#1E293B", fontWeight: isCorrect ? 600 : 400 }}>
                          {opt.text.trim() ? (
                            <LatexRenderer text={opt.text} />
                          ) : (
                            <span style={{ color: "#94A3B8", fontStyle: "italic", fontSize: "12px" }}>
                              (Opsi {opt.label})
                            </span>
                          )}
                        </div>
                        {isCorrect && (
                          <span style={{ fontSize: "10px", fontWeight: 700, color: "#059669", background: "#D1FAE5", padding: "1px 6px", borderRadius: "99px", flexShrink: 0 }}>
                            ✓ Kunci
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Hint jika diisi */}
                {hint.trim() && (
                  <div style={{ background: "#F5F3FF", border: "1px solid #DDD6FE", borderRadius: "6px", padding: "6px 8px", fontSize: "11px", color: "#5B21B6", display: "flex", alignItems: "center", gap: "6px" }}>
                    <span>💡</span>
                    <LatexRenderer text={hint} />
                  </div>
                )}
              </div>

              <div style={{ fontSize: "11px", color: "#64748B", paddingLeft: "4px" }}>
                💡 Rumus seperti 1/2, 2*2, 2^2, sin, lim otomatis tertata rapi persis seperti di lembar ini.
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="modal-footer" style={{ borderTop: "1px solid #E2E8F0", padding: "12px 20px", display: "flex", justifyContent: "flex-end", gap: "10px", flexShrink: 0 }}>
          <button className="btn btn-secondary btn-md" onClick={onClose}>Batal</button>
          <button className="btn btn-primary btn-md" onClick={handleSubmit}>
            {initial ? "Simpan Perubahan" : "Simpan Soal"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal: Delete Confirmation ───────────────────────────────────────────────
function DeleteModal({ title, message, onClose, onConfirm }: {
  title: string;
  message: React.ReactNode;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: "440px" }}>
        <div className="modal-header">
          <span className="modal-title" style={{ color: "#DC2626" }}>🗑️ {title}</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: "14px", color: "#475569", lineHeight: 1.7, margin: 0 }}>
            {message}
          </p>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary btn-md" onClick={onClose}>Batal</button>
          <button
            style={{
              background: "#DC2626", color: "white", borderRadius: "6px",
              padding: "0 20px", height: "40px", fontWeight: 600, border: "none",
              cursor: "pointer", fontSize: "14px",
            }}
            onClick={onConfirm}
          >
            Ya, Hapus
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Question Bank Dashboard Page ────────────────────────────────────────
export default function QuestionBankPage() {
  const [banks, setBanks] = useState<QuestionBank[]>([]);
  const [questions, setQuestions] = useState<BankQuestion[]>([]);
  const [activeBankId, setActiveBankId] = useState<string | null>(null);

  // Search & Filter state
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | QuestionBankStatus>("all");
  const [filterDiff, setFilterDiff] = useState<"all" | DifficultyLevel>("all");
  const [questionTypeFilter, setQuestionTypeFilter] = useState<"all" | QuestionType | "image">("all");

  // Modals state
  const [showBankModal, setShowBankModal] = useState(false);
  const [editBankTarget, setEditBankTarget] = useState<QuestionBank | null>(null);
  const [deleteBankTarget, setDeleteBankTarget] = useState<QuestionBank | null>(null);

  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [editQuestionTarget, setEditQuestionTarget] = useState<BankQuestion | null>(null);
  const [deleteQuestionTarget, setDeleteQuestionTarget] = useState<BankQuestion | null>(null);
  const [moveQuestionTarget, setMoveQuestionTarget] = useState<BankQuestion | null>(null);
  const [zoomImage, setZoomImage] = useState<{ src: string; alt: string } | null>(null);
  const [showImportXmlModal, setShowImportXmlModal] = useState(false);

  const [toast, setToast] = useState<{ type: string; msg: string } | null>(null);
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = useCallback((msg: string, type = "success") => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ type, msg });
    toastTimerRef.current = setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  // Handlers: XML Export & Import
  const handleExportBankXml = (bank: QuestionBank) => {
    try {
      const xmlStr = exportBankToXml(bank, questions);
      const safeTitle = bank.title.replace(/[^a-zA-Z0-9_\u00C0-\u017F-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "Bank-Soal";
      const dateStr = new Date().toISOString().slice(0, 10);
      downloadXmlFile(xmlStr, `Bank-Soal-${safeTitle}-${dateStr}.xml`);
      showToast(`Berhasil mengekspor bank soal "${bank.title}" ke berkas XML!`);
    } catch (err: any) {
      showToast(`Gagal mengekspor: ${err?.message || "Kesalahan sistem"}`, "error");
    }
  };

  const handleExportAllXml = () => {
    try {
      if (banks.length === 0) {
        showToast("Belum ada bank soal untuk diekspor", "error");
        return;
      }
      const xmlStr = exportAllBanksToXml(banks, questions);
      const dateStr = new Date().toISOString().slice(0, 10);
      downloadXmlFile(xmlStr, `Semua-Bank-Soal-LockIt-${dateStr}.xml`);
      showToast(`Berhasil mengekspor seluruh ${banks.length} bank soal ke berkas XML!`);
    } catch (err: any) {
      showToast(`Gagal mengekspor: ${err?.message || "Kesalahan sistem"}`, "error");
    }
  };

  const handleImportXmlSuccess = ({ message, targetBankId }: { message: string; targetBankId: string }) => {
    const freshBanks = getStoredQuestionBanks();
    const freshQuestions = getStoredQuestions();
    setBanks(freshBanks);
    setQuestions(freshQuestions);
    setActiveBankId(targetBankId);
    showToast(message);
  };

  // Initialize from LocalStorage
  useEffect(() => {
    const loadedBanks = getStoredQuestionBanks();
    const loadedQuestions = getStoredQuestions();
    setBanks(loadedBanks);
    setQuestions(loadedQuestions);
  }, []);

  // Active bank object if in folder view
  const currentBank = useMemo(() => {
    return banks.find(b => b.id === activeBankId) || null;
  }, [banks, activeBankId]);

  // Questions filtered for current folder
  const currentBankQuestions = useMemo(() => {
    if (!activeBankId) return [];
    return questions.filter(q => q.bankId === activeBankId);
  }, [questions, activeBankId]);

  // Questions filtered by search & type inside active folder
  const filteredQuestions = useMemo(() => {
    return currentBankQuestions.filter(q => {
      const matchSearch =
        !search ||
        q.questionText.toLowerCase().includes(search.toLowerCase()) ||
        q.options.some(opt => opt.text.toLowerCase().includes(search.toLowerCase()));

      let matchType = true;
      if (questionTypeFilter === "image") {
        matchType = !!q.imageUrl;
      } else if (questionTypeFilter !== "all") {
        matchType = q.type === questionTypeFilter;
      }

      return matchSearch && matchType;
    });
  }, [currentBankQuestions, search, questionTypeFilter]);

  // Filtered bank folders in overview mode
  const filteredBanks = useMemo(() => {
    return banks.filter(b => {
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        b.title.toLowerCase().includes(q) ||
        b.subject.toLowerCase().includes(q) ||
        b.tags.some(t => t.toLowerCase().includes(q));
      const matchStatus = filterStatus === "all" || b.status === filterStatus;
      const matchDiff = filterDiff === "all" || b.difficulty === filterDiff;
      return matchSearch && matchStatus && matchDiff;
    });
  }, [banks, search, filterStatus, filterDiff]);

  // Statistics
  const stats = useMemo(() => ({
    totalBanks: banks.length,
    activeBanks: banks.filter(b => b.status === "active").length,
    totalQuestions: questions.length,
    singleChoice: questions.filter(q => q.type === "single_choice").length,
    multiSelect: questions.filter(q => q.type === "multi_select").length,
    latexCount: questions.filter(q => q.type === "latex").length,
  }), [banks, questions]);

  // ── Handlers: Bank Folders ──────────────────────────────────────────────────
  const handleSaveBank = (data: Partial<QuestionBank>, existing?: QuestionBank | null) => {
    let nextBanks: QuestionBank[];
    const today = new Date().toISOString().slice(0, 10);

    if (existing) {
      nextBanks = banks.map(b => (b.id === existing.id ? { ...b, ...data, updatedAt: today } : b));
      showToast("Folder bank soal berhasil diperbarui");
    } else {
      const newBank: QuestionBank = {
        id: `qb-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        title: data.title!,
        subject: data.subject!,
        description: data.description ?? null,
        tags: data.tags ?? [],
        difficulty: data.difficulty ?? "medium",
        status: data.status ?? "draft",
        questionCount: 0,
        totalPoints: 0,
        usedInExams: 0,
        createdAt: today,
        updatedAt: today,
        createdBy: "Dr. Ahmad Fauzi, S.T.",
      };
      nextBanks = [newBank, ...banks];
      showToast("Folder bank soal baru berhasil dibuat!");
      setActiveBankId(newBank.id); // Langsung buka folder baru
    }

    setBanks(nextBanks);
    saveStoredQuestionBanks(nextBanks);
  };

  const handleDeleteBank = (id: string) => {
    const nextBanks = banks.filter(b => b.id !== id);
    const nextQuestions = questions.filter(q => q.bankId !== id);
    setBanks(nextBanks);
    setQuestions(nextQuestions);
    saveStoredQuestionBanks(nextBanks);
    saveStoredQuestions(nextQuestions);
    setDeleteBankTarget(null);
    if (activeBankId === id) setActiveBankId(null);
    showToast("Folder bank soal beserta butir soal di dalamnya berhasil dihapus");
  };

  // ── Handlers: Questions ─────────────────────────────────────────────────────
  const handleSaveQuestion = (
    data: Omit<BankQuestion, "id" | "createdAt" | "updatedAt">,
    existingId?: string
  ) => {
    if (existingId) {
      const { question: updated, banks: updatedBanks } = updateQuestionInBank(existingId, data);
      if (updated) {
        setQuestions(prev => prev.map(q => q.id === existingId ? updated : q));
        setBanks(updatedBanks);
        showToast("Soal berhasil diperbarui");
      }
    } else {
      const { question: created, banks: updatedBanks } = addQuestionToBank(data);
      setQuestions(prev => [created, ...prev]);
      setBanks(updatedBanks);
      showToast("Butir soal baru berhasil ditambahkan!");
      if (activeBankId !== data.bankId) {
        setActiveBankId(data.bankId); // Pindah ke folder target jika dibuat di folder lain
      }
    }
  };

  const handleDeleteQuestion = (id: string) => {
    const { banks: updatedBanks } = deleteQuestionFromBank(id);
    setQuestions(prev => prev.filter(q => q.id !== id));
    setBanks(updatedBanks);
    setDeleteQuestionTarget(null);
    showToast("Soal berhasil dihapus");
  };

  const handleDuplicateQuestion = (id: string, targetBankId?: string) => {
    const { question: dup, banks: updatedBanks } = duplicateQuestionInBank(id, targetBankId);
    if (dup) {
      setQuestions(prev => [dup, ...prev]);
      setBanks(updatedBanks);
      showToast("Soal berhasil digandakan");
    }
  };

  const handleMoveQuestion = (id: string, targetBankId: string) => {
    const { question: moved, banks: updatedBanks } = moveQuestionToBank(id, targetBankId);
    if (moved) {
      setQuestions(prev => prev.map(q => q.id === id ? moved : q));
      setBanks(updatedBanks);
      setMoveQuestionTarget(null);
      showToast("Soal berhasil dipindahkan ke folder tujuan");
    }
  };

  return (
    <DashboardShell>
      {/* Zoom Modal */}
      {zoomImage && (
        <ImageZoomModal
          src={zoomImage.src}
          alt={zoomImage.alt}
          onClose={() => setZoomImage(null)}
        />
      )}

      {/* Page Container */}
      <div style={{ padding: "32px", maxWidth: "1180px", margin: "0 auto" }}>
        
        {/* Breadcrumb Navigation */}
        <div className="breadcrumb" style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "#64748B", marginBottom: "16px" }}>
          <Link href="/dashboard" style={{ color: "#64748B", textDecoration: "none" }}>Dashboard</Link>
          <span className="breadcrumb-sep">›</span>
          {activeBankId && currentBank ? (
            <>
              <button
                type="button"
                onClick={() => setActiveBankId(null)}
                style={{ background: "none", border: "none", color: THEME.primary, cursor: "pointer", padding: 0, fontSize: "13px", fontWeight: 500 }}
              >
                Bank Soal
              </button>
              <span className="breadcrumb-sep">›</span>
              <span className="breadcrumb-current" style={{ fontWeight: 600, color: "#0F172A" }}>
                {currentBank.title}
              </span>
            </>
          ) : (
            <span className="breadcrumb-current" style={{ fontWeight: 600, color: "#0F172A" }}>
              Bank Soal
            </span>
          )}
        </div>

        {/* ── MODE 1: OVERVIEW FOLDER BANK SOAL ────────────────────────────── */}
        {!activeBankId && (
          <>
            {/* Page Header */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
              <div>
                <h1 className="text-h1" style={{ fontSize: "26px", fontWeight: 800, color: "#0F172A", margin: "0 0 4px 0" }}>
                  📚 Bank Soal & Manajemen Soal
                </h1>
                <p style={{ fontSize: "14px", color: "#64748B", margin: 0 }}>
                  Kelola kumpulan soal per mata kuliah, buat butir soal baru langsung di website, dan kelola antar-folder.
                </p>
              </div>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <button
                  className="btn btn-secondary btn-md"
                  onClick={() => setShowImportXmlModal(true)}
                  style={{ display: "flex", alignItems: "center", gap: "6px" }}
                  title="Impor butir soal dari berkas XML"
                >
                  📥 Impor XML
                </button>
                <button
                  className="btn btn-secondary btn-md"
                  onClick={handleExportAllXml}
                  style={{ display: "flex", alignItems: "center", gap: "6px" }}
                  title="Ekspor seluruh bank soal beserta butir-butir soalnya ke dalam satu berkas XML"
                >
                  📤 Ekspor Semua (XML)
                </button>
                <button
                  className="btn btn-secondary btn-md"
                  onClick={() => setShowBankModal(true)}
                  style={{ display: "flex", alignItems: "center", gap: "6px" }}
                >
                  📁 + Buat Folder Baru
                </button>
                <button
                  className="btn btn-primary btn-md"
                  onClick={() => {
                    setEditQuestionTarget(null);
                    setShowQuestionModal(true);
                  }}
                  style={{ display: "flex", alignItems: "center", gap: "6px" }}
                >
                  ➕ Buat Soal Baru
                </button>
              </div>
            </div>

            {/* Quick Stats Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "14px", marginBottom: "24px" }}>
              {[
                { label: "Total Bank Soal", value: stats.totalBanks, icon: "📚", color: THEME.primary, bg: THEME.primaryTint },
                { label: "Total Butir Soal", value: stats.totalQuestions, icon: "📝", color: "#059669", bg: "#D1FAE5" },
                { label: "Pilihan Ganda", value: stats.singleChoice, icon: "🔘", color: "#0284C7", bg: "#E0F4FD" },
                { label: "Multi-Pilih & LaTeX", value: stats.multiSelect + stats.latexCount, icon: "🧮", color: "#7C3AED", bg: "#EDE9FE" },
              ].map(s => (
                <div key={s.label} className="card" style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: "14px" }}>
                  <div style={{ width: "44px", height: "44px", borderRadius: "10px", background: s.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", flexShrink: 0 }}>
                    {s.icon}
                  </div>
                  <div>
                    <div style={{ fontSize: "22px", fontWeight: 800, color: "#0F172A" }}>{s.value}</div>
                    <div style={{ fontSize: "12px", color: "#64748B", marginTop: "2px" }}>{s.label}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Filters Bar */}
            <div className="card" style={{ marginBottom: "20px" }}>
              <div style={{ padding: "14px 20px", display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
                <div style={{ position: "relative", flex: "1 1 240px" }}>
                  <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", fontSize: "14px", color: "#94A3B8", pointerEvents: "none" }}>🔍</span>
                  <input
                    className="form-input"
                    style={{ paddingLeft: "36px", height: "38px" }}
                    placeholder="Cari nama folder, mata kuliah, atau tag..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>
                <select
                  className="form-select"
                  style={{ width: "160px", height: "38px" }}
                  value={filterStatus}
                  onChange={e => setFilterStatus(e.target.value as typeof filterStatus)}
                >
                  <option value="all">Semua Status</option>
                  <option value="active">Aktif</option>
                  <option value="draft">Draft</option>
                  <option value="archived">Arsip</option>
                </select>
                <select
                  className="form-select"
                  style={{ width: "170px", height: "38px" }}
                  value={filterDiff}
                  onChange={e => setFilterDiff(e.target.value as typeof filterDiff)}
                >
                  <option value="all">Semua Kesulitan</option>
                  <option value="easy">Mudah</option>
                  <option value="medium">Sedang</option>
                  <option value="hard">Sulit</option>
                  <option value="mixed">Campuran</option>
                </select>
                {(search || filterStatus !== "all" || filterDiff !== "all") && (
                  <button className="btn btn-ghost btn-sm" onClick={() => { setSearch(""); setFilterStatus("all"); setFilterDiff("all"); }}>
                    ✕ Reset
                  </button>
                )}
                <span style={{ marginLeft: "auto", fontSize: "13px", color: "#64748B", whiteSpace: "nowrap" }}>
                  {filteredBanks.length} dari {banks.length} folder
                </span>
              </div>
            </div>

            {/* Bank Folders Cards */}
            {filteredBanks.length === 0 ? (
              <div className="card" style={{ padding: "48px 24px", textAlign: "center" }}>
                <div style={{ fontSize: "36px", marginBottom: "12px" }}>🔍</div>
                <div style={{ fontSize: "16px", fontWeight: 700, color: "#0F172A", marginBottom: "6px" }}>
                  Tidak ada folder bank soal ditemukan
                </div>
                <div style={{ fontSize: "14px", color: "#64748B", marginBottom: "16px" }}>
                  Coba sesuaikan kata kunci pencarian atau buat folder baru.
                </div>
                <button className="btn btn-primary btn-md" onClick={() => setShowBankModal(true)}>
                  + Buat Folder Baru
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {filteredBanks.map(bank => {
                  const bankQuestionsCount = questions.filter(q => q.bankId === bank.id).length;
                  return (
                    <div
                      key={bank.id}
                      className="card"
                      style={{ transition: "all 0.15s ease", border: "1px solid #E2E8F0" }}
                    >
                      <div style={{ padding: "18px 22px", display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
                        <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: THEME.primaryTint, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px", flexShrink: 0 }}>
                          📚
                        </div>

                        {/* Title & Meta */}
                        <div style={{ flex: 1, minWidth: "200px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px", flexWrap: "wrap" }}>
                            <span style={{ fontSize: "16px", fontWeight: 700, color: "#0F172A" }}>
                              {bank.title}
                            </span>
                            <StatusBadge s={bank.status} />
                            <DiffBadge d={bank.difficulty} />
                          </div>
                          <div style={{ fontSize: "13px", color: "#64748B", marginBottom: "6px" }}>
                            Mata Pelajaran: <strong>{bank.subject}</strong>
                          </div>
                          {bank.tags.length > 0 && (
                            <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                              {bank.tags.map(t => (
                                <span key={t} style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "99px", background: "#F1F5F9", color: "#475569" }}>
                                  {t}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Counts */}
                        <div style={{ display: "flex", gap: "24px", alignItems: "center", flexShrink: 0 }}>
                          <div style={{ textAlign: "center" }}>
                            <div style={{ fontSize: "18px", fontWeight: 800, color: THEME.primary }}>
                              {bankQuestionsCount}
                            </div>
                            <div style={{ fontSize: "11px", color: "#64748B" }}>Soal</div>
                          </div>
                          <div style={{ textAlign: "center" }}>
                            <div style={{ fontSize: "18px", fontWeight: 800, color: "#0F172A" }}>
                              {bank.totalPoints}
                            </div>
                            <div style={{ fontSize: "11px", color: "#64748B" }}>Poin</div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexShrink: 0 }}>
                          <button
                            className="btn btn-primary btn-sm"
                            style={{ padding: "6px 14px", fontWeight: 600, display: "flex", alignItems: "center", gap: "6px" }}
                            onClick={() => {
                              setActiveBankId(bank.id);
                              setSearch("");
                            }}
                          >
                            <span>📂 Buka & Kelola Soal</span>
                          </button>
                          <button
                            title="Ekspor Folder Bank Soal Ini ke Berkas XML"
                            className="btn btn-secondary btn-sm"
                            style={{ padding: "6px 10px", display: "flex", alignItems: "center", gap: "4px" }}
                            onClick={() => handleExportBankXml(bank)}
                          >
                            <span>📤</span>
                            <span>Ekspor XML</span>
                          </button>
                          <button
                            title="Edit Info Folder"
                            className="btn btn-ghost btn-sm"
                            style={{ padding: "6px 8px" }}
                            onClick={() => setEditBankTarget(bank)}
                          >
                            ✏️
                          </button>
                          <button
                            title="Hapus Folder"
                            className="btn btn-ghost btn-sm"
                            style={{ padding: "6px 8px", color: "#DC2626" }}
                            onClick={() => setDeleteBankTarget(bank)}
                          >
                            🗑️
                          </button>
                        </div>
                      </div>

                      <div style={{ padding: "8px 22px", borderTop: "1px solid #F1F5F9", display: "flex", gap: "16px", fontSize: "12px", color: "#94A3B8" }}>
                        <span>Dibuat: {bank.createdAt}</span>
                        <span>·</span>
                        <span>Diupdate: {bank.updatedAt}</span>
                        <span>·</span>
                        <span>Oleh: {bank.createdBy}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ── MODE 2: KELOLA SOAL DI DALAM FOLDER TERTENTU ────────────────── */}
        {activeBankId && currentBank && (
          <div>
            {/* Folder Header Banner */}
            <div
              className="card"
              style={{
                padding: "20px 24px", marginBottom: "20px",
                background: "linear-gradient(135deg, #FFFFFF 0%, #F8FAFC 100%)",
                border: "1.5px solid #E2E8F0",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px", flexWrap: "wrap", marginBottom: "16px" }}>
                <div style={{ flex: 1, minWidth: "260px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => setActiveBankId(null)}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: "4px",
                        background: "#F1F5F9", border: "1px solid #CBD5E1", borderRadius: "6px",
                        padding: "4px 10px", fontSize: "12px", fontWeight: 600, color: "#334155", cursor: "pointer",
                      }}
                    >
                      ← Semua Folder
                    </button>
                    <StatusBadge s={currentBank.status} />
                    <DiffBadge d={currentBank.difficulty} />
                  </div>
                  <h1 style={{ fontSize: "22px", fontWeight: 800, color: "#0F172A", margin: "0 0 6px 0" }}>
                    📚 {currentBank.title}
                  </h1>
                  <div style={{ fontSize: "13px", color: "#64748B" }}>
                    Mata Pelajaran: <strong>{currentBank.subject}</strong> · Total Soal: <strong>{currentBankQuestions.length} butir</strong> · Total Bobot: <strong>{currentBank.totalPoints} poin</strong>
                  </div>
                  {currentBank.description && (
                    <p style={{ fontSize: "13px", color: "#475569", margin: "8px 0 0 0", lineHeight: 1.5, background: "#F1F5F9", padding: "8px 12px", borderRadius: "6px" }}>
                      {currentBank.description}
                    </p>
                  )}
                </div>

                {/* Folder Actions & Quick Switcher */}
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", alignItems: "flex-end" }}>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "flex-end" }}>
                    <button
                      className="btn btn-secondary btn-md"
                      onClick={() => setShowImportXmlModal(true)}
                      style={{ display: "flex", alignItems: "center", gap: "6px" }}
                      title="Impor butir soal dari berkas XML ke dalam folder ini"
                    >
                      📥 Impor XML
                    </button>
                    <button
                      className="btn btn-secondary btn-md"
                      onClick={() => handleExportBankXml(currentBank)}
                      style={{ display: "flex", alignItems: "center", gap: "6px" }}
                      title="Ekspor seluruh butir soal di folder ini ke berkas XML"
                    >
                      📤 Ekspor XML
                    </button>
                    <button
                      className="btn btn-primary btn-md"
                      onClick={() => {
                        setEditQuestionTarget(null);
                        setShowQuestionModal(true);
                      }}
                      style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 700 }}
                    >
                      ➕ Tambah Soal
                    </button>
                  </div>

                  {/* Switch to Another Bank Folder Selector */}
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "12px", color: "#64748B" }}>Pindah ke folder:</span>
                    <select
                      className="form-select"
                      style={{ height: "34px", fontSize: "12px", minWidth: "180px" }}
                      value={activeBankId}
                      onChange={e => setActiveBankId(e.target.value)}
                    >
                      {banks.map(b => (
                        <option key={b.id} value={b.id}>
                          {b.title}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Tags */}
              {currentBank.tags.length > 0 && (
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", borderTop: "1px solid #EDF2F7", paddingTop: "12px" }}>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", alignSelf: "center" }}>
                    TAGS:
                  </span>
                  {currentBank.tags.map(t => (
                    <span key={t} style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "99px", background: "#E2E8F0", color: "#334155" }}>
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Questions Filter Bar */}
            <div className="card" style={{ marginBottom: "16px" }}>
              <div style={{ padding: "12px 18px", display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
                <div style={{ position: "relative", flex: "1 1 200px" }}>
                  <span style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", fontSize: "13px", color: "#94A3B8" }}>🔍</span>
                  <input
                    className="form-input"
                    style={{ paddingLeft: "32px", height: "36px", fontSize: "13px" }}
                    placeholder="Cari teks soal atau opsi..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>

                {/* Filter Tipe Soal */}
                <select
                  className="form-select"
                  style={{ width: "190px", height: "36px", fontSize: "13px" }}
                  value={questionTypeFilter}
                  onChange={e => setQuestionTypeFilter(e.target.value as typeof questionTypeFilter)}
                >
                  <option value="all">Semua Tipe Soal</option>
                  <option value="single_choice">🔘 Pilihan Ganda</option>
                  <option value="multi_select">☑️ Multi-Pilih</option>
                  <option value="latex">🧮 Matematika (LaTeX)</option>
                  <option value="image">🖼️ Memiliki Gambar</option>
                </select>

                {(search || questionTypeFilter !== "all") && (
                  <button className="btn btn-ghost btn-sm" onClick={() => { setSearch(""); setQuestionTypeFilter("all"); }}>
                    ✕ Reset
                  </button>
                )}

                <span style={{ marginLeft: "auto", fontSize: "13px", color: "#64748B" }}>
                  {filteredQuestions.length} dari {currentBankQuestions.length} soal
                </span>
              </div>
            </div>

            {/* Questions List */}
            {filteredQuestions.length === 0 ? (
              <div className="card" style={{ padding: "60px 24px", textAlign: "center" }}>
                <div style={{ fontSize: "44px", marginBottom: "12px" }}>📝</div>
                <div style={{ fontSize: "17px", fontWeight: 700, color: "#0F172A", marginBottom: "6px" }}>
                  {currentBankQuestions.length === 0
                    ? "Folder ini belum memiliki soal"
                    : "Tidak ada soal yang cocok dengan filter"}
                </div>
                <div style={{ fontSize: "14px", color: "#64748B", maxWidth: "420px", margin: "0 auto 16px auto" }}>
                  {currentBankQuestions.length === 0
                    ? "Mulai susun soal pertama Anda di folder ini dengan pilihan ganda, multi-pilih, atau formula matematika LaTeX."
                    : "Coba sesuaikan pencarian atau reset filter tipe soal."}
                </div>
                <button
                  className="btn btn-primary btn-md"
                  onClick={() => {
                    setEditQuestionTarget(null);
                    setShowQuestionModal(true);
                  }}
                >
                  + Buat Soal Pertama di Sini
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {filteredQuestions.map((q, idx) => {
                  return (
                    <div
                      key={q.id}
                      className="card"
                      style={{
                        padding: "20px 24px",
                        border: "1.5px solid #E2E8F0",
                        transition: "box-shadow 0.15s ease",
                      }}
                    >
                      {/* Question Card Top Meta */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px", flexWrap: "wrap", gap: "8px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontSize: "13px", fontWeight: 800, color: THEME.primary }}>
                            #{idx + 1}
                          </span>
                          <QuestionTypeBadge type={q.type} />
                          <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "4px", background: "#F1F5F9", color: "#475569" }}>
                            {q.points} Poin
                          </span>
                          {q.imageUrl && (
                            <span style={{ fontSize: "11px", fontWeight: 600, padding: "2px 8px", borderRadius: "4px", background: "#DCFCE7", color: "#15803D" }}>
                              🖼️ Gambar
                            </span>
                          )}
                        </div>

                        {/* Question Action Buttons */}
                        <div style={{ display: "flex", gap: "6px" }}>
                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ padding: "4px 8px", fontSize: "12px", fontWeight: 600 }}
                            onClick={() => {
                              setEditQuestionTarget(q);
                              setShowQuestionModal(true);
                            }}
                          >
                            ✏️ Edit
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ padding: "4px 8px", fontSize: "12px" }}
                            title="Duplikat Soal"
                            onClick={() => handleDuplicateQuestion(q.id)}
                          >
                            📋 Duplikat
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ padding: "4px 8px", fontSize: "12px" }}
                            title="Pindah ke Folder Lain"
                            onClick={() => setMoveQuestionTarget(q)}
                          >
                            📁 Pindah
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ padding: "4px 8px", fontSize: "12px", color: "#DC2626" }}
                            title="Hapus Soal"
                            onClick={() => setDeleteQuestionTarget(q)}
                          >
                            🗑️
                          </button>
                        </div>
                      </div>

                      {/* Question Text */}
                      <div style={{ fontSize: "15px", color: "#1E293B", lineHeight: 1.7, marginBottom: "16px", fontWeight: 500 }}>
                        <LatexRenderer text={q.questionText} block />
                      </div>

                      {/* Question Image Attachment */}
                      {q.imageUrl && (
                        <div style={{ marginBottom: "16px" }}>
                          <div
                            onClick={() => setZoomImage({ src: q.imageUrl!, alt: q.imageAlt || "Gambar Soal" })}
                            style={{
                              display: "inline-block", cursor: "zoom-in",
                              border: "1px solid #CBD5E1", borderRadius: "8px", overflow: "hidden",
                              background: "#F8FAFC", padding: "6px",
                            }}
                            title="Klik untuk memperbesar gambar"
                          >
                            <img
                              src={q.imageUrl}
                              alt={q.imageAlt || "Gambar Soal"}
                              style={{ maxWidth: "320px", maxHeight: "180px", objectFit: "contain", display: "block" }}
                            />
                            {q.imageAlt && (
                              <div style={{ fontSize: "11px", color: "#64748B", marginTop: "4px", textAlign: "center" }}>
                                {q.imageAlt}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Options Grid / List */}
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "8px", marginBottom: "12px" }}>
                        {q.options.map(opt => {
                          const isCorrect = q.type === "multi_select"
                            ? q.correctAnswers?.includes(opt.id)
                            : q.correctAnswer === opt.id;

                          return (
                            <div
                              key={opt.id}
                              style={{
                                display: "flex", alignItems: "center", gap: "10px",
                                padding: "8px 12px", borderRadius: "6px",
                                border: `1.5px solid ${isCorrect ? "#10B981" : "#E2E8F0"}`,
                                background: isCorrect ? "#F0FDF4" : "#FFFFFF",
                                fontSize: "13px",
                              }}
                            >
                              <span
                                style={{
                                  width: "24px", height: "24px", borderRadius: "50%",
                                  background: isCorrect ? "#10B981" : "#F1F5F9",
                                  color: isCorrect ? "white" : "#475569",
                                  fontWeight: 700, fontSize: "12px",
                                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                                }}
                              >
                                {opt.label}
                              </span>
                              <div style={{ flex: 1, color: isCorrect ? "#065F46" : "#334155", fontWeight: isCorrect ? 600 : 400 }}>
                                <LatexRenderer text={opt.text} />
                              </div>
                              {isCorrect && (
                                <span style={{ fontSize: "11px", fontWeight: 700, color: "#10B981", flexShrink: 0 }}>
                                  ✓ Kunci
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Hint / Explanation if available */}
                      {q.hint && (
                        <div style={{ fontSize: "12px", color: "#5B21B6", background: "#F5F3FF", padding: "8px 12px", borderRadius: "6px", border: "1px solid #DDD6FE", display: "flex", alignItems: "center", gap: "6px" }}>
                          <span>💡 <strong>Petunjuk / Pembahasan:</strong></span>
                          <LatexRenderer text={q.hint} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </div>

      {/* ── Modals Layer ────────────────────────────────────────────────────── */}
      {showBankModal && (
        <BankModal
          initial={null}
          onClose={() => setShowBankModal(false)}
          onSave={data => handleSaveBank(data, null)}
        />
      )}

      {editBankTarget && (
        <BankModal
          initial={editBankTarget}
          onClose={() => setEditBankTarget(null)}
          onSave={data => handleSaveBank(data, editBankTarget)}
        />
      )}

      {deleteBankTarget && (
        <DeleteModal
          title="Hapus Folder Bank Soal"
          message={
            <>
              Anda akan menghapus folder <strong style={{ color: "#0F172A" }}>&ldquo;{deleteBankTarget.title}&rdquo;</strong> beserta butir-butir soal di dalamnya.
              <br /><br />
              <span style={{ color: "#DC2626" }}>⚠️ Tindakan ini tidak dapat dibatalkan.</span>
            </>
          }
          onClose={() => setDeleteBankTarget(null)}
          onConfirm={() => handleDeleteBank(deleteBankTarget.id)}
        />
      )}

      {showQuestionModal && (
        <QuestionModal
          initial={null}
          defaultBankId={activeBankId || banks[0]?.id || ""}
          banks={banks}
          onClose={() => setShowQuestionModal(false)}
          onSave={(data) => handleSaveQuestion(data)}
        />
      )}

      {editQuestionTarget && (
        <QuestionModal
          initial={editQuestionTarget}
          defaultBankId={editQuestionTarget.bankId}
          banks={banks}
          onClose={() => setEditQuestionTarget(null)}
          onSave={(data, id) => handleSaveQuestion(data, id)}
        />
      )}

      {deleteQuestionTarget && (
        <DeleteModal
          title="Hapus Butir Soal"
          message={
            <>
              Apakah Anda yakin ingin menghapus soal ini?
              <br /><br />
              <em style={{ color: "#0F172A" }}>
                &ldquo;{deleteQuestionTarget.questionText.slice(0, 100)}...&rdquo;
              </em>
            </>
          }
          onClose={() => setDeleteQuestionTarget(null)}
          onConfirm={() => handleDeleteQuestion(deleteQuestionTarget.id)}
        />
      )}

      {moveQuestionTarget && (
        <MoveCopyModal
          question={moveQuestionTarget}
          banks={banks}
          onClose={() => setMoveQuestionTarget(null)}
          onMove={(targetBankId) => handleMoveQuestion(moveQuestionTarget.id, targetBankId)}
          onCopy={(targetBankId) => {
            handleDuplicateQuestion(moveQuestionTarget.id, targetBankId);
            setMoveQuestionTarget(null);
          }}
        />
      )}

      {/* XML Question Import Modal */}
      {showImportXmlModal && (
        <ImportXmlModal
          isOpen={showImportXmlModal}
          onClose={() => setShowImportXmlModal(false)}
          currentBank={currentBank}
          allBanks={banks}
          onSuccess={handleImportXmlSuccess}
        />
      )}

      {/* Toast Alert */}
      {toast && (
        <div className="toast-container" style={{ position: "fixed", bottom: "24px", right: "24px", zIndex: 9999 }}>
          <div
            className={`toast ${toast.type}`}
            style={{
              background: "#1E293B", color: "white", padding: "12px 18px",
              borderRadius: "8px", boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
              display: "flex", alignItems: "center", gap: "10px", fontSize: "14px",
            }}
          >
            <span>{toast.type === "error" ? "⚠️" : "✅"}</span>
            <div>{toast.msg}</div>
            <button
              onClick={() => setToast(null)}
              style={{ background: "none", border: "none", color: "#94A3B8", cursor: "pointer", marginLeft: "10px", fontSize: "14px" }}
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
