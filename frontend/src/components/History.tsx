"use client";

import { MotionButton } from "@/components/MotionButton";
import Link from "next/link";
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { api, post } from "@/lib/api";
import { HistorySkeleton } from "@/components/skeletons";

type Entry = {
  studentId: string;
  studentName: string;
  status: string;
  joinedAt: string;
  submittedAt: string | null;
  score: number | null;
  pendingManualCount?: number;
  canReview: boolean;
  canResume: boolean;
  isLocked: boolean;
  exam: { title: string; status: string; className: string | null };
};
type HistoryPage = { items: Entry[]; nextCursor: string | null };

const status: Record<string, string> = {
  waiting: "Menunggu persetujuan",
  accepted: "Disetujui",
  active: "Sedang berlangsung",
  disconnected: "Terputus",
  submitted: "Selesai",
  rejected: "Ditolak",
  kicked: "Dikeluarkan",
};

export function History({ onResume, revision }: { onResume: () => Promise<void>; revision: number }) {
  const reduceMotion = useReducedMotion();
  const [items, setItems] = useState<Entry[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  async function load(next?: string) {
    setLoading(true);
    setError("");
    try {
      if (!next) await post("/api/student-history");
      const page = await api<HistoryPage>(
        `/api/student-history${next ? `?cursor=${encodeURIComponent(next)}` : ""}`
      );
      setItems((current) => (next ? [...current, ...page.items] : page.items));
      setCursor(page.nextCursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Riwayat tidak dapat dimuat.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timer);
  }, [revision]);

  async function resume(entry: Entry) {
    setBusyId(entry.studentId);
    setError("");
    try {
      await post(`/api/student-history/${encodeURIComponent(entry.studentId)}/resume`);
      await onResume();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sesi tidak dapat dilanjutkan.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <motion.section
      layout="position"
      initial={reduceMotion ? false : { opacity: 0.75, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={
        reduceMotion
          ? { duration: 0 }
          : {
              opacity: { duration: 0.32, delay: 0.12 },
              y: { duration: 0.32, delay: 0.12 },
              layout: { type: "spring", stiffness: 270, damping: 31, mass: 0.95 },
            }
      }
      className="history"
      aria-labelledby="history-title"
    >
      <div className="section-heading">
        <div>
          <h2 id="history-title">Riwayat ujian</h2>
          <p>Ujian yang pernah dibuka di browser ini.</p>
        </div>
      </div>

      {error && (
        <p className="error" role="alert">
          {error}{" "}
          <MotionButton className="text-button" type="button" onClick={() => void load()}>
            Coba lagi
          </MotionButton>
        </p>
      )}

      {!items.length && loading ? (
        <HistorySkeleton rows={2} />
      ) : !items.length && !error ? (
        <p className="empty">Belum ada riwayat ujian di browser ini.</p>
      ) : (
        <ul className="history-list">
          {items.map((entry, index) => (
            <motion.li
              key={entry.studentId}
              initial={reduceMotion ? false : { opacity: 0.75, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: reduceMotion ? 0 : 0.22,
                delay: reduceMotion ? 0 : Math.min(index, 4) * 0.04,
              }}
            >
              <div className="history-main">
                <strong>{entry.exam.title}</strong>
                <span>
                  {entry.studentName}
                  {entry.exam.className ? ` · ${entry.exam.className}` : ""}
                </span>
                <span>
                  {new Date(entry.submittedAt || entry.joinedAt).toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              </div>
              <div className="history-meta">
                <span className="status-text">
                  {entry.isLocked ? "Terkunci sementara" : status[entry.status] || entry.status}
                </span>
                {entry.score !== null && <strong>Nilai {entry.score}</strong>}
                {!!entry.pendingManualCount && <span>Menunggu penilaian guru</span>}
              </div>
              <div className="history-actions">
                {entry.canResume && (
                  <MotionButton
                    className="text-button"
                    disabled={!!busyId}
                    onClick={() => void resume(entry)}
                  >
                    {busyId === entry.studentId ? "Menyiapkan…" : "Lanjutkan"}
                  </MotionButton>
                )}
                {entry.canReview && (
                  <Link
                    className="text-button"
                    href={`/exam/review/${encodeURIComponent(entry.studentId)}`}
                  >
                    Review jawaban
                  </Link>
                )}
              </div>
            </motion.li>
          ))}
        </ul>
      )}

      {cursor && (
        <MotionButton
          className="secondary-button more-button"
          type="button"
          disabled={loading}
          onClick={() => void load(cursor)}
        >
          {loading ? "Memuat…" : "Muat lebih banyak"}
        </MotionButton>
      )}
    </motion.section>
  );
}
