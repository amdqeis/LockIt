"use client";

import { use, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { staffApi } from "@/lib/staff-api";
import { ExamWorkspace } from "@/components/ExamWorkspace";
import { ExamSessionSkeleton } from "@/components/skeletons";
import type { Question } from "@/lib/api";

type BankDetailResponse = {
  id: string;
  title: string;
  subject: string;
  description?: string | null;
  questions: Question[];
  subjectFolder?: {
    name: string;
    gradeLevel?: {
      name: string;
    } | null;
  } | null;
};

export default function BankPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const reduceMotion = useReducedMotion();
  const [data, setData] = useState<BankDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const res = await staffApi<BankDetailResponse>(`/api/question-banks/${encodeURIComponent(id)}`);
        if (active) setData(res);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Pratinjau bank soal belum dapat dimuat.");
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
        <p role="alert">{error || "Data bank soal tidak ditemukan."}</p>
        <Link className="primary-button" href="/dashboard/bank-soal">
          Kembali ke Bank Soal
        </Link>
      </main>
    );
  }

  const { title, subject, description, questions, subjectFolder } = data;
  const gradeName = subjectFolder?.gradeLevel?.name;

  return (
    <motion.main
      className="exam-page"
      initial={reduceMotion ? false : { opacity: 0.75 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reduceMotion ? 0 : 0.32 }}
    >
      <div className="exam-topbar">
        <Image className="exam-logo" src="/eduquas-logo.png" width={176} height={42} alt="EduQuas" priority />
        <Link className="text-button" href="/dashboard/bank-soal">
          Kembali ke Bank Soal
        </Link>
      </div>

      <header className="exam-header">
        <div className="exam-title">
          <span style={{ fontSize: 12, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Pratinjau Bank Soal Tersimpan
          </span>
          <h1 id="exam-title" tabIndex={-1} style={{ marginTop: 4 }}>
            {title}
          </h1>
          <p>
            {subject}
            {gradeName ? ` · Tingkat ${gradeName}` : ""}
            {description ? ` · ${description}` : ""}
          </p>
        </div>

        <div className="timer" style={{ minWidth: 140 }}>
          <span>Total Poin</span>
          <strong style={{ fontSize: 24, color: "var(--ink)" }}>
            {questions.reduce((sum, q) => sum + q.points, 0)}
          </strong>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>
            {questions.length} soal tersimpan
          </span>
        </div>
      </header>

      <ExamWorkspace
        mode="preview"
        questions={questions}
        currentIndex={currentIndex}
        onSelectIndex={setCurrentIndex}
        displayMode="one_by_one"
      />
    </motion.main>
  );
}

