"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { post, type ExamSession } from "./api";

export type ProctoringEventType = "window_blur" | "tab_switch" | "fullscreen_exit" | "fullscreen_denied" | "devtools";

export type ProctoringEventItem = {
  incidentId: string;
  eventType: ProctoringEventType;
  metadata: Record<string, unknown>;
};

type ProctoringResponse = {
  isLocked: boolean;
  violationCount?: number;
  violationCycleCount?: number;
  recoveryRequired?: boolean;
};

export function useExamProctoring(
  session: ExamSession | null,
  locked: boolean,
  onLock: (value: boolean) => void,
  onRecoveryRequired?: (required: boolean, cycleCount: number) => void
) {
  const [fullscreen, setFullscreen] = useState(false);
  const [compatibilityMode, setCompatibilityMode] = useState(false);
  const [error, setError] = useState("");
  const [splitScreenIndicated, setSplitScreenIndicated] = useState(false);

  const queue = useRef<ProctoringEventItem[]>([]);
  const queueOwner = useRef("");
  const sending = useRef(false);
  const lockedRef = useRef(locked);
  const wasFullscreen = useRef(false);

  const pendingSignals = useRef<Set<"fullscreen_exit" | "tab_switch" | "window_blur">>(new Set());
  const coalescingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSplitScreenRef = useRef(false);

  useEffect(() => {
    lockedRef.current = locked;
  }, [locked]);

  const saveQueue = useCallback(() => {
    if (!queueOwner.current) return;
    try {
      if (queue.current.length) {
        localStorage.setItem(queueOwner.current, JSON.stringify(queue.current));
      } else {
        localStorage.removeItem(queueOwner.current);
      }
    } catch {
      /* Penyimpanan lokal opsional */
    }
  }, []);

  const flush = useCallback(async () => {
    if (sending.current) return;
    sending.current = true;
    const owner = queueOwner.current;
    try {
      while (owner && owner === queueOwner.current && queue.current.length) {
        const item = queue.current[0];
        const result = await post<ProctoringResponse>("/api/proctoring/event", item);
        if (owner !== queueOwner.current) break;
        queue.current.shift();
        saveQueue();

        if (result.isLocked) {
          lockedRef.current = true;
          onLock(true);
        }
        if (result.recoveryRequired !== undefined && onRecoveryRequired) {
          onRecoveryRequired(result.recoveryRequired, result.violationCycleCount ?? 0);
        }
      }
    } catch {
      /* Pertahankan item antrean hingga koneksi kembali */
    } finally {
      sending.current = false;
    }
  }, [onLock, onRecoveryRequired, saveQueue]);

  const policy = session?.exam.violationPolicy;
  const focusLossEnabled = policy?.detect_focus_loss ?? policy?.detect_tab_switch ?? true;
  const tabSwitchEnabled = policy?.detect_tab_switch ?? true;
  const toolsEnabled = policy?.detect_devtools ?? true;
  const fullscreenEnabled = policy?.detect_fullscreen_exit ?? true;
  const splitScreenEnabled = policy?.detect_split_screen ?? true;

  const examId = session?.exam.id;
  const studentId = session?.student.id;

  const enterFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenEnabled || !document.documentElement.requestFullscreen) {
        setCompatibilityMode(true);
        if (queueOwner.current && !lockedRef.current) {
          queue.current.push({
            incidentId: crypto.randomUUID(),
            eventType: "fullscreen_denied",
            metadata: { source: "compatibility_mode", reason: "api_unsupported" },
          });
          saveQueue();
          void flush();
        }
        return;
      }
      await document.documentElement.requestFullscreen();
      setFullscreen(true);
      setError("");
    } catch (err) {
      setCompatibilityMode(true);
      if (queueOwner.current && !lockedRef.current) {
        queue.current.push({
          incidentId: crypto.randomUUID(),
          eventType: "fullscreen_denied",
          metadata: {
            source: "compatibility_mode",
            reason: err instanceof Error ? err.message : "api_rejected",
          },
        });
        saveQueue();
        void flush();
      }
    }
  }, [flush, saveQueue]);

  // Pantau geometri jendela untuk indikasi split screen tanpa menghukum resize sendiri
  useEffect(() => {
    if (!splitScreenEnabled) return;
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const checkGeometry = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        const isNotFullscreen = !document.fullscreenElement;
        const isNarrowRatio = window.innerWidth <= window.screen.availWidth * 0.65;
        const indicated = isNotFullscreen && isNarrowRatio;
        isSplitScreenRef.current = indicated;
        setSplitScreenIndicated(indicated);
      }, 500);
    };

    window.addEventListener("resize", checkGeometry);
    checkGeometry();
    return () => {
      window.removeEventListener("resize", checkGeometry);
      if (resizeTimer) clearTimeout(resizeTimer);
    };
  }, [splitScreenEnabled]);

  useEffect(() => {
    if (!examId || !studentId) return;
    const owner = `eduquas:pending-events:${examId}:${studentId}`;
    if (queueOwner.current !== owner) {
      queueOwner.current = owner;
      try {
        const saved: unknown = JSON.parse(localStorage.getItem(owner) || "[]");
        queue.current = Array.isArray(saved)
          ? saved
              .filter(
                (item): item is ProctoringEventItem =>
                  !!item &&
                  typeof item === "object" &&
                  typeof item.incidentId === "string" &&
                  ["window_blur", "tab_switch", "fullscreen_exit", "fullscreen_denied", "devtools"].includes(
                    item.eventType
                  ) &&
                  !!item.metadata &&
                  typeof item.metadata === "object"
              )
              .slice(0, 200)
          : [];
      } catch {
        queue.current = [];
      }
    }

    void flush();

    const record = (eventType: ProctoringEventType, metadata: Record<string, unknown>) => {
      if (lockedRef.current) return;
      queue.current.push({ incidentId: crypto.randomUUID(), eventType, metadata });
      saveQueue();
      void flush();
    };

    const scheduleCoalescedViolation = () => {
      if (coalescingTimer.current) clearTimeout(coalescingTimer.current);
      coalescingTimer.current = setTimeout(() => {
        const signals = Array.from(pendingSignals.current);
        pendingSignals.current.clear();
        coalescingTimer.current = null;
        if (!signals.length || lockedRef.current) return;

        let chosenType: "fullscreen_exit" | "tab_switch" | "window_blur";
        if (signals.includes("fullscreen_exit")) {
          chosenType = "fullscreen_exit";
        } else if (signals.includes("tab_switch")) {
          chosenType = "tab_switch";
        } else {
          chosenType = "window_blur";
        }

        const metadata: Record<string, unknown> = {
          coalescedSignals: signals,
          source: "proctoring_incident",
        };
        if (isSplitScreenRef.current) {
          metadata.splitScreenIndication = true;
        }

        record(chosenType, metadata);
      }, 350);
    };

    let focusLost = false;

    const lostFocus = () => {
      if (!focusLossEnabled && !tabSwitchEnabled) return;
      if (!focusLost) {
        focusLost = true;
        if (document.hidden) {
          if (tabSwitchEnabled) pendingSignals.current.add("tab_switch");
        } else {
          if (focusLossEnabled) pendingSignals.current.add("window_blur");
        }
        scheduleCoalescedViolation();
      }
    };

    const restoreFocus = () => {
      if (!document.hidden && document.hasFocus()) {
        focusLost = false;
      }
    };

    const visibility = () => {
      if (document.hidden) {
        lostFocus();
      } else {
        restoreFocus();
      }
    };

    const key = (event: KeyboardEvent) => {
      if (!toolsEnabled || !event.isTrusted || event.repeat) return;
      const mac = /Mac|iPhone|iPad/.test(navigator.platform);
      if (
        event.key === "F12" ||
        ((mac ? event.metaKey && event.altKey : event.ctrlKey && event.shiftKey) &&
          ["i", "j", "c"].includes(event.key.toLowerCase()))
      ) {
        record("devtools", { source: "keyboard_shortcut" });
      }
    };

    const fullscreenChange = () => {
      const entered = !!document.fullscreenElement;
      setFullscreen(entered);
      if (fullscreenEnabled && wasFullscreen.current && !entered && !compatibilityMode) {
        pendingSignals.current.add("fullscreen_exit");
        scheduleCoalescedViolation();
      }
      wasFullscreen.current = entered;
    };

    const retry = () => {
      void flush();
    };

    window.addEventListener("blur", lostFocus);
    window.addEventListener("focus", restoreFocus);
    document.addEventListener("visibilitychange", visibility);
    document.addEventListener("fullscreenchange", fullscreenChange);
    window.addEventListener("keydown", key);
    window.addEventListener("online", retry);

    const timer = window.setInterval(retry, 5000);

    return () => {
      window.removeEventListener("blur", lostFocus);
      window.removeEventListener("focus", restoreFocus);
      document.removeEventListener("visibilitychange", visibility);
      document.removeEventListener("fullscreenchange", fullscreenChange);
      window.removeEventListener("keydown", key);
      window.removeEventListener("online", retry);
      window.clearInterval(timer);
      if (coalescingTimer.current) clearTimeout(coalescingTimer.current);
    };
  }, [
    examId,
    studentId,
    focusLossEnabled,
    tabSwitchEnabled,
    toolsEnabled,
    fullscreenEnabled,
    compatibilityMode,
    flush,
    saveQueue,
  ]);

  const recover = useCallback(
    async (acknowledgedCycleCount: number): Promise<{ success: boolean; isLocked?: boolean; message?: string }> => {
      if (document.hidden || !document.hasFocus()) {
        return {
          success: false,
          message: "Halaman harus aktif dan fokus sebelum pemulihan dapat dijalankan.",
        };
      }

      if (!compatibilityMode && fullscreenEnabled && !document.fullscreenElement) {
        try {
          await enterFullscreen();
        } catch {
          // Compatibility mode diaktifkan oleh enterFullscreen
        }
      }

      try {
        const res = await post<{
          success: boolean;
          isLocked: boolean;
          violationCount: number;
          violationCycleCount: number;
          recoveredCycleCount: number;
          recoveryRequired: boolean;
        }>("/api/exam-session/recover", { acknowledgedCycleCount });

        if (res.recoveryRequired) {
          return {
            success: false,
            message: "Terdapat kejadian pelanggaran baru yang belum dipulihkan.",
          };
        }

        return { success: true, isLocked: res.isLocked };
      } catch (err) {
        return {
          success: false,
          message: err instanceof Error ? err.message : "Pemulihan sesi belum dapat dijalankan.",
        };
      }
    },
    [compatibilityMode, fullscreenEnabled, enterFullscreen]
  );

  const needsPreparation = fullscreenEnabled && !fullscreen && !compatibilityMode;

  return {
    fullscreen,
    fullscreenEnabled,
    compatibilityMode,
    needsPreparation,
    splitScreenIndicated,
    enterFullscreen,
    recover,
    error,
  };
}
