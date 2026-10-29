/**
 * EduQuas Student Exam Session Client Helpers
 * Handles student authentication via cookie, session retrieval, auto-save debounce,
 * periodic heartbeat, browser-only proctoring events, and final submission.
 */

import { apiFetch } from "./apiClient";

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
      allow_backtrack?: boolean;
      show_result?: boolean;
    };
    violationPolicy?: {
      max_violations?: number;
      action?: "warning" | "lock";
    };
  };
  questions: ExamQuestion[];
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
 * Restores previous answers if student reconnected
 */
export async function fetchExamSession() {
  return apiFetch<ExamSessionData>("/api/exam-session");
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
  }>("/api/exam-session/heartbeat", {
    method: "POST",
  });
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
  }>("/api/exam-session/submit", {
    method: "POST",
  });
}
