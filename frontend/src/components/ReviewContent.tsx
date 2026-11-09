"use client";

import { optionKey, type Option, type Question } from "@/lib/api";
import { QuestionContent } from "./QuestionContent";

export type Review = {
  exam: { title: string };
  showScoreToStudent: boolean;
  summary: {
    score: number;
    earnedPoints?: number;
    totalPoints?: number;
    pendingManualCount: number;
  } | null;
  questions: Question[];
};

export function ReviewContent({ review }: { review: Review }) {
  return (
    <div className="review">
      {review.showScoreToStudent && review.summary && (
        <p className="review-summary">
          Nilai <strong>{review.summary.score}</strong>
          {review.summary.earnedPoints !== undefined && review.summary.totalPoints !== undefined && (
            <span> · Poin: {review.summary.earnedPoints} / {review.summary.totalPoints}</span>
          )}
          {review.summary.pendingManualCount > 0 && " · Sebagian jawaban menunggu penilaian guru"}
        </p>
      )}
      {review.questions.map((q, index) => {
        const earned = q.earnedPoints ?? (q.isCorrect ? q.points : 0);
        const max = q.points;
        const isShortAnswer = q.type === "short_answer";
        const isMultiSelect = q.type === "multi_select";
        const isPendingShortAnswer = isShortAnswer && q.studentAnswer && q.isCorrect === null;
        const isPartial = isMultiSelect && (q.isPartiallyCorrect || (earned > 0 && earned < max));
        const isFull = !isPendingShortAnswer && (earned >= max || q.isCorrect === true);

        let statusText = "Jawaban belum benar";
        let statusClass = "review-status-incorrect";

        if (isPendingShortAnswer) {
          statusText = "Menunggu penilaian guru";
          statusClass = "review-status-pending";
        } else if (isPartial) {
          statusText = "Jawaban sebagian benar";
          statusClass = "review-status-partial";
        } else if (isFull) {
          statusText = "Jawaban benar";
          statusClass = "review-status-correct";
        }

        return (
          <article className="review-question" key={q.id}>
            <div className="review-question-header">
              <h3>Soal {index + 1}</h3>
              {review.showScoreToStudent && (
                <span className="review-point-pill">
                  Poin: {isPendingShortAnswer ? `— / ${max}` : `${earned} / ${max}`}
                </span>
              )}
            </div>

            <QuestionContent content={q.content} text={q.questionText} imageUrl={q.imageUrl} imageAlt={q.imageAlt} />

            {q.type !== "short_answer" && (
              <ul className="review-options">
                {(q.options || []).map((option, optionIndex) => {
                  const key = optionKey(option, optionIndex);
                  const value = typeof option === "string" ? { text: option } : (option as Option);
                  const selected = (q.studentAnswer || "").toUpperCase().split(",").includes(key);
                  const correct = review.showScoreToStudent && (q.correctAnswer || "").toUpperCase().split(",").includes(key);
                  return (
                    <li key={key}>
                      <QuestionContent content={value.content} text={value.text} imageUrl={value.imageUrl} imageAlt={value.imageAlt} />
                      {(selected || correct) && (
                        <span className="answer-mark">
                          {selected && "Jawaban Anda"}
                          {selected && correct && " · "}
                          {correct && "Jawaban benar"}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            {q.type === "short_answer" && (
              <p className="review-answer">
                Jawaban Anda: <strong>{q.studentAnswer || "Belum dijawab"}</strong>
                {review.showScoreToStudent && (
                  <> · <span className={statusClass}>{statusText}</span></>
                )}
              </p>
            )}

            {review.showScoreToStudent && q.type !== "short_answer" && (
              <p className="review-answer">
                <span className={statusClass}>{statusText}</span> · Poin diperoleh: <strong>{earned}</strong> dari {max}
              </p>
            )}
          </article>
        );
      })}
    </div>
  );
}
