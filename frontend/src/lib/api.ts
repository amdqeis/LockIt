export class ApiError extends Error {
  constructor(message: string, public code = "", public status = 0) { super(message); }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try { response = await fetch(path, { ...options, credentials: "include", cache: "no-store" }); }
  catch { throw new ApiError("Tidak dapat terhubung. Periksa koneksi Anda.", "NETWORK_ERROR"); }
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.success) throw new ApiError(body?.error?.message || "Permintaan tidak dapat diproses.", body?.error?.code || "", response.status);
  return body.data as T;
}

export function post<T>(path: string, body?: unknown): Promise<T> {
  return api<T>(path, { method: "POST", ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }) });
}

export type Option = { id?: string; label?: string; text?: string; content?: unknown; imageUrl?: string | null; imageAlt?: string | null };
export type Question = { id: string; orderIndex: number; type: string; questionText: string; content?: unknown; imageUrl?: string | null; imageAlt?: string | null; options: (Option | string)[]; points: number; earnedPoints?: number | null; isPartiallyCorrect?: boolean; studentAnswer?: string | null; correctAnswer?: string | null; isCorrect?: boolean | null };
export type Waiting = {
  student: {
    id: string;
    name: string;
    nisn: string;
    status: string;
    isLocked: boolean;
    violationCount?: number;
    violationCycleCount?: number;
    recoveryRequired?: boolean;
    kickReason?: string | null;
    latestAdmissionAction?: { reason: string | null } | null;
  };
  exam: {
    id: string;
    title: string;
    accessCode: string;
    status: string;
    durationMinutes: number;
    startTime: string | null;
    endTime: string | null;
    serverTime: string;
  };
  violationCount?: number;
  violationCycleCount?: number;
  recoveryRequired?: boolean;
};

export type ExamSession = {
  student: {
    id: string;
    name: string;
    nisn: string;
    isLocked: boolean;
    violationCount?: number;
    violationCycleCount?: number;
    recoveryRequired?: boolean;
  };
  exam: {
    id: string;
    title: string;
    description?: string | null;
    endTime: string | null;
    settings: {
      display_mode?: "one_by_one" | "all_at_once";
      question_selection?: {
        mode: "manual" | "random_once" | "random_per_student";
        count?: number;
      };
      [key: string]: unknown;
    };
    violationPolicy: Record<string, unknown>;
  };
  questions: Question[];
  totalQuestions: number;
  hasMore: boolean;
  answers: { questionId: string; selectedOption: string | null }[];
  serverTime: string;
  violationCount?: number;
  violationCycleCount?: number;
  recoveryRequired?: boolean;
};

export function optionKey(option: Option | string, index: number): string {
  if (typeof option === "string") return String.fromCharCode(65 + index);
  return String(option.label || option.id || String.fromCharCode(65 + index)).trim().toUpperCase();
}

export function socketOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_BACKEND_URL;
  if (configured) return configured.replace(/\/api\/?$/, "").replace(/\/$/, "");
  if (typeof window === "undefined") return "";
  return ["localhost", "127.0.0.1"].includes(window.location.hostname) ? `${window.location.protocol}//${window.location.hostname}:3001` : window.location.origin;
}
