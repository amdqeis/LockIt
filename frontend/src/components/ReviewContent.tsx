"use client";

import { optionKey, type Option, type Question } from "@/lib/api";
import { QuestionContent } from "./QuestionContent";

export type Review = { exam: { title: string }; showScoreToStudent: boolean; summary: { score: number; pendingManualCount: number } | null; questions: Question[] };

export function ReviewContent({ review }: { review: Review }) {
  return <div className="review">
    {review.showScoreToStudent && review.summary && <p className="review-summary">Nilai <strong>{review.summary.score}</strong>{review.summary.pendingManualCount > 0 && " · Sebagian jawaban menunggu penilaian guru"}</p>}
    {review.questions.map((q, index) => <article className="review-question" key={q.id}><h3>Soal {index + 1}</h3><QuestionContent content={q.content} text={q.questionText} imageUrl={q.imageUrl} imageAlt={q.imageAlt} />
      {q.type !== "short_answer" && <ul className="review-options">{(q.options || []).map((option, optionIndex) => { const key = optionKey(option, optionIndex); const value = typeof option === "string" ? { text: option } : option as Option; const selected = (q.studentAnswer || "").toUpperCase().split(",").includes(key); const correct = review.showScoreToStudent && (q.correctAnswer || "").toUpperCase().split(",").includes(key); return <li key={key}><QuestionContent content={value.content} text={value.text} imageUrl={value.imageUrl} imageAlt={value.imageAlt} />{(selected || correct) && <span className="answer-mark">{selected && "Jawaban Anda"}{selected && correct && " · "}{correct && "Jawaban benar"}</span>}</li>; })}</ul>}
      {q.type === "short_answer" && <p className="review-answer">Jawaban Anda: <strong>{q.studentAnswer || "Belum dijawab"}</strong>{review.showScoreToStudent && q.studentAnswer && q.isCorrect === null && <span> · Menunggu penilaian guru</span>}</p>}
      {review.showScoreToStudent && q.type !== "short_answer" && q.correctAnswer && <p className="review-answer">{q.isCorrect ? "Jawaban benar" : "Jawaban belum benar"}</p>}
    </article>)}
  </div>;
}
