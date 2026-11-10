"use client";

import { use, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { api, type Question } from "@/lib/api";
import { ExamWorkspace } from "@/components/ExamWorkspace";
import { ExamSessionSkeleton } from "@/components/skeletons";

type ReviewResponse = {
  exam: {
    id?: string;
    title: string;
    description?: string | null;
    display_mode?: "one_by_one" | "all_at_once";
  };
  student?: {
    id: string;
    name: string;
    nisn: string;
  };
  showScoreToStudent: boolean;
  summary: {
    score: number;
    earnedPoints?: number;
    totalPoints?: number;
    pendingManualCount: number;
  } | null;
  questions: Question[];
};

export default function StudentReviewPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = use(params);
  const reduceMotion = useReducedMotion();
  const [data, setData] = useState<ReviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    let active = true;
    async function fetchReview() {
      setLoading(true);
      setError("");
      try {
        const res = await api<ReviewResponse>(`/api/student-history/${encodeURIComponent(studentId)}/review`);
        if (active) {
          setData(res);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Review jawaban belum dapat dimuat.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void fetchReview();
    return () => {
      active = false;
    };
  }, [studentId]);

  if (loading) {
    return <ExamSessionSkeleton />;
  }

  if (error || !data) {
    return (
      <main className="state-page">
        <h1>Review belum tersedia</h1>
        <p role="alert">{error || "Review tidak ditemukan atau Anda belum memiliki akses."}</p>
        <Link className="primary-button" href="/">
          Kembali ke Beranda
        </Link>
      </main>
    );
  }

  const { exam, student, showScoreToStudent, summary, questions } = data;

  return (
    <motion.main
      className="exam-page"
      initial={reduceMotion ? false : { opacity: 0.75 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reduceMotion ? 0 : 0.32 }}
    >
      <div className="exam-topbar">
        <Image className="exam-logo" src="/eduquas-logo.png" width={176} height={42} alt="EduQuas" priority />
        <Link className="text-button" href={`/exam/done?studentId=${encodeURIComponent(studentId)}`}>
          Kembali ke Riwayat
        </Link>
      </div>

      <header className="exam-header">
        <div className="exam-title">
          <span style={{ fontSize: 12, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Review Jawaban
          </span>
          <h1 id="exam-title" tabIndex={-1} style={{ marginTop: 4 }}>
            {exam.title}
          </h1>
          {exam.description && <p>{exam.description}</p>}
        </div>

        {student && (
          <div className="exam-person">
            <span>Peserta</span>
            <strong>{student.name}</strong>
            <span>NISN {student.nisn}</span>
          </div>
        )}

        {showScoreToStudent && summary ? (
          <div className="timer" style={{ minWidth: 140 }}>
            <span>Nilai Akhir</span>
            <strong style={{ fontSize: 26, color: "var(--ink)" }}>{summary.score}</strong>
            {summary.earnedPoints !== undefined && summary.totalPoints !== undefined && (
              <span style={{ fontSize: 12, color: "var(--muted)" }}>
                {summary.earnedPoints} / {summary.totalPoints} poin
              </span>
            )}
            {summary.pendingManualCount > 0 && (
              <span style={{ fontSize: 11, color: "#785800" }}>Menunggu penilaian guru</span>
            )}
          </div>
        ) : (
          <div className="timer" style={{ minWidth: 140 }}>
            <span>Status</span>
            <strong style={{ fontSize: 16 }}>Selesai</strong>
          </div>
        )}
      </header>

      <ExamWorkspace
        mode="review"
        questions={questions}
        currentIndex={currentIndex}
        onSelectIndex={setCurrentIndex}
        displayMode={exam.display_mode ?? "one_by_one"}
        showScore={showScoreToStudent}
        reviewSummary={summary}
      />
    </motion.main>
  );
}
