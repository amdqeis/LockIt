"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import LatexRenderer from "@/app/components/LatexRenderer";
import { hasNaturalOrLatexMath } from "@/lib/naturalMath";
import DOMPurify from "dompurify";
import {
  fetchExamSession,
  saveStudentAnswer,
  sendStudentHeartbeat,
  sendProctoringEvent,
  submitStudentExam,
  saveSessionHint,
  clearSessionHint,
  markStudentWarningAsRead,
} from "@/lib/examSession";
import { io } from "socket.io-client";
import { SkeletonBase, SkeletonQuestionCard } from "@/app/components/skeleton";

type AutoSaveStatus = "saved" | "saving" | "failed";
type Question = any;

function normalizeQuestion(q: any, idx: number) {
  let opts: { id: string; text: string }[] = [];
  if (Array.isArray(q.options)) {
    opts = q.options.map((opt: any, optIdx: number) => {
      const letter = String.fromCharCode(97 + optIdx); // 'a', 'b', 'c', ...
      if (typeof opt === "string") {
        return { id: letter, text: opt };
      }
      return {
        id: (opt.id || opt.key || opt.label || letter).toLowerCase(),
        text: opt.text || opt.label || opt.content || opt.value || "",
      };
    });
  } else if (q.options && typeof q.options === "object") {
    opts = Object.entries(q.options).map(([key, val]: [string, any], optIdx: number) => ({
      id: key.toLowerCase(),
      text: typeof val === "string" ? val : val?.text || "",
    }));
  }

  return {
    id: q.id,
    number: q.orderIndex || idx + 1,
    type: (q.type || "single_choice") as "single_choice" | "multi_select" | "latex" | "short_answer",
    text: q.questionText || q.text || "",
    image: q.imageUrl || q.image || null,
    options: opts,
    points: q.points || 10,
    hint: null,
  };
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return isMobile;
}

function hasLatex(text: string) {
  return hasNaturalOrLatexMath(text);
}

// ─── Image Zoom Modal ─────────────────────────────────────────────────────────
function ImageZoomModal({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  const [svgContent, setSvgContent] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Decode SVG data URI on the client only (avoid SSR/hydration mismatch with atob)
  const isSvgDataUri = src.startsWith("data:image/svg+xml");
  useEffect(() => {
    if (!isSvgDataUri) return;
    try {
      let decoded = "";
      if (src.startsWith("data:image/svg+xml;base64,")) {
        // Strip whitespace — browser atob() is strict and throws on newlines/spaces
        const b64 = src.slice("data:image/svg+xml;base64,".length).replace(/[\s]/g, "");
        decoded = atob(b64);
      } else {
        decoded = decodeURIComponent(src.replace(/^data:image\/svg\+xml;charset=utf-8,/, ""));
      }
      const clean = typeof window !== "undefined"
        ? DOMPurify.sanitize(decoded, { USE_PROFILES: { svg: true, svgFilters: true } })
        : decoded;
      setSvgContent(clean);
    } catch {
      setSvgContent("");
    }
  }, [src, isSvgDataUri]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.88)", backdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "20px",
      }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ position: "relative", maxWidth: "90vw", maxHeight: "90vh" }}>
        <button
          onClick={onClose}
          style={{
            position: "absolute", top: "-14px", right: "-14px",
            width: "32px", height: "32px", borderRadius: "50%",
            background: "white", border: "none", cursor: "pointer",
            fontSize: "16px", display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 2px 8px rgba(0,0,0,0.3)", zIndex: 1,
          }}
          aria-label="Tutup zoom gambar"
        >✕</button>
        {isSvgDataUri && svgContent ? (
          <div
            dangerouslySetInnerHTML={{ __html: svgContent }}
            style={{
              maxWidth: "90vw", maxHeight: "85vh",
              borderRadius: "6px", boxShadow: "0 16px 48px rgba(15,30,40,0.55), 0 4px 12px rgba(15,30,40,0.25)",
              background: "white", padding: "16px", overflow: "hidden",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          />
        ) : (
          <img
            src={src}
            alt={alt}
            loading="lazy"
            decoding="async"
            style={{ maxWidth: "90vw", maxHeight: "85vh", objectFit: "contain", borderRadius: "6px", boxShadow: "0 16px 48px rgba(15,30,40,0.55), 0 4px 12px rgba(15,30,40,0.25)" }}
          />
        )}
        <p style={{ textAlign: "center", color: "rgba(255,255,255,0.6)", fontSize: "12px", marginTop: "10px" }}>
          Klik di mana saja atau tekan Esc untuk menutup
        </p>
      </div>
    </div>
  );
}

// ─── Question Image Component ─────────────────────────────────────────────────
function QuestionImage({ src, alt, isMobile }: { src: string; alt: string; isMobile: boolean }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  // null = belum di-decode (SSR/awal), string = hasil decode (kosong = error)
  const [svgContent, setSvgContent] = useState<string | null>(null);

  const isSvgDataUri = src.startsWith("data:image/svg+xml");

  // Reset state whenever src changes (e.g. navigating between questions)
  useEffect(() => {
    setLoaded(false);
    setError(false);
    setZoomed(false);
    setSvgContent(null);
  }, [src]);

  // Decode SVG on the client only — atob() tidak tersedia di SSR Node.js secara konsisten
  // dan memanggil atob() synchronously di render menyebabkan hydration mismatch.
  useEffect(() => {
    if (!isSvgDataUri) return;
    try {
      let decoded = "";
      if (src.startsWith("data:image/svg+xml;base64,")) {
        // Strip whitespace — browser atob() is strict and throws on newlines/spaces
        const b64 = src.slice("data:image/svg+xml;base64,".length).replace(/[\s]/g, "");
        decoded = atob(b64);
      } else {
        decoded = decodeURIComponent(src.replace(/^data:image\/svg\+xml;charset=utf-8,/, ""));
      }
      const clean = typeof window !== "undefined"
        ? DOMPurify.sanitize(decoded, { USE_PROFILES: { svg: true, svgFilters: true } })
        : decoded;
      setSvgContent(clean || "");
    } catch {
      setSvgContent("");
    }
  }, [src, isSvgDataUri]);

  if (isSvgDataUri) {
    // svgContent === null → masih loading/SSR; tampilkan shimmer
    // svgContent === "" → decode gagal; tampilkan pesan error
    // svgContent === "<svg...>" → berhasil; render inline
    const isLoading = svgContent === null;
    const hasError = svgContent === "";

    return (
      <div style={{ marginBottom: "20px" }}>
        {zoomed && <ImageZoomModal src={src} alt={alt} onClose={() => setZoomed(false)} />}
        <div
          style={{
            borderRadius: "6px", overflow: "hidden",
            border: "1.5px solid #D9E9F2", background: "#F0F9FF",
            cursor: (!isLoading && !hasError) ? "zoom-in" : "default",
            position: "relative",
            maxHeight: isMobile ? "200px" : "340px",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
          onClick={() => { if (!isLoading && !hasError) setZoomed(true); }}
          title={(!isLoading && !hasError) ? "Klik untuk memperbesar gambar" : undefined}
        >
          {isLoading && (
            <div style={{
              width: "100%", height: isMobile ? "180px" : "240px",
              background: "linear-gradient(90deg, #E0F4FD 25%, #C8E6F5 50%, #E0F4FD 75%)",
              backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <span style={{ fontSize: "32px", opacity: 0.4 }}>🖼️</span>
            </div>
          )}
          {hasError && (
            <div style={{
              padding: "24px", textAlign: "center", color: "#6E8EA0",
              height: isMobile ? "100px" : "120px",
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "8px"
            }}>
              <span style={{ fontSize: "28px" }}>⚠️</span>
              <span style={{ fontSize: "13px" }}>Gambar tidak bisa dimuat</span>
            </div>
          )}
          {!isLoading && !hasError && (
            <div
              className="svg-inline-container"
              dangerouslySetInnerHTML={{ __html: svgContent! }}
              style={{
                width: "100%", maxHeight: isMobile ? "220px" : "360px",
                display: "flex", alignItems: "center", justifyContent: "center",
                overflow: "auto",
              }}
            />
          )}
          {!isLoading && !hasError && (
            <div style={{
              position: "absolute", bottom: "8px", right: "8px",
              background: "rgba(0,0,0,0.45)", borderRadius: "6px",
              padding: "3px 8px", color: "white", fontSize: "11px",
              display: "flex", alignItems: "center", gap: "4px", pointerEvents: "none",
            }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                <line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
              </svg>
              Perbesar
            </div>
          )}
        </div>
        <p style={{ fontSize: "11px", color: "#98B4C4", marginTop: "6px", textAlign: "center", fontStyle: "italic" }}>{alt}</p>
        <style>{`
          @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
          .svg-inline-container svg { max-width: 100% !important; height: auto !important; display: block; }
        `}</style>
      </div>
    );
  }

  // Regular image (PNG, JPEG, WebP, remote URL, base64, etc.)
  return (
    <div style={{ marginBottom: "20px" }}>
      {zoomed && <ImageZoomModal src={src} alt={alt} onClose={() => setZoomed(false)} />}
      <div
        style={{
          borderRadius: "6px", overflow: "hidden",
          border: "1.5px solid #D9E9F2", background: "#F0F9FF",
          cursor: error ? "default" : "zoom-in",
          position: "relative",
          maxHeight: isMobile ? "200px" : "320px",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
        onClick={() => { if (!error) setZoomed(true); }}
        title={error ? undefined : "Klik untuk memperbesar gambar"}
      >
        {!loaded && !error && (
          <div style={{
            width: "100%", height: isMobile ? "180px" : "240px",
            background: "linear-gradient(90deg, #E0F4FD 25%, #C8E6F5 50%, #E0F4FD 75%)",
            backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{ fontSize: "32px", opacity: 0.4 }}>🖼️</span>
          </div>
        )}
        {error && (
          <div style={{
            padding: "24px", textAlign: "center", color: "#6E8EA0",
            height: isMobile ? "100px" : "120px",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "8px"
          }}>
            <span style={{ fontSize: "28px" }}>⚠️</span>
            <span style={{ fontSize: "13px" }}>Gambar tidak bisa dimuat</span>
          </div>
        )}
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => { setError(true); setLoaded(true); }}
          style={{
            maxWidth: "100%", maxHeight: isMobile ? "200px" : "320px",
            objectFit: "contain",
            display: loaded && !error ? "block" : "none",
            transition: "opacity 0.3s",
          }}
        />
        {loaded && !error && (
          <div style={{
            position: "absolute", bottom: "8px", right: "8px",
            background: "rgba(0,0,0,0.45)", borderRadius: "6px",
            padding: "3px 8px", color: "white", fontSize: "11px",
            display: "flex", alignItems: "center", gap: "4px", pointerEvents: "none",
          }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              <line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
            </svg>
            Perbesar
          </div>
        )}
      </div>
      <p style={{ fontSize: "11px", color: "#98B4C4", marginTop: "6px", textAlign: "center", fontStyle: "italic" }}>{alt}</p>
      <style>{`@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>
    </div>
  );
}

// ─── Q-Number Grid (right panel) ──────────────────────────────────────────────
function QNumberGrid({
  questions, currentQ, answers, multiAnswers, flagged, onSelect, isQuestionAnswered,
}: {
  questions: Question[];
  currentQ: number;
  answers: Record<string, string>;
  multiAnswers: Record<string, Set<string>>;
  flagged: Set<number>;
  onSelect: (idx: number) => void;
  isQuestionAnswered: (q: Question) => boolean;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "7px" }}>
      {questions.map((q, idx) => {
        const isCurrent = idx === currentQ;
        const isAnswered = isQuestionAnswered(q);
        const isFlagged = flagged.has(idx);
        const typeColor = q.type === "short_answer" ? "#0D9488" : q.type === "multi_select" ? "#D97706" : q.type === "latex" ? "#7C3AED" : "#29ABE2";
        const size = "36px";
        return (
          <button
            key={idx}
            onClick={() => onSelect(idx)}
            style={{
              width: size, height: size, borderRadius: "6px",
              border: isCurrent ? `2.5px solid ${typeColor}` : isAnswered ? `2px solid ${typeColor}` : "1.5px solid #D9E9F2",
              background: isCurrent ? typeColor : isAnswered ? (q.type === "short_answer" ? "#CCFBF1" : q.type === "multi_select" ? "#FEF3C7" : q.type === "latex" ? "#EDE9FE" : "#E0F4FD") : "white",
              color: isCurrent ? "white" : isAnswered ? typeColor : "#6E8EA0",
              fontWeight: isCurrent ? 700 : 500,
              fontSize: "13px",
              cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              position: "relative", transition: "all 0.15s",
              boxShadow: isCurrent ? `0 2px 8px ${typeColor}44` : "none",
              fontFamily: "Poppins, sans-serif",
            }}
            title={`Soal ${idx + 1}${isFlagged ? " (ditandai)" : ""}`}
          >
            {idx + 1}
            {isFlagged && (
              <span style={{
                position: "absolute", top: "-3px", right: "-3px",
                width: "8px", height: "8px", borderRadius: "50%",
                background: "#F59E0B", border: "1.5px solid white",
              }} />
            )}
          </button>
        );
      })}
    </div>
  );
}

type SidePanel = "soal" | "statistik" | "jadwal" | "history" | "settings" | "help" | null;

// ─── Sliding Panel Overlay ─────────────────────────────────────────────────────
function SidePanelDrawer({
  open, title, icon, onClose, children, warningH,
}: {
  open: boolean; title: string; icon: React.ReactNode;
  onClose: () => void; children: React.ReactNode; warningH: number;
}) {
  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 44,
          background: "rgba(15,23,42,0.25)", backdropFilter: "blur(2px)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: "opacity 0.22s ease",
        }}
      />
      {/* Drawer */}
      <div
        style={{
          position: "fixed",
          left: "56px",
          top: warningH > 0 ? `${warningH}px` : 0,
          bottom: 0,
          width: "320px",
          background: "white",
          borderRight: "1.5px solid #D9E9F2",
          boxShadow: "4px 0 24px rgba(41,171,226,0.10)",
          zIndex: 45,
          display: "flex",
          flexDirection: "column",
          transform: open ? "translateX(0)" : "translateX(-110%)",
          transition: "transform 0.28s cubic-bezier(0.34,1.1,0.64,1)",
          overflowY: "auto",
        }}
      >
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 18px", borderBottom: "1.5px solid #EDF6FC",
          background: "#F8FDFF", flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ color: "#29ABE2" }}>{icon}</div>
            <span style={{ fontSize: "14px", fontWeight: 700, color: "#1C303D", letterSpacing: "-0.01em" }}>
              {title}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              width: "28px", height: "28px", border: "none",
              background: "#EDF6FC", borderRadius: "6px",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              color: "#5A8FA8", fontSize: "14px",
            }}
            aria-label="Tutup panel"
          >✕</button>
        </div>
        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "18px" }}>
          {children}
        </div>
      </div>
    </>
  );
}

export default function ExamSessionPage() {
  const [questionsList, setQuestionsList] = useState<any[]>([]);
  const [examMeta, setExamMeta] = useState<any>({
    title: "Memuat Ujian...",
    code: "",
    duration: 90 * 60,
    teacher: "Pengawas",
    class: "Peserta Ujian",
  });
  const isMobile = useIsMobile();
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [multiAnswers, setMultiAnswers] = useState<Record<string, Set<string>>>({});
  const [flagged, setFlagged] = useState<Set<number>>(new Set());
  const [timeLeft, setTimeLeft] = useState(90 * 60);
  const [autoSaveStatus, setAutoSaveStatus] = useState<AutoSaveStatus>("saved");
  const [submitStep, setSubmitStep] = useState<0 | 1 | 2>(0);
  const [isLocked, setIsLocked] = useState(false);
  const [screenshotLockReason, setScreenshotLockReason] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(true);
  const [showFullscreenGate, setShowFullscreenGate] = useState(false);
  const [splitScreenWarning, setSplitScreenWarning] = useState<string | null>(null);
  const [hasEnteredFullscreenBefore, setHasEnteredFullscreenBefore] = useState(false);
  const [isShieldActive, setIsShieldActive] = useState<boolean>(false);
  const [isCheckingUnlock, setIsCheckingUnlock] = useState<boolean>(false);
  const [totalExpectedQuestions, setTotalExpectedQuestions] = useState<number>(0);
  const [isChunk2Loading, setIsChunk2Loading] = useState<boolean>(false);
  const blurTimestampRef = useRef<number>(0);
  const [studentProfile, setStudentProfile] = useState<{ name: string; nisn: string } | null>(null);
  const [warningBanner, setWarningBanner] = useState<string | null>(null);
  const [timeExpiredOverlay, setTimeExpiredOverlay] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [activePanel, setActivePanel] = useState<SidePanel>(null);
  const [currentDateStr, setCurrentDateStr] = useState<string>("");
  const saveTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({});
  const pillNavRef = useRef<HTMLDivElement>(null);
  const activityLog = useRef<{ time: string; action: string; detail: string }[]>([]);

  const togglePanel = (panel: SidePanel) =>
    setActivePanel((prev) => (prev === panel ? null : panel));

  const totalQ = Math.max(totalExpectedQuestions, questionsList.length);
  const isQuestionPending = currentQ >= questionsList.length && questionsList.length > 0;
  const question: Question = questionsList[currentQ] || questionsList[0] || {
    id: "q-loading",
    number: 1,
    type: "multiple_choice",
    text: "Memuat soal ujian...",
    options: [],
    points: 1,
  };

  const answeredCount = questionsList.filter((q) => {
    if (q.type === "multi_select") return (multiAnswers[q.id]?.size ?? 0) > 0;
    if (q.type === "short_answer") return !!(answers[q.id] && answers[q.id].trim().length > 0);
    return !!answers[q.id];
  }).length;

  const isQuestionAnswered = (q: Question) => {
    if (q.type === "multi_select") return (multiAnswers[q.id]?.size ?? 0) > 0;
    if (q.type === "short_answer") return !!(answers[q.id] && answers[q.id].trim().length > 0);
    return !!answers[q.id];
  };

  useEffect(() => {
    setCurrentDateStr(new Date().toLocaleDateString("id-ID", { weekday: "long", year: "numeric", month: "long", day: "numeric" }));
  }, []);

  // Fullscreen & Split-Screen Detection Guard
  const checkTrueFullscreen = useCallback(() => {
    if (typeof window === "undefined") return { isFs: false, isSplit: false, reason: "" };

    const hasFsElement = !!(
      document.fullscreenElement ||
      (document as any).webkitFullscreenElement ||
      (document as any).mozFullScreenElement ||
      (document as any).msFullscreenElement
    );

    const screenW = window.screen.availWidth || window.screen.width;
    const screenH = window.screen.availHeight || window.screen.height;
    const innerW = window.innerWidth;
    const innerH = window.innerHeight;
    const outerW = window.outerWidth || innerW;
    const outerH = window.outerHeight || innerH;

    const isMobileDevice =
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
      innerW < 768;

    let isSplit = false;
    let splitReason = "";

    if (isMobileDevice) {
      // HP / Android: Deteksi mode layar terbagi (split-screen / multi-window)
      const maxScreen = Math.max(screenH, screenW);
      const minScreen = Math.min(screenH, screenW);
      const ratioH = innerH / maxScreen;
      const ratioW = innerW / minScreen;

      if (ratioH < 0.68) {
        isSplit = true;
        splitReason = `Mode Split-Screen HP terdeteksi (tinggi viewport ${innerH}px vs ${maxScreen}px).`;
      } else if (ratioW < 0.72) {
        isSplit = true;
        splitReason = `Mode Layar Terbagi HP terdeteksi (lebar viewport ${innerW}px vs ${minScreen}px).`;
      }
    } else {
      // Laptop / Desktop: Deteksi Windows Snap Assist / Window Split
      const widthRatio = innerW / screenW;
      const heightRatio = innerH / screenH;
      const outerWidthRatio = outerW / screenW;

      if (widthRatio < 0.90 || outerWidthRatio < 0.90) {
        isSplit = true;
        splitReason = `Jendela browser terbagi (split-screen/snap). Lebar aktif: ${Math.round(widthRatio * 100)}% dari layar monitor.`;
      } else if (heightRatio < 0.85) {
        isSplit = true;
        splitReason = `Jendela browser terbagi secara vertikal. Tinggi aktif: ${Math.round(heightRatio * 100)}% dari layar monitor.`;
      }
    }

    const isTrue = hasFsElement && !isSplit;
    return { isFs: isTrue, isSplit, reason: splitReason };
  }, []);

  const enterFullscreen = useCallback(async () => {
    try {
      const { isSplit, reason } = checkTrueFullscreen();
      if (isSplit) {
        setSplitScreenWarning(reason);
        sendProctoringEvent("split_screen", { reason, trigger: "attempted_fullscreen_while_split" });
        setIsFullscreen(false);
        setShowFullscreenGate(true);
        return;
      }

      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }

      setTimeout(() => {
        const recheck = checkTrueFullscreen();
        if (!recheck.isFs) {
          setIsFullscreen(false);
          setShowFullscreenGate(true);
          if (recheck.isSplit) {
            setSplitScreenWarning(recheck.reason);
            sendProctoringEvent("split_screen", { reason: recheck.reason });
          }
        } else {
          setIsFullscreen(true);
          setSplitScreenWarning(null);
          setShowFullscreenGate(false);
          setHasEnteredFullscreenBefore(true);
        }
      }, 300);
    } catch (err) {
      console.warn("Fullscreen request rejected or requires user gesture:", err);
      setIsFullscreen(false);
      setShowFullscreenGate(true);
    }
  }, [checkTrueFullscreen]);

  useEffect(() => {
    if (typeof window === "undefined" || submitted) return;

    const checkFs = () => {
      const { isFs, isSplit, reason } = checkTrueFullscreen();
      if (!isFs) {
        setIsFullscreen(false);
        setShowFullscreenGate(true);
        if (isSplit) {
          setSplitScreenWarning(reason);
          sendProctoringEvent("split_screen", { reason });
        }
        return false;
      }
      setIsFullscreen(true);
      setSplitScreenWarning(null);
      setShowFullscreenGate(false);
      setHasEnteredFullscreenBefore(true);
      return true;
    };

    const initialFs = checkFs();
    if (!initialFs) {
      document.documentElement
        .requestFullscreen()
        .then(() => {
          checkFs();
        })
        .catch(() => {
          setIsFullscreen(false);
          setShowFullscreenGate(true);
        });
    }

    const onFsChange = () => {
      const { isFs, isSplit, reason } = checkTrueFullscreen();
      setIsFullscreen(isFs);
      if (!isFs) {
        if (isSplit) {
          setSplitScreenWarning(reason);
          sendProctoringEvent("split_screen", { reason });
        } else {
          sendProctoringEvent("fullscreen_exit");
        }
        setShowFullscreenGate(true);
      } else {
        setSplitScreenWarning(null);
        setShowFullscreenGate(false);
        setHasEnteredFullscreenBefore(true);
      }
    };

    const onResize = () => {
      const { isFs, isSplit, reason } = checkTrueFullscreen();
      if (!isFs) {
        setIsFullscreen(false);
        setShowFullscreenGate(true);
        if (isSplit) {
          setSplitScreenWarning(reason);
          sendProctoringEvent("split_screen", { reason });
        }
      }
    };

    // Guard interval setiap 1 detik untuk deteksi snap/split-screen kontinu
    const timer = setInterval(() => {
      const { isFs, isSplit, reason } = checkTrueFullscreen();
      if (!isFs) {
        setIsFullscreen(false);
        setShowFullscreenGate(true);
        if (isSplit && !splitScreenWarning) {
          setSplitScreenWarning(reason);
          sendProctoringEvent("split_screen", { reason });
        }
      } else if (splitScreenWarning) {
        setSplitScreenWarning(null);
      }
    }, 1000);

    document.addEventListener("fullscreenchange", onFsChange);
    document.addEventListener("webkitfullscreenchange", onFsChange);
    window.addEventListener("resize", onResize);

    return () => {
      clearInterval(timer);
      document.removeEventListener("fullscreenchange", onFsChange);
      document.removeEventListener("webkitfullscreenchange", onFsChange);
      window.removeEventListener("resize", onResize);
    };
  }, [checkTrueFullscreen, submitted, splitScreenWarning]);

  // Auto-scroll pill nav mobile ke nomor soal yang aktif
  useEffect(() => {
    if (!isMobile || !pillNavRef.current) return;
    const activeBtn = pillNavRef.current.children[currentQ] as HTMLElement;
    if (activeBtn) {
      activeBtn.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  }, [currentQ, isMobile]);

  // Fase A: Load exam session from backend (Incremental Chunked Fetching)
  useEffect(() => {
    let isSubscribed = true;
    const loadSession = async () => {
      try {
        // 1. Fetch chunk 1 (tahap pertama: 50% butir soal awal + metadata + seluruh jawaban)
        const res = await fetchExamSession({ chunk: 1 });
        if (!res.success) {
          if (res.error?.code === "ALREADY_SUBMITTED" || res.error?.code === "EXAM_ALREADY_SUBMITTED") {
            sessionStorage.setItem("exam_already_submitted", "true");
            window.location.href = "/exam/done";
            return;
          }
          if (res.error?.code === "EXAM_NOT_STARTED") {
            window.location.href = "/exam/lobby";
            return;
          }
        }
        if (res.success && res.data && isSubscribed) {
          const { student, exam, questions: beQuestions, answers: beAnswers, serverTime, totalQuestions, hasMore } = res.data;
          
          const expectedTotal = totalQuestions || (Array.isArray(beQuestions) ? beQuestions.length : 0);
          setTotalExpectedQuestions(expectedTotal);

          if (Array.isArray(beQuestions) && beQuestions.length > 0) {
            const mapped = beQuestions.map((q, idx) => normalizeQuestion(q, idx));
            setQuestionsList(mapped);
          }
          if (exam) {
            setExamMeta((prev: any) => ({
              ...prev,
              title: exam.title || prev.title,
              duration: exam.durationMinutes * 60,
            }));
            if (exam.endTime && serverTime) {
              const diff = Math.max(
                0,
                Math.floor((new Date(exam.endTime).getTime() - new Date(serverTime).getTime()) / 1000)
              );
              setTimeLeft(diff);
            }
          }
          if (student) {
            setStudentProfile({ name: student.name, nisn: student.nisn });
            if (student.isLocked) {
              setIsLocked(true);
            }
            // Simpan hint ke localStorage agar auto-resume bisa bekerja jika tab ditutup
            if (exam) {
              saveSessionHint({
                studentName: student.name,
                studentNisn: student.nisn,
                examTitle: exam.title || "",
                examId: exam.id || "",
              });
            }
          }
          if (Array.isArray(beAnswers) && beAnswers.length > 0) {
            const restored: Record<string, string> = {};
            const restoredMulti: Record<string, Set<string>> = {};
            beAnswers.forEach((ans) => {
              if (ans.selectedOption) {
                if (ans.selectedOption.includes(",")) {
                  const parts = ans.selectedOption.split(",").map((s: string) => s.toLowerCase().trim());
                  restoredMulti[ans.questionId] = new Set(parts);
                } else {
                  restored[ans.questionId] = ans.selectedOption.toLowerCase();
                }
              }
            });
            setAnswers((prev) => ({ ...prev, ...restored }));
            setMultiAnswers((prev) => ({ ...prev, ...restoredMulti }));
          }

          // 2. Fetch chunk 2 (tahap kedua: sisa soal) secara asinkron di latar belakang
          if (hasMore) {
            setIsChunk2Loading(true);
            fetchExamSession({ chunk: 2 })
              .then((res2) => {
                if (res2.success && res2.data?.questions && isSubscribed) {
                  const chunkQuestions = res2.data.questions;
                  setQuestionsList((prev) => {
                    const existingIds = new Set(prev.map((q) => q.id));
                    const newQuestions = chunkQuestions
                      .filter((q) => !existingIds.has(q.id))
                      .map((q, idx) => normalizeQuestion(q, prev.length + idx));
                    return [...prev, ...newQuestions];
                  });
                }
              })
              .catch((err) => {
                console.error("Gagal sinkronisasi chunk 2 soal:", err);
              })
              .finally(() => {
                if (isSubscribed) setIsChunk2Loading(false);
              });
          }
        }
      } catch {
        // Fallback to mock session
      }
    };

    loadSession();
    return () => {
      isSubscribed = false;
    };
  }, []);

  // Timer tick & auto-submit on expiry
  useEffect(() => {
    if (isLocked || submitted) return;
    if (timeLeft <= 0) {
      setTimeExpiredOverlay(true);
      clearSessionHint();
      submitStudentExam().then((res) => {
        try {
          if (typeof window !== "undefined") {
            const summaryPayload = JSON.stringify({
              name: studentProfile?.name || "Peserta Ujian",
              nisn: studentProfile?.nisn || "0000000000",
              exam: examMeta?.title || "Ujian Selesai",
              answered: answeredCount,
              total: totalQ,
              showScoreToStudent: res.data?.showScoreToStudent !== false,
              allowAnswerReview: res.data?.allowAnswerReview === true,
            });
            sessionStorage.setItem("eduquas_submission_summary", summaryPayload);
          }
        } catch {}
      }).finally(() => {
        sessionStorage.setItem("exam_just_submitted", "true");
        sessionStorage.setItem("exam_submitted_title", examMeta?.title || "Ujian");
        setTimeout(() => {
          window.location.href = "/exam/done";
        }, 2500);
      });
      return;
    }
    const t = setInterval(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [timeLeft, isLocked, submitted]);

  // Fast adaptive polling saat status terkunci (1.5 detik) untuk unblock instan
  useEffect(() => {
    if (!isLocked || submitted) return;
    const fastInterval = setInterval(async () => {
      try {
        const res = await sendStudentHeartbeat();
        if (res.success && res.data) {
          if (!res.data.isLocked) {
            setIsLocked(false);
            setScreenshotLockReason(null);
          }
        }
      } catch {}
    }, 1500);
    return () => clearInterval(fastInterval);
  }, [isLocked, submitted]);

  // Periodic heartbeat standar (15s) saat status normal
  useEffect(() => {
    if (submitted) return;
    const interval = setInterval(async () => {
      try {
        const res = await sendStudentHeartbeat();
        if (res.success && res.data) {
          if (res.data.isLocked) {
            setIsLocked(true);
          } else {
            setIsLocked(false);
            setScreenshotLockReason(null);
          }
          if (res.data.warning?.message) {
            setWarningBanner(res.data.warning.message);
            if (res.data.warning.id) {
              markStudentWarningAsRead(res.data.warning.id).catch(() => {});
            }
          }
          if (!res.data.isExamActive) {
            setTimeExpiredOverlay(true);
          }
        }
      } catch {
        // ignore heartbeat error
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [submitted]);

  // Real-time socket events from teacher (warning, unlock, kick, end)
  useEffect(() => {
    if (submitted) return;
    const socket = io("/student-session", {
      withCredentials: true,
      transports: ["websocket", "polling"],
    });

    socket.on("teacher_warning", ({ warningId, message }: { warningId?: string; message: string }) => {
      if (message) {
        setWarningBanner(message);
        if (warningId) {
          markStudentWarningAsRead(warningId).catch(() => {});
        }
      }
    });

    socket.on("student_unlocked", () => {
      setIsLocked(false);
      setScreenshotLockReason(null);
    });

    socket.on("student_kicked", () => {
      window.location.href = "/";
    });

    socket.on("exam_ended", () => {
      setTimeExpiredOverlay(true);
    });

    return () => {
      socket.disconnect();
    };
  }, [submitted]);

  // Browser-only proctoring event listeners
  useEffect(() => {
    if (submitted) return;

    const triggerScreenshotViolation = (trigger: string, details?: Record<string, any>) => {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText("");
        }
      } catch {
        // ignore clipboard error
      }
      sendProctoringEvent("screenshot", { trigger, ...details });
      setIsLocked(true);
      setScreenshotLockReason(`Percobaan tangkapan layar (screenshot) terdeteksi (${trigger}). Sesi ujian dikunci sementara demi keamanan.`);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        blurTimestampRef.current = Date.now();
        setIsShieldActive(true);
        sendProctoringEvent("tab_switch");
      } else {
        setIsShieldActive(false);
        const blurTime = blurTimestampRef.current;
        const now = Date.now();
        if (blurTime > 0) {
          const gap = now - blurTime;
          blurTimestampRef.current = 0;
          // Jeda micro capture screenshot pada HP (Power+VolDown) & Windows Snipping: 150ms - 2800ms
          if (gap >= 150 && gap <= 2800) {
            triggerScreenshotViolation("Tangkapan layar OS/HP terdeteksi (Jeda overlay screenshot)", { gapMs: gap });
            return;
          }
        }
      }
    };

    const handleBlur = () => {
      blurTimestampRef.current = Date.now();
      setIsShieldActive(true);
      sendProctoringEvent("window_blur");
      // Purge clipboard saat kehilangan fokus agar screenshot OS tidak tersimpan
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText("").catch(() => {});
        }
      } catch {}
    };

    const handleFocus = async () => {
      setIsShieldActive(false);
      // Purge clipboard saat kembali fokus
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText("").catch(() => {});
        }
      } catch {}

      const blurTime = blurTimestampRef.current;
      const now = Date.now();
      if (blurTime > 0) {
        const gap = now - blurTime;
        blurTimestampRef.current = 0;
        // Jeda overlay screenshot di Android/iOS & Windows Snipping: 150ms - 2800ms
        if (gap >= 150 && gap <= 2800) {
          triggerScreenshotViolation("Tangkapan layar OS/HP terdeteksi (Jeda capture screen)", { gapMs: gap });
          return;
        }
      }

      // Deteksi jika pengguna baru saja mengambil screenshot via tool eksternal OS
      if (navigator.clipboard && navigator.clipboard.read) {
        try {
          const items = await navigator.clipboard.read();
          for (const item of items) {
            if (item.types.some((t) => t.startsWith("image/"))) {
              triggerScreenshotViolation("Tangkapan layar terdeteksi pada clipboard sistem");
              navigator.clipboard.writeText("").catch(() => {});
              break;
            }
          }
        } catch {
          // Izin clipboard mungkin diblokir browser, abaikan
        }
      }
    };

    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      sendProctoringEvent("copy_attempt");
    };

    const handlePaste = (e: ClipboardEvent) => {
      e.preventDefault();
      const items = e.clipboardData?.items;
      let hasImage = false;
      if (items) {
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.startsWith("image/")) {
            hasImage = true;
            break;
          }
        }
      }
      if (hasImage) {
        triggerScreenshotViolation("Percobaan menempelkan (paste) gambar screenshot");
      } else {
        sendProctoringEvent("paste_attempt");
      }
    };

    const isPrintScreenKey = (e: KeyboardEvent) => {
      const k = (e.key || "").toLowerCase();
      const c = (e.code || "").toLowerCase();
      const w = e.which || e.keyCode || 0;
      return (
        k === "printscreen" ||
        k === "snapshot" ||
        k === "print" ||
        c === "printscreen" ||
        c === "snapshot" ||
        w === 44 ||
        w === 42
      );
    };

    const checkScreenshotKeys = (e: KeyboardEvent, phase: "keydown" | "keyup"): boolean => {
      // 1. Tombol PrintScreen / Snapshot (Linux, Windows, Web standards)
      if (isPrintScreenKey(e)) {
        e.preventDefault();
        e.stopPropagation();
        triggerScreenshotViolation(`Tombol PrintScreen (${phase})`, { key: e.key, code: e.code, which: e.which });
        return true;
      }

      // 2. Windows Snipping Tool: Win/Ctrl/Alt + Shift + S
      if (
        (e.metaKey || e.ctrlKey || e.altKey) &&
        e.shiftKey &&
        ((e.key || "").toLowerCase() === "s" || e.code === "KeyS")
      ) {
        e.preventDefault();
        e.stopPropagation();
        triggerScreenshotViolation(`Windows Snipping Tool (Win/Ctrl+Shift+S) (${phase})`, { key: e.key, code: e.code });
        return true;
      }

      // 3. macOS Screenshot: Cmd + Shift + 3/4/5/6
      const isMacNum = ["3", "4", "5", "6"].includes(e.key);
      const isMacDigitCode = ["digit3", "digit4", "digit5", "digit6", "numpad3", "numpad4", "numpad5", "numpad6"].includes(
        (e.code || "").toLowerCase()
      );
      if (e.metaKey && e.shiftKey && (isMacNum || isMacDigitCode)) {
        e.preventDefault();
        e.stopPropagation();
        triggerScreenshotViolation(`macOS Screenshot (Cmd+Shift+${e.key || e.code}) (${phase})`, { key: e.key, code: e.code });
        return true;
      }

      // 4. Print dialog / Save PDF attempt: Ctrl/Cmd + P
      if ((e.ctrlKey || e.metaKey) && ((e.key || "").toLowerCase() === "p" || e.code === "KeyP")) {
        e.preventDefault();
        e.stopPropagation();
        triggerScreenshotViolation(`Print / Save PDF (Ctrl/Cmd+P) (${phase})`, { key: e.key, code: e.code });
        return true;
      }

      // 5. Windows Game Bar / Capture: Win + G
      if ((e.metaKey || e.ctrlKey) && ((e.key || "").toLowerCase() === "g" || e.code === "KeyG")) {
        e.preventDefault();
        e.stopPropagation();
        triggerScreenshotViolation(`Screen Recorder / Game Bar (Win+G) (${phase})`, { key: e.key, code: e.code });
        return true;
      }

      return false;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (checkScreenshotKeys(e, "keydown")) return;

      const isF12 = e.key === "F12" || e.code === "F12" || e.keyCode === 123;
      const isDevTools =
        (e.ctrlKey || e.metaKey) && e.shiftKey && ["I", "i", "J", "j", "C", "c"].includes(e.key);
      const isViewSource = (e.ctrlKey || e.metaKey) && ["U", "u"].includes(e.key);

      if (isF12 || isDevTools || isViewSource) {
        e.preventDefault();
        e.stopPropagation();
        sendProctoringEvent("devtools", { key: e.key, code: e.code });
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      checkScreenshotKeys(e, "keyup");
    };

    const handleBeforePrint = (e: Event) => {
      e.preventDefault();
      triggerScreenshotViolation("window.beforeprint event");
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      sendProctoringEvent("right_click");
    };

    const handleSelectStart = (e: Event) => {
      // Izinkan seleksi teks hanya jika target berupa textarea atau input (mis. soal isian/jawaban singkat)
      const target = e.target as HTMLElement | null;
      if (target) {
        const tagName = target.tagName?.toLowerCase();
        if (tagName === "textarea" || tagName === "input" || target.isContentEditable) {
          return;
        }
      }
      e.preventDefault();
    };

    const captureOptions = { capture: true, passive: false };

    window.addEventListener("focus", handleFocus);
    window.addEventListener("blur", handleBlur);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.addEventListener("copy", handleCopy, captureOptions);
    document.addEventListener("paste", handlePaste, captureOptions);
    document.addEventListener("selectstart", handleSelectStart, captureOptions);
    window.addEventListener("keydown", handleKeyDown, captureOptions);
    document.addEventListener("keydown", handleKeyDown, captureOptions);
    window.addEventListener("keyup", handleKeyUp, captureOptions);
    document.addEventListener("keyup", handleKeyUp, captureOptions);
    window.addEventListener("beforeprint", handleBeforePrint);
    document.addEventListener("contextmenu", handleContextMenu, captureOptions);

    return () => {
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.removeEventListener("copy", handleCopy, captureOptions);
      document.removeEventListener("paste", handlePaste, captureOptions);
      document.removeEventListener("selectstart", handleSelectStart, captureOptions);
      window.removeEventListener("keydown", handleKeyDown, captureOptions);
      document.removeEventListener("keydown", handleKeyDown, captureOptions);
      window.removeEventListener("keyup", handleKeyUp, captureOptions);
      document.removeEventListener("keyup", handleKeyUp, captureOptions);
      window.removeEventListener("beforeprint", handleBeforePrint);
      document.removeEventListener("contextmenu", handleContextMenu, captureOptions);
    };
  }, [submitted]);

  // Handle single choice answer (with debounce auto-save)
  const handleSingleAnswer = (qId: string, optId: string) => {
    setAnswers((a) => ({ ...a, [qId]: optId }));
    setAutoSaveStatus("saving");

    if (saveTimeoutRef.current[qId]) {
      clearTimeout(saveTimeoutRef.current[qId]);
    }

    saveTimeoutRef.current[qId] = setTimeout(async () => {
      try {
        const res = await saveStudentAnswer(qId, optId.toUpperCase());
        if (res.success) {
          setAutoSaveStatus("saved");
        } else {
          setAutoSaveStatus("failed");
        }
      } catch {
        setAutoSaveStatus("failed");
      }
    }, 600);
  };

  const handleShortAnswerChange = (qId: string, text: string) => {
    setAnswers((a) => ({ ...a, [qId]: text }));
    setAutoSaveStatus("saving");
    if (saveTimeoutRef.current[qId]) clearTimeout(saveTimeoutRef.current[qId]);
    saveTimeoutRef.current[qId] = setTimeout(async () => {
      try {
        const res = await saveStudentAnswer(qId, text.trim() || null);
        setAutoSaveStatus(res.success ? "saved" : "failed");
      } catch {
        setAutoSaveStatus("failed");
      }
    }, 600);
  };

  const handleMultiToggle = (qId: string, optId: string) => {
    setMultiAnswers((prev) => {
      const current = new Set(prev[qId] ?? []);
      if (current.has(optId)) current.delete(optId);
      else current.add(optId);
      const next = { ...prev, [qId]: current };

      const selectedArr = Array.from(next[qId]).map(s => s.toUpperCase()).sort().join(",");
      setAutoSaveStatus("saving");
      if (saveTimeoutRef.current[qId]) clearTimeout(saveTimeoutRef.current[qId]);
      saveTimeoutRef.current[qId] = setTimeout(async () => {
        try {
          const res = await saveStudentAnswer(qId, selectedArr);
          setAutoSaveStatus(res.success ? "saved" : "failed");
        } catch {
          setAutoSaveStatus("failed");
        }
      }, 600);

      return next;
    });
  };

  const handleClearAnswer = (qId: string) => {
    if (question.type === "multi_select") {
      setMultiAnswers((prev) => ({ ...prev, [qId]: new Set() }));
    } else {
      setAnswers((a) => {
        const next = { ...a };
        delete next[qId];
        return next;
      });
    }
    setAutoSaveStatus("saving");
    if (saveTimeoutRef.current[qId]) clearTimeout(saveTimeoutRef.current[qId]);
    saveTimeoutRef.current[qId] = setTimeout(async () => {
      try {
        const res = await saveStudentAnswer(qId, "");
        setAutoSaveStatus(res.success ? "saved" : "failed");
      } catch {
        setAutoSaveStatus("failed");
      }
    }, 300);
  };

  const handleOpenSubmit = () => {
    const unanswered = totalQ - answeredCount;
    if (unanswered > 0) {
      setSubmitStep(1);
    } else {
      setSubmitStep(2);
    }
  };

  const handleSubmit = async () => {
    setSubmitted(true);
    setSubmitStep(0);
    let subFlags = { showScoreToStudent: true, allowAnswerReview: false };
    try {
      const res = await submitStudentExam();
      if (res && res.data) {
        subFlags = {
          showScoreToStudent: res.data.showScoreToStudent !== false,
          allowAnswerReview: res.data.allowAnswerReview === true,
        };
      }
    } catch {
      // Continue to done
    }
    try {
      if (typeof window !== "undefined") {
        const summaryPayload = JSON.stringify({
          name: studentProfile?.name || "Peserta Ujian",
          nisn: studentProfile?.nisn || "0000000000",
          exam: examMeta?.title || "Ujian Selesai",
          answered: answeredCount,
          total: totalQ,
          showScoreToStudent: subFlags.showScoreToStudent,
          allowAnswerReview: subFlags.allowAnswerReview,
        });
        sessionStorage.setItem("eduquas_submission_summary", summaryPayload);
      }
    } catch {}
    sessionStorage.setItem("exam_just_submitted", "true");
    sessionStorage.setItem("exam_submitted_title", examMeta?.title || "Ujian");
    clearSessionHint();
    window.location.href = "/exam/done";
  };

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  const isNearEnd = timeLeft < 5 * 60;
  const isVeryNearEnd = timeLeft < 60;
  const timerBg     = isVeryNearEnd ? "#FFE0E0" : isNearEnd ? "#FEF3C7" : "#E0F4FD";
  const timerBorder = isVeryNearEnd ? "#FFC5C5" : isNearEnd ? "#FCD34D" : "#C8E6F5";
  const timerColor  = isVeryNearEnd ? "#DC2626" : isNearEnd ? "#B45309" : "#29ABE2";

  const toggleFlag = (idx: number) => {
    setFlagged(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  // ===================== LOCKED =====================
  if (isLocked) {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.92)", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", textAlign: "center", padding: "24px", color: "white" }}>
        <div style={{ fontSize: "72px", marginBottom: "20px" }}>{screenshotLockReason ? "📸" : "🔒"}</div>
        <h1 style={{ fontSize: isMobile ? "22px" : "26px", fontWeight: 700, marginBottom: "10px", fontFamily: "Poppins, sans-serif" }}>Ujianmu Sementara Dikunci</h1>
        <p style={{ color: "rgba(255,255,255,0.75)", maxWidth: "420px", lineHeight: 1.7, fontSize: "14px" }}>
          {screenshotLockReason ?? "Pengawas sedang meninjau aktivitasmu. Tunggu hingga pengawas membuka kunci."}
        </p>

        {/* Tombol unblock instan — periksa status tanpa delay */}
        <button
          onClick={async () => {
            setIsCheckingUnlock(true);
            try {
              const res = await sendStudentHeartbeat();
              if (res.success && res.data) {
                if (!res.data.isLocked) {
                  setIsLocked(false);
                  setScreenshotLockReason(null);
                }
              }
            } catch {}
            finally {
              setIsCheckingUnlock(false);
            }
          }}
          disabled={isCheckingUnlock}
          style={{
            marginTop: "20px",
            padding: "12px 28px",
            background: isCheckingUnlock ? "#64748B" : "#1B76BF",
            color: "white",
            border: "none",
            borderRadius: "8px",
            fontWeight: 700,
            fontSize: "14px",
            cursor: isCheckingUnlock ? "not-allowed" : "pointer",
            boxShadow: "0 4px 16px rgba(27, 118, 191, 0.4)",
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            transition: "all 0.15s ease",
          }}
        >
          <span>{isCheckingUnlock ? "🔄" : "⚡"}</span>
          <span>{isCheckingUnlock ? "Memeriksa Status..." : "Periksa Pembukaan Kunci"}</span>
        </button>

        <div style={{ marginTop: "16px", display: "inline-flex", alignItems: "center", gap: "8px", padding: "6px 14px", borderRadius: "100px", background: "rgba(22,163,74,0.15)", color: "#4ade80", fontSize: "12px" }}>
          <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#4ade80", display: "inline-block" }} />
          Pengecekan otomatis aktif (tiap 1.5 detik)
        </div>
      </div>
    );
  }

  // ===================== TIME EXPIRED =====================
  if (timeExpiredOverlay) {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(220,38,38,0.95)", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", textAlign: "center", padding: "24px", color: "white" }}>
        <div style={{ fontSize: "64px", marginBottom: "20px" }}>⏰</div>
        <h1 style={{ fontSize: "28px", fontWeight: 700, marginBottom: "10px", fontFamily: "Poppins, sans-serif" }}>Waktu Habis!</h1>
        <p style={{ color: "rgba(255,255,255,0.85)", lineHeight: 1.7 }}>Semua jawabanmu telah tersimpan dan dikumpulkan otomatis.</p>
      </div>
    );
  }

  // ===================== FULLSCREEN GATE =====================
  if (showFullscreenGate || !isFullscreen) {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9999,
          background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          textAlign: "center",
          padding: "24px",
          color: "white",
        }}
      >
        <div
          style={{
            width: "76px",
            height: "76px",
            borderRadius: "50%",
            background: splitScreenWarning ? "rgba(228, 71, 43, 0.15)" : "rgba(41, 171, 226, 0.15)",
            border: `2px solid ${splitScreenWarning ? "#E4472B" : "#29ABE2"}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "36px",
            marginBottom: "20px",
            boxShadow: `0 0 24px ${splitScreenWarning ? "rgba(228, 71, 43, 0.35)" : "rgba(41, 171, 226, 0.25)"}`,
          }}
        >
          {splitScreenWarning ? "⚠️" : "⛶"}
        </div>
        <h1
          style={{
            fontSize: isMobile ? "22px" : "28px",
            fontWeight: 800,
            marginBottom: "12px",
            fontFamily: "Poppins, sans-serif",
            letterSpacing: "-0.5px",
            color: splitScreenWarning ? "#FFA494" : "white",
          }}
        >
          {splitScreenWarning
            ? "⚠️ Pelanggaran: Mode Split-Screen Terdeteksi!"
            : hasEnteredFullscreenBefore
            ? "⚠️ Mode Layar Penuh Terputus!"
            : "Mode Layar Penuh Diperlukan"}
        </h1>
        <div
          style={{
            color: "rgba(255, 255, 255, 0.82)",
            maxWidth: "500px",
            lineHeight: 1.7,
            fontSize: "14px",
            marginBottom: "28px",
          }}
        >
          {splitScreenWarning ? (
            <div style={{ background: "rgba(228, 71, 43, 0.18)", border: "1px solid rgba(228, 71, 43, 0.6)", padding: "14px 18px", borderRadius: "10px", textAlign: "left", color: "white" }}>
              <p style={{ margin: "0 0 8px 0", fontWeight: 700, color: "#FFA494" }}>{splitScreenWarning}</p>
              <p style={{ margin: 0, fontSize: "13px", color: "rgba(255,255,255,0.85)" }}>
                Anda dilarang menggunakan mode layar terbagi (split-screen / snap). Tutup aplikasi lain atau kembalikan jendela browser ke ukuran penuh 100%, lalu klik tombol di bawah untuk verifikasi ulang.
              </p>
            </div>
          ) : hasEnteredFullscreenBefore ? (
            "Kamu telah keluar dari mode layar penuh. Keluar dari layar penuh tercatat sebagai pelanggaran proctoring. Klik tombol di bawah untuk kembali ke mode layar penuh dan melanjutkan pengerjaan soal."
          ) : (
            "Untuk menjaga integritas dan ketertiban ujian, seluruh pengerjaan soal wajib dilakukan dalam mode layar penuh (fullscreen). Klik tombol di bawah untuk memulai."
          )}
        </div>
        <button
          onClick={enterFullscreen}
          style={{
            padding: "14px 32px",
            background: splitScreenWarning ? "#E4472B" : "#29ABE2",
            color: "white",
            border: "none",
            borderRadius: "8px",
            fontWeight: 700,
            fontSize: "15px",
            cursor: "pointer",
            boxShadow: `0 4px 18px ${splitScreenWarning ? "rgba(228, 71, 43, 0.45)" : "rgba(41, 171, 226, 0.45)"}`,
            display: "flex",
            alignItems: "center",
            gap: "10px",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = splitScreenWarning ? "#C53018" : "#1D8AB8")}
          onMouseLeave={(e) => (e.currentTarget.style.background = splitScreenWarning ? "#E4472B" : "#29ABE2")}
        >
          <span style={{ fontSize: "18px" }}>⛶</span>
          <span>
            {splitScreenWarning
              ? "Verifikasi & Masuk Layar Penuh"
              : hasEnteredFullscreenBefore
              ? "Kembali ke Layar Penuh"
              : "Masuk Layar Penuh & Mulai Ujian"}
          </span>
        </button>
        <div
          style={{
            marginTop: "24px",
            fontSize: "12px",
            color: "rgba(255, 255, 255, 0.5)",
          }}
        >
          Sistem LockIt Proctoring • Seluruh aktivitas diawasi secara otomatis
        </div>
      </div>
    );
  }

  const SIDEBAR_ICONS: { icon: React.ReactNode; label: string; panel: SidePanel }[] = [
    {
      panel: "soal",
      label: "Soal",
      icon: (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>),
    },
    {
      panel: "statistik",
      label: "Statistik",
      icon: (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>),
    },
    {
      panel: "jadwal",
      label: "Jadwal",
      icon: (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>),
    },
    {
      panel: "history",
      label: "History",
      icon: (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>),
    },
  ];

  const warningH = warningBanner ? (isMobile ? 60 : 44) : 0;

  const hasImage = !!(question as { image?: string | null }).image;
  const typeBadge: Record<string, { label: string; bg: string; color: string }> = {
    single_choice: { label: hasImage ? "Pilihan Ganda + Gambar" : "Pilihan Ganda", bg: hasImage ? "#E8F5E9" : "#E0F4FD", color: hasImage ? "#2E7D32" : "#0284C7" },
    multi_select:  { label: "Pilihan Ganda — Boleh lebih dari satu jawaban", bg: "#FEF3C7", color: "#92400E" },
    latex:         { label: hasImage ? "Matematika + Gambar" : "Soal Matematika", bg: hasImage ? "#F3E5F5" : "#EDE9FE", color: hasImage ? "#6A1B9A" : "#6D28D9" },
    short_answer:  { label: "Jawaban Singkat (Esai)", bg: "#CCFBF1", color: "#0F766E" },
  };

  const badge = typeBadge[question.type] ?? typeBadge.single_choice;
  const isMulti = question.type === "multi_select";
  const isLatexQ = question.type === "latex" || hasLatex(question.text);
  const selectedMulti = multiAnswers[question.id] ?? new Set<string>();

  return (
    <div style={{
      minHeight: "100vh",
      background: "#EDF6FC",
      display: "flex",
      flexDirection: "column",
      fontFamily: "Poppins, sans-serif",
      userSelect: "none",
      WebkitUserSelect: "none",
      WebkitTouchCallout: "none",
    }}>

      {/* Warning Banner */}
      {warningBanner && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 1000, background: "linear-gradient(90deg, #D97706, #b45309)", color: "white", padding: isMobile ? "8px 12px" : "10px 20px", display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "16px" }}>⚠️</span>
          <div style={{ flex: 1, fontSize: "13px" }}><strong>Peringatan dari Pengawas:</strong> {warningBanner}</div>
          <button style={{ background: "rgba(0,0,0,0.2)", border: "none", color: "white", padding: "3px 10px", borderRadius: "6px", cursor: "pointer", fontSize: "12px" }} onClick={() => setWarningBanner(null)}>Tutup</button>
        </div>
      )}

      <div style={{ display: "flex", flex: 1 }}>

        {/* ===== LEFT ICON SIDEBAR — Desktop only ===== */}
        {!isMobile && (
          <aside style={{
            width: "56px", background: "white", borderRight: "1.5px solid #E2EEF5",
            display: "flex", flexDirection: "column", alignItems: "center",
            paddingTop: "16px", paddingBottom: "16px", gap: "4px",
            position: "fixed", left: 0, top: warningBanner ? `${warningH}px` : 0, bottom: 0, zIndex: 50
          }}>
            <div style={{ width: "36px", height: "36px", background: "linear-gradient(135deg, #0284C7, #29ABE2)", borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", marginBottom: "18px", boxShadow: "0 2px 8px rgba(41,171,226,0.28)" }}>🔒</div>
            {SIDEBAR_ICONS.map((item) => {
              const isActive = activePanel === item.panel;
              return (
                <div key={item.panel} style={{ position: "relative", width: "100%" }}>
                  {isActive && (<div style={{ position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)", width: "3px", height: "28px", background: "#29ABE2", borderRadius: "0 3px 3px 0" }} />)}
                  <button
                    title={item.label}
                    onClick={() => togglePanel(item.panel)}
                    style={{ width: "100%", height: "44px", border: "none", background: isActive ? "rgba(41,171,226,0.10)" : "transparent", color: isActive ? "#29ABE2" : "#B0C9D8", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}
                  >{item.icon}</button>
                </div>
              );
            })}
            <div style={{ flex: 1 }} />
            {/* Settings icon */}
            <button
              title="Settings"
              onClick={() => togglePanel("settings")}
              style={{ width: "40px", height: "40px", border: "none", background: activePanel === "settings" ? "rgba(41,171,226,0.10)" : "transparent", borderRadius: "6px", color: activePanel === "settings" ? "#29ABE2" : "#B0C9D8", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
            </button>
            {/* Help icon */}
            <button
              title="Bantuan"
              onClick={() => togglePanel("help")}
              style={{ width: "40px", height: "40px", border: "none", background: activePanel === "help" ? "rgba(41,171,226,0.10)" : "transparent", borderRadius: "6px", color: activePanel === "help" ? "#29ABE2" : "#B0C9D8", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
            </button>
          </aside>
        )}

        {/* ===== SLIDING PANEL DRAWERS ===== */}
        {!isMobile && (
          <>
            {/* Panel: Navigasi Soal */}
            <SidePanelDrawer
              open={activePanel === "soal"}
              title="Navigasi Soal"
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>}
              onClose={() => setActivePanel(null)}
              warningH={warningH}
            >
              <div style={{ marginBottom: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "12px", fontWeight: 700, color: "#1C303D" }}>Navigasi Soal</span>
                <span style={{ fontSize: "12px", color: "#98B4C4" }}>
                  <span style={{ fontWeight: 700, color: "#29ABE2" }}>{answeredCount}</span>/{totalQ} dijawab
                </span>
              </div>
              <QNumberGrid
                questions={questionsList}
                currentQ={currentQ}
                answers={answers}
                multiAnswers={multiAnswers}
                flagged={flagged}
                onSelect={(idx) => { setCurrentQ(idx); setActivePanel(null); }}
                isQuestionAnswered={isQuestionAnswered}
              />
              <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "5px" }}>
                {[{color:"#29ABE2",label:"Pilihan Ganda"},{color:"#D97706",label:"Multi Pilih"},{color:"#7C3AED",label:"Matematika"}].map(({color,label}) => (
                  <div key={label} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <div style={{ width: "10px", height: "10px", borderRadius: "3px", background: color, flexShrink: 0 }} />
                    <span style={{ fontSize: "11px", color: "#6E8EA0" }}>{label}</span>
                  </div>
                ))}
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <div style={{ width: "10px", height: "10px", borderRadius: "3px", background: "#F59E0B", flexShrink: 0 }} />
                  <span style={{ fontSize: "11px", color: "#6E8EA0" }}>Ditandai</span>
                </div>
              </div>
              <button
                onClick={() => toggleFlag(currentQ)}
                style={{ marginTop: "14px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "10px 16px", borderRadius: "6px", border: "1.5px solid " + (flagged.has(currentQ) ? "#F59E0B" : "#D9E9F2"), background: flagged.has(currentQ) ? "#FEF3C7" : "#F0F9FF", color: flagged.has(currentQ) ? "#92400E" : "#29ABE2", cursor: "pointer", fontWeight: 500, fontSize: "13px", transition: "all 0.15s", fontFamily: "Poppins, sans-serif", width: "100%" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill={flagged.has(currentQ) ? "#F59E0B" : "none"} stroke={flagged.has(currentQ) ? "#F59E0B" : "#29ABE2"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" y1="22" x2="4" y2="15" />
                </svg>
                {flagged.has(currentQ) ? "Batal Tandai" : "Tandai Soal Ini"}
              </button>
            </SidePanelDrawer>

            {/* Panel: Statistik */}
            <SidePanelDrawer
              open={activePanel === "statistik"}
              title="Statistik Pengerjaan"
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>}
              onClose={() => setActivePanel(null)}
              warningH={warningH}
            >
              {/* Progress overview */}
              {(() => {
                const pct = Math.round((answeredCount / totalQ) * 100);
                const unanswered = totalQ - answeredCount;
                const flaggedCount = flagged.size;
                const byType = {
                  single: questionsList.filter(q => q.type === "single_choice"),
                  multi:  questionsList.filter(q => q.type === "multi_select"),
                  latex:  questionsList.filter(q => q.type === "latex"),
                  short:  questionsList.filter(q => q.type === "short_answer"),
                };
                const answeredByType = {
                  single: byType.single.filter(q => isQuestionAnswered(q)).length,
                  multi:  byType.multi.filter(q => isQuestionAnswered(q)).length,
                  latex:  byType.latex.filter(q => isQuestionAnswered(q)).length,
                  short:  byType.short.filter(q => isQuestionAnswered(q)).length,
                };
                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    {/* Big progress ring */}
                    <div style={{ textAlign: "center", padding: "16px 0 8px" }}>
                      <div style={{ position: "relative", display: "inline-block" }}>
                        <svg width="100" height="100" viewBox="0 0 100 100">
                          <circle cx="50" cy="50" r="40" fill="none" stroke="#EDF6FC" strokeWidth="10" />
                          <circle
                            cx="50" cy="50" r="40" fill="none" stroke="#29ABE2" strokeWidth="10"
                            strokeDasharray={`${(pct / 100) * 251.2} 251.2`}
                            strokeLinecap="round"
                            transform="rotate(-90 50 50)"
                            style={{ transition: "stroke-dasharray 0.5s ease" }}
                          />
                        </svg>
                        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                          <span style={{ fontSize: "22px", fontWeight: 800, color: "#1C303D" }}>{pct}%</span>
                          <span style={{ fontSize: "10px", color: "#98B4C4", fontWeight: 500 }}>Selesai</span>
                        </div>
                      </div>
                    </div>

                    {/* Stats grid */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                      {[
                        { label: "Dijawab", value: answeredCount, bg: "#E0F4FD", color: "#0284C7" },
                        { label: "Belum", value: unanswered, bg: "#FEF3C7", color: "#92400E" },
                        { label: "Ditandai", value: flaggedCount, bg: "#FFFBEB", color: "#D97706" },
                        { label: "Total Soal", value: totalQ, bg: "#F1F5F9", color: "#475569" },
                      ].map(s => (
                        <div key={s.label} style={{ background: s.bg, borderRadius: "6px", padding: "12px", textAlign: "center" }}>
                          <div style={{ fontSize: "22px", fontWeight: 800, color: s.color }}>{s.value}</div>
                          <div style={{ fontSize: "11px", color: s.color, fontWeight: 500, marginTop: "2px" }}>{s.label}</div>
                        </div>
                      ))}
                    </div>

                    {/* Per-type breakdown */}
                    <div style={{ background: "#F8FDFF", borderRadius: "6px", padding: "12px", border: "1.5px solid #EDF6FC" }}>
                      <div style={{ fontSize: "11px", fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "10px" }}>Per Tipe Soal</div>
                      {[
                        { label: "Pilihan Ganda", answered: answeredByType.single, total: byType.single.length, color: "#29ABE2" },
                        { label: "Multi Pilih",   answered: answeredByType.multi,  total: byType.multi.length,  color: "#D97706" },
                        { label: "Matematika",    answered: answeredByType.latex,  total: byType.latex.length,  color: "#7C3AED" },
                        { label: "Jawaban Singkat", answered: answeredByType.short, total: byType.short.length, color: "#0D9488" },
                      ].map(t => t.total > 0 && (
                        <div key={t.label} style={{ marginBottom: "10px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                            <span style={{ fontSize: "12px", color: "#475569", fontWeight: 500 }}>{t.label}</span>
                            <span style={{ fontSize: "12px", fontWeight: 700, color: t.color }}>{t.answered}/{t.total}</span>
                          </div>
                          <div style={{ height: "6px", borderRadius: "999px", background: "#E2E8F0" }}>
                            <div style={{ height: "100%", borderRadius: "999px", background: t.color, width: `${t.total > 0 ? (t.answered / t.total) * 100 : 0}%`, transition: "width 0.4s ease" }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </SidePanelDrawer>

            {/* Panel: Jadwal */}
            <SidePanelDrawer
              open={activePanel === "jadwal"}
              title="Jadwal Ujian"
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>}
              onClose={() => setActivePanel(null)}
              warningH={warningH}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {/* Exam identity card */}
                <div style={{ background: "linear-gradient(135deg, #0369A1, #29ABE2)", borderRadius: "6px", padding: "18px", color: "white" }}>
                  <div style={{ fontSize: "11px", fontWeight: 600, opacity: 0.75, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "6px" }}>Ujian Aktif</div>
                  <div style={{ fontSize: "15px", fontWeight: 700, lineHeight: 1.4, marginBottom: "8px" }}>{examMeta.title}</div>
                  <div style={{ fontSize: "12px", opacity: 0.8 }}>Kode: <strong>{examMeta.code || "-"}</strong></div>
                </div>

                {/* Info rows */}
                {[
                  { icon: "👨‍🏫", label: "Pengawas",       value: examMeta.teacher || "Pengawas Ujian" },
                  { icon: "🏫", label: "Kelas",           value: examMeta.class || "Peserta Ujian" },
                  { icon: "📅", label: "Tanggal",         value: currentDateStr || "Hari ini" },
                  { icon: "⏱️", label: "Durasi",          value: `${Math.round((examMeta.duration || 5400) / 60)} menit` },
                  { icon: "📝", label: "Jumlah Soal",     value: `${totalQ} soal` },
                ].map(r => (
                  <div key={r.label} style={{ display: "flex", alignItems: "flex-start", gap: "12px", padding: "10px 12px", background: "#F8FDFF", borderRadius: "6px", border: "1px solid #EDF6FC" }}>
                    <span style={{ fontSize: "18px", lineHeight: 1, flexShrink: 0, marginTop: "1px" }}>{r.icon}</span>
                    <div>
                      <div style={{ fontSize: "10px", fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em" }}>{r.label}</div>
                      <div style={{ fontSize: "13px", fontWeight: 600, color: "#1C303D", marginTop: "2px" }}>{r.value}</div>
                    </div>
                  </div>
                ))}

                {/* Timer reminder */}
                <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px", background: timerBg, borderRadius: "6px", border: `1px solid ${timerBorder}` }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={timerColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  <div>
                    <div style={{ fontSize: "10px", fontWeight: 700, color: timerColor, textTransform: "uppercase", letterSpacing: "0.05em" }}>Waktu Tersisa</div>
                    <div style={{ fontSize: "18px", fontWeight: 800, color: timerColor, fontFamily: "monospace" }}>{formatTime(timeLeft)}</div>
                  </div>
                </div>
              </div>
            </SidePanelDrawer>

            {/* Panel: History */}
            <SidePanelDrawer
              open={activePanel === "history"}
              title="Log Aktivitas"
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
              onClose={() => setActivePanel(null)}
              warningH={warningH}
            >
              <div style={{ fontSize: "11px", color: "#94A3B8", marginBottom: "12px" }}>Catatan aktivitas selama sesi ujian berlangsung.</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {/* Dynamic: answered questions */}
                {questionsList.map((q, idx) => {
                  const answered = isQuestionAnswered(q);
                  const isFlagged = flagged.has(idx);
                  if (!answered && !isFlagged) return null;
                  return (
                    <div key={q.id} style={{ display: "flex", gap: "10px", padding: "10px 12px", background: "#F8FDFF", borderRadius: "6px", border: "1px solid #EDF6FC" }}>
                      <div style={{ width: "6px", flexShrink: 0, borderRadius: "3px", background: isFlagged ? "#F59E0B" : "#29ABE2", alignSelf: "stretch" }} />
                      <div>
                        <div style={{ fontSize: "12px", fontWeight: 600, color: "#1C303D" }}>
                          {isFlagged && !answered ? "Ditandai" : "Jawab"} Soal {idx + 1}
                        </div>
                        <div style={{ fontSize: "11px", color: "#6E8EA0", marginTop: "2px" }}>
                          {answered
                            ? q.type === "multi_select"
                              ? `${multiAnswers[q.id]?.size ?? 0} pilihan dipilih`
                              : `Pilihan ${(answers[q.id] ?? "").toUpperCase()} dipilih`
                            : "Belum dijawab"}
                          {isFlagged && <span style={{ marginLeft: "6px", color: "#F59E0B" }}>🚩</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {/* Initial log entries */}
                {activityLog.current.map((log, i) => (
                  <div key={i} style={{ display: "flex", gap: "10px", padding: "10px 12px", background: "#F1F5F9", borderRadius: "6px", border: "1px solid #E2E8F0" }}>
                    <div style={{ width: "6px", flexShrink: 0, borderRadius: "3px", background: "#94A3B8", alignSelf: "stretch" }} />
                    <div>
                      <div style={{ fontSize: "11px", fontWeight: 600, color: "#64748B" }}>{log.action}</div>
                      <div style={{ fontSize: "10px", color: "#94A3B8", marginTop: "1px" }}>{log.detail}</div>
                    </div>
                  </div>
                ))}
                {questionsList.every((q, idx) => !isQuestionAnswered(q) && !flagged.has(idx)) && activityLog.current.length === 0 && (
                  <div style={{ textAlign: "center", color: "#CBD5E1", fontSize: "13px", padding: "24px 0" }}>Belum ada aktivitas tercatat.</div>
                )}
              </div>
            </SidePanelDrawer>

            {/* Panel: Settings */}
            <SidePanelDrawer
              open={activePanel === "settings"}
              title="Pengaturan Tampilan"
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>}
              onClose={() => setActivePanel(null)}
              warningH={warningH}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                {/* Font size */}
                <div style={{ background: "#F8FDFF", borderRadius: "6px", padding: "14px", border: "1px solid #EDF6FC" }}>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "#1C303D", marginBottom: "10px" }}>Ukuran Teks Soal</div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    {["Kecil", "Normal", "Besar"].map((s, i) => (
                      <button key={s} style={{ flex: 1, padding: "8px", borderRadius: "6px", border: i === 1 ? "2px solid #29ABE2" : "1.5px solid #E2E8F0", background: i === 1 ? "#E0F4FD" : "white", color: i === 1 ? "#0284C7" : "#64748B", fontSize: i === 0 ? "11px" : i === 2 ? "15px" : "13px", fontWeight: i === 1 ? 700 : 500, cursor: "pointer", transition: "all 0.15s" }}>{s}</button>
                    ))}
                  </div>
                </div>

                {/* Auto-save status */}
                <div style={{ background: "#F8FDFF", borderRadius: "6px", padding: "14px", border: "1px solid #EDF6FC" }}>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "#1C303D", marginBottom: "6px" }}>Status Auto-Save</div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: autoSaveStatus === "saved" ? "#10B981" : autoSaveStatus === "saving" ? "#F59E0B" : "#EF4444", flexShrink: 0 }} />
                    <span style={{ fontSize: "13px", color: autoSaveStatus === "saved" ? "#065F46" : autoSaveStatus === "saving" ? "#78350F" : "#7F1D1D", fontWeight: 500 }}>
                      {autoSaveStatus === "saved" ? "Jawaban tersimpan otomatis" : autoSaveStatus === "saving" ? "Menyimpan..." : "Gagal menyimpan"}
                    </span>
                  </div>
                </div>

                {/* Accessibility note */}
                <div style={{ background: "#FFFBEB", borderRadius: "6px", padding: "14px", border: "1px solid #FDE68A" }}>
                  <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                    <span style={{ fontSize: "16px" }}>💡</span>
                    <div style={{ fontSize: "12px", color: "#78350F", lineHeight: 1.6 }}>
                      Gunakan tombol <kbd style={{ background: "#FEF3C7", border: "1px solid #FCD34D", borderRadius: "4px", padding: "1px 5px", fontSize: "11px", fontWeight: 600 }}>←</kbd> dan <kbd style={{ background: "#FEF3C7", border: "1px solid #FCD34D", borderRadius: "4px", padding: "1px 5px", fontSize: "11px", fontWeight: 600 }}>→</kbd> untuk navigasi antar soal dengan cepat.
                    </div>
                  </div>
                </div>

                {/* Emergency submit */}
                <div style={{ background: "#FFF5F5", borderRadius: "6px", padding: "14px", border: "1px solid #FECACA" }}>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "#7F1D1D", marginBottom: "8px" }}>Zona Berbahaya</div>
                  <button
                    onClick={() => { setActivePanel(null); handleOpenSubmit(); }}
                    style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1.5px solid #FCA5A5", background: "#FEF2F2", color: "#DC2626", fontWeight: 600, fontSize: "13px", cursor: "pointer", transition: "all 0.15s", fontFamily: "Poppins, sans-serif" }}
                  >🚨 Kumpulkan Ujian Sekarang</button>
                </div>
              </div>
            </SidePanelDrawer>

            {/* Panel: Help */}
            <SidePanelDrawer
              open={activePanel === "help"}
              title="Panduan Ujian"
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>}
              onClose={() => setActivePanel(null)}
              warningH={warningH}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {[
                  {
                    emoji: "📋", title: "Cara Menjawab",
                    desc: "Klik salah satu opsi untuk soal pilihan ganda. Untuk soal multi-pilih, centang semua jawaban yang benar."
                  },
                  {
                    emoji: "🚩", title: "Tandai Soal",
                    desc: "Klik tombol 'Tandai' di bawah soal untuk menandai soal yang ingin kamu tinjau kembali nanti."
                  },
                  {
                    emoji: "🔢", title: "Navigasi Cepat",
                    desc: "Klik nomor soal di panel kiri (ikon grid) untuk loncat ke soal tertentu langsung."
                  },
                  {
                    emoji: "💾", title: "Auto-Save",
                    desc: "Jawabanmu disimpan otomatis setiap kali kamu memilih opsi. Kamu tidak perlu menekan tombol simpan."
                  },
                  {
                    emoji: "⏰", title: "Waktu Habis",
                    desc: "Saat waktu habis, ujian akan dikumpulkan otomatis dengan semua jawaban yang telah kamu isi."
                  },
                  {
                    emoji: "🚨", title: "Pelanggaran",
                    desc: "Keluar dari layar penuh atau membuka tab lain akan tercatat sebagai pelanggaran dan dilaporkan ke pengawas."
                  },
                ].map(item => (
                  <div key={item.title} style={{ display: "flex", gap: "12px", padding: "12px", background: "#F8FDFF", borderRadius: "6px", border: "1px solid #EDF6FC" }}>
                    <span style={{ fontSize: "20px", lineHeight: 1, flexShrink: 0, marginTop: "2px" }}>{item.emoji}</span>
                    <div>
                      <div style={{ fontSize: "13px", fontWeight: 700, color: "#1C303D", marginBottom: "4px" }}>{item.title}</div>
                      <div style={{ fontSize: "12px", color: "#64748B", lineHeight: 1.6 }}>{item.desc}</div>
                    </div>
                  </div>
                ))}

                {/* Contact supervisor */}
                <div style={{ padding: "12px", background: "#E0F4FD", borderRadius: "6px", border: "1px solid #BAE6FD", textAlign: "center" }}>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: "#0369A1", marginBottom: "4px" }}>Ada masalah teknis?</div>
                  <div style={{ fontSize: "12px", color: "#0284C7" }}>Angkat tangan dan hubungi pengawas di ruangan.</div>
                </div>
              </div>
            </SidePanelDrawer>
          </>
        )}

        {/* ===== MAIN CONTENT ===== */}
        <main style={{ marginLeft: isMobile ? 0 : "56px", flex: 1, display: "flex", flexDirection: "column", minHeight: "100vh", paddingBottom: isMobile ? "64px" : 0 }}>

          {/* ===== TOP HEADER — only exam title ===== */}
          <header style={{
            background: "white", borderBottom: "1.5px solid #C8E6F5",
            height: isMobile ? "50px" : "52px",
            display: "flex", alignItems: "center",
            justifyContent: isMobile ? "space-between" : "center",
            position: "sticky", top: warningBanner ? `${warningH}px` : 0,
            zIndex: 40, padding: isMobile ? "0 14px" : "0 24px", gap: "10px"
          }}>
            {isMobile && (
              <div style={{ width: "28px", height: "28px", background: "linear-gradient(135deg, #0284C7, #29ABE2)", borderRadius: "7px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", flexShrink: 0 }}>🔒</div>
            )}
            <h1 style={{ fontSize: isMobile ? "13px" : "14px", fontWeight: 600, color: "#1C303D", textAlign: "center", letterSpacing: "-0.01em", flex: isMobile ? 1 : undefined, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {examMeta.title || "Ujian"}
            </h1>
            {/* Mobile: timer in header */}
            {isMobile && (
              <div style={{ background: timerBg, border: `1px solid ${timerBorder}`, borderRadius: "6px", padding: "3px 9px", display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                <span style={{ fontSize: "8px", color: timerColor, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>Sisa</span>
                <span style={{ fontSize: "13px", fontWeight: 700, color: timerColor, fontFamily: "monospace", letterSpacing: "0.04em" }}>{formatTime(timeLeft)}</span>
              </div>
            )}
          </header>

          {/* Mobile: pill navigator bar */}
          {isMobile && (
            <div
              ref={pillNavRef}
              style={{
                background: "white",
                borderBottom: "1.5px solid #E2EEF5",
                padding: "8px 12px",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                overflowX: "auto",
                scrollbarWidth: "none",
                WebkitOverflowScrolling: "touch",
              }}
            >
              {questionsList.map((q, qIdx) => {
                const isCurrent = qIdx === currentQ;
                const isAnswered = isQuestionAnswered(q);
                const isFlagged = flagged.has(qIdx);
                const typeColor = q.type === "short_answer" ? "#0D9488" : q.type === "multi_select" ? "#D97706" : q.type === "latex" ? "#7C3AED" : "#29ABE2";
                return (
                  <button key={qIdx} onClick={() => setCurrentQ(qIdx)} style={{
                    width: "32px", height: "32px", borderRadius: "6px", flexShrink: 0,
                    border: isCurrent ? `2.5px solid ${typeColor}` : isAnswered ? `2px solid ${typeColor}` : "1.5px solid #D9E9F2",
                    background: isCurrent ? typeColor : isAnswered ? (q.type === "short_answer" ? "#CCFBF1" : q.type === "multi_select" ? "#FEF3C7" : q.type === "latex" ? "#EDE9FE" : "#E0F4FD") : "white",
                    color: isCurrent ? "white" : isAnswered ? typeColor : "#6E8EA0",
                    fontWeight: isCurrent ? 700 : 500, fontSize: "11px", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    position: "relative", transition: "all 0.15s",
                  }}>
                    {qIdx + 1}
                    {isFlagged && (<span style={{ position: "absolute", top: "-2px", right: "-2px", width: "7px", height: "7px", borderRadius: "50%", background: "#F59E0B", border: "1.5px solid white" }} />)}
                  </button>
                );
              })}
            </div>
          )}

          {/* ===== BODY: 2/3 left + 1/3 right (desktop) ===== */}
          <div style={{
            flex: 1,
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            padding: isMobile ? "16px 12px 16px 12px" : "28px 32px 28px 24px",
            gap: isMobile ? "12px" : "24px",
            maxWidth: isMobile ? "100%" : "1280px",
            margin: "0 auto",
            width: "100%",
            alignItems: isMobile ? undefined : "flex-start",
            boxSizing: "border-box",
          }}>

            {/* ── LEFT: Question + Options (2/3) ── */}
            {totalQ === 0 ? (
              <div style={{ flex: isMobile ? undefined : "1 1 0", minWidth: 0 }}>
                <SkeletonQuestionCard />
              </div>
            ) : (
              <div style={{
                flex: isMobile ? undefined : "1 1 0",
                minWidth: 0,
                background: "white",
                borderRadius: isMobile ? "16px" : "16px",
                border: "1.5px solid #D9E9F2",
                padding: isMobile ? "20px 16px 24px" : "28px 32px",
                boxShadow: "0 2px 12px rgba(41,171,226,0.06)",
              }}>

              {/* Meta row */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px", flexWrap: "wrap" }}>
                <span style={{ fontSize: "11px", color: "#98B4C4", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Soal {currentQ + 1} dari {totalQ}
                </span>
                <span style={{ fontSize: "11px", fontWeight: 600, padding: "3px 10px", borderRadius: "999px", background: badge.bg, color: badge.color }}>
                  {badge.label}
                </span>
                <span style={{ fontSize: "11px", color: "#98B4C4" }}>
                  {question.points} poin
                </span>
              </div>

              {/* Question text */}
              <div style={{ fontSize: isMobile ? "14px" : "16px", color: "#1C303D", lineHeight: 1.9, marginBottom: "20px", fontWeight: 400 }}>
                {isLatexQ
                  ? <LatexRenderer text={question.text} block />
                  : question.text
                }
              </div>

              {/* Question Image — key=question.id forces remount when question changes */}
              {hasImage && (
                <QuestionImage
                  key={question.id}
                  src={(question as { image: string }).image}
                  alt={(question as { imageAlt?: string }).imageAlt ?? "Gambar soal"}
                  isMobile={isMobile}
                />
              )}

              {/* Multi-select instruction */}
              {isMulti && (
                <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 14px", borderRadius: "6px", background: "#FFFBEB", border: "1px solid #FDE68A", marginBottom: "16px" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  <span style={{ fontSize: "12px", color: "#92400E", fontWeight: 500 }}>
                    Soal ini memiliki lebih dari satu jawaban benar. Centang semua yang benar.
                    {selectedMulti.size > 0 && <strong style={{ color: "#D97706" }}> ({selectedMulti.size} dipilih)</strong>}
                  </span>
                </div>
              )}

              {/* Hint */}
              {question.hint && (
                <div style={{ display: "flex", alignItems: "flex-start", gap: "8px", padding: "10px 14px", borderRadius: "6px", background: "#F5F3FF", border: "1px solid #DDD6FE", marginBottom: "16px" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: "1px" }}><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                  <div style={{ fontSize: "12px", color: "#5B21B6" }}>
                    <strong>Petunjuk: </strong>
                    <LatexRenderer text={question.hint} />
                  </div>
                </div>
              )}

              {/* ── OPTIONS / INPUT (stacked below question) ── */}
              {question.type === "short_answer" ? (
                <div style={{ marginTop: hasImage || question.hint ? "8px" : "4px", display: "flex", flexDirection: "column", gap: "8px" }}>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155" }}>
                    ✍️ Tuliskan Jawaban Singkat Anda:
                  </label>
                  <textarea
                    value={answers[question.id] || ""}
                    onChange={(e) => handleShortAnswerChange(question.id, e.target.value)}
                    placeholder="Ketik jawaban di sini (tersimpan otomatis)..."
                    rows={4}
                    style={{
                      width: "100%", padding: "14px 16px", borderRadius: "8px", border: "1.5px solid #CBD5E1",
                      fontSize: "14px", fontFamily: "Poppins, sans-serif", color: "#1E293B", background: "#FFFFFF",
                      resize: "vertical", outline: "none", boxSizing: "border-box", userSelect: "text", WebkitUserSelect: "text",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                    }}
                  />
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "2px" }}>
                    <span style={{ fontSize: "12px", color: "#64748B" }}>Poin maksimal: {question.points} poin • Dinilai manual oleh pengawas</span>
                    <span style={{ fontSize: "12px", color: "#94A3B8" }}>{(answers[question.id] || "").length} karakter</span>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: hasImage || isMulti || question.hint ? "4px" : "0" }}>
                  {question.options.map((opt: any, optIdx: number) => {
                    const isSelected = isMulti
                      ? selectedMulti.has(opt.id)
                      : answers[question.id] === opt.id;

                    const activeColor = question.type === "multi_select" ? "#D97706"
                      : question.type === "latex" ? "#7C3AED"
                      : "#29ABE2";
                    const activeShadow = question.type === "multi_select"
                      ? "0 4px 14px rgba(217,119,6,0.20)"
                      : question.type === "latex"
                      ? "0 4px 14px rgba(124,58,237,0.20)"
                      : "0 4px 14px rgba(41,171,226,0.22)";

                    const optHasLatex = hasLatex(opt.text);

                    return (
                      <button
                        key={opt.id}
                        onClick={() => isMulti
                          ? handleMultiToggle(question.id, opt.id)
                          : handleSingleAnswer(question.id, opt.id)
                        }
                        style={{
                          display: "flex", alignItems: "center", gap: "12px",
                          padding: isMobile ? "12px 14px" : "13px 18px",
                          borderRadius: "6px",
                          border: isSelected ? `2px solid ${activeColor}` : "1.5px solid #D9E9F2",
                          background: isSelected ? activeColor : "white",
                          color: isSelected ? "white" : "#2F4655",
                          cursor: "pointer", textAlign: "left",
                          transition: "all 0.15s",
                          fontSize: isMobile ? "14px" : "15px",
                          fontWeight: isSelected ? 600 : 400,
                          boxShadow: isSelected ? activeShadow : "0 1px 3px rgba(0,0,0,0.04)",
                          fontFamily: "Poppins, sans-serif", width: "100%",
                        }}
                      >
                        {isMulti ? (
                          <span style={{
                            width: "22px", height: "22px", borderRadius: "6px",
                            border: isSelected ? "2px solid rgba(255,255,255,0.5)" : "1.5px solid #C8E6F5",
                            background: isSelected ? "rgba(255,255,255,0.2)" : "#EBF3F8",
                            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
                          }}>
                            {isSelected && (
                              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </span>
                        ) : (
                          <span style={{
                            width: "32px", height: "32px", borderRadius: "50%",
                            border: isSelected ? "2px solid rgba(255,255,255,0.35)" : "1.5px solid #C8E6F5",
                            background: isSelected ? "rgba(255,255,255,0.18)" : "#EBF3F8",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontWeight: 700, fontSize: "13px",
                            color: isSelected ? "white" : "#6E8EA0", flexShrink: 0
                          }}>
                            {String.fromCharCode(65 + optIdx)}
                          </span>
                        )}
                        <span style={{ flex: 1, color: isSelected ? "white" : "#2F4655" }}>
                          {(optHasLatex || question.type === "latex")
                            ? <LatexRenderer key={`${question.id}-${opt.id}`} text={opt.text} style={{ color: "inherit" }} />
                            : opt.text
                          }
                        </span>
                        {isMulti && isSelected && (
                          <span style={{ fontSize: "11px", background: "rgba(255,255,255,0.2)", padding: "2px 8px", borderRadius: "999px", flexShrink: 0 }}>✓</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Tombol Clear Jawaban — tampil hanya jika ada pilihan */}
              {isQuestionAnswered(question) && (
                <button
                  onClick={() => handleClearAnswer(question.id)}
                  style={{
                    marginTop: "12px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "7px 14px",
                    borderRadius: "6px",
                    border: "1.5px solid #FCA5A5",
                    background: "#FFF5F5",
                    color: "#DC2626",
                    cursor: "pointer",
                    fontWeight: 500,
                    fontSize: "12px",
                    transition: "all 0.15s",
                    fontFamily: "Poppins, sans-serif",
                    alignSelf: "flex-start",
                  }}
                  title="Hapus pilihan jawaban untuk soal ini"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                  Hapus Pilihan
                </button>
              )}
            </div>
            )}

            {/* ── RIGHT PANEL: Timer + Q-Number Grid (1/3, sticky) ── */}
            {!isMobile && (
              <div style={{
                width: "280px", flexShrink: 0,
                position: "sticky",
                top: `${(warningBanner ? warningH : 0) + 52 + 20}px`,
                display: "flex", flexDirection: "column", gap: "16px",
                alignSelf: "flex-start",
              }}>
                {/* Timer card */}
                <div style={{
                  background: timerBg,
                  border: `1.5px solid ${timerBorder}`,
                  borderRadius: "6px",
                  padding: "16px 20px",
                  display: "flex", alignItems: "center", gap: "14px",
                }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={timerColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                  </svg>
                  <div>
                    <div style={{ fontSize: "10px", color: timerColor, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "2px" }}>Waktu Tersisa</div>
                    <div style={{
                      fontSize: "26px", fontWeight: 800, color: timerColor,
                      fontFamily: "monospace", letterSpacing: "0.05em",
                      animation: isVeryNearEnd ? "pulse 1s ease-in-out infinite" : "none",
                    }}>{formatTime(timeLeft)}</div>
                  </div>
                </div>

                {/* Q-number panel */}
                <div style={{
                  background: "white", borderRadius: "6px",
                  border: "1.5px solid #D9E9F2",
                  padding: "18px 16px",
                  boxShadow: "0 2px 12px rgba(41,171,226,0.06)",
                }}>
                  {/* Panel header */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                    <span style={{ fontSize: "12px", fontWeight: 700, color: "#1C303D", letterSpacing: "0.02em" }}>Navigasi Soal</span>
                    <span style={{ fontSize: "12px", color: "#98B4C4" }}>
                      <span style={{ fontWeight: 700, color: "#29ABE2" }}>{answeredCount}</span>/{totalQ}
                    </span>
                  </div>

                  {/* Grid */}
                  {totalQ === 0 ? (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "8px" }}>
                      {Array.from({ length: 15 }).map((_, idx) => (
                        <SkeletonBase key={idx} width="100%" height="36px" borderRadius="6px" />
                      ))}
                    </div>
                  ) : (
                    <QNumberGrid
                      questions={questionsList}
                      currentQ={currentQ}
                      answers={answers}
                      multiAnswers={multiAnswers}
                      flagged={flagged}
                      onSelect={setCurrentQ}
                      isQuestionAnswered={isQuestionAnswered}
                    />
                  )}

                  {/* Legend */}
                  <div style={{ marginTop: "14px", display: "flex", flexDirection: "column", gap: "5px" }}>
                    {[
                      { color: "#29ABE2", label: "Pilihan Ganda" },
                      { color: "#D97706", label: "Multi Pilih" },
                      { color: "#7C3AED", label: "Matematika" },
                      { color: "#0D9488", label: "Jawaban Singkat" },
                    ].map(({ color, label }) => (
                      <div key={label} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <div style={{ width: "10px", height: "10px", borderRadius: "3px", background: color, flexShrink: 0 }} />
                        <span style={{ fontSize: "11px", color: "#6E8EA0" }}>{label}</span>
                      </div>
                    ))}
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <div style={{ width: "10px", height: "10px", borderRadius: "3px", background: "#F59E0B", flexShrink: 0 }} />
                      <span style={{ fontSize: "11px", color: "#6E8EA0" }}>Ditandai</span>
                    </div>
                  </div>
                </div>

                {/* Action buttons */}
                <button
                  onClick={() => toggleFlag(currentQ)}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                    padding: "10px 16px", borderRadius: "6px",
                    border: "1.5px solid " + (flagged.has(currentQ) ? "#F59E0B" : "#D9E9F2"),
                    background: flagged.has(currentQ) ? "#FEF3C7" : "#F0F9FF",
                    color: flagged.has(currentQ) ? "#92400E" : "#29ABE2",
                    cursor: "pointer", fontWeight: 500, fontSize: "13px",
                    transition: "all 0.15s", fontFamily: "Poppins, sans-serif", width: "100%",
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill={flagged.has(currentQ) ? "#F59E0B" : "none"} stroke={flagged.has(currentQ) ? "#F59E0B" : "#29ABE2"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" y1="22" x2="4" y2="15" />
                  </svg>
                  {flagged.has(currentQ) ? "Batal Tandai" : "Tandai Soal Ini"}
                </button>
              </div>
            )}
          </div>

          {/* ===== FOOTER — Desktop ===== */}
          {!isMobile && (
            <footer style={{ background: "white", borderTop: "1.5px solid #C8E6F5", padding: "12px 32px 12px calc(56px + 32px)", display: "flex", alignItems: "center", justifyContent: "center", gap: "12px" }}>
              <button
                onClick={() => setCurrentQ(q => Math.max(0, q - 1))}
                disabled={currentQ === 0}
                style={{ padding: "10px 28px", borderRadius: "999px", border: "1.5px solid #D9E9F2", background: "#F0F9FF", color: currentQ === 0 ? "#C8DCE8" : "#29ABE2", cursor: currentQ === 0 ? "not-allowed" : "pointer", fontWeight: 600, fontSize: "14px", display: "flex", alignItems: "center", gap: "6px", transition: "all 0.15s", fontFamily: "Poppins, sans-serif" }}
              >← Sebelumnya</button>

              {currentQ < totalQ - 1 ? (
                <button
                  onClick={() => setCurrentQ(q => Math.min(totalQ - 1, q + 1))}
                  style={{ padding: "10px 32px", borderRadius: "999px", border: "none", background: "#29ABE2", color: "white", cursor: "pointer", fontWeight: 600, fontSize: "14px", display: "flex", alignItems: "center", gap: "6px", boxShadow: "0 4px 12px rgba(41,171,226,0.32), 0 1px 3px rgba(41,171,226,0.18)", transition: "all 0.15s", fontFamily: "Poppins, sans-serif" }}
                >Selanjutnya →</button>
              ) : (
                <button
                  onClick={handleOpenSubmit}
                  style={{ padding: "10px 32px", borderRadius: "999px", border: "none", background: "#10B981", color: "white", cursor: "pointer", fontWeight: 700, fontSize: "14px", boxShadow: "0 4px 12px rgba(16,185,129,0.28), 0 1px 3px rgba(16,185,129,0.16)", display: "flex", alignItems: "center", gap: "6px", transition: "all 0.15s", fontFamily: "Poppins, sans-serif" }}
                >✅ Kumpulkan</button>
              )}
            </footer>
          )}
        </main>
      </div>

      {/* ===== BOTTOM NAV — Mobile ===== */}
      {isMobile && (
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "white", borderTop: "1.5px solid #E2EEF5", padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", zIndex: 60, boxShadow: "0 -4px 16px rgba(0,0,0,0.06)" }}>
          <button
            onClick={() => toggleFlag(currentQ)}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "40px", height: "40px", borderRadius: "6px", border: "1.5px solid " + (flagged.has(currentQ) ? "#F59E0B" : "#D9E9F2"), background: flagged.has(currentQ) ? "#FEF3C7" : "#F0F9FF", color: flagged.has(currentQ) ? "#D97706" : "#29ABE2", cursor: "pointer", transition: "all 0.15s", flexShrink: 0 }}
            title="Tandai soal"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill={flagged.has(currentQ) ? "#F59E0B" : "none"} stroke={flagged.has(currentQ) ? "#F59E0B" : "#29ABE2"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" y1="22" x2="4" y2="15" /></svg>
          </button>
          <button
            onClick={() => setCurrentQ(q => Math.max(0, q - 1))}
            disabled={currentQ === 0}
            style={{ flex: 1, padding: "11px 0", borderRadius: "6px", border: "1.5px solid #D9E9F2", background: "#F0F9FF", color: currentQ === 0 ? "#C8DCE8" : "#29ABE2", cursor: currentQ === 0 ? "not-allowed" : "pointer", fontWeight: 600, fontSize: "13px", transition: "all 0.15s", fontFamily: "Poppins, sans-serif" }}
          >← Sebelumnya</button>
          {currentQ < totalQ - 1 ? (
            <button
              onClick={() => setCurrentQ(q => Math.min(totalQ - 1, q + 1))}
              style={{ flex: 1, padding: "11px 0", borderRadius: "6px", border: "none", background: "#29ABE2", color: "white", cursor: "pointer", fontWeight: 600, fontSize: "13px", boxShadow: "0 3px 10px rgba(41,171,226,0.28), 0 1px 3px rgba(41,171,226,0.16)", transition: "all 0.15s", fontFamily: "Poppins, sans-serif" }}
            >Selanjutnya →</button>
          ) : (
            <button
              onClick={handleOpenSubmit}
              style={{ flex: 1, padding: "11px 0", borderRadius: "6px", border: "none", background: "#10B981", color: "white", cursor: "pointer", fontWeight: 700, fontSize: "13px", boxShadow: "0 3px 10px rgba(16,185,129,0.26), 0 1px 3px rgba(16,185,129,0.14)", transition: "all 0.15s", fontFamily: "Poppins, sans-serif" }}
            >✅ Kumpulkan</button>
          )}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, gap: "1px" }}>
            <span style={{ fontSize: "14px", fontWeight: 700, color: "#29ABE2", lineHeight: 1 }}>{answeredCount}</span>
            <span style={{ fontSize: "10px", color: "#98B4C4" }}>/{totalQ}</span>
          </div>
        </div>
      )}

      {/* Submit Step 1 — Warning: Masih ada soal belum dijawab */}
      {submitStep === 1 && (
        <div className="modal-overlay" onClick={() => setSubmitStep(0)}>
          <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title" style={{ color: "#D97706", display: "flex", alignItems: "center", gap: "6px" }}>
                <span>⚠️</span> Perhatian Belum Semua Terisi
              </div>
              <button className="modal-close" onClick={() => setSubmitStep(0)}>×</button>
            </div>
            <div className="modal-body">
              <div style={{ textAlign: "center", padding: "8px 0 16px" }}>
                <div style={{ fontSize: "44px", marginBottom: "12px" }}>⚠️</div>
                <p style={{ color: "#92400E", fontWeight: 700, fontSize: "15px", marginBottom: "6px" }}>
                  {totalQ - answeredCount} soal belum dikonfirmasi!
                </p>
                <p style={{ color: "#6E8EA0", fontSize: "13px", lineHeight: 1.6, marginBottom: "14px" }}>
                  Kamu belum menjawab <strong style={{ color: "#D97706" }}>{totalQ - answeredCount}</strong> dari <strong>{totalQ}</strong> butir soal. Klik nomor soal di bawah untuk langsung menuju soal tersebut:
                </p>
                {/* Daftar nomor soal belum dijawab */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", justifyContent: "center", maxHeight: "140px", overflowY: "auto", padding: "4px" }}>
                  {questionsList
                    .map((q, idx) => ({ q, idx }))
                    .filter(({ q }) => !isQuestionAnswered(q))
                    .map(({ idx }) => (
                      <button
                        key={idx}
                        onClick={() => { setSubmitStep(0); setCurrentQ(idx); }}
                        style={{
                          width: "32px", height: "32px", borderRadius: "6px",
                          border: "1.5px solid #D97706", background: "#FFFBEB",
                          color: "#92400E", fontWeight: 700, fontSize: "12px", cursor: "pointer",
                          transition: "all 0.15s",
                        }}
                        title={`Buka Soal No. ${idx + 1}`}
                      >
                        {idx + 1}
                      </button>
                    ))}
                </div>
              </div>
            </div>
            <div className="modal-footer" style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
              <button className="btn btn-secondary btn-md" onClick={() => setSubmitStep(0)}>
                Kembali Isi Soal
              </button>
              <button
                className="btn btn-md"
                style={{ background: "#D97706", color: "white", fontWeight: 600 }}
                onClick={() => setSubmitStep(2)}
              >
                Tetap Lanjut →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Submit Step 2 — Konfirmasi Akhir (2x Konfirmasi) */}
      {submitStep === 2 && (
        <div className="modal-overlay" onClick={() => setSubmitStep(0)}>
          <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Konfirmasi Akhir Pengumpulan</div>
              <button className="modal-close" onClick={() => setSubmitStep(0)}>×</button>
            </div>
            <div className="modal-body">
              <div style={{ textAlign: "center", padding: "8px 0 16px" }}>
                <div style={{ fontSize: "44px", marginBottom: "14px" }}>📝</div>
                <p style={{ color: "#1C303D", fontWeight: 700, fontSize: "15px", marginBottom: "8px" }}>
                  Yakin ingin mengumpulkan ujian ini sekarang?
                </p>
                <p style={{ color: "#6E8EA0", fontSize: "13px", lineHeight: 1.6 }}>
                  Kamu telah menjawab <strong style={{ color: "#29ABE2" }}>{answeredCount}</strong> dari <strong>{totalQ}</strong> soal.
                </p>
                <p style={{ marginTop: "10px", fontSize: "12px", color: "#DC2626", fontWeight: 600, background: "#FEF2F2", padding: "8px 12px", borderRadius: "6px", border: "1px solid #FECACA" }}>
                  ⚠️ Perhatian: Setelah dikumpulkan, kamu tidak dapat lagi mengakses ujian ini.
                </p>
              </div>
            </div>
            <div className="modal-footer" style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
              <button className="btn btn-secondary btn-md" onClick={() => setSubmitStep(0)}>
                Batal
              </button>
              <button
                className="btn btn-md"
                style={{ background: "#10B981", color: "white", fontWeight: 700 }}
                onClick={handleSubmit}
              >
                ✅ Ya, Kumpulkan Sekarang
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
      `}</style>
    </div>
  );
}
