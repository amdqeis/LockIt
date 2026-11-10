"use client";

import { useEffect, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { MotionButton } from "@/components/MotionButton";
import { QuestionContent } from "@/components/QuestionContent";
import { optionKey, type Option, type Question } from "@/lib/api";

export type ExamWorkspaceMode = "taking" | "review" | "preview";

export type ExamWorkspaceProps = {
  mode: ExamWorkspaceMode;
  questions: Question[];
  currentIndex: number;
  onSelectIndex: (index: number) => void;
  displayMode?: "one_by_one" | "all_at_once";
  // Props khusus mode 'taking'
  answers?: Record<string, string>;
  onChangeAnswer?: (questionId: string, value: string) => void;
  flagged?: string[];
  onToggleFlag?: (questionId: string) => void;
  disabled?: boolean;
  onOpenSubmit?: () => void;
  // Props khusus mode 'review' & 'preview'
  showScore?: boolean;
  reviewSummary?: {
    score: number;
    earnedPoints?: number;
    totalPoints?: number;
    pendingManualCount?: number;
  } | null;
  sampleNotice?: string;
};

function ArrowIcon({ back = false }: { back?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={back ? "M19 12H5m0 0 6-6m-6 6 6 6" : "M5 12h14m0 0-6-6m6 6-6 6"} />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m4 12 5 5L20 6" />
    </svg>
  );
}

function FlagIcon() {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 21V4m0 1c5-3 8 3 14 0v10c-6 3-9-3-14 0" />
    </svg>
  );
}

function FlagButton({
  flagged,
  disabled,
  onClick,
}: {
  flagged: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <MotionButton
      className="flag-button"
      type="button"
      aria-pressed={flagged}
      disabled={disabled}
      onClick={onClick}
    >
      <FlagIcon />
      {flagged ? "Ditandai" : "Periksa lagi"}
      <span className="flag-switch" aria-hidden="true">
        <motion.span
          initial={false}
          animate={{ x: flagged ? 13 : 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.14 }}
        />
      </span>
    </MotionButton>
  );
}

export function ExamWorkspace({
  mode,
  questions,
  currentIndex,
  onSelectIndex,
  displayMode = "one_by_one",
  answers = {},
  onChangeAnswer,
  flagged = [],
  onToggleFlag,
  disabled = false,
  onOpenSubmit,
  showScore = true,
  sampleNotice,
}: ExamWorkspaceProps) {
  const reduceMotion = useReducedMotion();
  const navigatorRef = useRef<HTMLDivElement>(null);

  // Auto-scroll navigator horizontal pada layar kecil
  useEffect(() => {
    const container = navigatorRef.current;
    if (!container || !window.matchMedia("(max-width: 1023px)").matches) return;
    const current = container.querySelector<HTMLElement>('[aria-current="step"]');
    if (!current) return;
    const left = current.offsetLeft - container.offsetLeft - (container.clientWidth - current.offsetWidth) / 2;
    container.scrollTo({ left, behavior: reduceMotion ? "instant" : "smooth" });
  }, [currentIndex, questions.length, reduceMotion]);

  const answeredCount = questions.filter(
    (q) => (answers[q.id] || q.studentAnswer || "").trim().length > 0
  ).length;
  const markedCount = questions.filter((q) => flagged.includes(q.id)).length;
  const percent = questions.length ? Math.round((answeredCount / questions.length) * 100) : 0;

  const visibleQuestions =
    displayMode === "all_at_once" ? questions : questions.slice(currentIndex, currentIndex + 1);

  return (
    <div className="exam-workspace">
      <section className="exam-content" aria-label="Pengerjaan soal">
        {sampleNotice && (
          <div
            style={{
              padding: "12px 16px",
              marginBottom: 16,
              borderRadius: 10,
              background: "#eee9f8",
              color: "#3d3257",
              fontSize: 13,
              fontWeight: 500,
              lineHeight: 1.5,
            }}
          >
            {sampleNotice}
          </div>
        )}

        <div className="exam-progress">
          <div className="exam-position">
            {displayMode !== "all_at_once" && questions.length > 1 && (
              <MotionButton
                className="question-step"
                aria-label="Soal sebelumnya"
                disabled={currentIndex === 0}
                onClick={() => onSelectIndex(currentIndex - 1)}
              >
                <ArrowIcon back />
              </MotionButton>
            )}
            <strong>
              Soal {currentIndex + 1} dari {questions.length}
            </strong>
            {displayMode !== "all_at_once" && questions.length > 1 && (
              <MotionButton
                className="question-step"
                aria-label="Soal berikutnya"
                disabled={currentIndex === questions.length - 1}
                onClick={() => onSelectIndex(currentIndex + 1)}
              >
                <ArrowIcon />
              </MotionButton>
            )}
          </div>

          {mode === "taking" ? (
            <div className="exam-progress-status">
              <div
                className="progress-track"
                role="progressbar"
                aria-label="Progres soal terisi"
                aria-valuemin={0}
                aria-valuemax={questions.length}
                aria-valuenow={answeredCount}
                aria-valuetext={`${answeredCount} dari ${questions.length} soal terisi`}
              >
                <motion.div
                  className="progress-fill"
                  initial={false}
                  animate={{ scaleX: answeredCount / questions.length }}
                  transition={{ duration: reduceMotion ? 0 : 0.22 }}
                />
              </div>
              <span>
                {answeredCount} dari {questions.length} terisi · {percent}%
              </span>
            </div>
          ) : (
            <div className="exam-progress-status">
              <span>
                {questions.length} soal · {questions.reduce((sum, q) => sum + q.points, 0)} total poin
              </span>
            </div>
          )}

          {mode === "taking" && displayMode !== "all_at_once" && questions[currentIndex] && onToggleFlag && (
            <FlagButton
              flagged={flagged.includes(questions[currentIndex].id)}
              disabled={disabled}
              onClick={() => onToggleFlag(questions[currentIndex].id)}
            />
          )}
        </div>

        <div>
          {visibleQuestions.map((question, offset) => {
            const actualIndex = displayMode === "all_at_once" ? offset : currentIndex;
            const value = answers[question.id] || question.studentAnswer || "";
            const isFlagged = flagged.includes(question.id);

            return (
              <WorkspaceQuestionItem
                key={question.id}
                mode={mode}
                question={question}
                index={actualIndex}
                value={value}
                flagged={isFlagged}
                disabled={disabled}
                toolbarFlag={displayMode !== "all_at_once"}
                showScore={showScore}
                onFlag={onToggleFlag}
                onChange={onChangeAnswer}
              />
            );
          })}
        </div>

        <nav className="question-nav" aria-label="Pindah soal">
          {displayMode !== "all_at_once" && questions.length > 1 && (
            <MotionButton
              className="secondary-button"
              disabled={currentIndex === 0}
              onClick={() => onSelectIndex(Math.max(0, currentIndex - 1))}
            >
              <ArrowIcon back />
              Sebelumnya
            </MotionButton>
          )}

          {displayMode !== "all_at_once" && currentIndex < questions.length - 1 ? (
            <MotionButton className="primary-button" onClick={() => onSelectIndex(currentIndex + 1)}>
              Berikutnya
              <ArrowIcon />
            </MotionButton>
          ) : mode === "taking" && onOpenSubmit ? (
            <MotionButton
              className="primary-button exam-submit"
              disabled={disabled}
              onClick={onOpenSubmit}
            >
              Kumpulkan jawaban
              <ArrowIcon />
            </MotionButton>
          ) : null}
        </nav>
      </section>

      <aside className="exam-navigator" aria-labelledby="navigator-title">
        <div className="navigator-heading">
          <div>
            <h2 id="navigator-title">
              {mode === "taking" ? "Ringkasan soal" : mode === "review" ? "Daftar review" : "Daftar soal"}
            </h2>
            <p>Pilih nomor untuk membuka soal.</p>
          </div>
          <span>{questions.length} soal</span>
        </div>

        {mode === "taking" && (
          <div className="navigator-summary" aria-label="Ringkasan pengerjaan">
            <div>
              <span>Terisi</span>
              <strong>{answeredCount}</strong>
            </div>
            <div>
              <span>Belum diisi</span>
              <strong>{questions.length - answeredCount}</strong>
            </div>
            <div>
              <span>Soal aktif</span>
              <strong>{currentIndex + 1}</strong>
            </div>
            <div>
              <span>Ditandai</span>
              <strong>{markedCount}</strong>
            </div>
          </div>
        )}

        <div className="navigator-grid" ref={navigatorRef} role="navigation" aria-label="Nomor soal">
          {questions.map((question, qIndex) => {
            const isCurrent = currentIndex === qIndex;
            const answered = !!(answers[question.id] || question.studentAnswer || "").trim();
            const marked = flagged.includes(question.id);

            let reviewStatus = "";
            if (mode === "review" && showScore) {
              const earned = question.earnedPoints ?? (question.isCorrect ? question.points : 0);
              const max = question.points;
              const isShort = question.type === "short_answer";
              const isMulti = question.type === "multi_select";
              const isPendingShort = isShort && question.studentAnswer && question.isCorrect === null;
              const isPartial = isMulti && (question.isPartiallyCorrect || (earned > 0 && earned < max));
              const isFull = !isPendingShort && (earned >= max || question.isCorrect === true);

              if (isPendingShort) reviewStatus = "marked";
              else if (isFull) reviewStatus = "answered";
              else if (isPartial) reviewStatus = "marked";
            }

            const itemClass = [
              "navigator-item",
              mode === "taking" && answered ? "answered" : "",
              mode === "taking" && marked ? "marked" : "",
              mode === "review" && reviewStatus ? reviewStatus : "",
              isCurrent ? "current" : "",
            ]
              .filter(Boolean)
              .join(" ");

            return (
              <MotionButton
                key={question.id}
                type="button"
                className={itemClass}
                aria-current={isCurrent ? "step" : undefined}
                aria-label={`Soal ${qIndex + 1}${isCurrent ? ", sedang dibuka" : ""}`}
                onClick={() => onSelectIndex(qIndex)}
              >
                <span>{qIndex + 1}</span>
                {mode === "taking" && (
                  <span className="navigator-icons">
                    {answered && <CheckIcon />}
                    {marked && <FlagIcon />}
                  </span>
                )}
              </MotionButton>
            );
          })}
        </div>

        {mode === "taking" && (
          <>
            <div className="navigator-legend" aria-label="Keterangan status soal">
              <span>
                <i className="legend-current" />
                Sedang dibuka
              </span>
              <span>
                <i className="legend-answered" />
                Terisi
              </span>
              <span>
                <i className="legend-empty" />
                Belum diisi
              </span>
              <span>
                <i className="legend-marked" />
                Periksa lagi
              </span>
            </div>

            {answeredCount < questions.length && (
              <div className="navigator-review">
                <div>
                  <strong>Masih ada soal belum diisi</strong>
                  <p>Periksa {questions.length - answeredCount} soal sebelum mengumpulkan.</p>
                </div>
                <MotionButton
                  className="secondary-button"
                  onClick={() =>
                    onSelectIndex(
                      questions.findIndex(
                        (q) => !(answers[q.id] || q.studentAnswer || "").trim()
                      )
                    )
                  }
                >
                  Lihat soal belum diisi
                </MotionButton>
              </div>
            )}
          </>
        )}

        {mode === "review" && showScore && (
          <div className="navigator-legend" aria-label="Keterangan review">
            <span>
              <i className="legend-current" />
              Sedang dibuka
            </span>
            <span>
              <i className="legend-answered" />
              Jawaban benar
            </span>
            <span>
              <i className="legend-marked" />
              Sebagian / menunggu
            </span>
            <span>
              <i className="legend-empty" />
              Belum benar
            </span>
          </div>
        )}
      </aside>
    </div>
  );
}

function WorkspaceQuestionItem({
  mode,
  question,
  index,
  value,
  flagged,
  disabled,
  toolbarFlag,
  showScore,
  onFlag,
  onChange,
}: {
  mode: ExamWorkspaceMode;
  question: Question;
  index: number;
  value: string;
  flagged: boolean;
  disabled: boolean;
  toolbarFlag: boolean;
  showScore: boolean;
  onFlag?: (id: string) => void;
  onChange?: (id: string, value: string) => void;
}) {
  const multiple = question.type === "multi_select";
  const reduceMotion = useReducedMotion();

  // Detail skor untuk mode review
  const earned = question.earnedPoints ?? (question.isCorrect ? question.points : 0);
  const max = question.points;
  const isShort = question.type === "short_answer";
  const isPendingShort = isShort && question.studentAnswer && question.isCorrect === null;
  const isPartial = multiple && (question.isPartiallyCorrect || (earned > 0 && earned < max));
  const isFull = !isPendingShort && (earned >= max || question.isCorrect === true);

  let statusText = "Jawaban belum benar";
  let statusColor = "#b3261e";
  if (isPendingShort) {
    statusText = "Menunggu penilaian guru";
    statusColor = "#785800";
  } else if (isPartial) {
    statusText = "Jawaban sebagian benar";
    statusColor = "#785800";
  } else if (isFull) {
    statusText = "Jawaban benar";
    statusColor = "#17643d";
  }

  return (
    <article
      className="exam-question"
      id={`question-item-${question.id}`}
      tabIndex={-1}
      aria-labelledby={`question-${question.id}`}
    >
      <div className="question-heading">
        <span>
          Soal {index + 1} · {question.points} poin
          {mode === "review" && showScore && (
            <strong style={{ marginLeft: 8, color: statusColor }}>
              (Perolehan: {isPendingShort ? "—" : earned} / {max} poin)
            </strong>
          )}
        </span>
        {mode === "taking" && !toolbarFlag && onFlag && (
          <FlagButton flagged={flagged} disabled={disabled} onClick={() => onFlag(question.id)} />
        )}
      </div>

      <div className="question-prompt" id={`question-${question.id}`}>
        <QuestionContent
          content={question.content}
          text={question.questionText}
          imageUrl={question.imageUrl}
          imageAlt={question.imageAlt}
        />
      </div>

      {mode === "taking" ? (
        question.type === "short_answer" ? (
          <label className="short-answer">
            Jawaban Anda
            <textarea
              value={value}
              maxLength={2000}
              disabled={disabled}
              onChange={(e) => onChange?.(question.id, e.target.value)}
            />
          </label>
        ) : (
          <fieldset className="choices" disabled={disabled}>
            <legend>{multiple ? "Pilih semua jawaban yang sesuai" : "Pilih satu jawaban"}</legend>
            {(question.options || []).map((option, optionIndex) => {
              const key = optionKey(option, optionIndex);
              const item = typeof option === "string" ? { text: option } : (option as Option);
              const selected = value.toUpperCase().split(",").includes(key);

              return (
                <motion.label
                  whileTap={disabled || reduceMotion ? undefined : { scale: 0.99 }}
                  transition={{ duration: 0.14 }}
                  className={`choice${selected ? " selected" : ""}`}
                  key={`${key}-${optionIndex}`}
                >
                  <input
                    type={multiple ? "checkbox" : "radio"}
                    name={`choice-${question.id}`}
                    checked={selected}
                    onChange={() => {
                      if (!onChange) return;
                      if (!multiple) {
                        onChange(question.id, key);
                        return;
                      }
                      const next = new Set(value ? value.toUpperCase().split(",") : []);
                      if (next.has(key)) next.delete(key);
                      else next.add(key);
                      onChange(question.id, [...next].sort().join(","));
                    }}
                  />
                  <QuestionContent
                    content={item.content}
                    text={item.text}
                    imageUrl={item.imageUrl}
                    imageAlt={item.imageAlt}
                  />
                </motion.label>
              );
            })}
          </fieldset>
        )
      ) : mode === "review" ? (
        <div>
          {question.type === "short_answer" ? (
            <div style={{ display: "grid", gap: 8, fontSize: 14 }}>
              <p style={{ margin: 0 }}>
                Jawaban peserta: <strong>{value || "Belum dijawab"}</strong>
              </p>
              {showScore && (
                <p style={{ margin: 0, color: statusColor, fontWeight: 600 }}>
                  {statusText}
                </p>
              )}
            </div>
          ) : (
            <div className="choices">
              {(question.options || []).map((option, optionIndex) => {
                const key = optionKey(option, optionIndex);
                const item = typeof option === "string" ? { text: option } : (option as Option);
                const selected = value.toUpperCase().split(",").includes(key);
                const isCorrectOption =
                  showScore &&
                  Boolean(question.correctAnswer) &&
                  (question.correctAnswer || "").toUpperCase().split(",").includes(key);

                let badge = "";
                if (selected && isCorrectOption) badge = "Jawaban peserta · Kunci benar";
                else if (selected) badge = "Jawaban peserta";
                else if (isCorrectOption) badge = "Kunci jawaban";

                return (
                  <div
                    key={`${key}-${optionIndex}`}
                    className={`choice${selected ? " selected" : ""}`}
                    style={{
                      cursor: "default",
                      borderColor: isCorrectOption ? "#17643d" : undefined,
                      background: isCorrectOption ? "#f0fdf4" : undefined,
                    }}
                  >
                    <input
                      type={multiple ? "checkbox" : "radio"}
                      checked={selected}
                      disabled
                      readOnly
                    />
                    <div>
                      <QuestionContent
                        content={item.content}
                        text={item.text}
                        imageUrl={item.imageUrl}
                        imageAlt={item.imageAlt}
                      />
                      {badge && (
                        <span
                          style={{
                            display: "inline-block",
                            marginTop: 6,
                            fontSize: 12,
                            fontWeight: 600,
                            color: isCorrectOption ? "#17643d" : "#52515b",
                          }}
                        >
                          {badge}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* mode === "preview" */
        <div>
          {question.type === "short_answer" ? (
            <div style={{ display: "grid", gap: 6, fontSize: 14 }}>
              <p style={{ margin: 0, color: "var(--muted)" }}>Jawaban singkat</p>
              {question.correctAnswer && (
                <p style={{ margin: 0 }}>
                  Kunci jawaban: <strong>{question.correctAnswer}</strong>
                </p>
              )}
            </div>
          ) : (
            <div className="choices">
              {(question.options || []).map((option, optionIndex) => {
                const key = optionKey(option, optionIndex);
                const item = typeof option === "string" ? { text: option } : (option as Option);
                const isCorrect =
                  Boolean(question.correctAnswer) &&
                  (question.correctAnswer || "").toUpperCase().split(",").includes(key);

                return (
                  <div
                    key={`${key}-${optionIndex}`}
                    className={`choice${isCorrect ? " selected" : ""}`}
                    style={{
                      cursor: "default",
                      borderColor: isCorrect ? "#17643d" : undefined,
                      background: isCorrect ? "#f0fdf4" : undefined,
                    }}
                  >
                    <input
                      type={multiple ? "checkbox" : "radio"}
                      checked={isCorrect}
                      disabled
                      readOnly
                    />
                    <div>
                      <QuestionContent
                        content={item.content}
                        text={item.text}
                        imageUrl={item.imageUrl}
                        imageAlt={item.imageAlt}
                      />
                      {isCorrect && (
                        <span
                          style={{
                            display: "inline-block",
                            marginTop: 6,
                            fontSize: 12,
                            fontWeight: 600,
                            color: "#17643d",
                          }}
                        >
                          Kunci jawaban
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </article>
  );
}

