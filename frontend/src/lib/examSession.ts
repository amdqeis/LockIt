/**
 * EduQuas Student Exam Session Client Helpers
 * Handles student authentication via cookie, session retrieval, auto-save debounce,
 * periodic heartbeat, browser-only proctoring events, and final submission.
 */

import { apiFetch } from "./apiClient";

// ─── Session Hint (localStorage) ─────────────────────────────────────────────
// Menyimpan informasi non-sensitif sesi aktif di localStorage.
// Digunakan untuk menampilkan UI "Lanjutkan ujian" secara instan tanpa menunggu
// fetch backend. Data ini bukan otoritas autentikasi — hanya sebagai UX hint.

const SESSION_HINT_KEY = "eduquas_active_session";

export interface SessionHint {
  studentName: string;
  studentNisn: string;
  examTitle: string;
  examId: string;
  savedAt: string; // ISO timestamp — untuk invalidasi hint yang terlalu lama
}

/** Simpan hint sesi ke localStorage (client-only). */
export function saveSessionHint(data: Omit<SessionHint, "savedAt">): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      SESSION_HINT_KEY,
      JSON.stringify({ ...data, savedAt: new Date().toISOString() })
    );
  } catch {
    // ignore QuotaExceededError
  }
}

/** Baca hint sesi dari localStorage. Mengembalikan null jika tidak ada atau rusak. */
export function getSessionHint(): SessionHint | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_HINT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SessionHint;
    if (!parsed.examId || !parsed.examTitle) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Hapus hint sesi dari localStorage (setelah submit atau sesi berakhir). */
export function clearSessionHint(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(SESSION_HINT_KEY);
  } catch {
    // ignore
  }
}

// ─── Check Active Session ─────────────────────────────────────────────────────

export interface ActiveSessionCheck {
  isActive: true;
  isLocked: boolean;
  studentId: string;
  studentName: string;
  studentNisn: string;
  examId: string;
  examTitle: string;
  examStatus: string;
  endTime: string | null;
  timeLeftSeconds: number | null;
}

export interface InactiveSessionCheck {
  isActive: false;
  reason: "no_session" | "submitted" | "exam_ended" | "exam_not_started" | "time_expired" | "error";
  studentName?: string;
  studentNisn?: string;
  examTitle?: string;
  showScoreToStudent?: boolean;
  allowAnswerReview?: boolean;
}

export type SessionCheckResult = ActiveSessionCheck | InactiveSessionCheck;

/**
 * Cek apakah ada sesi ujian aktif berdasarkan cookie studentSession.
 * Selalu resolve (tidak throw) — error internal dikembalikan sebagai { isActive: false }.
 */
export async function checkActiveSession(): Promise<SessionCheckResult> {
  try {
    const res = await apiFetch<SessionCheckResult>("/api/exam-session/check");
    if (res.success && res.data) return res.data;
    return { isActive: false, reason: "no_session" };
  } catch {
    return { isActive: false, reason: "error" };
  }
}

export interface ValidateExamResponse {
  exam: {
    title: string;
    status: string;
    durationMinutes: number;
    endTime: string | null;
    serverTime: string;
  };
}

export interface JoinExamResponse {
  nextStep?: "session" | "waiting_room" | string;
  student: {
    id: string;
    name: string;
    nisn: string;
    examId: string;
    status: string;
  };
  exam: {
    id: string;
    title: string;
    description: string | null;
    durationMinutes: number;
    startTime: string | null;
    endTime: string | null;
    serverTime: string;
  };
}

export interface QuestionOption {
  id?: string;
  key?: string;
  label?: string;
  text?: string;
  content?: string;
  value?: string;
}

export interface ExamQuestion {
  id: string;
  orderIndex: number;
  questionText: string;
  imageUrl?: string | null;
  options: any; // string[] | Record<string, string> | QuestionOption[]
  points: number;
  type?: "single_choice" | "multi_select" | "latex";
}

export interface ExamAnswer {
  questionId: string;
  selectedOption: string | null;
  updatedAt: string;
}

export interface ExamSessionData {
  student: {
    id: string;
    name: string;
    nisn: string;
    isLocked: boolean;
    violationCount: number;
  };
  exam: {
    id: string;
    title: string;
    description: string | null;
    durationMinutes: number;
    startTime: string | null;
    endTime: string | null;
    status?: string;
    accessCode?: string;
    settings?: {
      randomize_questions?: boolean;
      randomize_choices?: boolean;
      allow_backtrack?: boolean;
      show_result?: boolean;
    };
    violationPolicy?: {
      max_violations?: number;
      action?: "warning" | "lock";
    };
  };
  questions: ExamQuestion[];
  totalQuestions?: number;
  chunk?: number;
  totalChunks?: number;
  hasMore?: boolean;
  answers: ExamAnswer[];
  serverTime: string;
}

/**
 * Validate exam access code before identity entry
 */
export async function validateExamCode(code: string) {
  return apiFetch<ValidateExamResponse>(`/api/join/validate?code=${encodeURIComponent(code)}`);
}

/**
 * Join exam session with accessCode, full name, and 10-digit NISN
 * Sets studentSession HTTP-only cookie
 */
export async function joinExam(accessCode: string, name: string, nisn: string) {
  return apiFetch<JoinExamResponse>("/api/join", {
    method: "POST",
    body: JSON.stringify({
      accessCode: accessCode.trim().toUpperCase(),
      name: name.trim(),
      nisn: nisn.trim(),
    }),
  });
}

/**
 * Fetch current student active exam session
 * Supports chunked / incremental fetching (?chunk=1, ?chunk=2) for low-latency initialization
 * Restores previous answers if student reconnected
 */
export async function fetchExamSession(options?: { chunk?: number | string; limit?: number; offset?: number }) {
  const params = new URLSearchParams();
  if (options?.chunk !== undefined) params.set("chunk", String(options.chunk));
  if (options?.limit !== undefined) params.set("limit", String(options.limit));
  if (options?.offset !== undefined) params.set("offset", String(options.offset));
  const queryString = params.toString() ? `?${params.toString()}` : "";
  return apiFetch<ExamSessionData>(`/api/exam-session${queryString}`);
}

/**
 * Auto-save student single answer
 */
export async function saveStudentAnswer(questionId: string, selectedOption: string | null) {
  return apiFetch<{ questionId: string; selectedOption: string | null; savedAt: string }>(
    "/api/exam-session/answer",
    {
      method: "POST",
      body: JSON.stringify({ questionId, selectedOption }),
    }
  );
}

/**
 * Send periodic presence heartbeat (10-30s interval)
 */
export async function sendStudentHeartbeat() {
  return apiFetch<{
    studentId: string;
    status: string;
    isLocked: boolean;
    isExamActive: boolean;
    serverTime: string;
    warning?: { id: string; message: string; sentAt: string } | null;
  }>("/api/exam-session/heartbeat", {
    method: "POST",
  });
}

/**
 * Mark student warning as read
 */
export async function markStudentWarningAsRead(warningId: string) {
  return apiFetch<{ warningId: string; isRead: boolean }>(
    `/api/exam-session/warning/${warningId}/read`,
    {
      method: "POST",
    }
  );
}

/**
 * Record browser proctoring event (tab_switch, copy_attempt, paste_attempt, devtools, reconnect)
 */
export async function sendProctoringEvent(eventType: string, metadata?: Record<string, any>) {
  return apiFetch<{
    eventId: string;
    violationCount: number;
    isLocked: boolean;
  }>("/api/proctoring/event", {
    method: "POST",
    body: JSON.stringify({
      eventType,
      timestamp: new Date().toISOString(),
      metadata,
    }),
  });
}

/**
 * Final submit of exam session
 * Clears studentSession cookie and triggers auto-grading
 */
export async function submitStudentExam() {
  return apiFetch<{
    message: string;
    studentId: string;
    submittedAt: string;
    showScoreToStudent?: boolean;
    allowAnswerReview?: boolean;
    score?: number;
  }>("/api/exam-session/submit", {
    method: "POST",
  });
}

export interface LobbyParticipant {
  id: string;
  name: string;
  nisn: string;
  status: string;
  joinedAt: string;
  isSelf?: boolean;
}

export interface LobbyData {
  currentStudent: {
    id: string;
    name: string;
    nisn: string;
    status: string;
    kickReason: string | null;
  };
  exam: {
    id: string;
    title: string;
    accessCode: string;
    durationMinutes: number;
    status: string;
    questionCount: number;
    startTime: string | null;
    endTime: string | null;
    serverTime: string;
  };
  participants: LobbyParticipant[];
  totalParticipants: number;
  canStartExam: boolean;
}

/**
 * Fetch current exam lobby status and list of participants
 */
export async function fetchLobbyStatus() {
  return apiFetch<LobbyData>("/api/exam-session/lobby");
}

export interface ReviewQuestion {
  id: string;
  orderIndex: number;
  type: string;
  questionText: string;
  imageUrl?: string | null;
  options: any;
  points: number;
  studentAnswer: string | null;
  correctAnswer?: string;
  isCorrect?: boolean | null;
}

export interface ExamReviewData {
  exam: {
    id: string;
    title: string;
    durationMinutes: number;
    totalQuestions: number;
  };
  student: {
    id: string;
    name: string;
    nisn: string;
  };
  showScoreToStudent: boolean;
  summary: {
    score: number;
    earnedPoints: number;
    totalPoints: number;
    correctCount: number;
  } | null;
  questions: ReviewQuestion[];
}

/**
 * Fetch exam review data for submitted student
 */
export async function fetchExamReview() {
  return apiFetch<ExamReviewData>("/api/exam-session/review");
}
