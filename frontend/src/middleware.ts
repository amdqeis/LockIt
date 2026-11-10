import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/") {
    // 1. Jika sudah login sebagai guru/admin, langsung forward ke dashboard
    const hasTeacherSession = request.cookies.get("hasTeacherSession")?.value === "1";
    if (hasTeacherSession) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    // 2. Jika siswa di tengah melakukan ujian, langsung forward ke pengerjaan ujian
    const studentSession = request.cookies.get("studentSession")?.value;
    if (studentSession) {
      try {
        const backendUrl = process.env.INTERNAL_BACKEND_URL || "http://127.0.0.1:3001";
        const response = await fetch(`${backendUrl}/api/exam-session/waiting`, {
          headers: {
            cookie: `studentSession=${studentSession}`,
          },
          cache: "no-store",
          signal: AbortSignal.timeout(1200),
        });

        if (response.ok) {
          const body = await response.json();
          const student = body?.data?.student;
          const exam = body?.data?.exam;
          const isExamEnded = Boolean(exam?.endTime && Date.parse(exam.endTime) <= Date.now());

          if (
            student &&
            exam &&
            ["active", "disconnected"].includes(student.status) &&
            exam.status === "active" &&
            !isExamEnded
          ) {
            return NextResponse.redirect(new URL("/exam/session", request.url));
          }
        }
      } catch {
        // Fallback jika backend internal tidak dapat dihubungi dari edge middleware
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/"],
};

