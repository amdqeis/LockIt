"use client";

import { use, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { staffApi } from "@/lib/staff-api";
import { ExamWorkspace } from "@/components/ExamWorkspace";
import { ExamSessionSkeleton } from "@/components/skeletons";
import type { Question } from "@/lib/api";

type PreviewExamResponse = {
  exam: {
    id: string;
    title: string;
    durationMinutes: number;
    status: string;
    accessCode: string;
    settings?: {
      question_selection?: {
        mode: "manual" | "random_once" | "random_per_student";
        count?: number;
      };
      display_mode?: "one_by_one" | "all_at_once";
    };
    totalQuestions: number;
    totalPoints: number;
  };
  questions: Question[];
};

export default function ExamPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const reduceMotion = useReducedMotion();
  const [data, setData] = useState<PreviewExamResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const res = await staffApi<PreviewExamResponse>(`/api/exams/${encodeURIComponent(id)}/questions/preview`);
        if (active) setData(res);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Pratinjau soal ujian belum dapat dimuat.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [id]);

  if (loading) return <ExamSessionSkeleton />;

  if (error || !data) {
    return (
      <main className="state-page">
        <h1>Pratinjau tidak tersedia</h1>
        <p role="alert">{error || "Data ujian tidak ditemukan."}</p>
        <Link className="primary-button" href="/dashboard/ujian">
          Kembali ke Daftar Ujian
        </Link>
      </main>
    );
  }

  const { exam, questions } = data;
  const selectionMode = exam.settings?.question_selection?.mode || "manual";
  const selectionCount = exam.settings?.question_selection?.count || questions.length;

  // Jika mode random_per_student, tampilkan contoh N soal pertama
  const isRandomPerStudent = selectionMode === "random_per_student";
  const displayedQuestions = isRandomPerStudent ? questions.slice(0, selectionCount) : questions;

  let sampleNotice = "";
  if (isRandomPerStudent) {
    sampleNotice = `Pratinjau Ujian (Mode Acak per Peserta) · Menampilkan contoh ${displayedQuestions.length} soal acak dari total ${questions.length} kandidat. Setiap peserta akan menerima penugasan soal dan urutan opsi yang ditetapkan sekali saat sesi dimulai.`;
  } else if (selectionMode === "random_once") {
    sampleNotice = `Pratinjau Ujian (Mode Acak Sekali per Ujian) · Seluruh peserta menerima kumpulan ${displayedQuestions.length} soal ini.`;
  }

  return (
    <motion.main
      className="exam-page"
      initial={reduceMotion ? false : { opacity: 0.75 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reduceMotion ? 0 : 0.32 }}
    >
      <div className="exam-topbar">
        <Image className="exam-logo" src="/eduquas-logo.png" width={176} height={42} alt="EduQuas" priority />
        <Link className="text-button" href="/dashboard/ujian">
          Kembali ke Dashboard
        </Link>
      </div>

      <header className="exam-header">
        <div className="exam-title">
          <span style={{ fontSize: 12, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Pratinjau Ujian (Tampilan Guru)
          </span>
          <h1 id="exam-title" tabIndex={-1} style={{ marginTop: 4 }}>
            {exam.title}
          </h1>
          <p>
            Durasi {exam.durationMinutes} menit · Kode akses {exam.accessCode} · Status {exam.status}
          </p>
        </div>

        <div className="timer" style={{ minWidth: 140 }}>
          <span>Total Poin</span>
          <strong style={{ fontSize: 24, color: "var(--ink)" }}>
            {displayedQuestions.reduce((sum, q) => sum + q.points, 0)}
          </strong>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>
            {displayedQuestions.length} soal ditampilkan
          </span>
        </div>
      </header>

      <ExamWorkspace
        mode="preview"
        questions={displayedQuestions}
        currentIndex={currentIndex}
        onSelectIndex={setCurrentIndex}
        displayMode={exam.settings?.display_mode ?? "one_by_one"}
        sampleNotice={sampleNotice}
      />
    </motion.main>
  );
}

