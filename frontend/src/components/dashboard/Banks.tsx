"use client";
import { MotionButton } from "@/components/MotionButton";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import type { JSONContent } from "@tiptap/core";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Dialog } from "@/components/Dialog";
import { QuestionContent } from "@/components/QuestionContent";
import { staffApi, staffSend } from "@/lib/staff-api";
import { queryCache } from "@/lib/data-cache";
import { BankListSkeleton } from "@/components/skeletons";
import EquationEditor, { docToText } from "./EquationEditor";
import { ErrorText, Icon, message } from "./Dashboard";
import type { Bank, BankQuestion, GradeLevel, Subject } from "./types";
import { exportBankXml, importBankXml, readBankXml, type Backup } from "./bankXml";

const blankDoc = (text = ""): JSONContent => ({
  type: "doc",
  content: [{ type: "paragraph", content: text ? [{ type: "text", text }] : [] }],
});

const newQuestion = (): BankQuestion => ({
  type: "single_choice",
  questionText: "",
  content: blankDoc(),
  options: ["A", "B", "C", "D"].map((id) => ({ id, label: id, text: "", content: blankDoc() })),
  correctAnswer: null,
  correctAnswers: [],
  points: 10,
});

function editable(q: BankQuestion): BankQuestion {
  return {
    ...q,
    sourceQuestionId: q.id,
    content: q.content || blankDoc(q.questionText),
    options: q.options.map((o) => ({ ...o, content: o.content || blankDoc(o.text) })),
  };
}

const stepNames = ["Buat Soal", "Pratinjau Siswa", "Konfirmasi Unggah"];

export function Banks({ teacherId }: { teacherId: string }) {
  const searchParams = useSearchParams();
  const reduceMotion = useReducedMotion();

  const [gradeLevels, setGradeLevels] = useState<GradeLevel[]>([]);
  const [selectedGradeId, setSelectedGradeId] = useState<string>(() => searchParams.get("gradeLevelId") || "");

  const [subjects, setSubjects] = useState<Subject[]>(() => {
    const initial = queryCache.get<Subject[]>("/api/subjects");
    return initial ? initial.data : [];
  });
  const [banks, setBanks] = useState<Bank[]>(() => {
    const initial = queryCache.get<{ items: Bank[]; nextCursor: string | null }>("/api/question-banks?limit=25");
    return initial ? initial.data.items : [];
  });
  const [folder, setFolder] = useState<string | null>(() => searchParams.get("subjectId") || searchParams.get("folder") || null);
  const [bankOpen, setBankOpen] = useState(false);
  const [bankName, setBankName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // In-place bank editor states
  const [selected, setSelected] = useState<Bank | null>(null);
  const [editor, setEditor] = useState(false);
  const [isNewBank, setIsNewBank] = useState(false);
  const [newBankTitle, setNewBankTitle] = useState("");
  const [newBankSubject, setNewBankSubject] = useState("");
  const [newBankSubjectId, setNewBankSubjectId] = useState("");
  const [newBankGradeId, setNewBankGradeId] = useState("");
  const [masterLoading, setMasterLoading] = useState(true);
  const [masterError, setMasterError] = useState("");
  const masterRequest = useRef(0);

  const [activeStep, setActiveStep] = useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [questions, setQuestions] = useState<BankQuestion[]>([]);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [draftRevision, setDraftRevision] = useState(0);
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [isEditingMeta, setIsEditingMeta] = useState(false);
  const questionImgInputRef = useRef<HTMLInputElement>(null);

  // Pop-up preview modal for entire bank
  const [viewingBank, setViewingBank] = useState<Bank | null>(null);

  // XML Import/Export states
  const [xmlFile, setXmlFile] = useState<File | null>(null);
  const [backup, setBackup] = useState<Backup | null>(null);
  const [notice, setNotice] = useState("");
  const [discard, setDiscard] = useState(false);
  const [deleteFolder, setDeleteFolder] = useState(false);
  const [moveBank, setMoveBank] = useState<Bank | null>(null);
  const [destination, setDestination] = useState("");
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const [cursorIndex, setCursorIndex] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [listLoading, setListLoading] = useState(() => {
    const initialBanks = queryCache.get<{ items: Bank[]; nextCursor: string | null }>("/api/question-banks?limit=25");
    return !initialBanks;
  });
  const listRequest = useRef(0);

  const refreshMaster = useCallback(async () => {
    const request = ++masterRequest.current;
    try {
      const [levels, items] = await Promise.all([
        staffApi<GradeLevel[]>("/api/academic/grade-levels"),
        staffApi<Subject[]>("/api/subjects"),
      ]);
      if (request !== masterRequest.current) return;
      setGradeLevels(levels);
      setSubjects(items);
      queryCache.set("/api/subjects", items, 300000);
      setMasterError("");
    } catch (err) {
      if (request === masterRequest.current) setMasterError(message(err));
    } finally {
      if (request === masterRequest.current) setMasterLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void refreshMaster(), 0);
    const onFocus = () => { void refreshMaster(); };
    const requestRef = masterRequest;
    window.addEventListener("focus", onFocus);
    return () => { window.clearTimeout(timer); requestRef.current++; window.removeEventListener("focus", onFocus); };
  }, [refreshMaster]);

  const load = useCallback(async (force = false) => {
    const request = ++listRequest.current;
    const params = new URLSearchParams({ limit: "25" });
    if (folder && folder !== "unassigned") params.set("subjectId", folder);
    else if (folder === "unassigned") params.set("subjectId", "unassigned");
    if (selectedGradeId) params.set("gradeLevelId", selectedGradeId);
    const cursor = cursors[cursorIndex];
    if (cursor) params.set("cursor", cursor);
    const banksKey = `/api/question-banks?${params}`;

    const cachedBanks = queryCache.get<{ items: Bank[]; nextCursor: string | null }>(banksKey);
    if (!cachedBanks || force) {
      if (!banks.length) setListLoading(true);
    }

    try {
      if (force) queryCache.invalidate(banksKey);
      const b = await queryCache.fetch<{ items: Bank[]; nextCursor: string | null }>(
        banksKey,
        () => staffApi<{ items: Bank[]; nextCursor: string | null }>(banksKey),
        60000
      );
      if (request === listRequest.current) {
        setBanks(b.items);
        setNextCursor(b.nextCursor);
        setError("");
      }
    } catch (e) {
      if (request === listRequest.current) setError(message(e));
    } finally {
      if (request === listRequest.current) setListLoading(false);
    }
  }, [folder, selectedGradeId, cursors, cursorIndex, banks.length]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (folder) params.set("subjectId", folder);
    if (selectedGradeId) params.set("gradeLevelId", selectedGradeId);
    window.history.replaceState(
      window.history.state,
      "",
      `/dashboard/bank-soal${params.size ? `?${params}` : ""}`
    );
    const timer = window.setTimeout(() => void load(), 0);
    const counter = listRequest;
    return () => {
      window.clearTimeout(timer);
      counter.current++;
    };
  }, [folder, selectedGradeId, load]);

  useEffect(() => {
    if (masterLoading || !selectedGradeId || !folder || folder === "unassigned") return;
    const subject = subjects.find((item) => item.id === folder);
    if (!subject || subject.gradeLevelId === selectedGradeId) return;
    const timer = window.setTimeout(() => { setFolder(null); setCursors([null]); setCursorIndex(0); }, 0);
    return () => window.clearTimeout(timer);
  }, [masterLoading, selectedGradeId, folder, subjects]);

  function switchFolder(value: string | null) {
    setFolder(value);
    setCursors([null]);
    setCursorIndex(0);
  }

  async function removeFolder() {
    if (!folder || folder === "unassigned") return;
    setBusy(true);
    setError("");
    try {
      await staffSend(`/api/subjects/${folder}`, "DELETE");
      queryCache.invalidate("/api/subjects");
      queryCache.invalidate("/api/question-banks");
      setDeleteFolder(false);
      switchFolder(null);
      setNotice("Mata pelajaran berhasil dihapus.");
      await refreshMaster();
      await load(true);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }

  async function move(e: FormEvent) {
    e.preventDefault();
    if (!moveBank || !destination) return;
    setBusy(true);
    setError("");
    try {
      await staffSend(`/api/question-banks/${moveBank.id}`, "PATCH", {
        revision: moveBank.revision,
        subjectId: destination,
      });
      setMoveBank(null);
      setNotice("Bank soal berhasil dipindahkan.");
      queryCache.invalidate("/api/question-banks");
      await load(true);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }

  async function createBank(e: FormEvent) {
    e.preventDefault();
    const subject = subjects.find((s) => s.id === folder);
    if (!subject) return;
    setBusy(true);
    setError("");
    try {
      await staffSend("/api/question-banks", "POST", {
        title: bankName,
        subject: subject.name,
        subjectId: subject.id,
      });
      setBankName("");
      setBankOpen(false);
      queryCache.invalidate("/api/question-banks");
      await load(true);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }

  async function previewBank(bank: Bank) {
    setError("");
    try {
      const detail = await staffApi<Bank>(`/api/question-banks/${bank.id}`);
      setViewingBank(detail);
    } catch (e) {
      setError(message(e));
    }
  }

  function startNewQuestionBank() {
    setError("");
    setIsNewBank(true);
    setIsEditingMeta(true);
    setPreviewDevice("desktop");
    const initialSubject = subjects.find((subject) => subject.id === folder && subject.gradeLevelId && (!selectedGradeId || subject.gradeLevelId === selectedGradeId));
    const initialBank: Bank = {
      id: "new-bank",
      title: "",
      subject: initialSubject?.name || "",
      subjectId: initialSubject?.id || null,
      revision: 1,
      _count: { questions: 0 },
      questions: [],
    };
    setSelected(initialBank);
    setNewBankTitle("");
    setNewBankSubject(initialSubject?.name || "");
    setNewBankSubjectId(initialSubject?.id || "");
    setNewBankGradeId(initialSubject?.gradeLevelId || selectedGradeId);
    setDraftId(null);
    setDraftRevision(0);
    setActiveStep(0);
    setCurrentQuestionIndex(0);
    setQuestions([newQuestion()]); // Default tepat 1 butir soal!
    setEditor(true);
  }

  async function openBank(id: string, edit: boolean, add = false) {
    setError("");
    try {
      const detail = await staffApi<Bank>(`/api/question-banks/${id}`);
      setSelected(detail);
      setIsNewBank(false);
      setIsEditingMeta(false);
      setPreviewDevice("desktop");
      setNewBankTitle(detail.title);
      setNewBankSubject(detail.subject);
      setNewBankSubjectId(detail.subjectId || "");
      setNewBankGradeId(detail.subjectFolder?.gradeLevelId || subjects.find((subject) => subject.id === detail.subjectId)?.gradeLevelId || "");
      setDraftId(null);
      setDraftRevision(0);
      setActiveStep(0);
      setCurrentQuestionIndex(0);

      let qs = (detail.questions || []).map(editable);
      if (edit) {
        const savedDraft = detail.drafts?.find((d) => d.createdBy === teacherId);
        if (savedDraft) {
          qs = savedDraft.content.questions;
          setDraftId(savedDraft.id);
          setDraftRevision(savedDraft.revision);
        }
        try {
          const local = localStorage.getItem(`eduquas:bank-draft:${teacherId}:${id}`);
          if (local) {
            const saved = JSON.parse(local) as {
              questions: BankQuestion[];
              draftId?: string;
              revision?: number;
            };
            qs = saved.questions;
            setDraftId(saved.draftId || null);
            setDraftRevision(saved.revision || 0);
          }
        } catch {}

        if (add || !qs.length) {
          qs = qs.length ? [...qs, newQuestion()] : [newQuestion()];
        }
      }

      setQuestions(qs);
      setCurrentQuestionIndex(add && qs.length > 1 ? qs.length - 1 : 0);
      setEditor(edit);
    } catch (e) {
      setError(message(e));
    }
  }

  function updateQuestions(next: BankQuestion[]) {
    setQuestions(next);
    if (selected && !isNewBank) {
      try {
        localStorage.setItem(
          `eduquas:bank-draft:${teacherId}:${selected.id}`,
          JSON.stringify({ questions: next, draftId, revision: draftRevision })
        );
      } catch {}
    }
  }

  function updateQuestion(index: number, patch: Partial<BankQuestion>) {
    updateQuestions(questions.map((q, i) => (i === index ? { ...q, ...patch } : q)));
  }

  async function saveDraft(commit: boolean) {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      let targetBank = selected;

      if (!newBankTitle.trim()) {
        setError("Nama bank soal wajib diisi.");
        setActiveStep(0);
        return;
      }

      if (isNewBank) {
        const subject = subjects.find((item) => item.id === newBankSubjectId && item.gradeLevelId === newBankGradeId && !item.isArchived && !item.gradeLevel?.isArchived);
        if (!newBankGradeId || !subject) {
          setError("Pilih tingkat dan mata pelajaran yang aktif.");
          setActiveStep(0);
          return;
        }
        const createdBank = await staffSend<Bank>("/api/question-banks", "POST", {
          title: newBankTitle.trim(),
          subject: subject.name,
          subjectId: subject.id,
        });

        targetBank = createdBank;
        setSelected(createdBank);
        setIsNewBank(false);
        queryCache.invalidate("/api/question-banks");
      } else if (newBankTitle.trim() !== selected.title || newBankSubjectId !== (selected.subjectId || "")) {
        if (newBankSubjectId !== (selected.subjectId || "") && !subjects.some((subject) => subject.id === newBankSubjectId && subject.gradeLevelId === newBankGradeId && !subject.isArchived && !subject.gradeLevel?.isArchived)) {
          setError("Pilih mata pelajaran yang aktif pada tingkat ini.");
          setActiveStep(0);
          return;
        }
        const updated = await staffSend<Bank>(`/api/question-banks/${selected.id}`, "PATCH", {
          revision: selected.revision,
          title: newBankTitle.trim(),
          ...(newBankSubjectId !== (selected.subjectId || "") ? { subjectId: newBankSubjectId } : {}),
        });
        targetBank = { ...selected, ...updated };
        setSelected(targetBank);
        queryCache.invalidate("/api/question-banks");
      }

      const content = { questions, bankRevision: targetBank.revision };
      let draft: { id: string; revision: number };
      if (draftId && !isNewBank) {
        draft = await staffSend(`/api/question-banks/${targetBank.id}/drafts/${draftId}`, "PUT", {
          revision: draftRevision,
          content,
        });
      } else {
        draft = await staffSend(`/api/question-banks/${targetBank.id}/drafts`, "POST", content);
      }
      setDraftId(draft.id);
      setDraftRevision(draft.revision);
      try {
        localStorage.setItem(
          `eduquas:bank-draft:${teacherId}:${targetBank.id}`,
          JSON.stringify({ questions, draftId: draft.id, revision: draft.revision })
        );
      } catch {}

      if (commit) {
        await staffSend(`/api/question-banks/${targetBank.id}/drafts/${draft.id}/commit`, "POST", {
          revision: draft.revision,
        });
        try {
          localStorage.removeItem(`eduquas:bank-draft:${teacherId}:${targetBank.id}`);
        } catch {}
        setSelected(null);
        setEditor(false);
        setNotice("Soal berhasil disimpan ke bank soal.");
        queryCache.invalidate("/api/question-banks");
        await load();
      } else {
        setNotice("Draf soal berhasil disimpan.");
      }
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }

  async function discardDraft() {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      if (draftId && !isNewBank) {
        await staffSend(`/api/question-banks/${selected.id}/drafts/${draftId}`, "DELETE", {
          revision: draftRevision,
        });
      }
      try {
        localStorage.removeItem(`eduquas:bank-draft:${teacherId}:${selected.id}`);
      } catch {}
      setDiscard(false);
      const id = selected.id;
      setSelected(null);
      setEditor(false);
      if (!isNewBank) {
        await openBank(id, true);
      }
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }

  async function upload(file: File, index: number, optionIndex?: number) {
    setError("");
    try {
      const data = new FormData();
      data.append("image", file);
      const result = await staffApi<{ url: string }>("/api/question-banks/media", {
        method: "POST",
        body: data,
      });
      const q = questions[index];
      if (optionIndex === undefined) {
        updateQuestion(index, { imageUrl: result.url });
      } else {
        updateQuestion(index, {
          options: q.options.map((o, i) => (i === optionIndex ? { ...o, imageUrl: result.url } : o)),
        });
      }
    } catch (e) {
      setError(message(e));
    }
  }

  async function prepareXml(file: File) {
    setError("");
    try {
      setBackup(await readBankXml(file));
      setXmlFile(file);
    } catch (e) {
      setError(message(e));
    }
  }

  async function confirmImport() {
    const subject = subjects.find((s) => s.id === folder) || subjects[0];
    if (!subject || !backup || !xmlFile) return;
    setBusy(true);
    setError("");
    try {
      const result = await importBankXml(xmlFile, subject);
      setBackup(null);
      setXmlFile(null);
      await load();
      if (result.alreadyImported && result.draftId && !result.draftOwnedByCaller) {
        setNotice("XML sudah diimpor oleh guru lain dan drafnya belum disimpan ke bank.");
        return;
      }
      setNotice(
        result.alreadyImported
          ? "XML ini sudah pernah diimpor ke folder ini."
          : "XML diimpor sebagai draf. Periksa soal sebelum menyimpan ke bank."
      );
      await openBank(result.bankId, true);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }

  async function exportXml(bank: Bank) {
    try {
      setError("");
      const external = await exportBankXml(bank);
      setNotice(external ? "XML diunduh. Gambar eksternal tetap membutuhkan jaringan." : "XML bank soal berhasil diunduh.");
    } catch (e) {
      setError(message(e));
    }
  }

  const currentQ = questions[currentQuestionIndex] || questions[0];

  // ─── IN-PLACE BANK SOAL STEPPER VIEW ───────────────────────────────────────
  if (editor && selected) {
    const formattedDate = selected.updatedAt
      ? new Date(selected.updatedAt).toLocaleDateString("id-ID", {
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "Belum disimpan";

    return (
      <motion.section
        className="bank-add-page exam-creator-entry"
        aria-labelledby="bank-creator-title"
        initial={reduceMotion ? false : { opacity: 0.85, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="bank-top-nav">
          <MotionButton
            className="bank-back-link"
            type="button"
            onClick={() => {
              setEditor(false);
              setSelected(null);
              setIsNewBank(false);
              setError("");
            }}
          >
            ← Kembali ke daftar bank soal
          </MotionButton>

          <ol className="bank-stepper" aria-label="Tahapan kelola butir soal">
            {stepNames.map((label, index) => (
              <li
                key={label}
                className={`bank-step-item ${index === activeStep ? "active" : index < activeStep ? "complete" : ""}`}
                onClick={() => {
                  if (index <= activeStep + 1) setActiveStep(index);
                }}
              >
                <span className="bank-step-circle">{index + 1}</span>
                <span>{label}</span>
                {index < stepNames.length - 1 && <span className="bank-step-line" aria-hidden="true" />}
              </li>
            ))}
          </ol>
          <div style={{ width: 120 }} className="hide-on-mobile" />
        </div>

        {/* Bank Meta Banner Card */}
        <div className="bank-meta-banner">
          <span className="bank-meta-badge">Bank Soal</span>
          <div className="bank-meta-title-row">
            <h1 id="bank-creator-title" className="bank-meta-title">
              {newBankTitle.trim() || "Bank Soal Baru"}
            </h1>
            <button
              type="button"
              className="bank-meta-edit-btn"
              aria-label="Ubah judul bank soal"
              title="Ubah judul bank soal"
              onClick={() => setIsEditingMeta(!isEditingMeta)}
            >
              <Icon name="pencil" size={13} />
            </button>
          </div>

          {(isNewBank || isEditingMeta) && (
            <div
              style={{
                display: "flex",
                gap: 12,
                margin: "10px 0 6px",
                flexWrap: "wrap",
                alignItems: "center",
                background: "#fafafc",
                padding: "10px 14px",
                borderRadius: "10px",
                border: "1px solid #e7e6ec",
              }}
            >
              <div style={{ flex: 1, minWidth: 220 }}>
                <label
                  htmlFor="new-bank-title"
                  style={{ display: "block", fontSize: "10px", fontWeight: 700, color: "#62626c", marginBottom: 4 }}
                >
                  Nama Bank Soal *
                </label>
                <input
                  id="new-bank-title"
                  className="bank-option-input"
                  style={{
                    border: "1px solid #c9c7cf",
                    borderRadius: "8px",
                    padding: "6px 12px",
                    background: "#ffffff",
                    fontSize: "12px",
                    fontWeight: 600,
                    width: "100%",
                  }}
                  placeholder="Contoh: Logika Matematika 1"
                  value={newBankTitle}
                  onChange={(e) => setNewBankTitle(e.target.value)}
                />
              </div>

              <div className="bank-master-field">
                <label htmlFor="new-bank-grade">Tingkat *</label>
                <select id="new-bank-grade" value={newBankGradeId} required disabled={masterLoading || (!isNewBank && !!selected.subjectFolder?.gradeLevelId)} onChange={(e) => { setNewBankGradeId(e.target.value); setNewBankSubjectId(""); setNewBankSubject(""); }}>
                  <option value="">Pilih tingkat</option>
                  {newBankGradeId && !gradeLevels.some((grade) => grade.id === newBankGradeId) && <option value={newBankGradeId} disabled>{selected.subjectFolder?.gradeLevel?.name || "Tingkat tidak tersedia"}</option>}
                  {gradeLevels.filter((grade) => !grade.isArchived).map((grade) => <option key={grade.id} value={grade.id}>{grade.name}</option>)}
                </select>
              </div>
              <div className="bank-master-field">
                <label htmlFor="new-bank-subject">Mata Pelajaran *</label>
                <select id="new-bank-subject" value={newBankSubjectId} required disabled={masterLoading || !newBankGradeId} onChange={(e) => {
                  const subject = subjects.find((item) => item.id === e.target.value);
                  setNewBankSubjectId(e.target.value);
                  setNewBankSubject(subject?.name || "");
                }}>
                  <option value="">Pilih mata pelajaran</option>
                  {newBankSubjectId && !subjects.some((subject) => subject.id === newBankSubjectId) && <option value={newBankSubjectId} disabled>{newBankSubject || "Mata pelajaran tidak tersedia"} (arsip)</option>}
                  {subjects.filter((subject) => subject.gradeLevelId === newBankGradeId && !subject.isArchived && !subject.gradeLevel?.isArchived).map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
                </select>
              </div>
              {masterLoading && <p className="bank-master-note" role="status">Memuat tingkat dan mata pelajaran...</p>}
              {masterError && <p className="bank-master-note" role="alert">{masterError} <button type="button" className="action-link" onClick={() => void refreshMaster()}>Coba lagi</button></p>}
              {!masterLoading && !masterError && (!gradeLevels.length || (newBankGradeId && !subjects.some((subject) => subject.gradeLevelId === newBankGradeId && !subject.isArchived))) && <p className="bank-master-note">Belum ada {gradeLevels.length ? "mata pelajaran pada tingkat ini" : "tingkat"}. <Link href={`/dashboard/kelas-mapel${newBankGradeId ? `?gradeLevelId=${encodeURIComponent(newBankGradeId)}` : ""}`} target="_blank" rel="noopener noreferrer">Kelola Kelas &amp; Mapel (tab baru)</Link></p>}
            </div>
          )}

          <div className="bank-meta-row">
            <span className="bank-meta-item">
              <Icon name="book" size={13} />
              {newBankSubject || "Pilih mata pelajaran"}
            </span>
            <span className="bank-meta-item">
              <Icon name="file" size={13} />
              {questions.length} Soal
            </span>
            <span className="bank-meta-item">
              <Icon name="clock" size={13} />
              {selected.updatedAt ? `Diperbarui: ${formattedDate}` : formattedDate}
            </span>
          </div>
        </div>

        <ErrorText error={error} />

        {/* ─── TAHAP 1: BUAT SOAL (SPLIT VIEW EDITOR & PREVIEW) ───────── */}
        {activeStep === 0 && currentQ && (
          <>
            {questions.length > 1 && (
              <div className="bank-nav-strip" style={{ margin: "2px 0 0" }}>
                <span style={{ fontSize: "11px", fontWeight: 650, color: "#62626c", marginRight: "4px" }}>
                  Butir Soal:
                </span>
                {questions.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className={`bank-q-pill ${currentQuestionIndex === idx ? "active" : ""}`}
                    onClick={() => setCurrentQuestionIndex(idx)}
                    title={`Pilih nomor ${idx + 1}`}
                  >
                    {idx + 1}
                  </button>
                ))}
                <MotionButton
                  type="button"
                  className="bank-icon-btn"
                  title="Tambah butir soal"
                  aria-label="Tambah butir soal"
                  onClick={() => {
                    const next = [...questions, newQuestion()];
                    updateQuestions(next);
                    setCurrentQuestionIndex(next.length - 1);
                  }}
                >
                  <Icon name="plus" size={14} />
                </MotionButton>
                <MotionButton
                  type="button"
                  className="bank-icon-btn danger"
                  disabled={questions.length <= 1}
                  title="Hapus butir soal saat ini"
                  aria-label="Hapus butir soal saat ini"
                  onClick={() => {
                    if (questions.length <= 1) return;
                    const next = questions.filter((_, idx) => idx !== currentQuestionIndex);
                    updateQuestions(next);
                    setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1));
                  }}
                >
                  <Icon name="trash" size={14} />
                </MotionButton>
              </div>
            )}

            <div className="bank-two-col-grid">
              {/* Kolom Kiri: Form Buat Soal Baru */}
              <section className="bank-card">
                <div className="bank-card-head">
                  <h3>Buat Soal Baru</h3>
                  <p>
                    Lengkapi pertanyaan, pilihan jawaban, dan pengaturan soal. Hasilnya dapat langsung dilihat di panel pratinjau.
                  </p>
                </div>

                {/* Jenis Soal & Bobot Poin */}
                <div className="bank-field-row">
                  <div>
                    <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#17171a", marginBottom: 6 }}>
                      Jenis Soal *
                    </label>
                    <div className="bank-select-shell">
                      <select
                        value={currentQ.type}
                        onChange={(e) =>
                          updateQuestion(currentQuestionIndex, {
                            type: e.target.value as BankQuestion["type"],
                          })
                        }
                      >
                        <option value="single_choice">Pilihan Ganda</option>
                        <option value="multi_select">Pilihan Jamak</option>
                        <option value="short_answer">Isian Singkat</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#17171a", marginBottom: 6 }}>
                      Bobot Poin *
                    </label>
                    <div className="bank-point-shell">
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={currentQ.points}
                        onChange={(e) =>
                          updateQuestion(currentQuestionIndex, {
                            points: Math.max(1, Number(e.target.value) || 1),
                          })
                        }
                      />
                      <span className="bank-point-suffix">Poin</span>
                    </div>
                  </div>
                </div>

                {/* Pertanyaan * */}
                <div style={{ marginTop: 4 }}>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#17171a", marginBottom: 6 }}>
                    Pertanyaan *
                  </label>
                  <EquationEditor
                    label={`Isi soal ${currentQuestionIndex + 1}`}
                    value={(currentQ.content as JSONContent) || blankDoc()}
                    onChange={(doc) =>
                      updateQuestion(currentQuestionIndex, {
                        content: doc,
                        questionText: docToText(doc),
                      })
                    }
                    onImageClick={() => questionImgInputRef.current?.click()}
                  />
                  <input
                    ref={questionImgInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    style={{ display: "none" }}
                    onChange={(e) =>
                      e.target.files?.[0] && void upload(e.target.files[0], currentQuestionIndex)
                    }
                  />
                  {currentQ.imageUrl && (
                    <div className="bank-attached-img">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={currentQ.imageUrl} alt={currentQ.imageAlt || "Lampiran soal"} />
                      <div style={{ flex: 1, display: "flex", gap: 8, alignItems: "center" }}>
                        <input
                          className="bank-option-input"
                          style={{ border: "1px solid #d5d4dc", borderRadius: 6, padding: "4px 8px" }}
                          placeholder="Keterangan alternatif gambar (alt)..."
                          value={currentQ.imageAlt || ""}
                          onChange={(e) =>
                            updateQuestion(currentQuestionIndex, { imageAlt: e.target.value })
                          }
                        />
                        <button
                          type="button"
                          className="bank-toolbar-btn"
                          style={{ color: "#de5558" }}
                          title="Hapus gambar"
                          onClick={() =>
                            updateQuestion(currentQuestionIndex, { imageUrl: undefined, imageAlt: undefined })
                          }
                        >
                          <Icon name="trash" size={13} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Pilihan Jawaban * */}
                {currentQ.type === "short_answer" ? (
                  <div
                    style={{
                      marginTop: 18,
                      padding: "12px 14px",
                      borderRadius: "10px",
                      background: "#fffbeb",
                      border: "1px solid #fef3c7",
                      color: "#92400e",
                      fontSize: "11px",
                      lineHeight: 1.5,
                    }}
                  >
                    Soal isian singkat tidak membutuhkan pilihan ganda. Siswa akan mengetikkan jawaban secara mandiri pada saat ujian dan dinilai manual oleh guru.
                  </div>
                ) : (
                  <div>
                    <div className="bank-options-head">
                      <label>Pilihan Jawaban *</label>
                      <div className="bank-options-stepper">
                        <span>Jumlah opsi</span>
                        <button
                          type="button"
                          className="bank-step-btn"
                          title="Kurangi opsi"
                          disabled={currentQ.options.length <= 2}
                          onClick={() => {
                            if (currentQ.options.length <= 2) return;
                            const next = currentQ.options.slice(0, -1);
                            const removed = currentQ.options[currentQ.options.length - 1];
                            updateQuestion(currentQuestionIndex, {
                              options: next,
                              correctAnswer: currentQ.correctAnswer === removed.id ? null : currentQ.correctAnswer,
                              correctAnswers: (currentQ.correctAnswers || []).filter((id) => id !== removed.id),
                            });
                          }}
                        >
                          −
                        </button>
                        <strong style={{ minWidth: 14, textAlign: "center", color: "#17171a" }}>
                          {currentQ.options.length}
                        </strong>
                        <button
                          type="button"
                          className="bank-step-btn"
                          title="Tambah opsi"
                          disabled={currentQ.options.length >= 6}
                          onClick={() => {
                            if (currentQ.options.length >= 6) return;
                            const id = ["A", "B", "C", "D", "E", "F"].find(
                              (key) => !currentQ.options.some((o) => o.id === key)
                            );
                            if (id) {
                              updateQuestion(currentQuestionIndex, {
                                options: [...currentQ.options, { id, label: id, text: "", content: blankDoc() }],
                              });
                            }
                          }}
                        >
                          +
                        </button>
                      </div>
                    </div>

                    <div className="bank-options-list">
                      {currentQ.options.map((opt, j) => {
                        const isKey =
                          currentQ.type === "multi_select"
                            ? !!currentQ.correctAnswers?.includes(opt.id)
                            : currentQ.correctAnswer === opt.id;
                        return (
                          <div
                            key={opt.id}
                            className={`bank-option-row ${isKey ? "is-selected" : ""}`}
                          >
                            <span className="bank-option-drag" title="Ubah urutan">
                              :::
                            </span>
                            <input
                              type={currentQ.type === "multi_select" ? "checkbox" : "radio"}
                              name={`key-q-${currentQuestionIndex}`}
                              checked={isKey}
                              onChange={(e) => {
                                updateQuestion(
                                  currentQuestionIndex,
                                  currentQ.type === "multi_select"
                                    ? {
                                        correctAnswers: e.target.checked
                                          ? [...(currentQ.correctAnswers || []), opt.id]
                                          : (currentQ.correctAnswers || []).filter((id) => id !== opt.id),
                                      }
                                    : { correctAnswer: opt.id }
                                );
                              }}
                              aria-label={`Pilih opsi ${opt.label || String.fromCharCode(65 + j)} sebagai kunci`}
                              title="Klik untuk menjadikan kunci jawaban"
                            />
                            <input
                              className="bank-option-input"
                              placeholder={`Tulis pilihan jawaban ${opt.label || String.fromCharCode(65 + j)}...`}
                              value={opt.text || ""}
                              onChange={(e) => {
                                const val = e.target.value;
                                const nextOptions = currentQ.options.map((item, k) =>
                                  k === j ? { ...item, text: val, content: blankDoc(val) } : item
                                );
                                updateQuestion(currentQuestionIndex, { options: nextOptions });
                              }}
                            />
                            {currentQ.options.length > 2 && (
                              <button
                                type="button"
                                className="bank-option-trash"
                                title="Hapus opsi"
                                aria-label={`Hapus pilihan ${opt.label || String.fromCharCode(65 + j)}`}
                                onClick={() => {
                                  const next = currentQ.options.filter((_, k) => k !== j);
                                  updateQuestion(currentQuestionIndex, {
                                    options: next,
                                    correctAnswer: currentQ.correctAnswer === opt.id ? null : currentQ.correctAnswer,
                                    correctAnswers: (currentQ.correctAnswers || []).filter((id) => id !== opt.id),
                                  });
                                }}
                              >
                                <Icon name="trash" size={13} />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {currentQ.options.length < 6 && (
                      <button
                        type="button"
                        className="bank-add-opt-btn"
                        onClick={() => {
                          const id = ["A", "B", "C", "D", "E", "F"].find(
                            (key) => !currentQ.options.some((o) => o.id === key)
                          );
                          if (id) {
                            updateQuestion(currentQuestionIndex, {
                              options: [...currentQ.options, { id, label: id, text: "", content: blankDoc() }],
                            });
                          }
                        }}
                      >
                        <Icon name="plus" size={12} /> Tambah Opsi
                      </button>
                    )}
                  </div>
                )}

                {/* Footer Actions */}
                <div className="bank-card-footer">
                  <button
                    type="button"
                    className="bank-btn-add-more"
                    onClick={() => {
                      const next = [...questions, newQuestion()];
                      updateQuestions(next);
                      setCurrentQuestionIndex(next.length - 1);
                    }}
                  >
                    + Simpan & Tambah Soal Lagi
                  </button>

                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <button
                      type="button"
                      className="bank-btn-cancel"
                      onClick={() => {
                        setEditor(false);
                        setSelected(null);
                        setIsNewBank(false);
                      }}
                    >
                      Batal
                    </button>
                    <MotionButton
                      type="button"
                      className="bank-btn-save"
                      aria-label="Lanjutkan ke Pratinjau Siswa →"
                      onClick={() => setActiveStep(1)}
                    >
                      <span>✓</span> Simpan Soal
                    </MotionButton>
                  </div>
                </div>
              </section>

              {/* Kolom Kanan: Pratinjau Soal Siswa */}
              <aside className="bank-card">
                <div className="bank-card-head">
                  <div className="bank-preview-head-row">
                    <div>
                      <h3>Pratinjau Soal</h3>
                      <p>Tampilan soal seperti yang akan dilihat oleh siswa.</p>
                    </div>
                    <div className="bank-device-toggle" role="tablist" aria-label="Pilih tampilan pratinjau">
                      <button
                        type="button"
                        className={`bank-device-btn ${previewDevice === "desktop" ? "active" : ""}`}
                        title="Tampilan Desktop"
                        aria-label="Tampilan Desktop"
                        onClick={() => setPreviewDevice("desktop")}
                      >
                        <Icon name="display" size={14} />
                      </button>
                      <button
                        type="button"
                        className={`bank-device-btn ${previewDevice === "mobile" ? "active" : ""}`}
                        title="Tampilan Mobile"
                        aria-label="Tampilan Mobile"
                        onClick={() => setPreviewDevice("mobile")}
                      >
                        <Icon name="phone" size={14} />
                      </button>
                    </div>
                  </div>
                </div>

                <div className={`bank-student-preview-shell ${previewDevice === "mobile" ? "is-mobile" : ""}`}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                    <span className="bank-preview-tag">
                      {currentQ.type === "single_choice"
                        ? "Pilihan Ganda"
                        : currentQ.type === "multi_select"
                        ? "Pilihan Jamak"
                        : "Isian Singkat"}
                    </span>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "#17171a" }}>
                      {currentQ.points} Poin
                    </span>
                  </div>

                  <div style={{ marginBottom: 16, fontSize: "12px", lineHeight: 1.6, color: "#17171a" }}>
                    <QuestionContent
                      content={currentQ.content}
                      text={currentQ.questionText || "Tulis pertanyaan soal di sebelah kiri..."}
                      imageUrl={currentQ.imageUrl}
                      imageAlt={currentQ.imageAlt}
                    />
                  </div>

                  {currentQ.type === "short_answer" ? (
                    <div style={{ marginTop: 12 }}>
                      <input
                        type="text"
                        disabled
                        placeholder="Siswa mengetikkan jawaban di sini..."
                        style={{
                          width: "100%",
                          padding: "10px 14px",
                          borderRadius: "10px",
                          border: "1px dashed #d5d4dc",
                          background: "#fafafc",
                          fontSize: "11px",
                          color: "#8c8a94",
                        }}
                      />
                    </div>
                  ) : (
                    <div className="bank-student-options" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {currentQ.options.map((opt, oIdx) => {
                        const isKey =
                          currentQ.type === "multi_select"
                            ? currentQ.correctAnswers?.includes(opt.id)
                            : currentQ.correctAnswer === opt.id;
                        return (
                          <div
                            key={opt.id}
                            className={`bank-preview-opt ${isKey ? "is-selected" : ""}`}
                          >
                            <input
                              type={currentQ.type === "multi_select" ? "checkbox" : "radio"}
                              checked={!!isKey}
                              readOnly
                            />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <QuestionContent
                                content={opt.content}
                                text={opt.text || `Pilihan ${opt.label || String.fromCharCode(65 + oIdx)}`}
                                imageUrl={opt.imageUrl}
                                imageAlt={opt.imageAlt}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </aside>
            </div>
          </>
        )}

        {/* ─── TAHAP 2: PRATINJAU SISWA LENGKAP ───────────────────────── */}
        {activeStep === 1 && (
          <div className="bank-card">
            <h1 id="bank-creator-title" className="bank-card-title">
              Pratinjau Lembar Soal Siswa
            </h1>
            <p className="lead" style={{ margin: "4px 0 20px" }}>
              Berikut tampilan lengkap seluruh {questions.length} butir soal seperti yang akan dilihat oleh siswa pada saat ujian.
            </p>

            <div className="bank-full-preview-list">
              {questions.map((q, idx) => (
                <section key={idx} className="bank-student-card" style={{ padding: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontWeight: 650, fontSize: "12px" }}>Nomor {idx + 1}</span>
                    <span style={{ fontSize: "11px", color: "var(--staff-muted)", fontWeight: 600 }}>
                      {q.points} Poin · {q.type === "short_answer" ? "Penilaian manual" : "Auto-grade"}
                    </span>
                  </div>

                  <div className="bank-student-qtext">
                    <QuestionContent
                      content={q.content}
                      text={q.questionText || "(Pertanyaan belum diisi)"}
                      imageUrl={q.imageUrl}
                      imageAlt={q.imageAlt}
                    />
                  </div>

                  {q.type === "short_answer" ? (
                    <div style={{ marginTop: 10 }}>
                      <input
                        type="text"
                        disabled
                        placeholder="Kolom isian siswa..."
                        style={{
                          width: "100%",
                          padding: "8px 12px",
                          borderRadius: "8px",
                          border: "1px dashed #d5d4dc",
                          background: "#f9f8fb",
                          fontSize: "11px",
                        }}
                      />
                    </div>
                  ) : (
                    <div className="bank-student-options" style={{ marginTop: 12 }}>
                      {q.options.map((o, j) => {
                        const isKey =
                          q.type === "multi_select"
                            ? q.correctAnswers?.includes(o.id)
                            : q.correctAnswer === o.id;
                        return (
                          <div
                            key={o.id}
                            className={`bank-student-opt ${isKey ? "selected" : ""}`}
                          >
                            <input
                              type={q.type === "multi_select" ? "checkbox" : "radio"}
                              checked={!!isKey}
                              readOnly
                            />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <QuestionContent
                                content={o.content}
                                text={o.text || `Pilihan ${o.label || String.fromCharCode(65 + j)}`}
                                imageUrl={o.imageUrl}
                                imageAlt={o.imageAlt}
                              />
                            </div>
                            {isKey && (
                              <span
                                style={{
                                  fontSize: "10px",
                                  fontWeight: 700,
                                  color: "#7867d9",
                                  textTransform: "uppercase",
                                }}
                              >
                                Kunci
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              ))}
            </div>

            <div className="exam-creator-actions" style={{ marginTop: 24 }}>
              <MotionButton
                type="button"
                className="secondary-button"
                onClick={() => setActiveStep(0)}
              >
                ← Kembali ke Buat Soal
              </MotionButton>
              <MotionButton
                type="button"
                className="primary-button"
                onClick={() => setActiveStep(2)}
              >
                Lanjutkan ke Konfirmasi Unggah →
              </MotionButton>
            </div>
          </div>
        )}

        {/* ─── TAHAP 3: KONFIRMASI UNGGAH SOAL ───────────────────────── */}
        {activeStep === 2 && (
          <div className="bank-card">
            <h1 id="bank-creator-title" className="bank-card-title">
              Konfirmasi Unggah Bank Soal
            </h1>
            <p className="lead" style={{ margin: "4px 0 20px" }}>
              Periksa ringkasan soal sebelum disimpan sebagai draf atau diterbitkan langsung ke bank soal.
            </p>

            <div className="bank-summary-grid">
              <div className="bank-summary-stat">
                <span>Total Butir Soal</span>
                <strong>{questions.length}</strong>
              </div>
              <div className="bank-summary-stat">
                <span>Pilihan Tunggal (Auto)</span>
                <strong>{questions.filter((q) => q.type === "single_choice").length}</strong>
              </div>
              <div className="bank-summary-stat">
                <span>Pilihan Jamak (Auto)</span>
                <strong>{questions.filter((q) => q.type === "multi_select").length}</strong>
              </div>
              <div className="bank-summary-stat">
                <span>Isian Singkat (Manual)</span>
                <strong>{questions.filter((q) => q.type === "short_answer").length}</strong>
              </div>
              <div className="bank-summary-stat">
                <span>Total Bobot Poin</span>
                <strong>{questions.reduce((acc, q) => acc + (q.points || 0), 0)}</strong>
              </div>
            </div>

            {/* Validation Warnings */}
            {(() => {
              const emptyQuestions = questions
                .map((q, i) => (!q.questionText?.trim() ? i + 1 : null))
                .filter(Boolean);
              const missingKeys = questions
                .map((q, i) =>
                  q.type === "single_choice" && !q.correctAnswer
                    ? i + 1
                    : q.type === "multi_select" && (!q.correctAnswers || !q.correctAnswers.length)
                    ? i + 1
                    : null
                )
                .filter(Boolean);

              return (
                <>
                  {emptyQuestions.length > 0 && (
                    <p className="staff-note" style={{ background: "#fff5f5", borderColor: "#fed7d7", color: "#c53030" }}>
                      Perhatian: Butir nomor {emptyQuestions.join(", ")} belum memiliki isi pertanyaan.
                    </p>
                  )}
                  {missingKeys.length > 0 && (
                    <p className="staff-note" style={{ background: "#fffaf0", borderColor: "#feebc8", color: "#c05621" }}>
                      Peringatan: Butir nomor {missingKeys.join(", ")} belum memiliki kunci jawaban yang dipilih.
                    </p>
                  )}
                </>
              );
            })()}

            <div className="exam-creator-actions" style={{ marginTop: 28 }}>
              <MotionButton
                type="button"
                className="secondary-button"
                onClick={() => setActiveStep(1)}
              >
                ← Kembali ke Pratinjau
              </MotionButton>

              <div style={{ display: "flex", gap: 10, marginLeft: "auto", flexWrap: "wrap" }}>
                {!isNewBank && (
                  <MotionButton
                    type="button"
                    className="staff-secondary"
                    disabled={busy}
                    onClick={() => setDiscard(true)}
                  >
                    Hapus Draf
                  </MotionButton>
                )}
                <MotionButton
                  type="button"
                  className="secondary-button"
                  disabled={busy}
                  onClick={() => void saveDraft(false)}
                >
                  {busy ? "Menyimpan…" : "Simpan Draf"}
                </MotionButton>
                <MotionButton
                  type="button"
                  className="primary-button"
                  disabled={busy}
                  onClick={() => void saveDraft(true)}
                >
                  {busy ? "Menyimpan…" : "Simpan ke Bank Soal"}
                </MotionButton>
              </div>
            </div>
          </div>
        )}

        {/* Modal Discard Draft */}
        <Dialog open={discard} title="Hapus draf soal?" onClose={() => setDiscard(false)}>
          <div className="staff-form">
            <p>
              Perubahan yang belum disimpan ke bank akan dihapus. Soal yang sudah tersimpan di bank tetap ada.
            </p>
            <ErrorText error={error} />
            <div className="staff-dialog-actions">
              <MotionButton className="staff-secondary" onClick={() => setDiscard(false)}>
                Batal
              </MotionButton>
              <MotionButton className="staff-primary" disabled={busy} onClick={() => void discardDraft()}>
                Hapus draf
              </MotionButton>
            </div>
          </div>
        </Dialog>
      </motion.section>
    );
  }

  // ─── NORMAL BANK LIST VIEW ─────────────────────────────────────────────────
  const visible = banks;
  const selectedGrade = gradeLevels.find((gl) => gl.id === selectedGradeId);
  const currentSubject = subjects.find((s) => s.id === folder);
  const displayedSubjects = selectedGradeId
    ? subjects.filter((s) => s.gradeLevelId === selectedGradeId)
    : subjects;

  const targetGradeId = moveBank?.subjectFolder?.gradeLevelId;
  const allowedMoveSubjects = targetGradeId
    ? subjects.filter((s) => s.gradeLevelId === targetGradeId && s.id !== moveBank?.subjectId)
    : subjects.filter((s) => s.id !== moveBank?.subjectId);

  return (
    <>
      <nav className="bank-breadcrumb" aria-label="Navigasi hierarki bank soal" style={{ display: "flex", gap: "6px", alignItems: "center", fontSize: "11px", color: "#64636c", marginBottom: "8px" }}>
        <span>Bank Soal</span>
        {selectedGrade && <><span>/</span><span>{selectedGrade.name}</span></>}
        {currentSubject && <><span>/</span><strong>{currentSubject.name}</strong></>}
      </nav>

      <div className="staff-section-head">
        <div>
          <h2>Bank soal</h2>
          <p>Susun dan kelola butir soal ujian bersama berdasarkan mata pelajaran.</p>
        </div>
        <div className="staff-action-wrap">
          <Link className="staff-secondary" href={`/dashboard/kelas-mapel${selectedGradeId ? `?gradeLevelId=${encodeURIComponent(selectedGradeId)}` : ""}`}>
            <Icon name="plus" size={16} /> Kelola mata pelajaran
          </Link>
          <label className="staff-secondary staff-file">
            Impor XML
            <input
              type="file"
              accept=".xml,application/xml,text/xml"
              onChange={(e) => {
                if (e.target.files?.[0]) void prepareXml(e.target.files[0]);
                e.target.value = "";
              }}
            />
          </label>
          <MotionButton className="staff-primary" disabled={masterLoading} onClick={() => startNewQuestionBank()}>
            <Icon name="plus" size={16} /> Buat Soal
          </MotionButton>
        </div>
      </div>

      {/* Grade Selector Filter */}
      <div className="grade-selector-strip" style={{ marginBottom: "12px" }}>
        <span className="grade-selector-label">Filter Tingkat:</span>
        <div className="grade-pills">
          <button
            type="button"
            className={`grade-pill ${!selectedGradeId ? "active" : ""}`}
            onClick={() => { setSelectedGradeId(""); switchFolder(null); }}
          >
            Semua Tingkat
          </button>
          {gradeLevels.map((gl) => (
            <button
              key={gl.id}
              type="button"
              className={`grade-pill ${gl.id === selectedGradeId ? "active" : ""}`}
              onClick={() => { setSelectedGradeId(gl.id); switchFolder(null); }}
            >
              {gl.name}
            </button>
          ))}
        </div>
      </div>

      {notice && <p role="status" className="staff-note" style={{ background: "#edfdf5", borderColor: "#c6f6d5", color: "#22543d" }}>{notice}</p>}
      <ErrorText error={!selected && !bankOpen && !backup && !moveBank && !deleteFolder && !viewingBank ? error : ""} />

      <div className="staff-folder-tabs">
        <MotionButton className={!folder ? "active" : ""} onClick={() => switchFolder(null)}>
          Semua bank
        </MotionButton>
        {displayedSubjects.map((s) => (
          <MotionButton
            className={folder === s.id ? "active" : ""}
            key={s.id}
            onClick={() => switchFolder(s.id)}
          >
            {s.name}{s.gradeLevel ? ` · ${s.gradeLevel.name}` : ""} <span>{s._count.banks}</span>
          </MotionButton>
        ))}
        <MotionButton className={folder === "unassigned" ? "active" : ""} onClick={() => switchFolder("unassigned")}>
          Belum dikelompokkan
        </MotionButton>
      </div>

      {/* Action bar sub-folder (hanya tampil jika memilih folder spesifik) */}
      {folder && folder !== "unassigned" && (
        <div className="staff-section-head" style={{ marginTop: 10, marginBottom: 14 }}>
          <div>
            <h3>{currentSubject ? `${currentSubject.name}${currentSubject.gradeLevel ? ` · ${currentSubject.gradeLevel.name}` : ""}` : "Folder"}</h3>
            <p>{visible.length} bank soal pada mata pelajaran ini</p>
          </div>
          <div className="staff-action-wrap">
            <MotionButton
              className="staff-secondary"
              disabled={!!subjects.find((s) => s.id === folder)?._count.banks}
              title="Folder harus kosong sebelum dihapus"
              onClick={() => {
                setError("");
                setDeleteFolder(true);
              }}
            >
              Hapus folder
            </MotionButton>
            <label className="staff-secondary staff-file">
              Impor XML
              <input
                type="file"
                accept=".xml,application/xml,text/xml"
                onChange={(e) => {
                  if (e.target.files?.[0]) void prepareXml(e.target.files[0]);
                  e.target.value = "";
                }}
              />
            </label>
            <MotionButton className="staff-primary" onClick={() => setBankOpen(true)}>
              <Icon name="plus" size={16} /> Buat bank
            </MotionButton>
          </div>
        </div>
      )}

      {listLoading && !visible.length ? (
        <BankListSkeleton />
      ) : visible.length > 0 ? (
        <>
          <div className="staff-list">
            {visible.map((b) => (
              <div className="staff-row staff-exam-row" key={b.id}>
                <span>
                  <strong>{b.title} — {b.subjectFolder?.name || b.subject}{b.subjectFolder?.gradeLevel ? ` · ${b.subjectFolder.gradeLevel.name}` : (b.targetGrade ? ` · Tingkat ${b.targetGrade}` : "")}</strong>
                  <small>
                    {b._count.questions} soal · {b.subjectFolder?.name || b.subject}
                    {b.subjectFolder?.gradeLevel ? ` · Tingkat ${b.subjectFolder.gradeLevel.name}` : (b.targetGrade ? ` · Tingkat ${b.targetGrade}` : "")}
                  </small>
                </span>
                <div className="staff-row-actions">
                  <MotionButton onClick={() => void previewBank(b)}>Preview</MotionButton>
                  <MotionButton onClick={() => void openBank(b.id, true)}>Edit</MotionButton>
                  <MotionButton onClick={() => void openBank(b.id, true, true)}>Tambah soal</MotionButton>
                  <MotionButton
                    onClick={() => {
                      setError("");
                      setMoveBank(b);
                      setDestination(b.subjectId || "");
                    }}
                  >
                    Pindahkan
                  </MotionButton>
                  <MotionButton onClick={() => void exportXml(b)}>Ekspor XML</MotionButton>
                </div>
              </div>
            ))}
          </div>

          <nav className="staff-pagination" aria-label="Halaman bank soal">
            <span>{visible.length} bank pada halaman ini</span>
            <div>
              <MotionButton
                className="staff-secondary"
                disabled={cursorIndex === 0}
                onClick={() => setCursorIndex((value) => value - 1)}
              >
                Sebelumnya
              </MotionButton>
              <MotionButton
                className="staff-secondary"
                disabled={!nextCursor}
                onClick={() => {
                  if (!nextCursor) return;
                  setCursors((current) => [...current.slice(0, cursorIndex + 1), nextCursor]);
                  setCursorIndex((value) => value + 1);
                }}
              >
                Berikutnya
              </MotionButton>
            </div>
          </nav>
        </>
      ) : (
        <div className="staff-empty" style={{ padding: "48px 24px" }}>
          <h3>Belum ada bank soal</h3>
          <p>Mulai susun butir soal pertama Anda untuk pelaksanaan ujian.</p>
          <div style={{ marginTop: 16 }}>
            <MotionButton className="staff-primary" disabled={masterLoading} onClick={() => startNewQuestionBank()}>
              <Icon name="plus" size={16} /> Buat Soal Sekarang
            </MotionButton>
          </div>
        </div>
      )}

      {/* Pop-up Preview Dialog for Entire Bank */}
      <Dialog
        open={!!viewingBank}
        variant="wide"
        title={`Pratinjau — ${viewingBank?.title || "Bank Soal"}`}
        onClose={() => setViewingBank(null)}
      >
        {viewingBank && (
          <div className="bank-full-preview-list">
            <p style={{ margin: "0 0 10px", color: "var(--staff-muted)", fontSize: "11px" }}>
              Mata pelajaran: <strong>{viewingBank.subject}</strong> · Total:{" "}
              <strong>{viewingBank.questions?.length || 0} butir soal</strong>
            </p>
            {viewingBank.questions && viewingBank.questions.length > 0 ? (
              viewingBank.questions.map((q, idx) => (
                <section key={q.id || idx} className="bank-student-card" style={{ marginBottom: 10, padding: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <strong style={{ fontSize: "12px" }}>Soal {idx + 1}</strong>
                    <span style={{ fontSize: "11px", color: "var(--staff-muted)" }}>
                      {q.points} Poin · {q.type === "short_answer" ? "Penilaian manual" : "Auto-grade"}
                    </span>
                  </div>
                  <QuestionContent content={q.content} text={q.questionText} imageUrl={q.imageUrl} imageAlt={q.imageAlt} />
                  {q.type === "short_answer" ? (
                    <p className="staff-note" style={{ margin: "8px 0 0" }}>
                      Soal isian singkat (penilaian manual oleh guru).
                    </p>
                  ) : (
                    <div className="bank-student-options" style={{ marginTop: 10 }}>
                      {q.options.map((o) => {
                        const isCorrect =
                          q.type === "multi_select"
                            ? q.correctAnswers?.includes(o.id)
                            : q.correctAnswer === o.id;
                        return (
                          <div key={o.id} className={`bank-student-opt ${isCorrect ? "selected" : ""}`}>
                            <input
                              type={q.type === "multi_select" ? "checkbox" : "radio"}
                              checked={!!isCorrect}
                              readOnly
                            />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <QuestionContent
                                content={o.content}
                                text={o.text}
                                imageUrl={o.imageUrl}
                                imageAlt={o.imageAlt}
                              />
                            </div>
                            {isCorrect && (
                              <span style={{ fontSize: "10px", fontWeight: 700, color: "#7867d9" }}>
                                Kunci
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              ))
            ) : (
              <p>Belum ada butir soal dalam bank ini.</p>
            )}
            <div className="staff-dialog-actions" style={{ marginTop: 16 }}>
              <MotionButton
                className="staff-primary"
                onClick={() => {
                  const id = viewingBank.id;
                  setViewingBank(null);
                  void openBank(id, true, true);
                }}
              >
                Tambah Soal ke Bank Ini
              </MotionButton>
            </div>
          </div>
        )}
      </Dialog>

      {/* Dialog Folder Management */}
      <Dialog open={deleteFolder} title="Hapus mata pelajaran?" onClose={() => setDeleteFolder(false)}>
        <div className="staff-form">
          <p>Folder yang kosong akan dihapus. Riwayat ujian tetap tersimpan.</p>
          <ErrorText error={error} />
          <div className="staff-dialog-actions">
            <MotionButton className="staff-secondary" onClick={() => setDeleteFolder(false)}>
              Batal
            </MotionButton>
            <MotionButton className="staff-primary" disabled={busy} onClick={() => void removeFolder()}>
              Hapus folder
            </MotionButton>
          </div>
        </div>
      </Dialog>

      {/* Dialog Pindahkan Bank */}
      <Dialog open={!!moveBank} title="Pindahkan bank soal" onClose={() => setMoveBank(null)}>
        <form className="staff-form" onSubmit={move}>
          <p>
            Pindahkan <strong>{moveBank?.title}</strong> ke mata pelajaran lain dalam tingkat yang sama.
          </p>
          <label>
            Mata pelajaran tujuan
            <select required value={destination} onChange={(e) => setDestination(e.target.value)}>
              <option value="">
                {allowedMoveSubjects.length ? "Pilih mata pelajaran tujuan" : "Tidak ada mata pelajaran lain pada tingkat yang sama"}
              </option>
              {allowedMoveSubjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}{subject.gradeLevel ? ` · ${subject.gradeLevel.name}` : ""}
                </option>
              ))}
            </select>
          </label>
          <ErrorText error={error} />
          <div className="staff-dialog-actions">
            <MotionButton type="button" className="staff-secondary" onClick={() => setMoveBank(null)}>
              Batal
            </MotionButton>
            <MotionButton className="staff-primary" disabled={busy || !destination || destination === moveBank?.subjectId}>
              Pindahkan
            </MotionButton>
          </div>
        </form>
      </Dialog>

      {/* Dialog XML Import Preview */}
      <Dialog
        open={!!backup}
        title="Preview impor XML"
        onClose={() => {
          setBackup(null);
          setXmlFile(null);
        }}
      >
        <div className="staff-form">
          <p>
            <strong>{backup?.title}</strong> · {backup?.questionCount} soal
          </p>
          <p>Periksa soal setelah diimpor. Gambar eksternal tetap membutuhkan jaringan.</p>
          {backup?.warnings.map((warning) => (
            <p className="staff-note" key={warning}>
              {warning}
            </p>
          ))}
          <label>
            Mata pelajaran tujuan
            <select
              value={folder || ""}
              onChange={(e) => switchFolder(e.target.value)}
              required
            >
              <option value="" disabled>Pilih mata pelajaran tujuan...</option>
              {subjects.filter(s => s.gradeLevelId != null).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}{s.gradeLevel ? ` · ${s.gradeLevel.name}` : ""}
                </option>
              ))}
            </select>
          </label>
          <ErrorText error={error} />
          <div className="staff-dialog-actions">
            <MotionButton
              className="staff-secondary"
              onClick={() => {
                setBackup(null);
                setXmlFile(null);
              }}
            >
              Batal
            </MotionButton>
            <MotionButton
              className="staff-primary"
              disabled={busy || !folder || folder === "unassigned" || !subjects.some(s => s.id === folder && s.gradeLevelId)}
              onClick={() => void confirmImport()}
            >
              {busy ? "Mengimpor…" : "Impor sebagai draf"}
            </MotionButton>
          </div>
        </div>
      </Dialog>

      {/* Dialog Create Bank */}
      <Dialog open={bankOpen} title="Buat bank soal" onClose={() => setBankOpen(false)}>
        <form className="staff-form" onSubmit={createBank}>
          <label>
            Nama bank
            <input
              autoFocus
              required
              maxLength={200}
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
            />
          </label>
          <ErrorText error={error} />
          <MotionButton className="staff-primary" disabled={busy}>
            Buat bank
          </MotionButton>
        </form>
      </Dialog>
    </>
  );
}
