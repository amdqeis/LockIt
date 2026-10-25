"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { mockResults, mockQuestions, mockStudentAnswers, mockExams } from "@/lib/mockData";
import DashboardShell from "@/app/components/DashboardShell";

function ResultDetailPage() {
  const params = useParams();
  const exam = mockExams.find(e => e.id === params.id) ?? mockExams[2];
  const result = mockResults.find(r => r.id === params.sid) ?? mockResults[0];

  const getAnswer = (qId: string) => mockStudentAnswers.find(a => a.questionId === qId);

  return (
    <DashboardShell>
      {/* Header */}
      <header style={{
        background: "white", borderBottom: "1px solid #E9ECF0",
        padding: "16px 32px", position: "sticky", top: 0, zIndex: 50
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#9CA3AF" }}>
          <Link href="/dashboard" style={{ color: "#9CA3AF", textDecoration: "none" }}>Dashboard</Link>
          <span>›</span>
          <Link href={`/dashboard/exams/${exam.id}/results`} style={{ color: "#9CA3AF", textDecoration: "none" }}>Hasil Ujian</Link>
          <span>›</span>
          <span style={{ color: "#111827", fontWeight: 500 }}>{result.name}</span>
        </div>
      </header>

      <div style={{ padding: "24px 32px", maxWidth: "900px" }}>
        {/* Student Header Card */}
        <div style={{
          background: "white", borderRadius: "16px", border: "1px solid #E9ECF0",
          padding: "24px", marginBottom: "20px",
          boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
          display: "flex", alignItems: "center", gap: "20px", flexWrap: "wrap"
        }}>
          <div style={{
            width: "56px", height: "56px", borderRadius: "50%",
            background: "linear-gradient(135deg, #2563EB, #1D4ED8)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "white", fontWeight: 800, fontSize: "22px", flexShrink: 0
          }}>
            {result.name.charAt(0)}
          </div>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: "22px", fontWeight: 700, color: "#111827", marginBottom: "4px" }}>{result.name}</h1>
            <div style={{ fontFamily: "monospace", color: "#9CA3AF", fontSize: "14px" }}>{result.nim}</div>
            <div style={{ marginTop: "8px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <span style={{ background: "#DCFCE7", color: "#16A34A", padding: "3px 10px", borderRadius: "100px", fontSize: "12px", fontWeight: 600 }}>
                ✅ {result.correct} benar
              </span>
              <span style={{ background: "#FEE2E2", color: "#DC2626", padding: "3px 10px", borderRadius: "100px", fontSize: "12px", fontWeight: 600 }}>
                ❌ {result.total - result.correct} salah
              </span>
              {result.violations > 0 && (
                <span style={{ background: "#FEF3C7", color: "#D97706", padding: "3px 10px", borderRadius: "100px", fontSize: "12px", fontWeight: 600 }}>
                  ⚠ {result.violations} pelanggaran
                </span>
              )}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{
              fontSize: "52px", fontWeight: 800, lineHeight: 1,
              color: result.score >= 70 ? "#16A34A" : "#DC2626"
            }}>
              {result.score}
              <span style={{ fontSize: "26px", color: "#D1D5DB" }}>/100</span>
            </div>
            <div style={{ fontSize: "13px", color: "#9CA3AF", marginTop: "4px" }}>Submit: {result.submittedAt}</div>
          </div>
        </div>

        {/* Question List */}
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {mockQuestions.map((q) => {
            const studentAns = getAnswer(q.id);
            const isCorrect = studentAns?.selectedAnswer === q.correctAnswer;
            const notAnswered = !studentAns?.selectedAnswer;

            return (
              <div key={q.id} style={{
                background: "white", borderRadius: "14px", border: "1px solid #E9ECF0",
                overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)"
              }}>
                {/* Question Header */}
                <div style={{
                  padding: "14px 20px",
                  background: notAnswered ? "#F8FAFC" : isCorrect ? "#F0FDF4" : "#FFF5F5",
                  borderBottom: "1px solid #E9ECF0",
                  display: "flex", justifyContent: "space-between", alignItems: "center"
                }}>
                  <span style={{ fontSize: "13px", color: "#6B7280", fontWeight: 600 }}>
                    Soal {q.number}
                  </span>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <span style={{ background: "#EFF6FF", color: "#2563EB", padding: "2px 8px", borderRadius: "100px", fontSize: "12px", fontWeight: 600 }}>
                      +{q.points} poin
                    </span>
                    {notAnswered ? (
                      <span style={{ background: "#F3F4F6", color: "#6B7280", padding: "2px 10px", borderRadius: "100px", fontSize: "12px", fontWeight: 600 }}>— Tidak Dijawab</span>
                    ) : isCorrect ? (
                      <span style={{ background: "#DCFCE7", color: "#16A34A", padding: "2px 10px", borderRadius: "100px", fontSize: "12px", fontWeight: 600 }}>✅ Benar</span>
                    ) : (
                      <span style={{ background: "#FEE2E2", color: "#DC2626", padding: "2px 10px", borderRadius: "100px", fontSize: "12px", fontWeight: 600 }}>❌ Salah</span>
                    )}
                  </div>
                </div>

                <div style={{ padding: "16px 20px" }}>
                  <p style={{ fontSize: "15px", color: "#111827", marginBottom: "16px", lineHeight: 1.7 }}>
                    {q.text}
                  </p>

                  {/* Options */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {q.options.map(opt => {
                      const isStudentChoice = studentAns?.selectedAnswer === opt.id;
                      const isCorrectOpt = q.correctAnswer === opt.id;

                      let bg = "transparent";
                      let borderColor = "#E5E7EB";
                      let labelBg = "#F3F4F6";
                      let labelColor = "#374151";
                      let suffix = null;

                      if (isStudentChoice && isCorrect) {
                        bg = "#F0FDF4"; borderColor = "#16A34A";
                        labelBg = "#16A34A"; labelColor = "white";
                        suffix = <span style={{ fontSize: "12px", color: "#16A34A", fontWeight: 600, marginLeft: "auto" }}>✅ Jawaban Kamu (Benar)</span>;
                      } else if (isStudentChoice && !isCorrect) {
                        bg = "#FFF5F5"; borderColor = "#DC2626";
                        labelBg = "#DC2626"; labelColor = "white";
                        suffix = <span style={{ fontSize: "12px", color: "#DC2626", fontWeight: 600, marginLeft: "auto" }}>❌ Jawaban Kamu (Salah)</span>;
                      } else if (!isStudentChoice && isCorrectOpt) {
                        bg = "#F0FDF4"; borderColor = "#16A34A";
                        labelBg = "#16A34A"; labelColor = "white";
                        suffix = <span style={{ fontSize: "12px", color: "#16A34A", fontWeight: 600, marginLeft: "auto" }}>✅ Kunci Jawaban</span>;
                      }

                      return (
                        <div key={opt.id} style={{
                          padding: "10px 14px", borderRadius: "10px",
                          border: `1.5px solid ${borderColor}`,
                          background: bg,
                          display: "flex", gap: "10px", alignItems: "center", fontSize: "14px",
                          transition: "all 0.15s"
                        }}>
                          <span style={{
                            width: "26px", height: "26px", borderRadius: "50%",
                            background: labelBg, color: labelColor,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: "12px", fontWeight: 700, flexShrink: 0
                          }}>
                            {opt.id.toUpperCase()}
                          </span>
                          <span style={{ flex: 1, color: "#374151" }}>{opt.text}</span>
                          {suffix}
                        </div>
                      );
                    })}
                  </div>
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
  return <Suspense><ResultDetailPage /></Suspense>;
}
