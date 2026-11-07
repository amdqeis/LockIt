"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { JSONContent } from "@tiptap/core";
import DashboardShell from "@/app/components/DashboardShell";
import PrivateMediaImage from "@/app/components/PrivateMediaImage";
import EquationEditor, { docToText } from "@/app/components/EquationEditor";
import StructuredQuestionContent from "@/app/components/StructuredQuestionContent";
import { MAX_XML_FILE_SIZE } from "@/lib/questionBankXml";
import { blankQuestion, emptyDoc, invalidQuestion, normalizeImportedQuestion, parseImportedXml, parsePastedQuestions, RequestError, request, uploadEmbeddedImage, type QuestionKind, type SharedDraft, type SharedQuestion } from "@/lib/sharedQuestionBank";
import styles from "../../../shared-bank.module.css";

function DraftEditor() {
  const { id, draftId } = useParams<{ id: string; draftId: string }>();
  const router = useRouter();
  const [draft, setDraft] = useState<SharedDraft | null>(null);
  const [questions, setQuestions] = useState<SharedQuestion[]>([]);
  const [current, setCurrent] = useState(0);
  const [pasteSource, setPasteSource] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [saveState, setSaveState] = useState("Memuat…");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState(false);
  const revision = useRef(0);
  const latest = useRef<{ questions: SharedQuestion[]; pasteSource: string; bankRevision?: number }>({ questions: [], pasteSource: "" });
  const dirty = useRef(false);
  const inFlight = useRef<Promise<void> | null>(null);
  const cacheKey = `eduquas-bank-draft-${draftId}`;
  useEffect(() => {
    let mounted = true;
    request<SharedDraft>(`/api/question-banks/${id}/drafts/${draftId}`).then(data => {
      if (!mounted) return;
      revision.current = data.revision;
      let content = data.content;
      try {
        const raw = localStorage.getItem(cacheKey);
        if (raw) {
          const cached = JSON.parse(raw) as { revision: number; content: typeof content };
          if (cached.revision === data.revision) { content = cached.content; dirty.current = true; }
          else { content = cached.content; revision.current = cached.revision; dirty.current = true; setConflict(true); setError("Draf di server telah berubah. Simpan pekerjaan lokal sebagai salinan sebelum melanjutkan."); }
        }
      } catch { setError("Salinan lokal tidak dapat dibaca; data server tetap tersedia."); }
      const usedIds = new Set<string>();
      const restored = content.questions.map(item => {
        const normalized = normalizeImportedQuestion(item);
        const existingId = typeof item.clientId === "string" && item.clientId && !usedIds.has(item.clientId) ? item.clientId : crypto.randomUUID();
        usedIds.add(existingId);
        return { ...normalized, ...item, clientId: existingId, content: item.content?.type === "doc" ? item.content : normalized.content, hintContent: item.hintContent?.type === "doc" ? item.hintContent : normalized.hintContent, correctAnswers: Array.isArray(item.correctAnswers) ? item.correctAnswers : normalized.correctAnswers, options: Array.isArray(item.options) ? item.options.map((option, index) => ({ ...normalized.options[index], ...option, content: option.content?.type === "doc" ? option.content : normalized.options[index]?.content })) : normalized.options };
      });
      latest.current = { questions: restored, pasteSource: content.pasteSource || "", bankRevision: content.bankRevision };
      setQuestions(restored); setPasteSource(content.pasteSource || ""); setDraft(data); setSaveState(dirty.current ? "Ada perubahan lokal" : "Tersimpan");
    }).catch(err => { if (mounted) { setError(err.message); setSaveState("Tidak dapat memuat"); } });
    return () => { mounted = false; };
  }, [cacheKey, draftId, id]);
  const update = useCallback((next: SharedQuestion[], source = latest.current.pasteSource) => {
    latest.current = { ...latest.current, questions: next, pasteSource: source }; dirty.current = true;
    setQuestions(next); setPasteSource(source); setSaveState("Belum tersimpan");
    try { localStorage.setItem(cacheKey, JSON.stringify({ revision: revision.current, content: latest.current })); }
    catch { setError("Salinan lokal tidak dapat disimpan. Jangan tutup halaman sampai draf tersimpan di server."); }
  }, [cacheKey]);
  const flush = useCallback(async () => {
    if (inFlight.current) await inFlight.current;
    if (!dirty.current) return;
    const snapshot = JSON.stringify(latest.current);
    setSaveState("Menyimpan…");
    const task = (async () => {
      const saved = await request<SharedDraft>(`/api/question-banks/${id}/drafts/${draftId}`, { method: "PUT", body: JSON.stringify({ revision: revision.current, content: JSON.parse(snapshot) }) });
      revision.current = saved.revision;
      dirty.current = JSON.stringify(latest.current) !== snapshot;
      if (dirty.current) localStorage.setItem(cacheKey, JSON.stringify({ revision: saved.revision, content: latest.current }));
      else localStorage.removeItem(cacheKey);
      setSaveState(dirty.current ? "Belum tersimpan" : "Tersimpan"); setError("");
    })();
    inFlight.current = task;
    try { await task; } finally { inFlight.current = null; }
  }, [cacheKey, draftId, id]);
  useEffect(() => {
    if (!draft || !dirty.current || busy || conflict) return;
    const timer = window.setTimeout(() => { void flush().catch(err => { if (err instanceof RequestError && err.code === "CONFLICT") setConflict(true); setSaveState("Belum tersimpan"); setError(err.message); }); }, 900);
    return () => window.clearTimeout(timer);
  }, [draft, questions, pasteSource, busy, conflict, flush]);
  const modify = (patch: Partial<SharedQuestion>) => { if (!busy) update(questions.map((q, i) => i === current ? { ...q, ...patch, ...(patch.type ? { importIssue: undefined } : {}) } : q)); };
  const copyDraft = async () => {
    setBusy(true);
    try {
      const copy = await request<SharedDraft>(`/api/question-banks/${id}/drafts`, { method: "POST", body: JSON.stringify({ ...latest.current, bankRevision: undefined, questions: latest.current.questions.map(question => ({ ...question, sourceQuestionId: undefined })) }) });
      localStorage.removeItem(cacheKey);
      router.push(`/dashboard/question-bank/${id}/drafts/${copy.id}`);
    } catch (err) { setError(err instanceof Error ? err.message : "Salinan draf belum dapat disimpan."); setBusy(false); }
  };
  const uploadImage = async (file: File | undefined, optionId?: string) => {
    if (!file || !q) return;
    setBusy(true); setError("");
    try {
      const form = new FormData(); form.set("image", file);
      const uploaded = await request<{ url: string }>("/api/question-banks/media", { method: "POST", body: form });
      const next = latest.current.questions.map(item => item.clientId !== q.clientId ? item : optionId ? { ...item, options: item.options.map(o => o.id === optionId ? { ...o, imageUrl: uploaded.url } : o) } : { ...item, imageUrl: uploaded.url });
      update(next);
    } catch (err) { setError(err instanceof Error ? err.message : "Gambar belum dapat diunggah."); }
    finally { setBusy(false); }
  };
  const importFile = async (file?: File) => {
    if (!file) return;
    if (file.size > MAX_XML_FILE_SIZE) { setError("Ukuran berkas maksimal 2 MB."); return; }
    setBusy(true);
    try {
      const text = await file.text();
      let items: unknown[] = [];
      let messages: string[] = [];
      if (/\.xml$/i.test(file.name)) {
        const parsed = parseImportedXml(text);
        items = parsed.questions;
        messages = parsed.warnings;
      } else if (/\.json$/i.test(file.name)) {
        const data: unknown = JSON.parse(text);
        if (Array.isArray(data)) items = data;
        else if (data && typeof data === "object" && Array.isArray((data as { questions?: unknown }).questions)) items = (data as { questions: unknown[] }).questions;
        else throw new Error("JSON harus berisi daftar questions.");
      } else throw new Error("Pilih berkas XML atau JSON.");
      if (!items.length) throw new Error("Tidak ada soal yang dapat ditambahkan. Periksa berkas sumber.");
      const blank = questions.length === 1 && !questions[0].questionText && !questions[0].imageUrl && questions[0].options.every(o => !o.text && !o.imageUrl);
      const prior = blank ? [] : questions;
      if (prior.length + items.length > 200) throw new Error("Jumlah draf melebihi 200 soal.");
      const imported = /\.xml$/i.test(file.name) ? items as SharedQuestion[] : items.map(normalizeImportedQuestion);
      for (const question of imported) {
        question.imageUrl = await uploadEmbeddedImage(question.imageUrl);
        for (const option of question.options) option.imageUrl = await uploadEmbeddedImage(option.imageUrl);
      }
      update([...prior, ...imported]); setCurrent(prior.length); setWarnings([...messages, ...imported.flatMap((item, index) => item.importIssue ? [`Soal ${index + 1}: ${item.importIssue}`] : [])]); setShowPaste(true); setError("");
    } catch (err) { setError(err instanceof Error ? err.message : "Berkas tidak dapat dibaca."); }
    finally { setBusy(false); }
  };
  const saveAll = async () => {
    const invalid = questions.findIndex(q => invalidQuestion(q).length > 0);
    if (invalid >= 0) { setCurrent(invalid); setError(`Periksa soal ${invalid + 1}: ${invalidQuestion(questions[invalid]).join(" ")}`); return; }
    (document.activeElement as HTMLElement | null)?.blur();
    setBusy(true); setError("");
    try {
      while (dirty.current || inFlight.current) await flush();
      await request(`/api/question-banks/${id}/drafts/${draftId}/commit`, { method: "POST", body: JSON.stringify({ revision: revision.current }) });
      localStorage.removeItem(cacheKey); router.push("/dashboard/question-bank");
    } catch (err) { if (err instanceof RequestError && err.code === "CONFLICT") setConflict(true); setError(err instanceof Error ? err.message : "Soal belum dapat disimpan."); }
    finally { setBusy(false); }
  };
  if (!draft) return <DashboardShell><div className={styles.page}><p role={error ? "alert" : "status"}>{error || "Memuat draf…"}</p><Link href="/dashboard/question-bank">Kembali ke bank soal</Link></div></DashboardShell>;
  const q = questions[current];
  const changeDoc = (field: "content" | "hintContent", doc: JSONContent) => modify(field === "content" ? { content: doc, questionText: docToText(doc) } : { hintContent: doc, hint: docToText(doc) });
  return <DashboardShell><div className={`${styles.page} batch-page`}><header className={styles.header}><div><Link href="/dashboard/question-bank">Bank soal</Link><h1>Susun soal</h1><p role="status">{saveState} · {questions.length} dari 200 soal</p></div><div className={styles.actions}><button type="button" onClick={() => setShowPaste(!showPaste)} aria-expanded={showPaste}>Tempel atau impor</button><button type="button" onClick={() => setShowPreview(!showPreview)} aria-expanded={showPreview}>{showPreview ? "Tutup pratinjau" : "Pratinjau"}</button><button type="button" className={styles.primary} disabled={busy || conflict || !questions.length} onClick={() => void saveAll()}>Simpan semua</button></div></header>
    {error && <div className={styles.error} role="alert">{error}{conflict && <button type="button" disabled={busy} onClick={() => void copyDraft()}>Simpan sebagai salinan</button>}</div>}
    {showPaste && <section className={styles.panel}><h2>Tempel atau impor soal</h2><p>Gunakan nomor soal, pilihan A–F, Kunci: dan Bobot: pada baris terpisah, atau pilih berkas XML/JSON.</p><label className="batch-label">Impor berkas<input type="file" accept=".xml,.json,application/xml,application/json,text/xml" onChange={e => { void importFile(e.target.files?.[0]); e.target.value = ""; }} /></label><label className="batch-label">Teks soal<textarea rows={8} value={pasteSource} onChange={e => update(questions, e.target.value)} placeholder={'1. Berapa hasil 2 + 2?\nA. 3\nB. 4\nKunci: B\nBobot: 10'} /></label><div className={styles.actions}><button type="button" onClick={() => { const result = parsePastedQuestions(pasteSource); const blank = questions.length === 1 && !questions[0].questionText && !questions[0].imageUrl && questions[0].options.every(o => !o.text && !o.imageUrl); const prior = blank ? [] : questions; if (prior.length + result.questions.length > 200) { setWarnings(["Jumlah draf melebihi 200 soal."]); return; } if (result.questions.length) { update([...prior, ...result.questions]); setCurrent(prior.length); } setWarnings(result.warnings); }}>Tambahkan ke draf</button></div>{warnings.map(w => <p key={w} role="status">{w}</p>)}</section>}
    <div className={`batch-layout ${showPreview ? "with-preview" : ""}`}><aside className={`${styles.panel} batch-list`}><div className="batch-list-head"><h2>Daftar soal</h2><button type="button" disabled={busy || questions.length >= 200} onClick={() => { update([...questions, blankQuestion(q?.type || "single_choice", q?.points || 10)]); setCurrent(questions.length); }}>Tambah</button></div><nav aria-label="Daftar soal">{questions.map((item, i) => <button key={item.clientId} type="button" className={`batch-question ${i === current ? "is-current" : ""}`} onClick={() => setCurrent(i)} aria-current={i === current ? "step" : undefined}><strong>{i + 1}. {item.questionText || "Soal baru"}</strong><span>{invalidQuestion(item).length ? "Belum lengkap" : "Siap"}</span></button>)}</nav></aside>
    {q && <section className={`${styles.panel} batch-editor`}><div className="batch-list-head"><div><h2>Soal {current + 1}</h2><p>{invalidQuestion(q).length ? "Lengkapi isi dan kunci jawaban." : "Siap disimpan."}</p></div><div className={styles.actions}><button type="button" disabled={busy || current === 0} onClick={() => { const next = [...questions]; [next[current - 1], next[current]] = [next[current], next[current - 1]]; update(next); setCurrent(current - 1); }}>Naik</button><button type="button" disabled={busy || current === questions.length - 1} onClick={() => { const next = [...questions]; [next[current + 1], next[current]] = [next[current], next[current + 1]]; update(next); setCurrent(current + 1); }}>Turun</button><button type="button" disabled={busy || questions.length >= 200} onClick={() => { const copy = structuredClone(q); copy.clientId = crypto.randomUUID(); delete copy.sourceQuestionId; delete copy.id; const next = [...questions]; next.splice(current + 1, 0, copy); update(next); setCurrent(current + 1); }}>Duplikasi</button><button type="button" disabled={busy || questions.length <= 1} onClick={() => { update(questions.filter((_, i) => i !== current)); setCurrent(Math.max(0, current - 1)); }}>Hapus</button></div></div>{q.importIssue && <div className={styles.error} role="alert">{q.importIssue} <button type="button" onClick={() => modify({ importIssue: undefined })}>Jenis soal sudah sesuai</button></div>}
      <fieldset disabled={busy} className="batch-fields"><div className={styles.fields}><label>Jenis soal<select value={q.type} onChange={e => modify({ type: e.target.value as QuestionKind })}><option value="single_choice">Pilihan ganda</option><option value="multi_select">Multi-pilih</option><option value="latex">Matematika</option><option value="short_answer">Jawaban singkat</option></select></label><label>Bobot<input type="number" min={1} max={100} value={q.points} onChange={e => modify({ points: Number(e.target.value) })} /></label></div><div className="batch-label">Pertanyaan<EquationEditor disabled={busy} key={`${q.clientId}-question`} label={`Pertanyaan soal ${current + 1}`} value={q.content || emptyDoc()} onChange={doc => changeDoc("content", doc)} /></div><label className="batch-label">Gambar soal (PNG, JPEG, WebP; maksimal 2 MB)<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => void uploadImage(e.target.files?.[0])} /></label>{q.imageUrl && <div><PrivateMediaImage src={q.imageUrl} alt={q.imageAlt || "Gambar soal"} style={{ maxWidth: "100%", maxHeight: 180 }} /><label className="batch-label">Teks alternatif gambar<input value={q.imageAlt || ""} onChange={e => modify({ imageAlt: e.target.value })} /></label><button type="button" onClick={() => modify({ imageUrl: null, imageAlt: null })}>Hapus gambar</button></div>}
      {q.type !== "short_answer" && <div className="batch-options"><h3>Pilihan dan kunci jawaban</h3><p>{q.type === "multi_select" ? "Pilih semua jawaban benar." : "Pilih satu jawaban benar."}</p>{q.options.map((o, index) => <div className="batch-option" key={o.id}>
        <label><input type={q.type === "multi_select" ? "checkbox" : "radio"} name={`correct-${q.clientId}`} checked={q.type === "multi_select" ? q.correctAnswers.includes(o.id) : q.correctAnswer === o.id} onChange={() => modify(q.type === "multi_select" ? { correctAnswers: q.correctAnswers.includes(o.id) ? q.correctAnswers.filter(x => x !== o.id) : [...q.correctAnswers, o.id] } : { correctAnswer: o.id })} /> Kunci {o.label}</label>
        <EquationEditor disabled={busy} key={`${q.clientId}-${o.id}`} label={`Pilihan ${o.label}`} value={o.content || emptyDoc()} onChange={doc => modify({ options: q.options.map((item, i) => i === index ? { ...item, content: doc, text: docToText(doc) } : item) })} />
        <label>Gambar pilihan {o.label}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => void uploadImage(e.target.files?.[0], o.id)} /></label>
        {o.imageUrl && <div><PrivateMediaImage src={o.imageUrl} alt={o.imageAlt || `Gambar pilihan ${o.label}`} style={{ maxWidth: "100%", maxHeight: 120 }} /><label className="batch-label">Teks alternatif gambar<input value={o.imageAlt || ""} onChange={e => modify({ options: q.options.map(item => item.id === o.id ? { ...item, imageAlt: e.target.value } : item) })} /></label><button type="button" onClick={() => modify({ options: q.options.map(item => item.id === o.id ? { ...item, imageUrl: null, imageAlt: null } : item) })}>Hapus gambar</button></div>}
        <button type="button" disabled={q.options.length <= 2} onClick={() => modify({ options: q.options.filter((_, i) => i !== index), correctAnswer: q.correctAnswer === o.id ? null : q.correctAnswer, correctAnswers: q.correctAnswers.filter(x => x !== o.id) })}>Hapus pilihan {o.label}</button>
      </div>)}<button type="button" disabled={q.options.length >= 6} onClick={() => { const id = "abcdef".split("").find(x => !q.options.some(o => o.id === x)); if (id) modify({ options: [...q.options, { id, label: id.toUpperCase(), text: "", content: emptyDoc() }] }); }}>Tambah pilihan</button></div>}
      <div className="batch-label">Petunjuk (opsional)<EquationEditor disabled={busy} key={`${q.clientId}-hint`} label="Petunjuk soal" value={q.hintContent || emptyDoc()} onChange={doc => changeDoc("hintContent", doc)} /></div></fieldset></section>}
      {showPreview && q && <aside className={`${styles.panel} batch-preview`} aria-label="Pratinjau soal"><h2>Pratinjau siswa</h2><p>Soal {current + 1} · {q.points} poin</p><div className="batch-preview-body"><StructuredQuestionContent content={q.content || emptyDoc()} />{q.imageUrl && <PrivateMediaImage src={q.imageUrl} alt={q.imageAlt || "Gambar soal"} style={{ maxWidth: "100%", maxHeight: 200, objectFit: "contain" }} />}{q.type !== "short_answer" && q.options.map(o => <div className="batch-preview-option" key={o.id}><strong>{o.label}.</strong><div><StructuredQuestionContent content={o.content || emptyDoc()} />{o.imageUrl && <PrivateMediaImage src={o.imageUrl} alt={o.imageAlt || `Gambar pilihan ${o.label}`} style={{ maxWidth: "100%", maxHeight: 120 }} />}</div></div>)}{q.type === "short_answer" && <p>Peserta mengetik jawaban singkat.</p>}</div></aside>}
    </div>
  </div></DashboardShell>;
}

export default function DraftEditorPage() {
  return <Suspense fallback={<DashboardShell><p role="status">Memuat draf…</p></DashboardShell>}><DraftEditor /></Suspense>;
}
