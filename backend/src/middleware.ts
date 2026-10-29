import { NextRequest, NextResponse } from "next/server";

/**
 * LOW-02: Request ID middleware — inject X-Request-ID ke semua API request & response.
 *
 * Cara kerja:
 * - Jika client sudah menyertakan X-Request-ID (mis. dari reverse proxy/load balancer), pakai itu.
 * - Jika tidak ada, generate UUID baru.
 * - Forward ke request (agar route handler bisa baca via req.headers.get("x-request-id"))
 * - Set ke response header (agar client/browser bisa trace di DevTools / Sentry)
 *
 * Di route handler, akses dengan:
 *   const log = createRequestLogger(req.headers.get("x-request-id") ?? undefined);
 *   // X-Request-ID di response sudah di-set otomatis oleh middleware ini.
 */
export function middleware(req: NextRequest) {
  const existingId = req.headers.get("x-request-id");
  const requestId = existingId ?? crypto.randomUUID();

  // Clone request headers dan tambahkan request ID
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-request-id", requestId);

  // Teruskan request dengan header yang sudah ditambahkan
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // Set di response header agar client bisa trace
  response.headers.set("X-Request-ID", requestId);

  return response;
}

export const config = {
  // Hanya berlaku untuk API routes — hindari overhead di static assets
  matcher: "/api/:path*",
};
