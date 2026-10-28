/**
 * LOW-02: Structured logging utility dengan request ID.
 * Setiap request mendapat ID unik (prefix req_ + 8 hex chars) yang bisa dilacak
 * dari log masuk hingga response keluar.
 *
 * Tujuan: memudahkan tracing bug di production tanpa perlu full APM.
 *
 * Cara pakai di route handler:
 *   const log = createRequestLogger();
 *   log.info("Memulai proses login", { email });
 *   log.error("Gagal query DB", { err: err.message });
 *   // requestId tersedia di log.requestId untuk disertakan di response header
 */

import crypto from "crypto";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  level: LogLevel;
  requestId: string;
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
}

function generateRequestId(): string {
  return "req_" + crypto.randomBytes(4).toString("hex");
}

function formatEntry(entry: LogEntry): string {
  const ctx = entry.context ? ` ${JSON.stringify(entry.context)}` : "";
  return `[${entry.timestamp}] [${entry.level.toUpperCase()}] [${entry.requestId}] ${entry.message}${ctx}`;
}

function writeLog(entry: LogEntry) {
  const formatted = formatEntry(entry);
  if (entry.level === "error" || entry.level === "warn") {
    console.error(formatted);
  } else if (process.env.NODE_ENV !== "production" || entry.level !== "debug") {
    console.log(formatted);
  }
}

export interface RequestLogger {
  requestId: string;
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}

/**
 * Buat logger baru untuk satu request.
 * Panggil di awal handler, gunakan requestId di response header X-Request-ID.
 *
 * @param requestId - Optional: pakai requestId dari luar (misalnya dari header X-Request-ID masuk).
 *                    Jika kosong, akan di-generate otomatis.
 */
export function createRequestLogger(requestId?: string): RequestLogger {
  const id = requestId ?? generateRequestId();

  function log(level: LogLevel, message: string, context?: Record<string, unknown>) {
    writeLog({
      level,
      requestId: id,
      message,
      timestamp: new Date().toISOString(),
      context,
    });
  }

  return {
    requestId: id,
    debug: (msg, ctx) => log("debug", msg, ctx),
    info: (msg, ctx) => log("info", msg, ctx),
    warn: (msg, ctx) => log("warn", msg, ctx),
    error: (msg, ctx) => log("error", msg, ctx),
  };
}

/**
 * Logger global untuk dipakai di luar request context (misalnya scheduler, boot sequence).
 */
export const logger = {
  debug(message: string, context?: Record<string, unknown>) {
    if (process.env.NODE_ENV !== "production") {
      console.log(formatEntry({ level: "debug", requestId: "system", message, timestamp: new Date().toISOString(), context }));
    }
  },
  info(message: string, context?: Record<string, unknown>) {
    console.log(formatEntry({ level: "info", requestId: "system", message, timestamp: new Date().toISOString(), context }));
  },
  warn(message: string, context?: Record<string, unknown>) {
    console.error(formatEntry({ level: "warn", requestId: "system", message, timestamp: new Date().toISOString(), context }));
  },
  error(message: string, context?: Record<string, unknown>) {
    console.error(formatEntry({ level: "error", requestId: "system", message, timestamp: new Date().toISOString(), context }));
  },
};
