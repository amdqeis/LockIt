"use client";

import { MotionButton } from "@/components/MotionButton";
import { motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { io, type Socket } from "socket.io-client";
import {
  api,
  post,
  ApiError,
  socketOrigin,
  type ExamSession,
  type Question,
  type Waiting,
} from "@/lib/api";
import { Dialog } from "@/components/Dialog";
import Image from "next/image";
import { useExamProctoring } from "@/lib/useExamProctoring";
import { ExamSessionSkeleton } from "@/components/skeletons";
import { ExamWorkspace } from "@/components/ExamWorkspace";

function clock(seconds: number) {
  const value = Math.max(0, seconds);
  return `${String(Math.floor(value / 3600)).padStart(2, "0")}:${String(
    Math.floor((value % 3600) / 60)
  ).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

function ArrowIcon({ back = false }: { back?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={back ? "M19 12H5m0 0 6-6m-6 6 6 6" : "M5 12h14m0 0-6-6m6 6-6 6"} />
    </svg>
  );
}

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
  return (
    <dialog
      ref={dialogRef}
      className="exam-lock-screen"
      role="alertdialog"
      aria-labelledby="exam-lock-title"
      aria-describedby="exam-lock-description"
      onCancel={(event) => event.preventDefault()}
    >
      <div className="exam-lock-content">
        <svg
          aria-hidden="true"
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="4" y="10" width="16" height="11" rx="2" />
          <path d="M8 10V7a4 4 0 0 1 8 0v3" />
        </svg>
        <h2 id="exam-lock-title" ref={headingRef} tabIndex={-1}>
          Ujian terkunci
        </h2>
        <p id="exam-lock-description">Hubungi pengawas untuk membuka kunci. Waktu ujian tetap berjalan.</p>
        {offline && (
          <p className="exam-lock-offline" role="status">
            Koneksi terputus. Menunggu koneksi kembali.
          </p>
        )}
      </div>
    </dialog>
  );
}

type Heartbeat = {
  isLocked: boolean;
  isExamActive: boolean;
  serverTime: string;
  violationCount?: number;
  violationCycleCount?: number;
  recoveryRequired?: boolean;
  warning: { id: string; message: string } | null;
};

type Incident = {
  incidentId: string;
  eventType: "screenshot";
  metadata: {
    source: "keyboard_shortcut";
    shortcut: "print_screen" | "windows_snipping" | "macos_capture";
  };
};

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

  // Status siklus pelanggaran & pemulihan
  const [violationCycleCount, setViolationCycleCount] = useState(0);
  const [recoveryRequired, setRecoveryRequired] = useState(false);
  const [firstCycleAcknowledged, setFirstCycleAcknowledged] = useState(false);
  const [recoveryError, setRecoveryError] = useState("");
  const [recovering, setRecovering] = useState(false);

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

  const setLock = useCallback((value: boolean) => {
    lockedRef.current = value;
    if (value) setConfirm(0);
    setLocked(value);
  }, []);

  const onRecoveryRequired = useCallback((required: boolean, cycleCount: number) => {
    setRecoveryRequired(required);
    setViolationCycleCount(cycleCount);
  }, []);

  const proctoring = useExamProctoring(session, locked, setLock, onRecoveryRequired);

  const sync = useCallback(async () => {
    const initialRevision = answerRevision.current;
    try {
      const state = await api<Waiting>("/api/exam-session/waiting");
      setWaiting(state);
      setClockOffset(Date.parse(state.exam.serverTime) - Date.now());
      setOffline(false);

      if (state.recoveryRequired !== undefined) {
        setRecoveryRequired(state.recoveryRequired);
      }
      if (state.violationCycleCount !== undefined) {
        setViolationCycleCount(state.violationCycleCount);
      }

      const storageKey = `eduquas:exam-flags:${state.exam.id}:${state.student.id}`;
      if (flagOwner.current !== storageKey) {
        flagOwner.current = storageKey;
        try {
          const saved = JSON.parse(localStorage.getItem(storageKey) || "[]");
          setFlagged(Array.isArray(saved) ? saved.filter((v): v is string => typeof v === "string") : []);
        } catch {
          setFlagged([]);
        }
      }

      if (
        ["ended", "archived"].includes(state.exam.status) ||
        (state.exam.endTime && Date.parse(state.exam.endTime) <= Date.parse(state.exam.serverTime))
      ) {
        setNotice("Waktu ujian telah berakhir. Menunggu konfirmasi dari server.");
        setError("");
        return;
      }
      if (!["active", "disconnected"].includes(state.student.status)) {
        router.replace("/");
        return;
      }

      const incidentOwner = `eduquas:pending-screenshot:${state.exam.id}:${state.student.id}`;
      if (pendingIncidentOwner.current !== incidentOwner) {
        pendingIncidentOwner.current = incidentOwner;
        try {
          const saved = JSON.parse(localStorage.getItem(incidentOwner) || "null") as Incident | null;
          pendingIncident.current =
            saved?.eventType === "screenshot" &&
            typeof saved.incidentId === "string" &&
            saved.metadata?.source === "keyboard_shortcut" &&
            ["print_screen", "windows_snipping", "macos_capture"].includes(saved.metadata.shortcut)
              ? saved
              : null;
        } catch {
          pendingIncident.current = null;
        }
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
        first.answers.forEach((answer) => {
          if (answer.selectedOption) saved[answer.questionId] = answer.selectedOption;
        });
        pending.current.forEach((value, id) => {
          saved[id] = value;
        });
        const changedDuringLoad = answerRevision.current !== initialRevision;
        setAnswers((current) => (changedDuringLoad ? { ...saved, ...current } : saved));
        setQuestions(all);
        setSession(first);
        setClockOffset(Date.parse(first.serverTime) - Date.now());

        if (first.recoveryRequired !== undefined) {
          setRecoveryRequired(first.recoveryRequired);
        }
        if (first.violationCycleCount !== undefined) {
          setViolationCycleCount(first.violationCycleCount);
        }
      }
      setError("");
    } catch (err) {
      if (err instanceof ApiError && ["ALREADY_SUBMITTED", "EXAM_TIME_EXPIRED"].includes(err.code)) {
        router.replace("/exam/done");
        return;
      }
      if (err instanceof ApiError && err.code === "STUDENT_LOCKED") setLock(true);
      else {
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) setLock(true);
        else setOffline(true);
        setError(err instanceof Error ? err.message : "Sesi belum dapat dimuat.");
      }
    } finally {
      setLoading(false);
    }
  }, [router, setLock]);

  useEffect(() => {
    syncRef.current = sync;
  }, [sync]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void sync();
    }, 0);
    return () => clearTimeout(timer);
  }, [sync]);

  useEffect(() => {
    const first = setTimeout(() => setNow(Date.now()), 0);
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, []);

  const flushOne = useCallback(async (id: string): Promise<boolean> => {
    while (true) {
      const existing = inflight.current.get(id);
      if (existing) {
        if (!(await existing)) return false;
        if (inflight.current.get(id) === existing) inflight.current.delete(id);
        continue;
      }
      const value = pending.current.get(id);
      if (value === undefined) {
        if (pending.current.size === 0) setSaveState("saved");
        return true;
      }
      if (lockedRef.current) return false;
      const request = post<{ selectedOption: string | null }>("/api/exam-session/answer", {
        questionId: id,
        selectedOption: value || null,
      })
        .then(() => {
          if (pending.current.get(id) === value) pending.current.delete(id);
          answerRevision.current += 1;
          setSaveError("");
          return true;
        })
        .catch((err) => {
          setSaveError(err instanceof Error ? err.message : "Jawaban belum tersimpan.");
          setSaveState("error");
          return false;
        });
      inflight.current.set(id, request);
      const ok = await request;
      if (inflight.current.get(id) === request) inflight.current.delete(id);
      if (!ok) return false;
    }
  }, []);

  const flushAll = useCallback(async () => {
    timers.current.forEach((timer) => clearTimeout(timer));
    timers.current.clear();
    if (pending.current.size) setSaveState("saving");
    const results = await Promise.all([...pending.current.keys()].map((id) => flushOne(id)));
    return results.every(Boolean) && pending.current.size === 0;
  }, [flushOne]);

  function changeAnswer(id: string, value: string) {
    if (lockedRef.current) return;
    answerRevision.current += 1;
    setAnswers((current) => ({ ...current, [id]: value }));
    pending.current.set(id, value);
    setSaveState("saving");
    setSaveError("");
    const previous = timers.current.get(id);
    if (previous) clearTimeout(previous);
    timers.current.set(
      id,
      setTimeout(() => {
        timers.current.delete(id);
        void flushOne(id);
      }, 500)
    );
  }

  function toggleFlag(id: string) {
    if (lockedRef.current) return;
    const next = flagged.includes(id) ? flagged.filter((value) => value !== id) : [...flagged, id];
    setFlagged(next);
    try {
      if (flagOwner.current) localStorage.setItem(flagOwner.current, JSON.stringify(next));
    } catch {
      /* Simpan flags dalam memori */
    }
  }

  function navigateToQuestion(nextIndex: number) {
    if (lockedRef.current) return;
    const question = questions[nextIndex];
    if (!question) return;
    setIndex(nextIndex);
    requestAnimationFrame(() => {
      const target = document.getElementById(`question-item-${question.id}`);
      target?.focus({ preventScroll: true });
      if (session?.exam.settings.display_mode === "all_at_once") {
        target?.scrollIntoView({ behavior: reduceMotion ? "instant" : "smooth", block: "start" });
      }
    });
  }

  useEffect(() => {
    const timerMap = timers.current;
    const onUnload = (event: BeforeUnloadEvent) => {
      if (pending.current.size) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    const onOnline = () => {
      void syncRef.current().then(() => {
        if (!lockedRef.current) void flushAll();
      });
    };
    window.addEventListener("beforeunload", onUnload);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("beforeunload", onUnload);
      window.removeEventListener("online", onOnline);
      timerMap.forEach((timer) => clearTimeout(timer));
    };
  }, [flushAll]);

  // Socket & Heartbeat setiap 5 detik serta saat online/fokus
  useEffect(() => {
    if (!waiting?.student.id) return;
    const channel = io(`${socketOrigin()}/student-session`, {
      withCredentials: true,
      reconnection: true,
    });
    socket.current = channel;

    const heartbeat = async () => {
      channel.emit("heartbeat");
      try {
        const result = await post<Heartbeat>("/api/exam-session/heartbeat");
        setOffline(false);
        setClockOffset(Date.parse(result.serverTime) - Date.now());

        if (result.recoveryRequired !== undefined) {
          setRecoveryRequired(result.recoveryRequired);
        }
        if (result.violationCycleCount !== undefined) {
          setViolationCycleCount(result.violationCycleCount);
        }

        const wasLocked = lockedRef.current;
        if (pendingIncident.current) {
          setLock(true);
          void sendIncidentRef.current();
        } else {
          setLock(result.isLocked);
        }
        if (result.warning) setWarning(result.warning);
        if (!result.isExamActive || (wasLocked && !result.isLocked && !pendingIncident.current)) {
          await syncRef.current();
          if (!result.isLocked) void flushAll();
        }
      } catch {
        setOffline(true);
      }
    };

    channel.on("connect", () => {
      void heartbeat();
      void syncRef.current().then(() => {
        if (!lockedRef.current) void flushAll();
      });
    });

    channel.on("student_locked", () => setLock(true));
    channel.on("student_unlocked", () => {
      if (!pendingIncident.current) setLock(false);
      setRecoveryRequired(false);
      void syncRef.current();
      void flushAll();
    });
    channel.on("student_recovered", (data: { studentId: string; recoveredCycleCount: number }) => {
      if (data.studentId === waiting.student.id) {
        setRecoveryRequired(false);
      }
    });
    channel.on("teacher_warning", (event: { id?: string; warningId?: string; message?: string }) => {
      if (event.message) setWarning({ id: event.id || event.warningId || "", message: event.message });
    });
    channel.on("exam_ended", () => {
      void syncRef.current();
    });
    channel.on("session_unavailable", () => {
      void syncRef.current();
    });

    void heartbeat();
    const timer = setInterval(() => {
      void heartbeat();
    }, 5000);

    const onFocusOrOnline = () => {
      void heartbeat();
    };
    window.addEventListener("focus", onFocusOrOnline);
    window.addEventListener("online", onFocusOrOnline);

    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", onFocusOrOnline);
      window.removeEventListener("online", onFocusOrOnline);
      channel.disconnect();
      socket.current = null;
    };
  }, [waiting?.student.id, setLock, flushAll]);

  const sendIncident = useCallback(async () => {
    const incident = pendingIncident.current;
    if (!incident) return;
    try {
      const result = await post<{ isLocked: boolean }>("/api/proctoring/event", incident);
      if (pendingIncident.current?.incidentId === incident.incidentId) {
        pendingIncident.current = null;
        try {
          if (pendingIncidentOwner.current) localStorage.removeItem(pendingIncidentOwner.current);
        } catch {
          /* Storage opsional */
        }
      }
      setLock(result.isLocked);
      setNotice(
        result.isLocked
          ? "Shortcut screenshot terdeteksi. Hubungi pengawas untuk membuka kunci."
          : "Status sesi telah diperbarui."
      );
      void syncRef.current();
    } catch {
      if (pendingIncident.current?.incidentId === incident.incidentId) {
        setNotice("Sesi dijeda sementara. Menunggu koneksi untuk mengirim status kepada pengawas.");
      }
    }
  }, [setLock]);

  useEffect(() => {
    sendIncidentRef.current = sendIncident;
  }, [sendIncident]);

  useEffect(() => {
    if (!session) return;
    const onKey = (event: KeyboardEvent) => {
      if (
        !event.isTrusted ||
        event.repeat ||
        lockedRef.current ||
        session.exam.violationPolicy.detect_screenshot === false
      )
        return;
      const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
      let shortcut: Incident["metadata"]["shortcut"] | null = null;
      if (event.key === "PrintScreen") shortcut = "print_screen";
      else if (!isMac && event.metaKey && event.shiftKey && event.key.toLowerCase() === "s")
        shortcut = "windows_snipping";
      else if (isMac && event.metaKey && event.shiftKey && ["3", "4", "5"].includes(event.key))
        shortcut = "macos_capture";
      if (!shortcut) return;
      pendingIncident.current = {
        incidentId: crypto.randomUUID(),
        eventType: "screenshot",
        metadata: { source: "keyboard_shortcut", shortcut },
      };
      try {
        if (pendingIncidentOwner.current)
          localStorage.setItem(pendingIncidentOwner.current, JSON.stringify(pendingIncident.current));
      } catch {
        /* Fallback memori */
      }
      setLock(true);
      void sendIncident();
    };
    const retry = () => {
      void sendIncident();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("online", retry);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("online", retry);
    };
  }, [session, sendIncident, setLock]);

  async function handleRecover() {
    if (recovering) return;
    setRecovering(true);
    setRecoveryError("");
    try {
      const result = await proctoring.recover(violationCycleCount);
      if (!result.success) {
        setRecoveryError(result.message || "Pemulihan belum berhasil.");
      } else {
        setRecoveryRequired(false);
        if (result.isLocked) {
          setLock(true);
        }
        void syncRef.current();
      }
    } catch (err) {
      setRecoveryError(err instanceof Error ? err.message : "Pemulihan belum berhasil.");
    } finally {
      setRecovering(false);
    }
  }

  async function submit() {
    if (submitting || lockedRef.current) return;
    setSubmitting(true);
    try {
      if (!(await flushAll())) {
        setConfirm(0);
        setSaveState("error");
        setSaveError("Jawaban belum tersimpan. Periksa koneksi dan coba lagi.");
        return;
      }
      if (lockedRef.current) return;
      await post("/api/exam-session/submit");
      try {
        if (flagOwner.current) localStorage.removeItem(flagOwner.current);
      } catch {
        /* Storage opsional */
      }
      router.replace(`/exam/done?studentId=${encodeURIComponent(waiting?.student.id || "")}`);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Jawaban belum dapat dikumpulkan.");
      setConfirm(0);
    } finally {
      setSubmitting(false);
    }
  }

  const end = waiting?.exam.endTime ? Date.parse(waiting.exam.endTime) : null;
  const remaining = end && now ? Math.max(0, Math.floor((end - (now + clockOffset)) / 1000)) : null;
  const finished =
    !!waiting &&
    (["ended", "archived"].includes(waiting.exam.status) ||
      (!!end && end <= Date.parse(waiting.exam.serverTime)) ||
      remaining === 0);

  useEffect(() => {
    if (remaining === 0) {
      const timer = setTimeout(() => {
        void syncRef.current();
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [remaining]);

  useEffect(() => {
    if (loading || session?.exam.settings.display_mode !== "all_at_once" || !questions.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const vis = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (!vis) return;
        const next = questions.findIndex((q) => `question-item-${q.id}` === vis.target.id);
        if (next >= 0) setIndex(next);
      },
      { rootMargin: "-10% 0px -65% 0px", threshold: 0 }
    );
    questions.forEach((q) => {
      const element = document.getElementById(`question-item-${q.id}`);
      if (element) observer.observe(element);
    });
    return () => observer.disconnect();
  }, [loading, session?.exam.settings.display_mode, questions]);

  if (loading)
    return (
      <>
        <ExamSessionSkeleton />
        {locked && <ExamLockScreen offline={offline} />}
      </>
    );

  if (!waiting)
    return (
      <>
        <main className="state-page">
          <h1>Sesi belum tersedia</h1>
          <p role="alert">{error || "Periksa koneksi atau kembali ke halaman masuk."}</p>
          <MotionButton className="secondary-button" onClick={() => void sync()}>
            Coba lagi
          </MotionButton>
          <MotionButton className="text-button" onClick={() => router.push("/")}>
            Kembali
          </MotionButton>
        </main>
        {locked && <ExamLockScreen offline={offline} />}
      </>
    );

  const answeredCount = questions.filter(
    (question) => (answers[question.id] || "").trim().length > 0
  ).length;
  const markedCount = questions.filter((question) => flagged.includes(question.id)).length;

  // Evaluasi overlay:
  // 1. Kunci pengawas (locked) punya prioritas tertinggi
  // 2. Jika proctoring.needsPreparation (redirect/refresh belum fullscreen): tampilkan layar persiapan
  // 3. Jika recoveryRequired atau violationCycleCount >= 2: layar hitam pemulihan
  // 4. Jika violationCycleCount === 1 dan belum diakui: modal peringatan siklus 1
  const showBlackout = !locked && (recoveryRequired || violationCycleCount >= 2);
  const showCycleOneWarning = !locked && !showBlackout && violationCycleCount === 1 && !firstCycleAcknowledged;
  const showPreparation = !locked && !showBlackout && !showCycleOneWarning && proctoring.needsPreparation;

  return (
    <motion.main
      className="exam-page"
      initial={reduceMotion ? false : { opacity: 0.75 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reduceMotion ? 0 : 0.32 }}
    >
      <div className="exam-topbar">
        <Image className="exam-logo" src="/eduquas-logo.png" width={176} height={42} alt="EduQuas" priority />
        {proctoring.fullscreenEnabled && !proctoring.fullscreen && !proctoring.compatibilityMode && (
          <MotionButton className="text-button" onClick={() => void proctoring.enterFullscreen()}>
            Aktifkan layar penuh
          </MotionButton>
        )}
      </div>

      {proctoring.error && (
        <p className="notice" role="status">
          {proctoring.error}
        </p>
      )}

      <header className="exam-header">
        <div className="exam-title">
          <h1 id="exam-title" tabIndex={-1}>
            {waiting.exam.title}
          </h1>
          {session?.exam.description && <p>{session.exam.description}</p>}
        </div>
        <div className="exam-person">
          <span>Peserta</span>
          <strong>{waiting.student.name}</strong>
          <span>NISN {waiting.student.nisn}</span>
        </div>
        <div className="timer">
          <span>Sisa waktu</span>
          <strong
            aria-label={
              remaining === null ? "Waktu belum tersedia" : `Sisa waktu ${remaining} detik`
            }
          >
            {remaining === null ? "--:--:--" : clock(remaining)}
          </strong>
        </div>
      </header>

      <div className="exam-status" role="status">
        <span>{offline ? "Koneksi terputus" : "Terhubung"}</span>
        <span>
          {locked
            ? "Sesi terkunci sementara"
            : saveState === "saving"
            ? "Menyimpan jawaban…"
            : saveState === "error"
            ? "Ada jawaban yang belum tersimpan"
            : "Jawaban tersimpan"}
        </span>
        {saveState === "error" && (
          <MotionButton className="text-button" onClick={() => void flushAll()}>
            Coba simpan lagi
          </MotionButton>
        )}
      </div>

      {saveError && (
        <p className="error" role="alert">
          {saveError}
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}{" "}
          <MotionButton className="text-button" onClick={() => void sync()}>
            Coba lagi
          </MotionButton>
        </p>
      )}
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}

      {warning && (
        <div className="warning" role="alert">
          <strong>Peringatan pengawas</strong>
          <p>{warning.message}</p>
          <MotionButton
            className="text-button"
            onClick={() => {
              if (warning.id) void post(`/api/exam-session/warning/${encodeURIComponent(warning.id)}/read`);
              setWarning(null);
            }}
          >
            Saya mengerti
          </MotionButton>
        </div>
      )}

      {questions.length > 0 && (
        <ExamWorkspace
          mode="taking"
          questions={questions}
          currentIndex={index}
          onSelectIndex={navigateToQuestion}
          displayMode={session?.exam.settings.display_mode ?? "one_by_one"}
          answers={answers}
          onChangeAnswer={changeAnswer}
          flagged={flagged}
          onToggleFlag={toggleFlag}
          disabled={locked || finished || showBlackout || showPreparation}
          onOpenSubmit={() => setConfirm(1)}
        />
      )}

      {/* Dialog Konfirmasi Submit */}
      <Dialog
        open={confirm !== 0}
        title={confirm === 1 ? "Periksa sebelum mengumpulkan" : "Yakin ingin mengumpulkan?"}
        onClose={() => {
          if (!submitting) setConfirm(0);
        }}
      >
        <p>
          {questions.length - answeredCount > 0
            ? `Masih ada ${questions.length - answeredCount} soal belum diisi.`
            : "Semua soal sudah diisi."}{" "}
          {markedCount > 0 && `${markedCount} soal ditandai untuk diperiksa.`}
        </p>
        <p>
          {confirm === 1
            ? "Periksa kembali jawaban Anda sebelum melanjutkan."
            : "Setelah dikumpulkan, jawaban tidak dapat diubah."}
        </p>
        <div className="dialog-actions">
          <MotionButton
            className="secondary-button"
            disabled={submitting}
            onClick={() => setConfirm(0)}
          >
            Kembali ke soal
          </MotionButton>
          {confirm === 1 ? (
            <MotionButton className="primary-button" onClick={() => setConfirm(2)}>
              Lanjutkan pengumpulan
              <ArrowIcon />
            </MotionButton>
          ) : (
            <MotionButton
              className="primary-button"
              disabled={submitting}
              onClick={() => void submit()}
            >
              {submitting ? "Mengumpulkan…" : "Ya, kumpulkan"}
              <ArrowIcon />
            </MotionButton>
          )}
        </div>
      </Dialog>

      {/* Layar Persiapan Fullscreen */}
      {showPreparation && (
        <section className="exam-prep-screen" role="region" aria-label="Persiapan ujian">
          <div className="exam-prep-content">
            <h2>Persiapan Layar Ujian</h2>
            <p>
              Ujian ini mewajibkan mode layar penuh. Klik tombol di bawah untuk mengaktifkan layar penuh dan
              melanjutkan pengerjaan.
            </p>
            <MotionButton
              className="primary-button"
              onClick={() => void proctoring.enterFullscreen()}
            >
              Aktifkan Layar Penuh & Lanjutkan
            </MotionButton>
          </div>
        </section>
      )}

      {/* Siklus 1: Peringatan Jeda */}
      {showCycleOneWarning && (
        <div className="exam-cycle-warning" role="alertdialog" aria-labelledby="cycle-warn-title">
          <div className="exam-cycle-box">
            <h2 id="cycle-warn-title">Peringatan Pengawasan</h2>
            <p>
              Aktivitas meninggalkan layar ujian terdeteksi. Ini adalah peringatan pertama. Kejadian
              berikutnya akan menghentikan pengerjaan hingga pemulihan divalidasi. Waktu ujian tetap berjalan.
            </p>
            <MotionButton
              className="primary-button"
              onClick={() => setFirstCycleAcknowledged(true)}
            >
              Saya Mengerti & Lanjutkan
            </MotionButton>
          </div>
        </div>
      )}

      {/* Siklus 2+: Layar Hitam Pemulihan */}
      {showBlackout && (
        <section
          className="exam-blackout-screen"
          role="region"
          aria-label="Layar pemulihan sesi"
        >
          <div className="exam-blackout-content">
            <h2>Pengerjaan Dijeda</h2>
            <p>
              Aktivitas meninggalkan layar ujian terdeteksi kembali. Pengerjaan soal ditutup sementara.
              Pastikan jendela ujian aktif, fokus, dan kembali ke mode layar penuh untuk memulihkan sesi.
            </p>
            {recoveryError && (
              <p style={{ color: "#fca5a5", fontSize: 14 }}>{recoveryError}</p>
            )}
            <MotionButton
              className="primary-button"
              disabled={recovering}
              onClick={() => void handleRecover()}
            >
              {recovering
                ? "Memvalidasi pemulihan…"
                : proctoring.compatibilityMode
                ? "Kembali ke ujian"
                : "Pulihkan Sesi & Masuk Layar Penuh"}
            </MotionButton>
          </div>
        </section>
      )}

      {/* Kunci Pengawas */}
      {locked && <ExamLockScreen offline={offline} />}
    </motion.main>
  );
}
