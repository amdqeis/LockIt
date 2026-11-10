"use client";

import { MotionButton } from "@/components/MotionButton";
import { motion, useReducedMotion } from "framer-motion";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { io, type Socket } from "socket.io-client";
import { api, post, ApiError, optionKey, socketOrigin, type ExamSession, type Option, type Question, type Waiting } from "@/lib/api";
import { QuestionContent } from "@/components/QuestionContent";
import { Dialog } from "@/components/Dialog";
import Image from "next/image";
import { useExamProctoring } from "@/lib/useExamProctoring";
import { ExamSessionSkeleton } from "@/components/skeletons";

function clock(seconds: number) {
  const value = Math.max(0, seconds);
  return `${String(Math.floor(value / 3600)).padStart(2, "0")}:${String(Math.floor(value % 3600 / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

function QuestionView({ question, index, value, disabled, flagged, onFlag, onChange, toolbarFlag }: { question: Question; index: number; value: string; disabled: boolean; flagged: boolean; onFlag: (id: string) => void; onChange: (id: string, value: string) => void; toolbarFlag: boolean }) {
  const multiple = question.type === "multi_select";
  const reduceMotion = useReducedMotion();
  return <article className="exam-question" id={`question-item-${question.id}`} tabIndex={-1} aria-labelledby={`question-${question.id}`}>
    <div className="question-heading"><span>Soal {index + 1} · {question.points} poin</span>{!toolbarFlag && <FlagButton flagged={flagged} disabled={disabled} onClick={() => onFlag(question.id)} />}</div>
    <div className="question-prompt" id={`question-${question.id}`}><QuestionContent content={question.content} text={question.questionText} imageUrl={question.imageUrl} imageAlt={question.imageAlt} /></div>
    {question.type === "short_answer" ? <label className="short-answer">Jawaban Anda<textarea value={value} maxLength={2000} disabled={disabled} onChange={event => onChange(question.id, event.target.value)} /></label> : <fieldset className="choices" disabled={disabled}><legend>{multiple ? "Pilih semua jawaban yang sesuai" : "Pilih satu jawaban"}</legend>
      {(question.options || []).map((option, optionIndex) => {
        const key = optionKey(option, optionIndex);
        const item = typeof option === "string" ? { text: option } : option as Option;
        const selected = value.toUpperCase().split(",").includes(key);
        return <motion.label whileTap={disabled || reduceMotion ? undefined : { scale: 0.99 }} transition={{ duration: 0.14 }} className={`choice${selected ? " selected" : ""}`} key={`${key}-${optionIndex}`}><input type={multiple ? "checkbox" : "radio"} name={`choice-${question.id}`} checked={selected} onChange={() => {
          if (!multiple) { onChange(question.id, key); return; }
          const next = new Set(value ? value.toUpperCase().split(",") : []);
          if (next.has(key)) next.delete(key); else next.add(key);
          onChange(question.id, [...next].sort().join(","));
        }} /><QuestionContent content={item.content} text={item.text} imageUrl={item.imageUrl} imageAlt={item.imageAlt} /></motion.label>;
      })}
    </fieldset>}
  </article>;
}

function FlagIcon() { return <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 21V4m0 1c5-3 8 3 14 0v10c-6 3-9-3-14 0" /></svg>; }
function FlagButton({ flagged, disabled, onClick }: { flagged: boolean; disabled: boolean; onClick: () => void }) { const reduceMotion = useReducedMotion(); return <MotionButton className="flag-button" type="button" aria-pressed={flagged} disabled={disabled} onClick={onClick}><FlagIcon />{flagged ? "Ditandai" : "Periksa lagi"}<span className="flag-switch" aria-hidden="true"><motion.span initial={false} animate={{ x: flagged ? 13 : 0 }} transition={{ duration: reduceMotion ? 0 : 0.14 }} /></span></MotionButton>; }
function CheckIcon() { return <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m4 12 5 5L20 6" /></svg>; }
function ArrowIcon({ back = false }: { back?: boolean }) { return <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={back ? "M19 12H5m0 0 6-6m-6 6 6 6" : "M5 12h14m0 0-6-6m6 6-6 6"} /></svg>; }

function ExamLockScreen({ offline }: { offline: boolean }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    headingRef.current?.focus();
    return () => {
      if (dialog.open) dialog.close();
      document.body.style.overflow = overflow;
      if (previous?.isConnected && !previous.closest("dialog:not([open])")) previous.focus();
      else document.getElementById("exam-title")?.focus();
    };
  }, []);
  return <dialog ref={dialogRef} className="exam-lock-screen" role="alertdialog" aria-labelledby="exam-lock-title" aria-describedby="exam-lock-description" onCancel={(event) => event.preventDefault()}>
    <div className="exam-lock-content">
      <svg aria-hidden="true" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
      <h2 id="exam-lock-title" ref={headingRef} tabIndex={-1}>Ujian terkunci</h2>
      <p id="exam-lock-description">Hubungi pengawas untuk membuka kunci. Waktu ujian tetap berjalan.</p>
      {offline && <p className="exam-lock-offline" role="status">Koneksi terputus. Menunggu koneksi kembali.</p>}
    </div>
  </dialog>;
}

type Heartbeat = { isLocked: boolean; isExamActive: boolean; serverTime: string; warning: { id: string; message: string } | null };
type Incident = { incidentId: string; eventType: "screenshot"; metadata: { source: "keyboard_shortcut"; shortcut: "print_screen" | "windows_snipping" | "macos_capture" } };

export default function ExamSessionPage() {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [waiting, setWaiting] = useState<Waiting | null>(null);
  const [session, setSession] = useState<ExamSession | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [locked, setLocked] = useState(false);
  const [offline, setOffline] = useState(false);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">("saved");
  const [saveError, setSaveError] = useState("");
  const [notice, setNotice] = useState("");
  const [warning, setWarning] = useState<{ id: string; message: string } | null>(null);
  const [clockOffset, setClockOffset] = useState(0);
  const [now, setNow] = useState(0);
  const [index, setIndex] = useState(0);
  const [flagged, setFlagged] = useState<string[]>([]);
  const [confirm, setConfirm] = useState<0 | 1 | 2>(0);
  const [submitting, setSubmitting] = useState(false);
  const pending = useRef(new Map<string, string>());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const inflight = useRef(new Map<string, Promise<boolean>>());
  const lockedRef = useRef(false);
  const pendingIncident = useRef<Incident | null>(null);
  const pendingIncidentOwner = useRef("");
  const sendIncidentRef = useRef<() => Promise<void>>(async () => {});
  const answerRevision = useRef(0);
  const socket = useRef<Socket | null>(null);
  const syncRef = useRef<() => Promise<void>>(async () => {});
  const flagOwner = useRef("");
  const navigatorRef = useRef<HTMLDivElement>(null);

  const setLock = useCallback((value: boolean) => { lockedRef.current = value; if (value) setConfirm(0); setLocked(value); }, []);
  const proctoring = useExamProctoring(session, locked, setLock);
  const sync = useCallback(async () => {
    const initialRevision = answerRevision.current;
    try {
      const state = await api<Waiting>("/api/exam-session/waiting");
      setWaiting(state); setClockOffset(Date.parse(state.exam.serverTime) - Date.now()); setOffline(false);
      const storageKey = `eduquas:exam-flags:${state.exam.id}:${state.student.id}`;
      if (flagOwner.current !== storageKey) {
        flagOwner.current = storageKey;
        try { const saved = JSON.parse(localStorage.getItem(storageKey) || "[]"); setFlagged(Array.isArray(saved) ? saved.filter((value): value is string => typeof value === "string") : []); }
        catch { setFlagged([]); }
      }
      if (["ended", "archived"].includes(state.exam.status) || (state.exam.endTime && Date.parse(state.exam.endTime) <= Date.parse(state.exam.serverTime))) {
        setNotice("Waktu ujian telah berakhir. Menunggu konfirmasi dari server."); setError(""); return;
      }
      if (!["active", "disconnected"].includes(state.student.status)) { router.replace("/"); return; }
      const incidentOwner = `eduquas:pending-screenshot:${state.exam.id}:${state.student.id}`;
      if (pendingIncidentOwner.current !== incidentOwner) {
        pendingIncidentOwner.current = incidentOwner;
        try {
          const saved = JSON.parse(localStorage.getItem(incidentOwner) || "null") as Incident | null;
          pendingIncident.current = saved?.eventType === "screenshot" && typeof saved.incidentId === "string" &&
            saved.metadata?.source === "keyboard_shortcut" && ["print_screen", "windows_snipping", "macos_capture"].includes(saved.metadata.shortcut) ? saved : null;
        } catch { pendingIncident.current = null; }
      }
      setLock(state.student.isLocked || !!pendingIncident.current);
      if (pendingIncident.current) void sendIncidentRef.current();
      if (!state.student.isLocked && !pendingIncident.current) {
        const first = await api<ExamSession>("/api/exam-session?limit=200&offset=0");
        const all = [...first.questions];
        while (all.length < first.totalQuestions) {
          const next = await api<ExamSession>(`/api/exam-session?limit=200&offset=${all.length}`);
          if (!next.questions.length) throw new Error("Soal belum berhasil dimuat seluruhnya.");
          all.push(...next.questions);
        }
        const saved: Record<string, string> = {};
        first.answers.forEach(answer => { if (answer.selectedOption) saved[answer.questionId] = answer.selectedOption; });
        pending.current.forEach((value, id) => { saved[id] = value; });
        const changedDuringLoad = answerRevision.current !== initialRevision;
        setAnswers(current => changedDuringLoad ? { ...saved, ...current } : saved);
        setQuestions(all); setSession(first);
        setClockOffset(Date.parse(first.serverTime) - Date.now());
      }
      setError("");
    } catch (err) {
      if (err instanceof ApiError && ["ALREADY_SUBMITTED", "EXAM_TIME_EXPIRED"].includes(err.code)) { router.replace("/exam/done"); return; }
      if (err instanceof ApiError && err.code === "STUDENT_LOCKED") setLock(true);
      else {
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) setLock(true);
        else setOffline(true);
        setError(err instanceof Error ? err.message : "Sesi belum dapat dimuat.");
      }
    } finally { setLoading(false); }
  }, [router, setLock]);
  useEffect(() => { syncRef.current = sync; }, [sync]);
  useEffect(() => { const timer = setTimeout(() => { void sync(); }, 0); return () => clearTimeout(timer); }, [sync]);
  useEffect(() => { const first = setTimeout(() => setNow(Date.now()), 0); const timer = setInterval(() => setNow(Date.now()), 1000); return () => { clearTimeout(first); clearInterval(timer); }; }, []);

  const flushOne = useCallback(async (id: string): Promise<boolean> => {
    while (true) {
      const existing = inflight.current.get(id);
      if (existing) {
        if (!await existing) return false;
        if (inflight.current.get(id) === existing) inflight.current.delete(id);
        continue;
      }
      const value = pending.current.get(id);
      if (value === undefined) { if (pending.current.size === 0) setSaveState("saved"); return true; }
      if (lockedRef.current) return false;
      const request = post<{ selectedOption: string | null }>("/api/exam-session/answer", { questionId: id, selectedOption: value || null }).then(() => {
        if (pending.current.get(id) === value) pending.current.delete(id);
        answerRevision.current += 1;
        setSaveError(""); return true;
      }).catch(err => { setSaveError(err instanceof Error ? err.message : "Jawaban belum tersimpan."); setSaveState("error"); return false; });
      inflight.current.set(id, request);
      const ok = await request;
      if (inflight.current.get(id) === request) inflight.current.delete(id);
      if (!ok) return false;
    }
  }, []);

  const flushAll = useCallback(async () => {
    timers.current.forEach(timer => clearTimeout(timer)); timers.current.clear();
    if (pending.current.size) setSaveState("saving");
    const results = await Promise.all([...pending.current.keys()].map(id => flushOne(id)));
    return results.every(Boolean) && pending.current.size === 0;
  }, [flushOne]);

  function changeAnswer(id: string, value: string) {
    if (lockedRef.current) return;
    answerRevision.current += 1;
    setAnswers(current => ({ ...current, [id]: value })); pending.current.set(id, value); setSaveState("saving"); setSaveError("");
    const previous = timers.current.get(id); if (previous) clearTimeout(previous);
    timers.current.set(id, setTimeout(() => { timers.current.delete(id); void flushOne(id); }, 500));
  }

  function toggleFlag(id: string) {
    if (lockedRef.current) return;
    const next = flagged.includes(id) ? flagged.filter(value => value !== id) : [...flagged, id];
    setFlagged(next);
    try { if (flagOwner.current) localStorage.setItem(flagOwner.current, JSON.stringify(next)); } catch { /* Keep flags in memory if storage is unavailable. */ }
  }

  function navigateToQuestion(nextIndex: number) {
    if (lockedRef.current) return;
    const question = questions[nextIndex];
    if (!question) return;
    setIndex(nextIndex);
    requestAnimationFrame(() => {
      const target = document.getElementById(`question-item-${question.id}`);
      target?.focus({ preventScroll: true });
      if (session?.exam.settings.display_mode === "all_at_once") target?.scrollIntoView({ behavior: reduceMotion ? "instant" : "smooth", block: "start" });
    });
  }

  useEffect(() => {
    const container = navigatorRef.current;
    if (!container || !window.matchMedia("(max-width: 1023px)").matches) return;
    const current = container.querySelector<HTMLElement>('[aria-current="step"]');
    if (!current) return;
    const left = current.offsetLeft - container.offsetLeft - (container.clientWidth - current.offsetWidth) / 2;
    container.scrollTo({ left, behavior: reduceMotion ? "instant" : "smooth" });
  }, [index, questions.length, reduceMotion]);

  useEffect(() => {
    const timerMap = timers.current;
    const onUnload = (event: BeforeUnloadEvent) => { if (pending.current.size) { event.preventDefault(); event.returnValue = ""; } };
    const onOnline = () => { void syncRef.current().then(() => { if (!lockedRef.current) void flushAll(); }); };
    window.addEventListener("beforeunload", onUnload); window.addEventListener("online", onOnline);
    return () => { window.removeEventListener("beforeunload", onUnload); window.removeEventListener("online", onOnline); timerMap.forEach(timer => clearTimeout(timer)); };
  }, [flushAll]);

  useEffect(() => {
    if (!waiting?.student.id) return;
    const channel = io(`${socketOrigin()}/student-session`, { withCredentials: true, reconnection: true });
    socket.current = channel;
    channel.on("connect", () => { channel.emit("heartbeat"); void syncRef.current().then(() => { if (!lockedRef.current) void flushAll(); }); });
    channel.on("student_locked", () => setLock(true));
    channel.on("student_unlocked", () => { if (!pendingIncident.current) setLock(false); void syncRef.current(); void flushAll(); });
    channel.on("teacher_warning", (event: { id?: string; warningId?: string; message?: string }) => { if (event.message) setWarning({ id: event.id || event.warningId || "", message: event.message }); });
    channel.on("exam_ended", () => { void syncRef.current(); });
    channel.on("session_unavailable", () => { void syncRef.current(); });
    const heartbeat = async () => {
      channel.emit("heartbeat");
      try {
        const result = await post<Heartbeat>("/api/exam-session/heartbeat");
        setOffline(false); setClockOffset(Date.parse(result.serverTime) - Date.now());
        const wasLocked = lockedRef.current;
        if (pendingIncident.current) { setLock(true); void sendIncidentRef.current(); }
        else setLock(result.isLocked);
        if (result.warning) setWarning(result.warning);
        if (!result.isExamActive || (wasLocked && !result.isLocked && !pendingIncident.current)) { await syncRef.current(); if (!result.isLocked) void flushAll(); }
      } catch { setOffline(true); }
    };
    void heartbeat(); const timer = setInterval(() => { void heartbeat(); }, 10_000);
    return () => { clearInterval(timer); channel.disconnect(); socket.current = null; };
  }, [waiting?.student.id, setLock, flushAll]);

  const sendIncident = useCallback(async () => {
    const incident = pendingIncident.current;
    if (!incident) return;
    try {
      const result = await post<{ isLocked: boolean }>("/api/proctoring/event", incident);
      if (pendingIncident.current?.incidentId === incident.incidentId) {
        pendingIncident.current = null;
        try { if (pendingIncidentOwner.current) localStorage.removeItem(pendingIncidentOwner.current); } catch { /* Storage can be unavailable. */ }
      }
      setLock(result.isLocked); setNotice(result.isLocked ? "Shortcut screenshot terdeteksi. Hubungi pengawas untuk membuka kunci." : "Status sesi telah diperbarui.");
      void syncRef.current();
    } catch { if (pendingIncident.current?.incidentId === incident.incidentId) setNotice("Sesi dijeda sementara. Menunggu koneksi untuk mengirim status kepada pengawas."); }
  }, [setLock]);
  useEffect(() => { sendIncidentRef.current = sendIncident; }, [sendIncident]);
  useEffect(() => {
    if (!session) return;
    const onKey = (event: KeyboardEvent) => {
      if (!event.isTrusted || event.repeat || lockedRef.current || session.exam.violationPolicy.detect_screenshot === false) return;
      const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
      let shortcut: Incident["metadata"]["shortcut"] | null = null;
      if (event.key === "PrintScreen") shortcut = "print_screen";
      else if (!isMac && event.metaKey && event.shiftKey && event.key.toLowerCase() === "s") shortcut = "windows_snipping";
      else if (isMac && event.metaKey && event.shiftKey && ["3", "4", "5"].includes(event.key)) shortcut = "macos_capture";
      if (!shortcut) return;
      pendingIncident.current = { incidentId: crypto.randomUUID(), eventType: "screenshot", metadata: { source: "keyboard_shortcut", shortcut } };
      try { if (pendingIncidentOwner.current) localStorage.setItem(pendingIncidentOwner.current, JSON.stringify(pendingIncident.current)); } catch { /* Keep the incident in memory as a fallback. */ }
      setLock(true); void sendIncident();
    };
    const retry = () => { void sendIncident(); };
    window.addEventListener("keydown", onKey); window.addEventListener("online", retry);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("online", retry); };
  }, [session, sendIncident, setLock]);

  async function submit() {
    if (submitting || lockedRef.current) return;
    setSubmitting(true);
    try {
      if (!await flushAll()) { setConfirm(0); setSaveState("error"); setSaveError("Jawaban belum tersimpan. Periksa koneksi dan coba lagi."); return; }
      if (lockedRef.current) return;
      await post("/api/exam-session/submit");
      try { if (flagOwner.current) localStorage.removeItem(flagOwner.current); } catch { /* Submission remains successful without local storage. */ }
      router.replace(`/exam/done?studentId=${encodeURIComponent(waiting?.student.id || "")}`);
    } catch (err) { setNotice(err instanceof Error ? err.message : "Jawaban belum dapat dikumpulkan."); setConfirm(0); }
    finally { setSubmitting(false); }
  }

  const end = waiting?.exam.endTime ? Date.parse(waiting.exam.endTime) : null;
  const remaining = end && now ? Math.max(0, Math.floor((end - (now + clockOffset)) / 1000)) : null;
  const finished = !!waiting && (["ended", "archived"].includes(waiting.exam.status) || (!!end && end <= Date.parse(waiting.exam.serverTime)) || remaining === 0);
  useEffect(() => { if (remaining === 0) { const timer = setTimeout(() => { void syncRef.current(); }, 1200); return () => clearTimeout(timer); } }, [remaining]);
  useEffect(() => {
    if (loading || session?.exam.settings.display_mode !== "all_at_once" || !questions.length) return;
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (!visible) return;
      const next = questions.findIndex(question => `question-item-${question.id}` === visible.target.id);
      if (next >= 0) setIndex(next);
    }, { rootMargin: "-10% 0px -65% 0px", threshold: 0 });
    questions.forEach(question => { const element = document.getElementById(`question-item-${question.id}`); if (element) observer.observe(element); });
    return () => observer.disconnect();
  }, [loading, session?.exam.settings.display_mode, questions]);

  if (loading) return <><ExamSessionSkeleton />{locked && <ExamLockScreen offline={offline} />}</>;
  if (!waiting) return <><main className="state-page"><h1>Sesi belum tersedia</h1><p role="alert">{error || "Periksa koneksi atau kembali ke halaman masuk."}</p><MotionButton className="secondary-button" onClick={() => void sync()}>Coba lagi</MotionButton><MotionButton className="text-button" onClick={() => router.push("/")}>Kembali</MotionButton></main>{locked && <ExamLockScreen offline={offline} />}</>;
  const answeredCount = questions.filter(question => (answers[question.id] || "").trim().length > 0).length;
  const markedCount = questions.filter(question => flagged.includes(question.id)).length;
  const percent = questions.length ? Math.round(answeredCount / questions.length * 100) : 0;
  const visibleQuestions = session?.exam.settings.display_mode === "all_at_once" ? questions : questions.slice(index, index + 1);
  return <motion.main className="exam-page" initial={reduceMotion ? false : { opacity: 0.75 }} animate={{ opacity: 1 }} transition={{ duration: reduceMotion ? 0 : 0.32 }}>
    <div className="exam-topbar"><Image className="exam-logo" src="/eduquas-logo.png" width={176} height={42} alt="EduQuas" priority />{proctoring.fullscreenEnabled && !proctoring.fullscreen && <MotionButton className="text-button" onClick={() => void proctoring.enterFullscreen()}>Aktifkan layar penuh</MotionButton>}</div>{proctoring.error && <p className="notice" role="status">{proctoring.error}</p>}
    <header className="exam-header"><div className="exam-title"><h1 id="exam-title" tabIndex={-1}>{waiting.exam.title}</h1>{session?.exam.description && <p>{session.exam.description}</p>}</div><div className="exam-person"><span>Peserta</span><strong>{waiting.student.name}</strong><span>NISN {waiting.student.nisn}</span></div><div className="timer"><span>Sisa waktu</span><strong aria-label={remaining === null ? "Waktu belum tersedia" : `Sisa waktu ${remaining} detik`}>{remaining === null ? "--:--:--" : clock(remaining)}</strong></div></header>
    <div className="exam-status" role="status"><span>{offline ? "Koneksi terputus" : "Terhubung"}</span><span>{locked ? "Sesi terkunci sementara" : saveState === "saving" ? "Menyimpan jawaban…" : saveState === "error" ? "Ada jawaban yang belum tersimpan" : "Jawaban tersimpan"}</span>{saveState === "error" && <MotionButton className="text-button" onClick={() => void flushAll()}>Coba simpan lagi</MotionButton>}</div>
    {saveError && <p className="error" role="alert">{saveError}</p>}{error && <p className="error" role="alert">{error} <MotionButton className="text-button" onClick={() => void sync()}>Coba lagi</MotionButton></p>}{notice && <p className="notice" role="status">{notice}</p>}
    {warning && <div className="warning" role="alert"><strong>Peringatan pengawas</strong><p>{warning.message}</p><MotionButton className="text-button" onClick={() => { if (warning.id) void post(`/api/exam-session/warning/${encodeURIComponent(warning.id)}/read`); setWarning(null); }}>Saya mengerti</MotionButton></div>}
    {questions.length > 0 && <div className="exam-workspace">
      <section className="exam-content" aria-label="Pengerjaan soal"><div className="exam-progress"><div className="exam-position">{session?.exam.settings.display_mode !== "all_at_once" && questions.length > 1 && <MotionButton className="question-step" aria-label="Soal sebelumnya" disabled={index === 0} onClick={() => navigateToQuestion(index - 1)}><ArrowIcon back /></MotionButton>}<strong>Soal {index + 1} dari {questions.length}</strong>{session?.exam.settings.display_mode !== "all_at_once" && questions.length > 1 && <MotionButton className="question-step" aria-label="Soal berikutnya" disabled={index === questions.length - 1} onClick={() => navigateToQuestion(index + 1)}><ArrowIcon /></MotionButton>}</div><div className="exam-progress-status"><div className="progress-track" role="progressbar" aria-label="Progres soal terisi" aria-valuemin={0} aria-valuemax={questions.length} aria-valuenow={answeredCount} aria-valuetext={`${answeredCount} dari ${questions.length} soal terisi`}><motion.div className="progress-fill" initial={false} animate={{ scaleX: answeredCount / questions.length }} transition={{ duration: reduceMotion ? 0 : 0.22 }} /></div><span>{answeredCount} dari {questions.length} terisi · {percent}%</span></div>{session?.exam.settings.display_mode !== "all_at_once" && questions[index] && <FlagButton flagged={flagged.includes(questions[index].id)} disabled={locked || finished} onClick={() => toggleFlag(questions[index].id)} />}</div>
        <div>{visibleQuestions.map((question, offset) => <QuestionView key={question.id} question={question} index={session?.exam.settings.display_mode === "all_at_once" ? offset : index} value={answers[question.id] || ""} flagged={flagged.includes(question.id)} disabled={locked || finished} onFlag={toggleFlag} onChange={changeAnswer} toolbarFlag={session?.exam.settings.display_mode !== "all_at_once"} />)}</div>
        <nav className="question-nav" aria-label="Pindah soal">{session?.exam.settings.display_mode !== "all_at_once" && questions.length > 1 && <MotionButton className="secondary-button" disabled={index === 0} onClick={() => navigateToQuestion(Math.max(0, index - 1))}><ArrowIcon back />Sebelumnya</MotionButton>}{session?.exam.settings.display_mode !== "all_at_once" && index < questions.length - 1 ? <MotionButton className="primary-button" onClick={() => navigateToQuestion(index + 1)}>Berikutnya<ArrowIcon /></MotionButton> : <MotionButton className="primary-button exam-submit" disabled={locked || finished || submitting} onClick={() => setConfirm(1)}>Kumpulkan jawaban<ArrowIcon /></MotionButton>}</nav>
      </section>
      <aside className="exam-navigator" aria-labelledby="navigator-title"><div className="navigator-heading"><div><h2 id="navigator-title">Ringkasan soal</h2><p>Pilih nomor untuk membuka soal.</p></div><span>{questions.length} soal</span></div><div className="navigator-summary" aria-label="Ringkasan pengerjaan"><div><span>Terisi</span><strong>{answeredCount}</strong></div><div><span>Belum diisi</span><strong>{questions.length - answeredCount}</strong></div><div><span>Soal aktif</span><strong>{index + 1}</strong></div><div><span>Ditandai</span><strong>{markedCount}</strong></div></div><div className="navigator-grid" ref={navigatorRef} role="navigation" aria-label="Nomor soal">{questions.map((question, questionIndex) => { const answered = !!(answers[question.id] || "").trim(); const marked = flagged.includes(question.id); const current = index === questionIndex; return <MotionButton key={question.id} type="button" className={`navigator-item${answered ? " answered" : ""}${marked ? " marked" : ""}${current ? " current" : ""}`} aria-current={current ? "step" : undefined} aria-label={`Soal ${questionIndex + 1}, ${answered ? "terisi" : "belum diisi"}${marked ? ", ditandai untuk diperiksa" : ""}${current ? ", sedang dibuka" : ""}`} onClick={() => navigateToQuestion(questionIndex)}><span>{questionIndex + 1}</span><span className="navigator-icons">{answered && <CheckIcon />}{marked && <FlagIcon />}</span></MotionButton>; })}</div><div className="navigator-legend" aria-label="Keterangan status soal"><span><i className="legend-current" />Sedang dibuka</span><span><i className="legend-answered" />Terisi</span><span><i className="legend-empty" />Belum diisi</span><span><i className="legend-marked" />Periksa lagi</span></div>{answeredCount < questions.length && <div className="navigator-review"><div><strong>Masih ada soal belum diisi</strong><p>Periksa {questions.length - answeredCount} soal sebelum mengumpulkan.</p></div><MotionButton className="secondary-button" onClick={() => navigateToQuestion(questions.findIndex(question => !(answers[question.id] || "").trim()))}>Lihat soal belum diisi</MotionButton></div>}</aside>
    </div>}
    <Dialog open={confirm !== 0} title={confirm === 1 ? "Periksa sebelum mengumpulkan" : "Yakin ingin mengumpulkan?"} onClose={() => { if (!submitting) setConfirm(0); }}><p>{questions.length - answeredCount > 0 ? `Masih ada ${questions.length - answeredCount} soal belum diisi.` : "Semua soal sudah diisi."} {markedCount > 0 && `${markedCount} soal ditandai untuk diperiksa.`}</p><p>{confirm === 1 ? "Periksa kembali jawaban Anda sebelum melanjutkan." : "Setelah dikumpulkan, jawaban tidak dapat diubah."}</p><div className="dialog-actions"><MotionButton className="secondary-button" disabled={submitting} onClick={() => setConfirm(0)}>Kembali ke soal</MotionButton>{confirm === 1 ? <MotionButton className="primary-button" onClick={() => setConfirm(2)}>Lanjutkan pengumpulan<ArrowIcon /></MotionButton> : <MotionButton className="primary-button" disabled={submitting} onClick={() => void submit()}>{submitting ? "Mengumpulkan…" : "Ya, kumpulkan"}<ArrowIcon /></MotionButton>}</div></Dialog>
    {locked && <ExamLockScreen offline={offline} />}
  </motion.main>;
}
