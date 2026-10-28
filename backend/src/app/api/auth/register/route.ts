import { NextRequest } from "next/server";
import { errorResponse } from "@/lib/response";

// ─── REGISTRASI MANDIRI DINONAKTIFKAN ─────────────────────────────────────────
// Akun guru hanya dapat dibuat oleh Administrator.
// Endpoint ini sengaja ditutup untuk mencegah pendaftaran yang tidak sah.
// Implementasi Admin CRUD akan membuka pembuatan akun via: POST /api/admin/teachers
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(_req: NextRequest) {
  return errorResponse(
    "REGISTRATION_DISABLED",
    "Pendaftaran mandiri tidak diizinkan. Akun guru hanya dapat dibuat oleh Administrator. Hubungi admin institusi Anda.",
    403
  );
}

