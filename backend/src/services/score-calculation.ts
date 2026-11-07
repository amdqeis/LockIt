export type ScoredQuestion = { id: string; type: string; points: number };
export type ScoredAnswer = { questionId: string; selectedOption: string | null; isCorrect: boolean | null };

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
    if (answer?.isCorrect === true) { earnedPoints += question.points; correctCount++; }
    if (question.type === "short_answer" && answer?.selectedOption?.trim() && answer.isCorrect === null) pendingManualCount++;
  }
  return { totalPoints, earnedPoints, correctCount, pendingManualCount, finalScore: totalPoints ? Math.round(earnedPoints / totalPoints * 1000) / 10 : 0 };
}
