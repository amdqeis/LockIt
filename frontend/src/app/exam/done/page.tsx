"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { api, post } from "@/lib/api";
import { MotionButton } from "@/components/MotionButton";
import { Dialog } from "@/components/Dialog";
import { ReviewContent, type Review } from "@/components/ReviewContent";
import { DoneResultSkeleton, SkeletonText } from "@/components/skeletons";

type Result = { studentId: string; studentName: string; status: string; score: number | null; pendingManualCount?: number; canReview: boolean; exam: { title: string } };
type HistoryPage = { items: Result[]; nextCursor: string | null };

export default function ExamDonePage() {
  const reduceMotion = useReducedMotion();
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [review, setReview] = useState<Review | null>(null);
  const [reviewError, setReviewError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      await post("/api/student-history");
      const studentId = new URLSearchParams(window.location.search).get("studentId");
      let cursor: string | null = null;
      let found: Result | undefined;
      do {
        const page: HistoryPage = await api(`/api/student-history${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`);
        found = page.items.find(item => item.status === "submitted" && (!studentId || item.studentId === studentId));
        cursor = page.nextCursor;
      } while (!found && cursor && studentId);
      setResult(found || null);
    } catch (err) { setError(err instanceof Error ? err.message : "Hasil ujian belum dapat dimuat."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { const timer = setTimeout(() => void load(), 0); return () => clearTimeout(timer); }, [load]);

  async function openReview() {
    if (!result) return;
    setReviewOpen(true); setReview(null); setReviewError("");
    try { setReview(await api<Review>(`/api/student-history/${encodeURIComponent(result.studentId)}/review`)); }
    catch (err) { setReviewError(err instanceof Error ? err.message : "Review belum dapat dimuat."); }
  }

  return <motion.main className="done-page" initial={reduceMotion ? false : { opacity: 0.75, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduceMotion ? 0 : 0.32 }}>
    <Image className="done-logo" src="/eduquas-logo.png" width={176} height={42} alt="EduQuas" priority />
    <section className="done-content" aria-labelledby="done-title">
      <div className="done-symbol" aria-hidden="true"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4 4L19 6" /></svg></div>
      <h1 id="done-title">{loading ? "Memeriksa hasil ujian" : result ? "Ujian selesai" : "Hasil ujian belum tersedia"}</h1>
      {result && <p>Jawaban Anda sudah dikumpulkan. Terima kasih telah mengerjakan ujian.</p>}
      {loading ? <DoneResultSkeleton /> : error ? <p className="error" role="alert">{error} <MotionButton className="text-button" onClick={() => void load()}>Coba lagi</MotionButton></p> : result ? <div className="done-result"><h2>{result.exam.title}</h2><p>{result.studentName}</p>{result.score !== null && <p className="done-score"><span>Nilai Anda</span><strong>{result.score}</strong></p>}{!!result.pendingManualCount && <p>Sebagian jawaban masih menunggu penilaian guru.</p>}{result.canReview && <MotionButton className="secondary-button" onClick={() => void openReview()}>Review jawaban</MotionButton>}</div> : <p>Hasil belum tersedia di browser ini. Anda dapat memeriksa riwayat ujian.</p>}
      <Link className="primary-button done-home" href="/">Kembali ke halaman utama</Link>
    </section>
    <Dialog open={reviewOpen} title={review?.exam.title || "Review jawaban"} onClose={() => { setReviewOpen(false); setReview(null); }}>
      {reviewError ? <p className="error" role="alert">{reviewError}</p> : !review ? <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "16px 0" }}><SkeletonText width="40%" height={14} /><SkeletonText width="90%" height={12} /><SkeletonText width="70%" height={12} /></div> : <ReviewContent review={review} />}
    </Dialog>
  </motion.main>;
}
