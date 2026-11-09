"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { post, type ExamSession } from "./api";

type EventType = "window_blur" | "tab_switch" | "fullscreen_exit" | "devtools";
type Event = { incidentId: string; eventType: EventType; metadata: Record<string, unknown> };
export function useExamProctoring(session: ExamSession | null, locked: boolean, onLock: (value: boolean) => void) {
  const [fullscreen, setFullscreen] = useState(false);
  const [error, setError] = useState("");
  const queue = useRef<Event[]>([]);
  const queueOwner = useRef("");
  const sending = useRef(false);
  const lockedRef = useRef(locked);
  const wasFullscreen = useRef(false);
  useEffect(() => { lockedRef.current = locked; }, [locked]);
  const saveQueue = useCallback(() => {
    if (!queueOwner.current) return;
    try {
      if (queue.current.length) localStorage.setItem(queueOwner.current, JSON.stringify(queue.current));
      else localStorage.removeItem(queueOwner.current);
    } catch { /* Exam access remains available when browser storage is unavailable. */ }
  }, []);
  const flush = useCallback(async () => {
    if (sending.current) return;
    sending.current = true;
    const owner = queueOwner.current;
    try {
      while (owner && owner === queueOwner.current && queue.current.length) {
        const result = await post<{ isLocked: boolean }>("/api/proctoring/event", queue.current[0]);
        if (owner !== queueOwner.current) break;
        queue.current.shift();
        saveQueue();
        if (result.isLocked) { lockedRef.current = true; onLock(true); }
      }
    } catch { /* Retain the same incident IDs until the connection returns. */ }
    finally { sending.current = false; }
  }, [onLock, saveQueue]);
  const focusEnabled = session?.exam.violationPolicy.detect_tab_switch === true;
  const toolsEnabled = session?.exam.violationPolicy.detect_devtools === true;
  const fullscreenEnabled = session?.exam.violationPolicy.detect_fullscreen_exit === true;
  const examId = session?.exam.id;
  const studentId = session?.student.id;
  useEffect(() => {
    if (!examId || !studentId) return;
    const owner = `eduquas:pending-events:${examId}:${studentId}`;
    if (queueOwner.current !== owner) {
      queueOwner.current = owner;
      try {
        const saved: unknown = JSON.parse(localStorage.getItem(owner) || "[]");
        queue.current = Array.isArray(saved) ? saved.filter((item): item is Event =>
          !!item && typeof item === "object" && typeof item.incidentId === "string" &&
          ["window_blur", "tab_switch", "fullscreen_exit", "devtools"].includes(item.eventType) &&
          !!item.metadata && typeof item.metadata === "object").slice(0, 200) : [];
      } catch { queue.current = []; }
    }
    void flush();
    let focusLost = false;
    const record = (eventType: EventType, metadata: Record<string, unknown>) => {
      if (lockedRef.current) return;
      queue.current.push({ incidentId: crypto.randomUUID(), eventType, metadata });
      saveQueue();
      void flush();
    };
    const lostFocus = () => { if (focusEnabled && !focusLost) { focusLost = true; record(document.hidden ? "tab_switch" : "window_blur", { source: "focus_change" }); } };
    const restoreFocus = () => { if (!document.hidden && document.hasFocus()) focusLost = false; };
    const visibility = () => { if (document.hidden) lostFocus(); else restoreFocus(); };
    const key = (event: KeyboardEvent) => {
      if (!toolsEnabled || !event.isTrusted || event.repeat) return;
      const mac = /Mac|iPhone|iPad/.test(navigator.platform);
      if (event.key === "F12" || (mac ? event.metaKey && event.altKey : event.ctrlKey && event.shiftKey) && ["i", "j", "c"].includes(event.key.toLowerCase())) record("devtools", { source: "keyboard_shortcut" });
    };
    const fullscreenChange = () => {
      const entered = !!document.fullscreenElement;
      setFullscreen(entered);
      if (fullscreenEnabled && wasFullscreen.current && !entered) record("fullscreen_exit", { source: "fullscreen_change" });
      if (entered) wasFullscreen.current = true;
      else wasFullscreen.current = false;
    };
    const retry = () => { void flush(); };
    window.addEventListener("blur", lostFocus); window.addEventListener("focus", restoreFocus);
    document.addEventListener("visibilitychange", visibility); document.addEventListener("fullscreenchange", fullscreenChange);
    window.addEventListener("keydown", key); window.addEventListener("online", retry);
    const timer = window.setInterval(retry, 12000);
    return () => { window.removeEventListener("blur", lostFocus); window.removeEventListener("focus", restoreFocus); document.removeEventListener("visibilitychange", visibility); document.removeEventListener("fullscreenchange", fullscreenChange); window.removeEventListener("keydown", key); window.removeEventListener("online", retry); window.clearInterval(timer); };
  }, [examId, studentId, focusEnabled, toolsEnabled, fullscreenEnabled, flush, saveQueue]);
  const enterFullscreen = useCallback(async () => {
    try { if (!document.fullscreenEnabled || !document.documentElement.requestFullscreen) throw new Error("Layar penuh tidak didukung pada perangkat ini."); await document.documentElement.requestFullscreen(); setError(""); }
    catch (err) { setError(err instanceof Error ? err.message : "Layar penuh belum dapat diaktifkan."); }
  }, []);
  return { fullscreen, fullscreenEnabled, enterFullscreen, error };
}
