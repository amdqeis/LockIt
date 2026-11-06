"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchExamReview, ExamReviewData, ReviewQuestion } from "@/lib/examSession";
import LatexRenderer from "@/app/components/LatexRenderer";

export default function ExamReviewPage() {
  const [data, setData] = useState<ExamReviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    fetchExamReview()
      .then((res) => {
        if (!isMounted) return;
        if (res.success && res.data) {
          setData(res.data);
        } else {
          setErrorMsg(res.error?.message || "Tidak dapat memuat data review ujian.");
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setErrorMsg("Terjadi kesalahan saat memuat lembar review ujian.");
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div style={{
        minHeight: "100vh",
        background: "#F8FAFC",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Poppins, sans-serif",
      }}>
        <div style={{
          width: "48px",
          height: "48px",
          borderRadius: "50%",
          border: "4px solid #E2E8F0",
          borderTopColor: "#1B76BF",
          animation: "spin 1s linear infinite",
        }} />
        <p style={{ marginTop: "16px", color: "#64748B", fontSize: "14px" }}>
          Memuat lembar review jawaban...
        </p>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (errorMsg || !data) {
    return (
      <div style={{
        minHeight: "100vh",
        background: "#F8FAFC",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        fontFamily: "Poppins, sans-serif",
      }}>
        <div style={{
          width: "100%",
          maxWidth: "440px",
          background: "white",
          borderRadius: "16px",
          border: "1.5px solid #FCA5A5",
          padding: "32px 24px",
          textAlign: "center",
          boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
        }}>
          <div style={{
            width: "56px",
            height: "56px",
            borderRadius: "50%",
            background: "#FEF2F2",
            color: "#DC2626",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "24px",
            margin: "0 auto 16px",
          }}>
            ⚠️
          </div>
          <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#1E293B", marginBottom: "8px" }}>
            Akses Review Ditolak
          </h2>
          <p style={{ fontSize: "13px", color: "#64748B", lineHeight: 1.6, marginBottom: "24px" }}>
            {errorMsg || "Anda tidak memiliki izin untuk melihat review jawaban pada ujian ini."}
          </p>
          <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
            <Link
              href="/exam/done"
              style={{
                padding: "10px 18px",
                borderRadius: "8px",
                background: "#1B76BF",
                color: "white",
                fontSize: "13px",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Kembali ke Halaman Selesai
            </Link>
            <Link
              href="/"
              style={{
                padding: "10px 18px",
                borderRadius: "8px",
                background: "#F1F5F9",
                color: "#475569",
                fontSize: "13px",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Beranda
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { exam, student, showScoreToStudent, summary, questions } = data;

  return (
    <div style={{
      minHeight: "100vh",
      background: "#F8FAFC",
      fontFamily: "Poppins, sans-serif",
      paddingBottom: "60px",
    }}>
      {/* Brand Tri-Color Top Stripe */}
      <div style={{
        height: "4px",
        background: "linear-gradient(90deg, #1B76BF 0%, #4DA8DA 35%, #F59E0B 70%, #E4472B 100%)",
        width: "100%",
      }} />

      {/* Sticky Header */}
      <header style={{
        background: "white",
        borderBottom: "1.5px solid #E2E8F0",
        position: "sticky",
        top: 0,
        zIndex: 40,
        boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
      }}>
        <div style={{
          maxWidth: "1000px",
          margin: "0 auto",
          padding: "14px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "12px",
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "#64748B" }}>
              <span style={{ fontWeight: 700, color: "#1B76BF" }}>EduQuas</span>
              <span>›</span>
              <span>Review Jawaban Ujian</span>
            </div>
            <h1 style={{ fontSize: "18px", fontWeight: 700, color: "#0F172A", margin: "2px 0 0" }}>
              {exam.title}
            </h1>
            <div style={{ fontSize: "12px", color: "#64748B", marginTop: "2px" }}>
              Peserta: <strong>{student.name}</strong> • NISN: <span style={{ fontFamily: "monospace" }}>{student.nisn}</span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {showScoreToStudent && summary && (
              <div style={{
                background: "linear-gradient(135deg, #E0F2FE, #BAE6FD)",
                padding: "8px 16px",
                borderRadius: "10px",
                border: "1.5px solid #7DD3FC",
                textAlign: "right",
              }}>
                <div style={{ fontSize: "10px", fontWeight: 700, color: "#0369A1", textTransform: "uppercase" }}>
                  Skor Anda
                </div>
                <div style={{ fontSize: "20px", fontWeight: 800, color: "#0284C7", lineHeight: 1.1 }}>
                  {summary.score} <span style={{ fontSize: "12px", fontWeight: 600 }}>/ 100</span>
                </div>
              </div>
            )}
            <Link
              href="/exam/done"
              style={{
                padding: "8px 16px",
                borderRadius: "8px",
                border: "1.5px solid #CBD5E1",
                background: "white",
                color: "#334155",
                fontSize: "13px",
                fontWeight: 600,
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              ← Selesai
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main style={{ maxWidth: "1000px", margin: "24px auto 0", padding: "0 20px" }}>
        {/* KPI / Security Status Banner */}
        {showScoreToStudent && summary ? (
          <div style={{
            background: "white",
            border: "1.5px solid #E2E8F0",
            borderRadius: "14px",
            padding: "16px 20px",
            marginBottom: "24px",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "16px",
            boxShadow: "0 2px 6px rgba(0,0,0,0.02)",
          }}>
            <div>
              <div style={{ fontSize: "11px", color: "#64748B", fontWeight: 600, textTransform: "uppercase" }}>Total Butir Soal</div>
              <div style={{ fontSize: "22px", fontWeight: 800, color: "#0F172A", marginTop: "2px" }}>{questions.length}</div>
            </div>
            <div>
              <div style={{ fontSize: "11px", color: "#64748B", fontWeight: 600, textTransform: "uppercase" }}>Jawaban Benar (Otomatis)</div>
              <div style={{ fontSize: "22px", fontWeight: 800, color: "#16A34A", marginTop: "2px" }}>{summary.correctCount}</div>
            </div>
            <div>
              <div style={{ fontSize: "11px", color: "#64748B", fontWeight: 600, textTransform: "uppercase" }}>Poin Diperoleh</div>
              <div style={{ fontSize: "22px", fontWeight: 800, color: "#0284C7", marginTop: "2px" }}>
                {summary.earnedPoints} <span style={{ fontSize: "14px", color: "#64748B", fontWeight: 500 }}>/ {summary.totalPoints}</span>
              </div>
            </div>
          </div>
        ) : (
          <div style={{
            background: "#FFFBEB",
            border: "1.5px solid #FDE68A",
            borderRadius: "14px",
            padding: "16px 20px",
            marginBottom: "24px",
            display: "flex",
            alignItems: "flex-start",
            gap: "12px",
          }}>
            <span style={{ fontSize: "20px" }}>🔒</span>
            <div>
              <div style={{ fontSize: "14px", fontWeight: 700, color: "#92400E" }}>
                Kunci Jawaban & Skor Dirahasiakan oleh Pengawas
              </div>
              <div style={{ fontSize: "13px", color: "#B45309", marginTop: "3px", lineHeight: 1.6 }}>
                Guru/pengawas mengatur agar kunci jawaban dan skor akhir tidak ditampilkan. Di bawah ini adalah rekaman jawaban yang telah Anda kumpulkan untuk setiap butir soal.
              </div>
            </div>
          </div>
        )}

        {/* Questions List */}
        <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          {questions.map((q, idx) => {
            const hasAnswer = !!q.studentAnswer && q.studentAnswer.trim().length > 0;
            const isShortAnswer = q.type === "short_answer";
            const isCorrect = q.isCorrect;

            let cardHeaderBg = "#F8FAFC";
            if (showScoreToStudent) {
              if (isShortAnswer) cardHeaderBg = "#F0FDFA";
              else if (hasAnswer && isCorrect) cardHeaderBg = "#F0FDF4";
              else if (hasAnswer && !isCorrect) cardHeaderBg = "#FEF2F2";
            }

            return (
              <div
                key={q.id || idx}
                style={{
                  background: "white",
                  borderRadius: "14px",
                  border: "1.5px solid #E2E8F0",
                  overflow: "hidden",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.03)",
                }}
              >
                {/* Header Card */}
                <div style={{
                  padding: "12px 20px",
                  background: cardHeaderBg,
                  borderBottom: "1px solid #E2E8F0",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "8px",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontWeight: 700, fontSize: "14px", color: "#1E293B" }}>
                      Soal #{q.orderIndex || idx + 1}
                    </span>
                    <span style={{
                      fontSize: "11px",
                      fontWeight: 600,
                      padding: "2px 8px",
                      borderRadius: "6px",
                      background: isShortAnswer ? "#CCFBF1" : q.type === "multi_select" ? "#FEF3C7" : "#E0F2FE",
                      color: isShortAnswer ? "#0F766E" : q.type === "multi_select" ? "#92400E" : "#0369A1",
                    }}>
                      {isShortAnswer ? "✍️ Jawaban Singkat" : q.type === "multi_select" ? "☑️ Multi-Pilih" : "🔘 Pilihan Ganda"}
                    </span>
                    <span style={{ fontSize: "12px", color: "#64748B" }}>
                      ({q.points} poin)
                    </span>
                  </div>

                  <div>
                    {showScoreToStudent ? (
                      isShortAnswer ? (
                        <span style={{
                          background: hasAnswer ? "#CCFBF1" : "#F1F5F9",
                          color: hasAnswer ? "#0F766E" : "#64748B",
                          fontSize: "12px",
                          fontWeight: 600,
                          padding: "3px 10px",
                          borderRadius: "99px",
                        }}>
                          {hasAnswer ? "✍️ Dinilai Manual" : "— Tidak Dijawab"}
                        </span>
                      ) : !hasAnswer ? (
                        <span style={{
                          background: "#F1F5F9",
                          color: "#64748B",
                          fontSize: "12px",
                          fontWeight: 600,
                          padding: "3px 10px",
                          borderRadius: "99px",
                        }}>
                          — Tidak Dijawab
                        </span>
                      ) : isCorrect ? (
                        <span style={{
                          background: "#DCFCE7",
                          color: "#16A34A",
                          fontSize: "12px",
                          fontWeight: 700,
                          padding: "3px 10px",
                          borderRadius: "99px",
                        }}>
                          ✅ Benar
                        </span>
                      ) : (
                        <span style={{
                          background: "#FEE2E2",
                          color: "#DC2626",
                          fontSize: "12px",
                          fontWeight: 700,
                          padding: "3px 10px",
                          borderRadius: "99px",
                        }}>
                          ❌ Salah
                        </span>
                      )
                    ) : (
                      <span style={{
                        background: hasAnswer ? "#E0F2FE" : "#F1F5F9",
                        color: hasAnswer ? "#0369A1" : "#64748B",
                        fontSize: "12px",
                        fontWeight: 600,
                        padding: "3px 10px",
                        borderRadius: "99px",
                      }}>
                        {hasAnswer ? "✓ Terjawab" : "— Tidak Dijawab"}
                      </span>
                    )}
                  </div>
                </div>

                {/* Body Card */}
                <div style={{ padding: "18px 20px" }}>
                  {/* Question Text */}
                  <div style={{ fontSize: "15px", color: "#0F172A", lineHeight: 1.7, marginBottom: "16px" }}>
                    <LatexRenderer text={q.questionText} block />
                  </div>

                  {/* Question Image */}
                  {q.imageUrl && (
                    <div style={{ marginBottom: "16px" }}>
                      <img
                        src={q.imageUrl}
                        alt="Lampiran Soal"
                        loading="lazy"
                        decoding="async"
                        style={{ maxWidth: "100%", maxHeight: "260px", objectFit: "contain", borderRadius: "8px", border: "1px solid #E2E8F0" }}
                      />
                    </div>
                  )}

                  {/* Answer Section */}
                  {isShortAnswer ? (
                    <div style={{ marginTop: "12px" }}>
                      <div style={{ fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "6px" }}>
                        Jawaban Teks yang Dikumpulkan:
                      </div>
                      <div style={{
                        padding: "12px 16px",
                        borderRadius: "8px",
                        border: "1.5px solid #CBD5E1",
                        background: hasAnswer ? "#F8FAFC" : "#F1F5F9",
                        color: hasAnswer ? "#0F172A" : "#94A3B8",
                        fontSize: "14px",
                        lineHeight: 1.6,
                        whiteSpace: "pre-wrap",
                        fontStyle: hasAnswer ? "normal" : "italic",
                      }}>
                        {hasAnswer ? q.studentAnswer : "(Anda tidak mengisi jawaban untuk soal ini)"}
                      </div>
                      <div style={{ fontSize: "12px", color: "#64748B", marginTop: "4px" }}>
                        ℹ️ Soal jawaban singkat dinilai secara manual oleh pengawas.
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "12px" }}>
                      {Array.isArray(q.options) && q.options.map((opt: any, optIdx: number) => {
                        const optId = (opt.id || opt.key || opt.label || String.fromCharCode(97 + optIdx)).toLowerCase();
                        const optLabel = (opt.label || opt.id || String.fromCharCode(65 + optIdx)).toUpperCase();
                        const optText = opt.text || "";

                        const studentChoices = (q.studentAnswer || "").split(",").map((s: string) => s.trim().toLowerCase());
                        const isStudentChoice = studentChoices.includes(optId);

                        let bg = "#FFFFFF";
                        let borderColor = "#E2E8F0";
                        let tagLabel: React.ReactNode = null;

                        if (showScoreToStudent) {
                          const correctChoices = (q.correctAnswer || "").split(",").map((s: string) => s.trim().toLowerCase());
                          const isCorrectOpt = correctChoices.includes(optId);

                          if (isStudentChoice && isCorrectOpt) {
                            bg = "#F0FDF4";
                            borderColor = "#16A34A";
                            tagLabel = (
                              <span style={{ fontSize: "12px", fontWeight: 700, color: "#16A34A", marginLeft: "auto" }}>
                                ✅ Pilihan Anda (Benar)
                              </span>
                            );
                          } else if (isStudentChoice && !isCorrectOpt) {
                            bg = "#FEF2F2";
                            borderColor = "#DC2626";
                            tagLabel = (
                              <span style={{ fontSize: "12px", fontWeight: 700, color: "#DC2626", marginLeft: "auto" }}>
                                ❌ Pilihan Anda (Salah)
                              </span>
                            );
                          } else if (!isStudentChoice && isCorrectOpt) {
                            bg = "#F0FDF4";
                            borderColor = "#16A34A";
                            tagLabel = (
                              <span style={{ fontSize: "12px", fontWeight: 700, color: "#16A34A", marginLeft: "auto" }}>
                                ✓ Kunci Jawaban
                              </span>
                            );
                          }
                        } else {
                          // Secret score mode: only highlight student choice without right/wrong hints
                          if (isStudentChoice) {
                            bg = "#E0F2FE";
                            borderColor = "#0284C7";
                            tagLabel = (
                              <span style={{ fontSize: "12px", fontWeight: 700, color: "#0369A1", marginLeft: "auto" }}>
                                🔘 Jawaban Anda
                              </span>
                            );
                          }
                        }

                        return (
                          <div
                            key={optId}
                            style={{
                              padding: "10px 14px",
                              borderRadius: "8px",
                              border: `1.5px solid ${borderColor}`,
                              background: bg,
                              display: "flex",
                              alignItems: "center",
                              gap: "10px",
                              fontSize: "14px",
                              transition: "all 0.15s",
                            }}
                          >
                            <span style={{
                              width: "24px",
                              height: "24px",
                              borderRadius: "50%",
                              background: isStudentChoice ? (showScoreToStudent ? (isCorrect ? "#16A34A" : "#DC2626") : "#0284C7") : "#F1F5F9",
                              color: isStudentChoice ? "white" : "#475569",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontWeight: 700,
                              fontSize: "11px",
                              flexShrink: 0,
                            }}>
                              {optLabel}
                            </span>
                            <div style={{ flex: 1, color: "#1E293B" }}>
                              <LatexRenderer text={optText} />
                            </div>
                            {tagLabel}
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

        {/* Footer Back Button */}
        <div style={{ marginTop: "32px", textAlign: "center" }}>
          <Link
            href="/exam/done"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "12px 24px",
              borderRadius: "10px",
              background: "#1B76BF",
              color: "white",
              fontSize: "14px",
              fontWeight: 600,
              textDecoration: "none",
              boxShadow: "0 4px 12px rgba(27, 118, 191, 0.25)",
            }}
          >
            ← Kembali ke Halaman Selesai Ujian
          </Link>
        </div>
      </main>
    </div>
  );
}
