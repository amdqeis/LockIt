"use client";

import { useState, useEffect } from "react";
import {
  checkActiveSession,
  getSessionHint,
  clearSessionHint,
  type SessionCheckResult,
  type SessionHint,
} from "@/lib/examSession";

export interface UseActiveSessionResult {
  /** true saat sedang fetch backend (setelah mount) */
  checking: boolean;
  /** Hasil check dari backend (null sebelum check selesai) */
  sessionCheck: SessionCheckResult | null;
  /** Hint dari localStorage — tersedia instan sebelum backend merespons */
  sessionHint: SessionHint | null;
  /** true jika backend konfirmasi ada sesi aktif */
  hasActiveSession: boolean;
}

/**
 * Hook untuk mendeteksi sesi ujian aktif.
 *
 * Cara kerja:
 * 1. Saat mount: baca localStorage hint secara sinkron (instant feedback).
 * 2. Fetch GET /api/exam-session/check di background.
 * 3. Jika backend konfirmasi isActive: false → hapus localStorage hint.
 * 4. Kembalikan { checking, sessionCheck, sessionHint, hasActiveSession }.
 *
 * Gunakan `sessionHint` untuk tampilan awal (sementara `checking === true`).
 * Gunakan `hasActiveSession` untuk redirect / show resume UI setelah check selesai.
 */
export function useActiveSession(): UseActiveSessionResult {
  const [checking, setChecking] = useState(true);
  const [sessionCheck, setSessionCheck] = useState<SessionCheckResult | null>(null);
  const [sessionHint, setSessionHint] = useState<SessionHint | null>(null);

  useEffect(() => {
    // 1. Baca hint sinkron dari localStorage untuk instant feedback
    const hint = getSessionHint();
    setSessionHint(hint);

    // 2. Fetch backend di background
    let cancelled = false;
    checkActiveSession().then((result) => {
      if (cancelled) return;
      setSessionCheck(result);
      setChecking(false);

      // 3. Jika sesi tidak aktif, bersihkan hint yang mungkin stale
      if (!result.isActive) {
        clearSessionHint();
        setSessionHint(null);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const hasActiveSession = sessionCheck?.isActive === true;

  return { checking, sessionCheck, sessionHint, hasActiveSession };
}
