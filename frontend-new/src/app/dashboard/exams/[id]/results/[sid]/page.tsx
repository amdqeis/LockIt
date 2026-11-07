"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiClient } from "@/lib/apiClient";
import DashboardShell from "@/app/components/DashboardShell";
import LatexRenderer from "@/app/components/LatexRenderer";
import StructuredQuestionContent from "@/app/components/StructuredQuestionContent";
import PrivateMediaImage from "@/app/components/PrivateMediaImage";
import type { JSONContent } from "@tiptap/core";

interface QuestionDetail {
  id: string;
  number: number;
  text: string;
  content?: JSONContent | null;
  imageUrl?: string | null;
  imageAlt?: string | null;
  points: number;
  correctAnswer: string;
  selectedAnswer: string | null;
  isCorrect: boolean | null;
  type?: string;
  options: { id: string; text: string; content?: JSONContent | null; imageUrl?: string | null; imageAlt?: string | null }[];
}

function ResultDetailPage() {
  const params = useParams();
  const examId = Array.isArray(params.id) ? params.id[0] : (params.id as string);
  const sid = Array.isArray(params.sid) ? params.sid[0] : (params.sid as string);

  const [examTitle, setExamTitle] = useState("Hasil Ujian");
  const [result, setResult] = useState({
    name: "Peserta Ujian",
    nisn: "-",
    score: 0,
    correct: 0,
    total: 0,
    violations: 0,
    submittedAt: "-",
    pendingManualCount: 0,
    status: "",
  });

  const [questions, setQuestions] = useState<QuestionDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [gradingId, setGradingId] = useState<string | null>(null);
  const [gradingError, setGradingError] = useState("");

  useEffect(() => {
    let isMounted = true;
    const fetchDetail = async () => {
      try {
        const res = await apiClient.get<any>(`/api/exams/${examId}/results/${sid}`);
        if (!isMounted) return;

        if (res.success && res.data) {
          const { summary, answers } = res.data;
          if (summary) {
            setResult({
              name: summary.name,
              nisn: summary.nisn || "-",
              score: Math.round(summary.finalScore ?? 0),
              correct: summary.correctCount ?? 0,
              total: summary.totalQuestions ?? 0,
              violations: summary.violationCount ?? 0,
              pendingManualCount: summary.pendingManualCount ?? 0,
              status: summary.status ?? "",
              submittedAt: summary.submittedAt
                ? new Date(summary.submittedAt).toLocaleTimeString("id-ID", {
                    hour: "2-digit",
                    minute: "2-digit",
                  }) + " WIB"
                : "-",
            });
          }

          if (Array.isArray(answers) && answers.length > 0) {
            const mappedQuestions: QuestionDetail[] = answers.map((a: any, idx: number) => {
              let parsedOptions: QuestionDetail["options"] = [];
              if (Array.isArray(a.options)) {
                parsedOptions = a.options.map((opt: any, optIdx: number) => {
                  if (typeof opt === "string") {
                    return { id: String.fromCharCode(97 + optIdx), text: opt };
                  }
                  return { id: (opt.id || opt.key || opt.label || "").toLowerCase(), text: opt.text || "", content: opt.content, imageUrl: opt.imageUrl, imageAlt: opt.imageAlt };
                });
              }

              return {
                id: a.questionId || String(idx),
                number: idx + 1,
                text: a.questionText || "",
                content: a.content,
                imageUrl: a.imageUrl,
                imageAlt: a.imageAlt,
                points: a.points || 1,
                correctAnswer: a.type === "short_answer" ? (a.correctAnswer || "") : (a.correctAnswer || "").toLowerCase(),
                selectedAnswer: a.type === "short_answer" ? (a.selectedOption || null) : (a.selectedOption ? a.selectedOption.toLowerCase() : null),
                isCorrect: a.type === "short_answer" ? (a.isCorrect ?? null) : !!a.isCorrect,
                type: a.type,
                options: parsedOptions,
              };
            });
            setQuestions(mappedQuestions);
          }
        } else setLoadError(res.error?.message || "Hasil peserta tidak dapat dimuat.");
      } catch (err) {
        if (isMounted) setLoadError(err instanceof Error ? err.message : "Hasil peserta tidak dapat dimuat.");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchDetail();
    return () => {
      isMounted = false;
    };
  }, [examId, sid]);

  const gradeAnswer = async (questionId: string, isCorrect: boolean | null) => {
    setGradingId(questionId); setGradingError("");
    try {
      const response = await apiClient.patch<{ summary: { finalScore: number; correctCount: number; pendingManualCount: number } }>(`/api/exams/${examId}/results/${sid}`, { questionId, isCorrect });
      if (!response.success || !response.data) throw new Error(response.error?.message || "Penilaian belum dapat disimpan.");
      setQuestions(previous => previous.map(question => question.id === questionId ? { ...question, isCorrect } : question));
      const summary = response.data.summary;
      setResult(previous => ({ ...previous, score: Math.round(summary.finalScore), correct: summary.correctCount, pendingManualCount: summary.pendingManualCount }));
    } catch (error) { setGradingError(error instanceof Error ? error.message : "Penilaian belum dapat disimpan."); }
    finally { setGradingId(null); }
  };

  if (loading || loadError) return <DashboardShell><div style={{ padding: "32px" }} role={loadError ? "alert" : "status"}>{loadError || "Memuat hasil peserta…"}{loadError && <> <Link href={`/dashboard/exams/${examId}/results`}>Kembali ke hasil ujian</Link></>}</div></DashboardShell>;

  return (
    <DashboardShell>
      {/* Header */}
      <header
        style={{
          background: "white",
          borderBottom: "1px solid #E9ECF0",
          padding: "16px 32px",
          position: "sticky",
          top: 0,
          zIndex: 50,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#9CA3AF" }}>
          <Link href="/dashboard" style={{ color: "#9CA3AF", textDecoration: "none" }}>
            Dashboard
          </Link>
          <span>›</span>
          <Link href={`/dashboard/exams/${examId}/results`} style={{ color: "#9CA3AF", textDecoration: "none" }}>
            Hasil Ujian
          </Link>
          <span>›</span>
          <span style={{ color: "#111827", fontWeight: 500 }}>{result.name}</span>
        </div>
      </header>

      <div style={{ padding: "24px 32px", maxWidth: "900px" }}>
        {/* Student Header Card */}
        <div
          style={{
            background: "white",
            borderRadius: "16px",
            border: "1px solid #E9ECF0",
            padding: "24px",
            marginBottom: "20px",
            boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
            display: "flex",
            alignItems: "center",
            gap: "20px",
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "50%",
              background: "linear-gradient(135deg, #2563EB, #1D4ED8)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontWeight: 800,
              fontSize: "22px",
              flexShrink: 0,
            }}
          >
            {result.name.charAt(0)}
          </div>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: "22px", fontWeight: 700, color: "#111827", marginBottom: "4px" }}>{result.name}</h1>
            <div style={{ fontFamily: "monospace", color: "#9CA3AF", fontSize: "14px" }}>NISN: {result.nisn}</div>
            <div style={{ marginTop: "8px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <span
                style={{
                  background: "#DCFCE7",
                  color: "#42654F",
                  padding: "3px 10px",
                  borderRadius: "100px",
                  fontSize: "12px",
                  fontWeight: 600,
                }}
              >
                {result.correct} benar
              </span>
              <span
                style={{
                  background: "#FEE2E2",
                  color: "#DC2626",
                  padding: "3px 10px",
                  borderRadius: "100px",
                  fontSize: "12px",
                  fontWeight: 600,
                }}
              >
                {result.total} soal
              </span>
              {result.violations > 0 && (
                <span
                  style={{
                    background: "#FEF3C7",
                    color: "#C28A3D",
                    padding: "3px 10px",
                    borderRadius: "100px",
                    fontSize: "12px",
                    fontWeight: 600,
                  }}
                >
                  {result.violations} pelanggaran
                </span>
              )}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div
              style={{
                fontSize: "52px",
                fontWeight: 800,
                lineHeight: 1,
                color: result.pendingManualCount > 0 ? "#79531E" : result.score >= 70 ? "#42654F" : "#914848",
              }}
            >
              {result.score}
              <span style={{ fontSize: "26px", color: "#D1D5DB" }}>/100</span>
            </div>
            <div style={{ fontSize: "13px", color: "#9CA3AF", marginTop: "4px" }}>Submit: {result.submittedAt}</div>
            {result.pendingManualCount > 0 && <div style={{ fontSize: 13, color: "#79531E" }}>Nilai sementara · {result.pendingManualCount} jawaban menunggu penilaian</div>}
          </div>
        </div>

        {/* Question List */}
        {gradingError && <p role="alert" style={{ color: "#914848" }}>{gradingError}</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {questions.map((q) => {
            const isCorrect = q.isCorrect;
            const notAnswered = !q.selectedAnswer;

            return (
              <div
                key={q.id}
                style={{
                  background: "white",
                  borderRadius: "14px",
                  border: "1px solid #E9ECF0",
                  overflow: "hidden",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                }}
              >
                {/* Question Header */}
                <div
                  style={{
                    padding: "14px 20px",
                    background: q.type === "short_answer" ? "#F0FDFA" : notAnswered ? "#F8FAFC" : isCorrect ? "#E4EFE7" : "#FFF5F5",
                    borderBottom: "1px solid #E9ECF0",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span style={{ fontSize: "13px", color: "#6B7280", fontWeight: 600 }}>Soal {q.number}</span>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <span
                      style={{
                        background: "#EFF6FF",
                        color: "#2563EB",
                        padding: "2px 8px",
                        borderRadius: "100px",
                        fontSize: "12px",
                        fontWeight: 600,
                      }}
                    >
                      +{q.points} poin
                    </span>
                    {q.type === "short_answer" ? (
                      <span
                        style={{
                          background: notAnswered ? "#F3F4F6" : "#CCFBF1",
                          color: notAnswered ? "#6B7280" : "#0F766E",
                          padding: "2px 10px",
                          borderRadius: "100px",
                          fontSize: "12px",
                          fontWeight: 600,
                        }}
                      >
                        {notAnswered ? "Tidak dijawab" : isCorrect === null ? "Belum dinilai" : isCorrect ? "Benar" : "Salah"}
                      </span>
                    ) : notAnswered ? (
                      <span
                        style={{
                          background: "#F3F4F6",
                          color: "#6B7280",
                          padding: "2px 10px",
                          borderRadius: "100px",
                          fontSize: "12px",
                          fontWeight: 600,
                        }}
                      >
                        — Tidak Dijawab
                      </span>
                    ) : isCorrect ? (
                      <span
                        style={{
                          background: "#DCFCE7",
                          color: "#42654F",
                          padding: "2px 10px",
                          borderRadius: "100px",
                          fontSize: "12px",
                          fontWeight: 600,
                        }}
                      >
                        Benar
                      </span>
                    ) : (
                      <span
                        style={{
                          background: "#FEE2E2",
                          color: "#DC2626",
                          padding: "2px 10px",
                          borderRadius: "100px",
                          fontSize: "12px",
                          fontWeight: 600,
                        }}
                      >
                        Salah
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ padding: "16px 20px" }}>
                  <div style={{ fontSize: "15px", color: "#111827", marginBottom: "16px", lineHeight: 1.7 }}>
                    {q.content ? <StructuredQuestionContent content={q.content} /> : <LatexRenderer text={q.text} />}
                    {q.imageUrl && <PrivateMediaImage src={q.imageUrl} alt={q.imageAlt || "Gambar soal"} style={{ display: "block", maxWidth: "100%", maxHeight: 300 }} />}
                  </div>

                  {/* Options or Short Answer Content */}
                  {q.type === "short_answer" ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      <label style={{ fontSize: "12px", fontWeight: 700, color: "#475569" }}>
                        Jawaban Teks Siswa:
                      </label>
                      <div
                        style={{
                          padding: "12px 16px",
                          borderRadius: "8px",
                          border: "1.5px solid #CBD5E1",
                          background: notAnswered ? "#F8FAFC" : "#FFFFFF",
                          color: notAnswered ? "#94A3B8" : "#1E293B",
                          fontSize: "14px",
                          lineHeight: 1.6,
                          whiteSpace: "pre-wrap",
                          fontStyle: notAnswered ? "italic" : "normal",
                        }}
                      >
                        {notAnswered ? "(Siswa tidak mengisi jawaban untuk soal ini)" : q.selectedAnswer}
                      </div>
                      {!notAnswered && result.status === "submitted" && <fieldset className="grade-controls" disabled={gradingId !== null}><legend>Penilaian jawaban</legend><button type="button" aria-pressed={isCorrect === true} onClick={() => void gradeAnswer(q.id, true)}>Benar · {q.points} poin</button><button type="button" aria-pressed={isCorrect === false} onClick={() => void gradeAnswer(q.id, false)}>Salah · 0 poin</button>{isCorrect !== null && <button type="button" onClick={() => void gradeAnswer(q.id, null)}>Batalkan penilaian</button>}{gradingId === q.id && <span role="status">Menyimpan…</span>}</fieldset>}
                    </div>
                  ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {q.options.map((opt) => {
                      const studentChoices = q.selectedAnswer ? q.selectedAnswer.split(",").map((s: string) => s.trim().toLowerCase()) : [];
                      const correctChoices = q.correctAnswer ? q.correctAnswer.split(",").map((s: string) => s.trim().toLowerCase()) : [];
                      const isStudentChoice = studentChoices.includes(opt.id);
                      const isCorrectOpt = correctChoices.includes(opt.id);

                      let bg = "transparent";
                      let borderColor = "#E5E7EB";
                      let labelBg = "#F3F4F6";
                      let labelColor = "#374151";
                      let suffix = null;

                      if (isStudentChoice && isCorrectOpt) {
                        bg = "#E4EFE7";
                        borderColor = "#42654F";
                        labelBg = "#42654F";
                        labelColor = "white";
                        suffix = (
                          <span style={{ fontSize: "12px", color: "#42654F", fontWeight: 600, marginLeft: "auto" }}>
                            Jawaban Siswa (Benar)
                          </span>
                        );
                      } else if (isStudentChoice && !isCorrectOpt) {
                        bg = "#FFF5F5";
                        borderColor = "#DC2626";
                        labelBg = "#DC2626";
                        labelColor = "white";
                        suffix = (
                          <span style={{ fontSize: "12px", color: "#DC2626", fontWeight: 600, marginLeft: "auto" }}>
                            Jawaban Siswa (Salah)
                          </span>
                        );
                      } else if (!isStudentChoice && isCorrectOpt) {
                        bg = "#E4EFE7";
                        borderColor = "#42654F";
                        labelBg = "#42654F";
                        labelColor = "white";
                        suffix = (
                          <span style={{ fontSize: "12px", color: "#42654F", fontWeight: 600, marginLeft: "auto" }}>
                            Kunci Jawaban
                          </span>
                        );
                      }

                      return (
                        <div
                          key={opt.id}
                          style={{
                            padding: "10px 14px",
                            borderRadius: "10px",
                            border: `1.5px solid ${borderColor}`,
                            background: bg,
                            display: "flex",
                            gap: "10px",
                            alignItems: "center",
                            fontSize: "14px",
                            transition: "all 0.15s",
                          }}
                        >
                          <span
                            style={{
                              width: "26px",
                              height: "26px",
                              borderRadius: "50%",
                              background: labelBg,
                              color: labelColor,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "12px",
                              fontWeight: 700,
                              flexShrink: 0,
                            }}
                          >
                            {opt.id.toUpperCase()}
                          </span>
                          <span style={{ flex: 1, color: "#374151" }}>{opt.content ? <StructuredQuestionContent content={opt.content} /> : <LatexRenderer text={opt.text} />}{opt.imageUrl && <PrivateMediaImage src={opt.imageUrl} alt={opt.imageAlt || `Gambar pilihan ${opt.id.toUpperCase()}`} style={{ display: "block", maxWidth: "100%", maxHeight: 180 }} />}</span>
                          {suffix}
                        </div>
                      );
                    })}
                  </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </DashboardShell>
  );
}

export default function ResultDetailPageWrapper() {
  return (
    <Suspense>
      <ResultDetailPage />
    </Suspense>
  );
}
