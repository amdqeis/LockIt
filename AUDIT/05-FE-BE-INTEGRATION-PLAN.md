# 🔗 Rencana Integrasi Frontend ↔ Backend — LockIt

> **Tanggal Dibuat:** 28 Oktober 2026
> **Terakhir Direvisi:** 28 Oktober 2026 — Rev 1.2 (NISN reconnect, FlagKey scope, validate-code backend spec)
> **Status:** Planning — Siap Dieksekusi
> **Dasar:** Hasil audit `02-FRONTEND-AUDIT.md` · `03-BACKEND-AUDIT.md`

---

## 📋 Keputusan yang Sudah Dibuat (Resolved)

| ID | Keputusan | Hasil |
|----|-----------|-------|
| **D-01** | Validasi kode ujian dari halaman `/` | ✅ **Tambah `GET /api/join/validate?code=ABC123` di backend** |
| **D-02** | Mapping FlagKey FE ↔ EventType BE | ✅ **Resolved — lihat §2.4** |
| **D-03** | NIM vs NISN sebagai ID siswa | ✅ **Ganti NIM → NISN** (Prisma migration + semua route + grading) |
| **D-04** | Token storage guru | ✅ **In-memory React context** |
| **D-05** | Proxy vs CORS di dev | ✅ **Next.js rewrites proxy** |
| **D-06** | FlagKey cakupan | ✅ **Hanya kecurangan berbasis perilaku browser — TANPA kamera/deteksi wajah** |
| **D-07** | NISN sebagai kunci reconnect | ✅ **NISN dipakai untuk resume sesi yang terputus, jawaban ter-restore** |

---

## ⚠️ Kebijakan Proctoring — Wajib Dibaca

> **LockIt TIDAK menggunakan kamera, deteksi wajah, deteksi jumlah wajah, atau deteksi benda fisik.**
>
> Proctoring sepenuhnya berbasis **perilaku browser** yang mengindikasikan potensi kecurangan:
> pindah tab, buka DevTools, copy/paste, koneksi terputus, dsb.
>
> Flag yang tampil di dashboard guru **bukan** "kamera mati" atau "luar frame" — melainkan
> indikator perilaku yang bisa diverifikasi browser.

---

## 1. Ringkasan Situasi Saat Ini

### 1.1 State Frontend

Frontend LockIt adalah **full mockup** — semua data berasal dari `frontend/src/lib/mockData.ts`.
Tidak ada satu pun API call ke backend yang berjalan.

### 1.2 State Backend

Backend API sudah **lengkap dan production-ready**, kecuali:
- Kolom masih `nim` (perlu migration ke `nisn`)
- `GET /api/join/validate` belum ada (perlu dibuat)

### 1.3 Gap Backend yang Harus Ditutup di Sprint I-1

| Gap | File | Aksi |
|-----|------|------|
| Kolom `nim` di schema | `prisma/schema.prisma` | Migration rename → `nisn` |
| `generateStudentSessionToken` param `nim` | `src/lib/auth.ts` | Ganti ke `nisn` |
| `joinSchema` memakai `nim` | `src/app/api/join/route.ts` | Ganti ke `nisn` + validasi 10 digit |
| `StudentScoreSummary.nim` | `src/services/grading.ts` | Ganti ke `nisn` di interface + return |
| `GET /api/join/validate` belum ada | — | Buat file baru |
| Reconnect tidak update `name` | `src/app/api/join/route.ts` | Tambahkan `name` ke update data |
| Reconnect ProctoringEvent hanya jika IP beda | `src/app/api/join/route.ts` | Catat selalu |

---

## 2. Keputusan Arsitektur Penting

### 2.1 NIM → NISN (Nomor Induk Siswa Nasional)

**Validasi NISN:** 10 digit angka (format standar NISN Indonesia)
```typescript
nisn: z.string()
  .regex(/^\d{10}$/, "NISN harus 10 digit angka")
  .trim()
```

**File backend yang harus diubah:**

| File | Field yang berubah |
|------|--------------------|
| `prisma/schema.prisma` | `nim String` → `nisn String`; `@@unique([examId, nim])` → `@@unique([examId, nisn])` |
| `src/app/api/join/route.ts` | schema, unique query key `examId_nim` → `examId_nisn`, log, response, reconnect update |
| `src/lib/auth.ts` | `StudentTokenPayload.nim` → `nisn`; `generateStudentSessionToken` param |
| `src/app/api/exam-session/route.ts` | shuffle seed: `student.nim` → `student.nisn` |
| `src/services/grading.ts` | `StudentScoreSummary.nim` → `nisn`; semua return object di 3 fungsi |

**File frontend yang harus diubah:**

| File | Perubahan |
|------|-----------|
| `join/identity/page.tsx` | Label "NIM" → "NISN", validasi format, info reconnect |
| `exam/session/page.tsx` | Display nama + NISN |
| `mockData.ts` | Field `nim` → `nisn` di semua mock student |

### 2.2 NISN sebagai Kunci Reconnect (Saving Progress — D-07)

NISN berfungsi sebagai **kunci resume sesi** jika siswa terputus (reload, koneksi drop, browser crash).

**Flow reconnect:**
```
Siswa reload / koneksi terputus
  → Buka kembali halaman /
  → Masukkan kode ujian yang sama
  → GET /api/join/validate → ujian masih active
  → Redirect ke /join/identity?code=...
  → Isi nama + NISN yang SAMA
  → POST /api/join { accessCode, name, nisn }
  → Backend: findUnique({ examId_nisn })
    → Student ditemukan + status != "submitted"
    → Update name, sessionToken baru, status → "active"
    → Catat ProctoringEvent type "reconnect" (SELALU, bukan hanya jika IP beda)
    → Return student + exam
  → Frontend: GET /api/exam-session
    → answers[] berisi jawaban yang sudah tersimpan sebelumnya
    → Timer = exam.endTime - serverTime (sisa waktu)
    → Jawaban lama ter-restore otomatis
```

**Aturan reconnect di `join/route.ts`:**
- `student.status === "submitted"` → **403 ALREADY_SUBMITTED** (tidak boleh reconnect)
- `student.status === "waiting" | "active" | "disconnected"` → izinkan reconnect
- **Selalu update `name`** saat reconnect (siswa mungkin salah ketik nama sebelumnya)
- **Selalu catat ProctoringEvent `reconnect`** — `ipChanged: true/false` sebagai metadata

### 2.3 Endpoint Baru: GET /api/join/validate

**Spec:**
```typescript
// Path: backend/src/app/api/join/validate/route.ts

// Response 200:
{ success: true, data: { exam: { title, status, durationMinutes, endTime, serverTime } } }

// Error codes:
// 400 MISSING_CODE    — query param `code` tidak ada atau < 4 karakter
// 404 EXAM_NOT_FOUND  — kode tidak ditemukan
// 409 EXAM_NOT_STARTED — status "draft"
// 410 EXAM_ENDED      — status "ended" | "archived" | endTime sudah lewat

// Rate limit: 10x per 5 menit per IP (lebih longgar dari POST /join)
// Tidak expose: teacherId, accessCode internal, jumlah siswa
```

**Implementasi:**
```typescript
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, errorResponse } from "@/lib/response";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { createRequestLogger } from "@/lib/logger";

export async function GET(req: NextRequest) {
  const log = createRequestLogger(req.headers.get("x-request-id") ?? undefined);
  try {
    const clientIp = getClientIp(req.headers);
    const rateLimit = checkRateLimit(clientIp, {
      windowMs: 5 * 60 * 1000,
      max: 10,
      keyPrefix: "join:validate",
    });
    if (!rateLimit.success) {
      return errorResponse("TOO_MANY_REQUESTS", "Terlalu banyak percobaan.", 429,
        { retryAfter: rateLimit.retryAfterSeconds });
    }

    const code = req.nextUrl.searchParams.get("code");
    if (!code || code.trim().length < 4) {
      return errorResponse("MISSING_CODE", "Parameter kode ujian wajib diisi", 400);
    }

    const exam = await prisma.exam.findFirst({
      where: { accessCode: { equals: code.trim().toUpperCase() } },
      select: { id: true, title: true, status: true, durationMinutes: true, endTime: true },
    });

    if (!exam) return errorResponse("EXAM_NOT_FOUND", "Kode ujian tidak ditemukan", 404);
    if (exam.status === "draft") return errorResponse("EXAM_NOT_STARTED", "Ujian belum dibuka oleh pengawas", 409);
    if (exam.status === "ended" || exam.status === "archived") return errorResponse("EXAM_ENDED", "Ujian telah berakhir", 410);

    const now = new Date();
    if (exam.endTime && now > exam.endTime) return errorResponse("EXAM_TIME_EXPIRED", "Waktu ujian telah berakhir", 410);

    log.info("Validate code success", { examId: exam.id });
    return successResponse({
      exam: {
        title: exam.title,
        status: exam.status,
        durationMinutes: exam.durationMinutes,
        endTime: exam.endTime?.toISOString() ?? null,
        serverTime: now.toISOString(),
      },
    });
  } catch (err: any) {
    log.error("Validate code error", { err });
    return errorResponse("INTERNAL_SERVER_ERROR", "Gagal memvalidasi kode ujian", 500);
  }
}
```

### 2.4 FlagKey — Hanya Deteksi Kecurangan Berbasis Perilaku Browser

> ❌ **Tidak ada:** kamera, deteksi wajah, multiple faces, deteksi benda fisik.
> ✅ **Yang dideteksi:** tindakan browser yang bisa dimanipulasi untuk menyontek.

**4 FlagKey (menggantikan camera_off/out_of_frame/multiple_people):**
```typescript
export type FlagKey =
  | "tab_switch"    // ← tab_switch + window_blur + fullscreen_exit + fullscreen_denied
  | "copy_paste"    // ← copy_attempt + paste_attempt
  | "devtools"      // ← devtools
  | "reconnect"     // ← reconnect + heartbeat_lost (IP change / dropout)

const FLAG_LABELS: Record<FlagKey, string> = {
  tab_switch: "Pindah Tab",
  copy_paste:  "Copy/Paste",
  devtools:    "Buka DevTools",
  reconnect:   "Terputus/IP Change",
};
```

**Tabel event → flag:**

| Aksi Siswa | EventType (Prisma) | FlagKey di dashboard |
|------------|-------------------|----------------------|
| Ctrl+C / klik kanan copy | `copy_attempt` | `copy_paste` |
| Ctrl+V | `paste_attempt` | `copy_paste` |
| Klik kanan | `right_click` | — (dicatat, tidak dihitung) |
| Pindah tab / alt-tab | `tab_switch` | `tab_switch` |
| Window kehilangan fokus | `window_blur` | `tab_switch` |
| Keluar fullscreen | `fullscreen_exit` | `tab_switch` |
| Fullscreen ditolak | `fullscreen_denied` | `tab_switch` |
| Buka DevTools | `devtools` | `devtools` |
| Reconnect / reload / IP berubah | `reconnect` | `reconnect` |
| Tidak ada heartbeat >30 detik | `heartbeat_lost` | `reconnect` |

**Mapping function (di `proctoring.ts`):**
```typescript
function eventTypeToFlagKey(eventType: EventType): FlagKey | null {
  switch (eventType) {
    case "tab_switch": case "window_blur":
    case "fullscreen_exit": case "fullscreen_denied":
      return "tab_switch";
    case "copy_attempt": case "paste_attempt":
      return "copy_paste";
    case "devtools":
      return "devtools";
    case "reconnect": case "heartbeat_lost":
      return "reconnect";
    default: return null;  // right_click → null (noise)
  }
}
```

---

## 3. Arsitektur Target Setelah Integrasi

### 3.1 Auth Flow Guru

```
FE: /login → POST /api/auth/login { email, password }
           ← { accessToken } + cookie: refreshToken (httpOnly, 7d)
           Simpan accessToken di memory (React context — bukan localStorage)

Silent refresh: accessToken expired (15m)
  → POST /api/auth/refresh ← cookie
  ← { accessToken baru } atau 401 → redirect /login
```

### 3.2 Auth Flow Siswa + NISN Reconnect

```
FE: /  → GET /api/join/validate?code=ABC123
       ← { exam: { title, status, durationMinutes, endTime, serverTime } }

Redirect /join/identity?code=ABC123
  Form: nama + NISN (10 digit)
  POST /api/join { accessCode, name, nisn }
  ← { student: { id, name, nisn }, exam } + cookie: studentSession (httpOnly)

  [RECONNECT: siswa reload/terputus]
  POST /api/join dengan NISN yang SAMA
  → findUnique({ examId_nisn }) → student ditemukan
  → update name, sessionToken, status → active
  → catat ProctoringEvent "reconnect" (selalu)
  → cookie studentSession diperbarui

Redirect /exam/waiting → /exam/session
  GET /api/exam-session ← cookie
  ← { student, exam, questions, answers[], serverTime }

  Timer = exam.endTime - serverTime (server-authoritative)
  answers[] → restore jawaban sebelumnya (NISN reconnect benefit)

  Auto-save: POST /api/exam-session/answer { questionId, selectedOption }
  Heartbeat (15s): POST /api/exam-session/heartbeat
  Proctoring: POST /api/proctoring { eventType, durationMs?, metadata? }
  Submit: POST /api/exam-session/submit → clear cookie → redirect /exam/done
```

### 3.3 Dashboard Guru — Live Strip

```
GET /api/exams/[id]/dashboard (polling 30 detik)
← { overview, recentEvents: [{ eventType, ... }] }

recentEvents → eventTypeToFlagKey() → flags:
  { tab_switch: 3, copy_paste: 1, devtools: 0, reconnect: 2 }
  (BUKAN camera_off, out_of_frame, multiple_people)
```

---

## 4. Komponen Baru (Frontend)

| File | Fungsi |
|------|--------|
| `src/lib/apiClient.ts` | HTTP client + Bearer + silent refresh 401 |
| `src/contexts/AuthContext.tsx` | React context auth state guru |
| `src/lib/auth.ts` | `useTeacherAuth()` hook, login/logout |
| `src/lib/examSession.ts` | Helpers: fetch, saveAnswer, heartbeat, submit, proctoring |
| `src/lib/proctoring.ts` | Browser event listeners + `eventTypeToFlagKey()` |
| `src/middleware.ts` | Route guard `/dashboard/**` |
| `.env.local` | `NEXT_PUBLIC_BACKEND_URL=http://localhost:3000` |

**`proctoring.ts` — listeners yang diimplementasi (HANYA browser API):**
```typescript
// ✅ Diimplementasi:
document.addEventListener('visibilitychange') → tab_switch
window.addEventListener('blur') → window_blur
document.addEventListener('fullscreenchange') → fullscreen_exit
document.addEventListener('copy') → copy_attempt
document.addEventListener('paste') → paste_attempt
document.addEventListener('contextmenu') → right_click
// DevTools detection via window size heuristic / debugger timing

// ❌ TIDAK diimplementasi:
// Webcam / MediaStream
// Deteksi wajah (Face API, TensorFlow.js face)
// Deteksi jumlah wajah (multiple faces)
// Deteksi benda fisik (phone, paper)
```

---

## 5. Rencana Sprint Integrasi

### ✅ Pre-condition (sebelum Sprint I-1)
- [ ] Fix 5 halaman Suspense wrapper (FE-MED-01) — `next build` harus clean
- [ ] Setup proxy di `frontend/next.config.ts` (lihat §6)
- [ ] Buat `frontend/.env.local`

---

### 🎯 Sprint I-1: Backend — NISN Migration + Endpoint Baru (1 hari)

#### I-1.1 Prisma Migration NIM → NISN

```bash
npx prisma migrate dev --name rename-nim-to-nisn
```

**`prisma/schema.prisma`:**
```diff
- nim  String
+ nisn String
- @@unique([examId, nim])
+ @@unique([examId, nisn])
```

**`src/app/api/join/route.ts`:**
```diff
- nim: z.string().min(3).max(30).trim(),
+ nisn: z.string().regex(/^\d{10}$/, "NISN harus 10 digit angka").trim(),

- const { accessCode, name, nim } = parsed.data;
+ const { accessCode, name, nisn } = parsed.data;

- where: { examId_nim: { examId: exam.id, nim } }
+ where: { examId_nisn: { examId: exam.id, nisn } }

  // Reconnect — tambah update name + catat reconnect selalu:
  student = await prisma.student.update({
    where: { id: student.id },
    data: {
+     name,           // update nama saat reconnect
      sessionTokenHash: hashStudentToken(freshToken),
      status: "active", ipAddress: clientIp, userAgent,
    },
  });

  await prisma.proctoringEvent.create({
    data: {
      studentId: student.id, examId: exam.id, eventType: "reconnect",
      metadata: {
        newIp: clientIp, oldIp: previousIp ?? null,
        ipChanged: !!previousIp && previousIp !== clientIp,
-       reason: "rejoined_with_code",  // PINDAHKAN metadata ini
+       reason: "rejoined_with_code",  // catat SELALU, bukan hanya jika ipChanged
      },
    },
  });
```

**`src/lib/auth.ts`:**
```diff
  export interface StudentTokenPayload {
    studentId: string; examId: string;
-   nim: string;
+   nisn: string;
    timestamp: number;
  }
  export function generateStudentSessionToken(
-   data: { studentId: string; examId: string; nim: string }
+   data: { studentId: string; examId: string; nisn: string }
  ): string
```

**`src/app/api/exam-session/route.ts`:**
```diff
- pseudoRandomShuffle(questions, student.nim, exam.id)
+ pseudoRandomShuffle(questions, student.nisn, exam.id)
```

**`src/services/grading.ts`:**
```diff
  export interface StudentScoreSummary {
    studentId: string; name: string;
-   nim: string;
+   nisn: string;
    ...
  }
  // Dan di semua return object (3 fungsi):
-   nim: student.nim,
+   nisn: student.nisn,
```

**Checklist I-1.1:**
- [ ] Update `prisma/schema.prisma`
- [ ] Jalankan migration
- [ ] Update `src/app/api/join/route.ts`
- [ ] Update `src/lib/auth.ts`
- [ ] Update `src/app/api/exam-session/route.ts`
- [ ] Update `src/services/grading.ts`
- [ ] Verifikasi: join dengan NISN 10 digit berhasil; reconnect catat event; reconnect update nama

#### I-1.2 Buat `GET /api/join/validate` Endpoint

- [ ] Buat `src/app/api/join/validate/route.ts` sesuai spec §2.3
- [ ] Verifikasi: AKTIF → 200; DRAFT → 409; INVALID → 404; ENDED → 410; rate limit berfungsi

**✅ DoD Sprint I-1:** NISN di DB; validate endpoint live; semua test manual lulus.

---

### 🎯 Sprint I-2: Auth Guru Frontend (1-2 hari)

- [ ] **I-2.1** Buat `apiClient.ts` — fetch wrapper + Bearer + silent refresh 401
- [ ] **I-2.2** Buat `AuthContext.tsx` + `auth.ts` — `useTeacherAuth()`, login/logout, auto-refresh
- [ ] **I-2.3** Update `login/page.tsx` — call backend, hapus simulasi mock
- [ ] **I-2.4** Buat `middleware.ts` — route guard `/dashboard/**`

**✅ DoD:** Login dengan kredensial DB; silent refresh aktif; route guard berfungsi.

---

### 🎯 Sprint I-3: Dashboard Data Real (1-2 hari)

- [ ] **I-3.1** `dashboard/page.tsx` — fetch `GET /api/exams`; polling live stats; FlagKey mapping
- [ ] **I-3.2** `DashboardShell.tsx` — user chip dari `useTeacherAuth().teacher`
- [ ] **I-3.3** `dashboard/exams/page.tsx` — fetch real

**Live Strip — flags (4 type, bukan kamera):**
```typescript
const flags: Record<FlagKey, number> = { tab_switch: 0, copy_paste: 0, devtools: 0, reconnect: 0 };
for (const event of recentEvents) {
  const key = eventTypeToFlagKey(event.eventType);
  if (key) flags[key]++;
}
```

**✅ DoD:** Dashboard tampil data real; live strip flags dari event DB.

---

### 🎯 Sprint I-4: Alur Siswa P0 (2-3 hari — terbesar)

- [ ] **I-4.1** `page.tsx` — `GET /api/join/validate`; map error codes; redirect ke identity
- [ ] **I-4.2** `join/identity/page.tsx` — label NISN, validasi 10 digit, info reconnect, `POST /api/join`
- [ ] **I-4.3** Buat `examSession.ts` — fetch, saveAnswer, heartbeat, submit, proctoring
- [ ] **I-4.4** Buat `proctoring.ts` — listeners browser + `eventTypeToFlagKey()`
- [ ] **I-4.5** `exam/session/page.tsx` — integrasi 5 Fase:
  - Fase A: load + restore jawaban dari `answers[]`
  - Fase B: auto-save
  - Fase C: heartbeat
  - Fase D: proctoring listeners (browser-only, TANPA kamera)
  - Fase E: submit + flush
- [ ] **I-4.6** `mockData.ts` — FlagKey baru (4 type), `nim` → `nisn`

**✅ DoD:** End-to-end join → kerjakan → reconnect → submit; guru lihat hasil.

---

### 🎯 Sprint I-5: CRUD Ujian Guru (1-2 hari)

- [ ] **I-5.1** Detail ujian — `GET /api/exams/[id]` + questions
- [ ] **I-5.2** Edit ujian — `PUT /api/exams/[id]`
- [ ] **I-5.3** Buat ujian — `POST /api/exams`
- [ ] **I-5.4** Aksi status — `PATCH /api/exams/[id]/status`

**✅ DoD:** Full CRUD ujian; aktivasi bekerja.

---

### 🎯 Sprint I-6: Monitoring Live (1 hari)

- [ ] **I-6.1** `monitor/page.tsx` — polling `GET /api/exams/[id]/dashboard` (10 detik); flags 4 type
- [ ] **I-6.2** WebSocket (opsional) — `useSocket.ts`, namespace `/teacher-dashboard`

---

## 6. Konfigurasi

### Proxy (wajib sebelum Sprint I-2)
```typescript
// frontend/next.config.ts:
async rewrites() {
  return [{ source: '/api/:path*', destination: 'http://localhost:3000/api/:path*' }]
}
```

### Environment
```env
# frontend/.env.local:
NEXT_PUBLIC_BACKEND_URL=http://localhost:3000
```

---

## 7. Impact Map

### Backend (Sprint I-1)

| File | Perubahan |
|------|-----------|
| `prisma/schema.prisma` | `nim` → `nisn`, constraint update |
| `prisma/migrations/` | `rename-nim-to-nisn` |
| `src/app/api/join/route.ts` | schema, query key, reconnect: update name + catat selalu |
| `src/app/api/join/validate/route.ts` | **File baru** |
| `src/lib/auth.ts` | `StudentTokenPayload` + `generateStudentSessionToken` |
| `src/app/api/exam-session/route.ts` | shuffle seed |
| `src/services/grading.ts` | interface + 3 return objects |

### Frontend (Sprint I-2 sampai I-6)

| File | Sprint |
|------|--------|
| `next.config.ts` | Pre-cond |
| `src/app/login/page.tsx` | I-2.3 |
| `src/app/dashboard/page.tsx` | I-3.1 |
| `src/app/dashboard/exams/page.tsx` | I-3.3 |
| `src/app/components/DashboardShell.tsx` | I-3.2 |
| `src/app/page.tsx` | I-4.1 |
| `src/app/join/identity/page.tsx` | I-4.2 |
| `src/app/exam/session/page.tsx` | I-4.5 |
| `src/app/dashboard/exams/[id]/page.tsx` | I-5.1 |
| `src/app/dashboard/exams/[id]/edit/page.tsx` | I-5.2 |
| `src/app/dashboard/exams/new/page.tsx` | I-5.3 |
| `src/app/dashboard/exams/[id]/monitor/page.tsx` | I-6.1 |
| `src/lib/mockData.ts` | I-4.6 |

---

## 8. Risiko & Mitigasi

| Risiko | Level | Mitigasi |
|--------|-------|----------|
| Cookie cross-port dev | 🔴 Tinggi | Setup proxy PERTAMA sebelum Sprint I-2 |
| Prisma migration gagal | 🟠 Sedang | Backup DB dev; gunakan `--create-only` untuk review dulu |
| Silent refresh infinite loop | 🟠 Sedang | Flag `isRefreshing` + max 1 retry |
| Timer drift FE vs BE | 🟠 Sedang | Gunakan `serverTime` dari response sebagai anchor |
| Race condition auto-save vs submit | 🟠 Sedang | Flush/await pending answer sebelum POST /submit |
| DevTools detection false positive | 🟡 Rendah | Log ke DB, tidak auto-lock; guru yang review |
| `exam/session/page.tsx` 1431 baris | 🟠 Sedang | Integrasikan per Fase A→B→C→D→E |

---

## 9. Urutan Eksekusi

```
Pre-condition (0.5 hari)
├── Fix Suspense FE-MED-01
└── Setup proxy + buat .env.local

Sprint I-1: Backend (1 hari) ← MULAI DI SINI
├── Prisma migration nim → nisn
├── Update semua routes (join, auth, exam-session, grading)
└── Buat GET /api/join/validate

Sprint I-2: Auth Guru FE (1-2 hari)
Sprint I-3: Dashboard Real (1-2 hari)
Sprint I-4: Alur Siswa (2-3 hari)
Sprint I-5: CRUD Ujian Guru (1-2 hari)
Sprint I-6: Monitoring (1 hari)

Total estimasi: 7-11 hari
```

---

## 10. Definition of Done

- [ ] Guru register, login, logout via backend ✅
- [ ] Guru buat ujian draft, tambah soal, aktivasi ✅
- [ ] Siswa masukkan kode valid → isi nama + NISN (10 digit) → kerjakan soal dari DB ✅
- [ ] Siswa terputus → reconnect dengan NISN sama → jawaban ter-restore ✅
- [ ] Event proctoring (tab switch, devtools, copy/paste, reconnect) di DB ✅
- [ ] Submit → guru lihat di dashboard ✅
- [ ] Timer sinkron dengan waktu server ✅
- [ ] Flags di live strip: tab_switch, copy_paste, devtools, reconnect — BUKAN kamera ✅
- [ ] `grep -r "mockData" frontend/src/app` → 0 hasil ✅
- [ ] `grep -rn "\.nim" backend/src` → 0 hasil ✅
- [ ] `grep -rn "camera_off\|out_of_frame\|multiple_people" frontend/src` → 0 hasil ✅

---

*Revisi: 1.2 — 28 Oktober 2026*
*NIM → NISN · NISN sebagai kunci reconnect (D-07) · FlagKey 4 type berbasis browser (tanpa kamera)*
