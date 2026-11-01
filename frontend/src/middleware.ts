import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Route-route yang hanya bisa diakses ADMIN
const ADMIN_ROUTES = ["/dashboard/admin"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Redirect guru yang sudah login saat mengakses "/" langsung ke /dashboard
  const hasTeacherSession =
    req.cookies.get("hasTeacherSession")?.value === "1" ||
    req.cookies.get("eduquas_teacher_session")?.value === "active" ||
    Boolean(req.cookies.get("refreshToken")?.value);

  if (pathname === "/") {
    if (hasTeacherSession) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    return NextResponse.next();
  }

  // 2. Protect all /dashboard routes — cek sesi teacher
  if (pathname.startsWith("/dashboard")) {
    if (!hasTeacherSession) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // 2. Guard route Admin — decode JWT dari cookie accessToken untuk cek role
  // Di edge runtime kita tidak bisa verify signature, tapi role di payload cukup
  // untuk redirect awal; backend tetap enforce via requireAdmin() middleware.
  if (ADMIN_ROUTES.some((r) => pathname.startsWith(r))) {
    const accessToken = req.cookies.get("accessToken")?.value;
    if (accessToken) {
      try {
        // Decode tanpa verify (edge runtime — verifikasi sebenarnya ada di backend)
        const payloadB64 = accessToken.split(".")[1];
        if (payloadB64) {
          const decoded = JSON.parse(
            Buffer.from(payloadB64, "base64url").toString("utf8")
          );
          if (decoded.role !== "ADMIN") {
            return NextResponse.redirect(new URL("/dashboard", req.url));
          }
        }
      } catch {
        // Jika decode gagal, biarkan backend yang reject
      }
    }
    // Jika tidak ada accessToken (akan refresh) — biarkan request lanjut,
    // backend tetap enforce via requireAdmin()
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/"],
};
