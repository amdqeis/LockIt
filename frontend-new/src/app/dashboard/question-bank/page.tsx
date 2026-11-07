"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import DashboardShell from "@/app/components/DashboardShell";
import { blankQuestion, normalizeImportedQuestion, portableImage, request, uploadEmbeddedImage, type SharedBank, type SharedDraft, type SharedQuestion } from "@/lib/sharedQuestionBank";
import { getStoredQuestionBanks, getStoredQuestions, type BankQuestion, type QuestionBank } from "@/lib/questionBank";
import { downloadXmlFile, exportBankToXml } from "@/lib/questionBankXml";
import styles from "./shared-bank.module.css";

export default function QuestionBanksPage() {
  const router = useRouter();
  const [banks, setBanks] = useState<SharedBank[]>([]);
  const [selected, setSelected] = useState<SharedBank | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [create, setCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [localBanks, setLocalBanks] = useState<QuestionBank[] | null>(null);
  const refresh = async () => {
    setError("");
    try { setBanks(await request<SharedBank[]>("/api/question-banks")); }
    catch (err) { setError(err instanceof Error ? err.message : "Bank soal tidak dapat dimuat."); }
    finally { setLoading(false); }
  };
  useEffect(() => {
    let active = true;
    request<SharedBank[]>("/api/question-banks").then(data => { if (active) setBanks(data); })
      .catch(err => { if (active) setError(err instanceof Error ? err.message : "Bank soal tidak dapat dimuat."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const visible = useMemo(() => banks.filter(b => `${b.title} ${b.subject}`.toLowerCase().includes(query.toLowerCase()) && (status === "all" || b.status === status)), [banks, query, status]);
  const openBank = async (id: string) => {
    setBusy(true); setError("");
    try { setSelected(await request<SharedBank>(`/api/question-banks/${id}`)); }
    catch (err) { setError(err instanceof Error ? err.message : "Bank soal tidak dapat dibuka."); }
    finally { setBusy(false); }
  };
  const createBank = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const bank = await request<SharedBank>("/api/question-banks", { method: "POST", body: JSON.stringify({ title: title.trim(), subject: subject.trim() }) });
      setCreate(false); setTitle(""); setSubject(""); await refresh(); await openBank(bank.id);
    } catch (err) { setError(err instanceof Error ? err.message : "Bank soal tidak dapat dibuat."); }
    finally { setBusy(false); }
  };
  const startDraft = async () => {
    if (!selected) return;
    setBusy(true); setError("");
    try {
      const draft = await request<SharedDraft>(`/api/question-banks/${selected.id}/drafts`, { method: "POST", body: JSON.stringify({ questions: [blankQuestion()] }) });
      router.push(`/dashboard/question-bank/${selected.id}/drafts/${draft.id}`);
    } catch (err) { setError(err instanceof Error ? err.message : "Draf tidak dapat dibuat."); setBusy(false); }
  };
  const editQuestion = async (question: SharedQuestion) => {
    if (!selected || !question.id) return;
    setBusy(true); setError("");
    try {
      const normalized = normalizeImportedQuestion(question);
      normalized.sourceQuestionId = question.id;
      const draft = await request<SharedDraft>(`/api/question-banks/${selected.id}/drafts`, { method: "POST", body: JSON.stringify({ questions: [normalized], bankRevision: selected.revision }) });
      router.push(`/dashboard/question-bank/${selected.id}/drafts/${draft.id}`);
    } catch (err) { setError(err instanceof Error ? err.message : "Draf tidak dapat dibuat."); setBusy(false); }
  };
  const deleteQuestion = async (question: SharedQuestion) => {
    if (!selected || !question.id || !window.confirm("Hapus soal dari bank? Ujian yang sudah dibuat tidak berubah.")) return;
    setBusy(true); setError("");
    try {
      await request(`/api/question-banks/${selected.id}/questions/${question.id}`, { method: "DELETE", body: JSON.stringify({ revision: selected.revision }) });
      await openBank(selected.id);
    } catch (err) { setError(err instanceof Error ? err.message : "Soal tidak dapat dihapus."); }
    finally { setBusy(false); }
  };
  const updateBank = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected) return;
    const data = new FormData(event.currentTarget);
    setBusy(true); setError("");
    try {
      await request(`/api/question-banks/${selected.id}`, { method: "PATCH", body: JSON.stringify({ revision: selected.revision, title: data.get("title"), subject: data.get("subject"), status: data.get("status") }) });
      await refresh(); await openBank(selected.id);
    } catch (err) { setError(err instanceof Error ? err.message : "Bank soal tidak dapat diperbarui."); }
    finally { setBusy(false); }
  };
  const deleteBank = async () => {
    if (!selected || !window.confirm(`Hapus bank “${selected.title}” beserta soal dan drafnya? Ujian yang sudah dibuat tidak berubah.`)) return;
    setBusy(true); setError("");
    try {
      await request(`/api/question-banks/${selected.id}`, { method: "DELETE", body: JSON.stringify({ revision: selected.revision }) });
      setSelected(null); await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Bank soal tidak dapat dihapus."); }
    finally { setBusy(false); }
  };
  const importLocal = async (bank: QuestionBank) => {
    if (!window.confirm(`Impor bank “${bank.title}”? Bank akan dapat diakses semua guru dan admin.`)) return;
    setBusy(true); setError("");
    try {
      const source = getStoredQuestions(bank.id);
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify({ bank, questions: source })));
      const importKey = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
      const existing = await request<{ bankId: string; draftId: string | null; committed: boolean } | null>(`/api/question-banks/import?key=${importKey}`);
      if (existing) {
        if (existing.committed || !existing.draftId) { await refresh(); await openBank(existing.bankId); }
        else router.push(`/dashboard/question-bank/${existing.bankId}/drafts/${existing.draftId}`);
        return;
      }
      const questions = [];
      for (const item of source) {
        const question = normalizeImportedQuestion(item);
        question.imageUrl = await uploadEmbeddedImage(question.imageUrl);
        for (const option of question.options) option.imageUrl = await uploadEmbeddedImage(option.imageUrl);
        questions.push(question);
      }
      const contents = [];
      for (let index = 0; index < questions.length; index += 200) contents.push({ questions: questions.slice(index, index + 200) });
      if (!contents.length) contents.push({ questions: [blankQuestion()] });
      const result = await request<{ bankId: string; draftId: string | null; committed?: boolean; alreadyImported: boolean }>("/api/question-banks/import", { method: "POST", body: JSON.stringify({ importKey, bank: { title: bank.title, subject: bank.subject, description: bank.description, tags: bank.tags, difficulty: bank.difficulty, status: bank.status }, contents }) });
      if (result.committed || !result.draftId) { await refresh(); await openBank(result.bankId); }
      else router.push(`/dashboard/question-bank/${result.bankId}/drafts/${result.draftId}`);
    } catch (err) { setError(err instanceof Error ? err.message : "Bank lokal belum dapat diimpor."); }
    finally { setBusy(false); }
  };
  const exportBank = async () => {
    if (!selected) return;
    setBusy(true); setError("");
    try {
      const questions: BankQuestion[] = [];
      for (const [index, q] of (selected.questions || []).entries()) {
        const options = [];
        for (const option of q.options) options.push({ ...option, imageUrl: await portableImage(option.imageUrl) });
        questions.push({ ...q, id: q.id || String(index), bankId: selected.id, orderIndex: index + 1, createdAt: "", updatedAt: "", imageUrl: await portableImage(q.imageUrl), options });
      }
      const bank: QuestionBank = { id: selected.id, title: selected.title, subject: selected.subject, description: selected.description || null, tags: [], difficulty: "mixed", status: selected.status as QuestionBank["status"], questionCount: questions.length, totalPoints: questions.reduce((sum, q) => sum + q.points, 0), usedInExams: 0, createdAt: "", updatedAt: "", createdBy: "" };
      downloadXmlFile(exportBankToXml(bank, questions), `${selected.title.replace(/[^a-z0-9_-]+/gi, "-") || "bank-soal"}.xml`);
    } catch (err) { setError(err instanceof Error ? err.message : "Ekspor gagal."); }
    finally { setBusy(false); }
  };
  return <DashboardShell><div className={styles.page}>
    <header className={styles.header}><div><h1>Bank soal</h1><p>Kumpulkan soal untuk digunakan dalam ujian.</p></div><button className={styles.primary} onClick={() => { setCreate(!create); setSelected(null); }} aria-expanded={create}>{create ? "Tutup" : "Buat bank soal"}</button></header>
    {error && <div className={styles.error} role="alert">{error} <button onClick={() => { void refresh(); }}>Coba lagi</button></div>}
    {create && <form className={styles.panel} onSubmit={createBank}><h2>Bank soal baru</h2><div className={styles.fields}><label>Nama bank soal<input value={title} onChange={e => setTitle(e.target.value)} maxLength={200} required /></label><label>Mata pelajaran<input value={subject} onChange={e => setSubject(e.target.value)} maxLength={100} required /></label></div><div className={styles.actions}><button className={styles.primary} disabled={busy}>Simpan bank soal</button><button type="button" onClick={() => setCreate(false)}>Batal</button></div></form>}
    {selected ? <section className={styles.section}><button className={styles.textButton} onClick={() => setSelected(null)}>Kembali ke bank soal</button><div className={styles.sectionHeading}><div><h2>{selected.title}</h2><p>{selected.subject} · {selected.questions?.length || 0} soal</p></div><div className={styles.actions}><button disabled={busy || !selected.questions?.length} onClick={() => void exportBank()}>Ekspor XML</button><button className={styles.primary} disabled={busy} onClick={startDraft}>Tambah soal</button></div></div>
      <details className={styles.panel}><summary>Pengaturan bank soal</summary><form key={`${selected.id}-${selected.revision}`} onSubmit={updateBank}><div className={styles.fields}><label>Nama bank soal<input name="title" defaultValue={selected.title} maxLength={200} required /></label><label>Mata pelajaran<input name="subject" defaultValue={selected.subject} maxLength={100} required /></label><label>Status<select name="status" defaultValue={selected.status}><option value="draft">Draf</option><option value="active">Aktif</option><option value="archived">Arsip</option></select></label></div><div className={styles.actions}><button className={styles.primary} disabled={busy}>Simpan perubahan</button><button type="button" disabled={busy} onClick={() => void deleteBank()}>Hapus bank</button></div></form></details>
      {(selected.drafts?.length || 0) > 0 && <div className={styles.panel}><h3>Draf kumpulan</h3>{selected.drafts?.map(d => <div className={styles.row} key={d.id}><div><strong>{d.content.questions.length} soal</strong><small>Terakhir diubah {new Date(d.updatedAt).toLocaleString("id-ID")}</small></div><Link href={`/dashboard/question-bank/${selected.id}/drafts/${d.id}`}>Lanjutkan</Link></div>)}</div>}
      <div className={styles.panel}><h3>Soal dalam bank</h3>{selected.questions?.length ? selected.questions.map((q, i) => <div className={styles.row} key={q.id}><div><strong>{i + 1}. {q.questionText}</strong><small>{q.type === "short_answer" ? "Jawaban singkat" : q.type === "multi_select" ? "Multi-pilih" : "Pilihan ganda"} · {q.points} poin</small></div><div className={styles.actions}><button type="button" disabled={busy} onClick={() => void editQuestion(q)}>Edit</button><button type="button" disabled={busy} onClick={() => void deleteQuestion(q)}>Hapus</button></div></div>) : <p className={styles.muted}>Belum ada soal. Tambahkan soal untuk memulai.</p>}</div>
    </section> : <section className={styles.section}><div className={styles.filters}><label>Cari bank soal<input value={query} onChange={e => setQuery(e.target.value)} placeholder="Nama atau mata pelajaran" /></label><label>Status<select value={status} onChange={e => setStatus(e.target.value)}><option value="all">Semua status</option><option value="draft">Draf</option><option value="active">Aktif</option><option value="archived">Arsip</option></select></label></div>
      {loading ? <p role="status">Memuat bank soal…</p> : visible.length ? <div className={styles.list}>{visible.map(bank => <button className={styles.bank} key={bank.id} onClick={() => void openBank(bank.id)} disabled={busy}><span><strong>{bank.title}</strong><small>{bank.subject}</small></span><span>{bank._count?.questions ?? 0} soal</span></button>)}</div> : <div className={styles.empty}><h2>Belum ada bank soal</h2><p>Buat bank soal atau ubah pencarian untuk melanjutkan.</p></div>}
      <div className={styles.panel}><h3>Bank soal di browser ini</h3><p>Impor bank lama untuk meninjau dan menyimpannya ke bank bersama. Data di browser tidak dihapus.</p><div className={styles.actions}><button type="button" onClick={() => setLocalBanks(getStoredQuestionBanks())}>Periksa bank lokal</button><Link href="/dashboard/question-bank/legacy">Buka bank lokal</Link></div>{localBanks && (localBanks.length ? localBanks.map(bank => <div className={styles.row} key={bank.id}><div><strong>{bank.title}</strong><small>{bank.subject} · {getStoredQuestions(bank.id).length} soal</small></div><button type="button" disabled={busy} onClick={() => void importLocal(bank)}>Tinjau dan impor</button></div>) : <p className={styles.muted}>Tidak ada bank lokal di browser ini.</p>)}</div>
    </section>}
  </div></DashboardShell>;
}
