import path from "path";
/** An explicit directory allows isolated integration tests without touching real uploads. */
export function questionBankMediaDirectory() {
  return process.env.EDUQUAS_QUESTION_MEDIA_DIR || path.join(process.cwd(), "storage", "question-bank");
}
