"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { api, post, ApiError, type Waiting } from "@/lib/api";
import { History } from "@/components/History";
import { MotionButton } from "@/components/MotionButton";
import { AnimatePresence, LayoutGroup, motion, useAnimate, useReducedMotion } from "framer-motion";

type Step = "code" | "identity" | "confirmation" | "waiting";
type Validation = { exam: { title: string; durationMinutes: number; status: string } };
const stepNames = ["Kode ujian", "Identitas", "Menunggu persetujuan"];

export default function Home() {
  const router = useRouter();
  const [isRedirecting] = useState(() => {
    if (typeof document !== "undefined" && document.cookie.includes("hasTeacherSession=1")) {
      return true;
    }
    return false;
  });
  const [step, setStep] = useState<Step>("code");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [nisn, setNisn] = useState("");
  const [exam, setExam] = useState<Validation["exam"] | null>(null);
  const [waiting, setWaiting] = useState<Waiting | null>(null);
  const [error, setError] = useState("");
  const [waitingError, setWaitingError] = useState("");
  const [sessionUnavailable, setSessionUnavailable] = useState(false);
  const [field, setField] = useState<"code" | "name" | "nisn" | null>(null);
  const [busy, setBusy] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [identityEntrance, setIdentityEntrance] = useState(false);
  const [codeFieldScope, animateCode] = useAnimate();
  const reduceMotion = useReducedMotion();
  const [revision, setRevision] = useState(0);
  const [notice, setNotice] = useState("");
  const codeRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const nisnRef = useRef<HTMLInputElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const acknowledgementRef = useRef<HTMLInputElement>(null);
  const interacted = useRef(false);
  const nameEdited = useRef(false);
  const nisnEdited = useRef(false);

  useEffect(() => {
    let active = true;
    void api<{ name: string | null; nisn: string | null }>("/api/student-profile")
      .then((profile) => {
        if (!active) return;
        if (profile.name && !nameEdited.current) {
          setName(profile.name);
        }
        if (profile.nisn && !nisnEdited.current) {
          setNisn(profile.nisn);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (isRedirecting) {
      router.replace("/dashboard");
    }
  }, [isRedirecting, router]);

  const applyWaiting = useCallback((value: Waiting) => {
    const isExamInProgress = ["active", "disconnected"].includes(value.student.status) && value.exam.status === "active";
    if (isExamInProgress) {
      router.replace("/exam/session");
      return;
    }
    setWaiting(value);
    setWaitingError("");
    setSessionUnavailable(false);
    setCode(value.exam.accessCode);
    setName(value.student.name);
    setNisn(value.student.nisn);
    setStep("waiting");
  }, [router]);

  const restore = useCallback(async () => {
    const value = await api<Waiting>("/api/exam-session/waiting");
    applyWaiting(value);
  }, [applyWaiting]);

  useEffect(() => {
    let active = true;
    void api<Waiting>("/api/exam-session/waiting").then(value => {
      if (!active) return;
      const isExamInProgress = ["active", "disconnected"].includes(value.student.status) && value.exam.status === "active";
      if (isExamInProgress) {
        router.replace("/exam/session");
        return;
      }
      if (!interacted.current) {
        applyWaiting(value);
      }
    }).catch((err: unknown) => {
      if (active && err instanceof ApiError && err.status !== 401 && err.code !== "ALREADY_SUBMITTED") {
        setWaitingError(err.message);
      }
    });
    if (new URLSearchParams(window.location.search).has("selesai")) {
      Promise.resolve().then(() => {
        if (active) setNotice("Ujian telah dikumpulkan. Riwayat Anda tersedia di bawah.");
      });
    }
    return () => { active = false; };
  }, [applyWaiting, router]);

  useEffect(() => {
    if (step !== "waiting" || sessionUnavailable) return;
    let active = true;
    async function refresh() {
      try { const value = await api<Waiting>("/api/exam-session/waiting"); if (active) applyWaiting(value); }
      catch (err) {
        if (!active) return;
        if (err instanceof ApiError && err.code === "ALREADY_SUBMITTED") { setStep("code"); setWaiting(null); setNotice("Ujian telah dikumpulkan. Riwayat Anda tersedia di bawah."); setRevision(value => value + 1); return; }
        if (err instanceof ApiError && err.status === 401) { setSessionUnavailable(true); setWaitingError(""); return; }
        setWaitingError(err instanceof Error ? err.message : "Status belum dapat diperbarui.");
      }
    }
    const timer = setInterval(() => { void refresh(); }, 3000);
    const visible = () => { if (document.visibilityState === "visible") void refresh(); };
    document.addEventListener("visibilitychange", visible);
    return () => { active = false; clearInterval(timer); document.removeEventListener("visibilitychange", visible); };
  }, [step, applyWaiting, sessionUnavailable]);

  useEffect(() => {
    if (!reduceMotion) return;
    const frame = requestAnimationFrame(() => {
      if (step === "identity") nameRef.current?.focus();
      else if (step === "waiting" || step === "confirmation") headingRef.current?.focus();
      else if (interacted.current) codeRef.current?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [step, reduceMotion]);

  function fail(message: string, target: "code" | "name" | "nisn") {
    setError(message); setField(target);
    if (target === "code" && !reduceMotion && codeFieldScope.current) {
      void animateCode(codeFieldScope.current, { x: [0, -4, 4, -2, 0] }, { duration: 0.22 });
    }
    ({ code: codeRef, name: nameRef, nisn: nisnRef })[target].current?.focus();
  }
  async function validate(event: FormEvent) {
    event.preventDefault(); setError(""); setField(null);
    if (code.length !== 6) { fail("Masukkan 6 huruf atau angka dari pengawas.", "code"); return; }
    setBusy(true);
    try { const value = await api<Validation>(`/api/join/validate?code=${encodeURIComponent(code)}`); setExam(value.exam); setIdentityEntrance(true); setStep("identity"); }
    catch (err) { fail(err instanceof Error ? err.message : "Kode belum dapat diperiksa.", "code"); }
    finally { setBusy(false); }
  }
  function confirmIdentity(event: FormEvent) {
    event.preventDefault(); setError(""); setField(null);
    if (name.trim().length < 2) { fail("Masukkan nama minimal 2 karakter.", "name"); return; }
    if (!/^\d{10}$/.test(nisn)) { fail("NISN harus terdiri dari 10 angka.", "nisn"); return; }
    setAcknowledged(false); setStep("confirmation");
  }
  async function join() {
    setError("");
    if (!acknowledged) { setError("Centang pernyataan berikut sebelum mengajukan masuk."); acknowledgementRef.current?.focus(); return; }
    setBusy(true);
    try { await post("/api/join", { accessCode: code, name: name.trim(), nisn }); await restore(); setRevision(value => value + 1); requestAnimationFrame(() => headingRef.current?.focus()); }
    catch (err) { setError(err instanceof Error ? err.message : "Permintaan belum dapat dikirim."); }
    finally { setBusy(false); }
  }

  const current = step === "code" ? 0 : step === "identity" || step === "confirmation" ? 1 : 2;
  const ended = !!waiting && (["ended", "archived"].includes(waiting.exam.status) || !!waiting.exam.endTime && Date.parse(waiting.exam.endTime) <= Date.parse(waiting.exam.serverTime));
  const studentStatus = waiting?.student.status || "waiting";
  const title = sessionUnavailable ? "Sesi tidak tersedia" : ended ? "Ujian telah berakhir" : studentStatus === "rejected" ? "Permintaan belum disetujui" : studentStatus === "accepted" ? "Anda sudah disetujui" : studentStatus === "kicked" ? "Sesi telah dihentikan" : "Menunggu persetujuan";

  if (isRedirecting) {
    return <main className="page-shell" />;
  }

  return <main className="page-shell">
    <motion.header className="site-header" initial={reduceMotion ? false : { opacity: 0.7, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduceMotion ? 0 : 0.32, ease: [0.22, 1, 0.36, 1] }}><Image className="brand-logo" src="/eduquas-logo.png" width={264} height={62} alt="EduQuas" priority /></motion.header>
    <LayoutGroup><motion.section className="entry" aria-labelledby="entry-title" initial={reduceMotion ? false : { opacity: 0.75, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduceMotion ? 0 : 0.32, delay: reduceMotion ? 0 : 0.06, ease: [0.22, 1, 0.36, 1] }}>
      <motion.ol className="steps" aria-label="Tahapan masuk ujian" initial={reduceMotion ? false : { opacity: 0.75 }} animate={{ opacity: 1 }} transition={{ duration: reduceMotion ? 0 : 0.32, delay: reduceMotion ? 0 : 0.1 }}>{stepNames.map((label, index) => <li key={label} className={index === current ? "current" : index < current ? "complete" : ""} aria-current={index === current ? "step" : undefined}>{index < stepNames.length - 1 && <span className="step-connector" aria-hidden="true"><motion.span initial={false} animate={{ scaleX: index < current ? 1 : 0 }} transition={{ duration: reduceMotion ? 0 : 0.22 }} /></span>}<span className="step-number">{index + 1}</span><span>{label}</span></li>)}</motion.ol>
      <motion.div layout className="entry-frame" data-plain={step === "code"} transition={reduceMotion ? { duration: 0 } : { layout: { type: "spring", stiffness: 270, damping: 31, mass: 0.95 } }}>
      {step !== "code" && <motion.div aria-hidden="true" className="entry-card-surface" initial={reduceMotion || !identityEntrance ? false : { opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: reduceMotion ? 0 : 0.36, ease: [0.22, 1, 0.36, 1] }} />}
      <AnimatePresence mode="popLayout" initial={false}>
      <motion.div layout className="entry-body" key={step} initial={reduceMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={reduceMotion ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, transition: { duration: 0.12 } }} transition={{ opacity: { duration: reduceMotion ? 0 : 0.22, delay: !reduceMotion && step === "identity" && identityEntrance ? 0.32 : 0 }, layout: reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 270, damping: 31, mass: 0.95 } }} onAnimationComplete={() => { if (document.activeElement !== document.body) return; if (step === "identity") nameRef.current?.focus(); else if (step === "waiting" || step === "confirmation") headingRef.current?.focus(); else if (interacted.current) codeRef.current?.focus(); }}>
        {step === "code" && <><h1 id="entry-title">Masuk ke ujian</h1><p className="lead">Masukkan kode yang diberikan oleh pengawas.</p>
          <form onSubmit={event => void validate(event)} noValidate><label className="field-label" htmlFor="exam-code">Kode ujian</label>
            <motion.div ref={codeFieldScope} className="code-field"><div className="code-slots" aria-hidden="true">{Array.from({ length: 6 }, (_, index) => <span key={index} />)}</div><input ref={codeRef} id="exam-code" value={code} onChange={event => { interacted.current = true; setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6)); setError(""); setField(null); }} maxLength={6} autoComplete="off" autoCapitalize="characters" spellCheck={false} aria-invalid={field === "code"} aria-describedby={field === "code" ? "code-hint form-error" : "code-hint"} /></motion.div>
            <p className="hint" id="code-hint">6 huruf atau angka</p>{error && <p className="error" role="alert" id="form-error">{error}</p>}
            <MotionButton className="primary-button" type="submit" disabled={busy} aria-busy={busy}>{busy ? "Memeriksa kode…" : "Lanjutkan"}</MotionButton>
          </form></>}
        {step === "identity" && <><MotionButton className="back-button" type="button" onClick={() => { setStep("code"); setError(""); requestAnimationFrame(() => codeRef.current?.focus()); }}>← Kembali ke kode</MotionButton><h1 id="entry-title">Isi identitas</h1><p className="lead">{exam?.title || waiting?.exam.title || "Ujian"}</p>
          <form onSubmit={confirmIdentity} noValidate className="identity-form"><label htmlFor="student-name">Nama lengkap</label><input ref={nameRef} id="student-name" value={name} maxLength={100} autoComplete="name" placeholder="Masukkan nama lengkap" onChange={event => { nameEdited.current = true; setName(event.target.value); setError(""); setField(null); }} aria-invalid={field === "name"} aria-describedby={field === "name" ? "identity-error" : undefined} />
            <label htmlFor="student-nisn">NISN</label><input ref={nisnRef} id="student-nisn" value={nisn} inputMode="numeric" maxLength={10} placeholder="10 digit NISN" onChange={event => { nisnEdited.current = true; setNisn(event.target.value.replace(/\D/g, "").slice(0, 10)); setError(""); setField(null); }} aria-invalid={field === "nisn"} aria-describedby={field === "nisn" ? "identity-error" : undefined} />
            {error && <p className="error" id="identity-error" role="alert">{error}</p>}
            <MotionButton className="primary-button" type="submit">Lanjutkan</MotionButton>
          </form></>}
        {step === "confirmation" && <><MotionButton className="back-button" type="button" disabled={busy} onClick={() => { setIdentityEntrance(false); setStep("identity"); setError(""); }}>← Kembali ke identitas</MotionButton><h1 id="entry-title" ref={headingRef} tabIndex={-1}>Sebelum masuk ujian</h1><p className="lead">Baca informasi ini sebelum mengirim permintaan kepada pengawas.</p>
          <div className="admission-information"><p>Selama ujian, pelanggaran yang terdeteksi dapat dicatat dan diperiksa oleh pengawas sesuai pengaturan ujian. Sesi Anda dapat terkunci sementara jika terjadi pelanggaran.</p><p>Sesuai pengaturan ujian, kehilangan fokus, keluar dari layar penuh, perubahan IP, dan shortcut devtools dapat dicatat sebagai pelanggaran.</p><p>Shortcut screenshot tertentu dapat terdeteksi dan langsung mengunci sesi. Browser tidak dapat memastikan apakah tangkapan layar berhasil dibuat, dan tidak semua aktivitas dapat dideteksi.</p></div>
          <motion.label className="acknowledgement" animate={{ backgroundColor: acknowledged ? "#f3eff8" : "#ffffff", borderColor: acknowledged ? "#9b7ac8" : "#e9e9ec" }} transition={{ duration: reduceMotion ? 0 : 0.22 }}><input ref={acknowledgementRef} type="checkbox" checked={acknowledged} onChange={event => { setAcknowledged(event.target.checked); setError(""); }} aria-invalid={!!error && !acknowledged} aria-describedby={error && !acknowledged ? "confirmation-error" : undefined} /><span>Saya sudah membaca dan memahami informasi di atas.</span></motion.label>
          {error && <p className="error" id="confirmation-error" role="alert">{error}</p>}
          <MotionButton className="primary-button" type="button" disabled={busy} aria-busy={busy} onClick={() => void join()}>{busy ? "Mengirim permintaan…" : studentStatus === "rejected" ? "Ajukan ulang" : "Ajukan masuk"}</MotionButton>
        </>}
        {step === "waiting" && <><h1 id="entry-title" ref={headingRef} tabIndex={-1}>{title}</h1><p className="lead">{waiting?.exam.title}</p>{studentStatus === "waiting" && !ended && !sessionUnavailable && !waitingError && <div className="waiting-indicator" role="status"><motion.span className="waiting-spinner" aria-hidden="true" animate={reduceMotion ? { rotate: 0 } : { rotate: 360 }} transition={reduceMotion ? { duration: 0 } : { duration: 1, ease: "linear", repeat: Infinity }} /><span>Menunggu respons pengawas…</span></div>}<div className="waiting-details"><p><strong>{waiting?.student.name}</strong><span>NISN {waiting?.student.nisn}</span></p><p role="status">{sessionUnavailable ? "Sesi berakhir atau telah digantikan. Hubungi pengawas jika Anda memerlukan bantuan." : ended ? "Waktu ujian sudah berakhir." : studentStatus === "rejected" ? waiting?.student.latestAdmissionAction?.reason || "Anda dapat memperbaiki data dan mengajukan ulang." : studentStatus === "accepted" ? "Tunggu pengawas memulai ujian. Halaman akan berpindah otomatis." : studentStatus === "kicked" ? waiting?.student.kickReason || "Hubungi pengawas untuk informasi lebih lanjut." : "Permintaan Anda telah dikirim. Tunggu pengawas memeriksa identitas Anda."}</p></div>
          {waitingError && <p className="error" role="alert">{waitingError} Status akan diperiksa kembali.</p>}
          {studentStatus === "rejected" && !ended && !sessionUnavailable && <MotionButton className="primary-button" type="button" onClick={() => { setIdentityEntrance(false); setStep("identity"); setError(""); requestAnimationFrame(() => nameRef.current?.focus()); }}>Ajukan ulang</MotionButton>}
          {(ended || studentStatus === "kicked" || sessionUnavailable) && <MotionButton className="secondary-button" type="button" onClick={() => { interacted.current = true; setStep("code"); setCode(""); setWaiting(null); setWaitingError(""); setSessionUnavailable(false); }}>Masukkan kode lain</MotionButton>}
        </>}
      </motion.div>
      </AnimatePresence></motion.div>
    </motion.section>
    {notice && <p className="notice" role="status">{notice}</p>}{step === "code" && waitingError && <p className="error" role="alert">{waitingError}</p>}
    <History revision={revision} onResume={restore} /></LayoutGroup>
    <motion.footer className="staff-entry-link" initial={reduceMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: reduceMotion ? 0 : .32 }}><Link href="/login">Masuk sebagai guru</Link></motion.footer>
  </main>;
}
