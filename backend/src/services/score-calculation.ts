export type ScoredQuestion = {
  id: string;
  type: string;
  points: number;
  correctAnswer?: string | null;
  options?: unknown;
};

export type ScoredAnswer = {
  questionId: string;
  selectedOption: string | null;
  isCorrect: boolean | null;
};

export type QuestionScoreResult = {
  earnedPoints: number;
  maxPoints: number;
  percentage: number;
  isFullCorrect: boolean;
  isPartiallyCorrect: boolean;
  pendingManual: boolean;
};

export function parseOptionsList(options: unknown): unknown[] {
  if (Array.isArray(options)) return options;
  if (typeof options === "string") {
    try {
      const parsed = JSON.parse(options);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Hitung nilai parsial untuk multi_select:
 * Rumus: max(0, (opsi_benar_dipilih / x * 100) - (opsi_salah_dipilih / n * 100))
 * x: jumlah opsi benar
 * n: jumlah seluruh opsi
 * Jika x atau n nol, nilai soal 0.
 * Persentase ini menjadi bagian dari bobot poin soal (earnedPoints = (percentage / 100) * questionPoints).
 */
export function calculateMultiSelectScore(
  selectedOption: string | null | undefined,
  correctAnswer: string | null | undefined,
  options: unknown,
  questionPoints: number
): {
  earnedPoints: number;
  percentage: number;
  isFullCorrect: boolean;
  isPartiallyCorrect: boolean;
} {
  const correctKeys = new Set(
    (correctAnswer || "")
      .split(",")
      .map(s => s.trim().toUpperCase())
      .filter(Boolean)
  );
  const x = correctKeys.size;
  const optionsList = parseOptionsList(options);
  const n = optionsList.length;

  if (x === 0 || n === 0 || questionPoints <= 0) {
    return {
      earnedPoints: 0,
      percentage: 0,
      isFullCorrect: false,
      isPartiallyCorrect: false,
    };
  }

  const selectedKeys = new Set(
    (selectedOption || "")
      .split(",")
      .map(s => s.trim().toUpperCase())
      .filter(Boolean)
  );

  let correctSelected = 0;
  let wrongSelected = 0;

  for (const key of selectedKeys) {
    if (correctKeys.has(key)) {
      correctSelected++;
    } else {
      wrongSelected++;
    }
  }

  const rawPercentage = (correctSelected / x * 100) - (wrongSelected / n * 100);
  const percentage = Math.max(0, Math.min(100, Math.round(rawPercentage * 100) / 100));
  const earnedPoints = Math.max(0, Math.min(questionPoints, Math.round(((percentage / 100) * questionPoints) * 100) / 100));

  const isFullCorrect = percentage >= 100;
  const isPartiallyCorrect = percentage > 0 && percentage < 100;

  return {
    earnedPoints,
    percentage,
    isFullCorrect,
    isPartiallyCorrect,
  };
}

export function calculateQuestionScore(
  question: ScoredQuestion,
  answer: ScoredAnswer | null | undefined
): QuestionScoreResult {
  const maxPoints = question.points ?? 0;
  if (maxPoints <= 0) {
    return {
      earnedPoints: 0,
      maxPoints: 0,
      percentage: 0,
      isFullCorrect: false,
      isPartiallyCorrect: false,
      pendingManual: false,
    };
  }

  if (question.type === "multi_select") {
    if (question.correctAnswer !== undefined && question.correctAnswer !== null) {
      const multi = calculateMultiSelectScore(
        answer?.selectedOption,
        question.correctAnswer,
        question.options,
        maxPoints
      );
      return {
        earnedPoints: multi.earnedPoints,
        maxPoints,
        percentage: multi.percentage,
        isFullCorrect: multi.isFullCorrect,
        isPartiallyCorrect: multi.isPartiallyCorrect,
        pendingManual: false,
      };
    }
    const isFull = answer?.isCorrect === true;
    return {
      earnedPoints: isFull ? maxPoints : 0,
      maxPoints,
      percentage: isFull ? 100 : 0,
      isFullCorrect: isFull,
      isPartiallyCorrect: false,
      pendingManual: false,
    };
  }

  if (question.type === "single_choice") {
    if (question.correctAnswer !== undefined && question.correctAnswer !== null) {
      const studentChoice = answer?.selectedOption?.trim().toUpperCase() || "";
      const correctChoice = question.correctAnswer.trim().toUpperCase();
      const isCorrect = studentChoice.length > 0 && studentChoice === correctChoice;
      return {
        earnedPoints: isCorrect ? maxPoints : 0,
        maxPoints,
        percentage: isCorrect ? 100 : 0,
        isFullCorrect: isCorrect,
        isPartiallyCorrect: false,
        pendingManual: false,
      };
    }
    const isCorrect = answer?.isCorrect === true;
    return {
      earnedPoints: isCorrect ? maxPoints : 0,
      maxPoints,
      percentage: isCorrect ? 100 : 0,
      isFullCorrect: isCorrect,
      isPartiallyCorrect: false,
      pendingManual: false,
    };
  }

  if (question.type === "short_answer") {
    const isPending = !!(answer?.selectedOption?.trim() && answer.isCorrect === null);
    const isCorrect = answer?.isCorrect === true;
    return {
      earnedPoints: isCorrect ? maxPoints : 0,
      maxPoints,
      percentage: isCorrect ? 100 : 0,
      isFullCorrect: isCorrect,
      isPartiallyCorrect: false,
      pendingManual: isPending,
    };
  }

  const isCorrect = answer?.isCorrect === true;
  return {
    earnedPoints: isCorrect ? maxPoints : 0,
    maxPoints,
    percentage: isCorrect ? 100 : 0,
    isFullCorrect: isCorrect,
    isPartiallyCorrect: false,
    pendingManual: false,
  };
}

/** Jawaban singkat yang terisi tetapi belum diperiksa menghasilkan nilai sementara. */
export function calculateScore(questions: ScoredQuestion[], answers: ScoredAnswer[]) {
  const byQuestion = new Map(answers.map(answer => [answer.questionId, answer]));
  let totalPoints = 0;
  let earnedPoints = 0;
  let correctCount = 0;
  let pendingManualCount = 0;

  for (const question of questions) {
    totalPoints += question.points;
    const answer = byQuestion.get(question.id);
    const qScore = calculateQuestionScore(question, answer);

    earnedPoints += qScore.earnedPoints;
    if (qScore.isFullCorrect) correctCount++;
    if (qScore.pendingManual) pendingManualCount++;
  }

  const roundedEarnedPoints = Math.round(earnedPoints * 100) / 100;
  const finalScore = totalPoints ? Math.round((roundedEarnedPoints / totalPoints) * 1000) / 10 : 0;

  return {
    totalPoints,
    earnedPoints: roundedEarnedPoints,
    correctCount,
    pendingManualCount,
    finalScore,
  };
}
