# 02 — Frontend Audit

> **Tanggal:** 26 Oktober 2026  
> **Path:** `frontend/`  
> **Stack:** Next.js 16.4.3 (App Router), TypeScript, Vanilla CSS

---

## 1. Inventaris Halaman

| Route | File | Ukuran | Status |
|-------|------|--------|--------|
| `/` | `page.tsx` | 17.8 KB | ✅ Landing page |
| `/login` | `login/page.tsx` | — | ✅ UI ada |
| `/register` | `register/page.tsx` | — | ✅ UI ada |
| `/lupa-password` | `lupa-password/page.tsx` | — | ⚠️ No backend |
| `/daftar` | `daftar/page.tsx` | — | ✅ |
| `/join` | `join/page.tsx` | 3.5 KB | 🔴 **Mock total** |
| `/join/identity` | — | — | ✅ UI ada |
| `/exam/waiting` | `exam/waiting/page.tsx` | — | ⚠️ Tidak ada socket poll |
| `/exam/session` | `exam/session/page.tsx` | **83 KB** | 🔴 **Mock data** |
| `/exam/done` | `exam/done/page.tsx` | — | ✅ Static |
| `/dashboard` | `dashboard/page.tsx` | **63 KB** | 🔴 Mock |
| `/dashboard/exams` | `dashboard/exams/page.tsx` | **40 KB** | 🔴 Mock |
| `/dashboard/exams/new` | `dashboard/exams/new/page.tsx` | — | 🔴 Mock |
| `/dashboard/exams/[id]` | `dashboard/exams/[id]/page.tsx` | 16 KB | 🔴 Mock |
| `/dashboard/exams/[id]/edit` | `edit/page.tsx` | — | 🔴 Mock |
| `/dashboard/exams/[id]/monitor` | `monitor/page.tsx` | — | 🔴 Mock, no socket |
| `/dashboard/exams/[id]/live-feed` | `live-feed/page.tsx` | 42 KB | 🔴 Mock |
| `/dashboard/exams/[id]/results` | `results/page.tsx` | 12 KB | 🔴 Mock |
| `/dashboard/exams/[id]/results/[sid]` | `results/[sid]/page.tsx` | — | 🔴 Mock |
| `/dashboard/exams/[id]/violations/[sid]` | `violations/[sid]/page.tsx` | — | 🔴 Mock |
| `/dashboard/question-bank` | `question-bank/page.tsx` | — | 🔴 Mock, no BE endpoint |

---

## 2. Temuan Kritis

### FE-CRIT-01: Tidak ada satu pun fetch() ke backend

**Ditemukan di:** Semua halaman dashboard dan exam session

Seluruh data berasal dari `@/lib/mockData`. Pencarian `fetch(` di `src/app/` menghasilkan **0 hasil**.

```typescript
// Contoh dari dashboard/exams/page.tsx
import { mockExams, mockDashboardStats } from "@/lib/mockData";  // ← ini sumber data
// Tidak ada useEffect + fetch ke /api/exams
```

**Dampak:** Aplikasi frontend adalah shell UI tanpa koneksi backend. Tidak akan berfungsi di production.

---

### FE-CRIT-02: `/join/page.tsx` — Fully Hardcoded

```typescript
// join/page.tsx
if (code === "BD2026X") {
  setInfo("Ujian belum dimulai.");  // hardcoded mock
  return;
}
router.push("/join/identity");  // tidak POST ke /api/join
```

Backend endpoint `POST /api/join` sudah ada dan berfungsi, tapi tidak pernah dipanggil.

---

### FE-CRIT-03: Exam Session menggunakan mockData

```typescript
// exam/session/page.tsx
import { mockQuestions, mockExamSession } from "@/lib/mockData";
```

File ini 1431 baris dengan UI yang sangat matang — timer, auto-save, navigasi soal, proctoring event detection — tapi semua data dan submit-nya ke mock.

Proctoring event detection **ADA** di kode (tab switch, visibility change, dll) tapi event tidak dikirim ke `POST /api/proctoring/event`.

---

### FE-CRIT-04: `dangerouslySetInnerHTML` tanpa sanitasi

```typescript
// exam/session/page.tsx (sekitar baris 182)
<div dangerouslySetInnerHTML={{ __html: svgContent! }} />
```

SVG dari soal dirender langsung tanpa DOMPurify atau sanitasi apapun. Jika soal mengandung SVG dari sumber tidak terpercaya, ini bisa jadi vektor XSS.

**Mitigasi:** Pasang `dompurify` atau `sanitize-html` sebelum render SVG.

---

### FE-CRIT-05: Tidak ada token management

Tidak ada implementasi:
- Storage `accessToken` (localStorage/memory)
- Silent refresh saat token expiry (15 menit)
- Axios interceptor / fetch wrapper dengan auto-refresh
- Logout handler saat 401

Backend mengembalikan `accessToken` di body response login — tapi frontend tidak pernah memanggilnya, apalagi menyimpan token-nya.

---

## 3. Temuan Medium

### FE-MED-01: `useParams()` tanpa Suspense di beberapa halaman

Halaman berikut menggunakan `useParams()` di level component root tanpa `<Suspense>` wrapper, menyebabkan build error di Next.js 16:

| File | Status |
|------|--------|
| `live-feed/page.tsx` | ✅ **Sudah difix** (session ini) |
| `monitor/page.tsx` | ❌ Belum difix |
| `exams/[id]/edit/page.tsx` | ❌ Belum difix |
| `exams/[id]/page.tsx` | ❌ Belum difix |
| `violations/[sid]/page.tsx` | ❌ Belum difix |
| `results/page.tsx` | ✅ Sudah ada Suspense wrapper |
| `results/[sid]/page.tsx` | ❌ Belum difix |

**Frontend production build akan gagal** karena error ini di 5 halaman.

---

### FE-MED-02: Socket.IO client tidak ada

Dashboard guru (`/monitor`, `/live-feed`) dan sesi siswa perlu Socket.IO client, tapi:
- Tidak ada `socket.io-client` di `frontend/package.json`
- Tidak ada file `useSocket.ts` atau hook apapun
- Seluruh data "real-time" di live-feed adalah simulasi `setInterval` dengan mockData

---

### FE-MED-03: Tipe `FlagKey` di live-feed tidak sinkron dengan DB

```typescript
// live-feed/page.tsx — definisi di frontend
type FlagKey = "tab_switch" | "copy_paste" | "duplicate_screen" | "right_click" | "fullscreen_exit" | "devtools_open";

// prisma/schema.prisma — EventType di DB
enum EventType {
  fullscreen_exit
  tab_switch
  copy_attempt    // ← frontend pakai "copy_paste"
  paste_attempt   // ← frontend tidak punya ini
  right_click
  devtools        // ← frontend pakai "devtools_open"
  // frontend punya "duplicate_screen" → tidak ada di DB
}
```

---

### FE-MED-04: File halaman sangat besar tanpa pemisahan komponen

| File | Ukuran | Masalah |
|------|--------|---------|
| `exam/session/page.tsx` | 83 KB / 1431 baris | Semua UI dalam satu file |
| `dashboard/page.tsx` | 63 KB | Semua widget dalam satu file |
| `dashboard/exams/page.tsx` | 40 KB | |
| `live-feed/page.tsx` | 42 KB | |

Tidak ada pemisahan komponen ke folder `components/` — hanya 2 shared component (`DashboardShell`, `LatexRenderer`). Sulit di-maintain dan di-test.

---

### FE-MED-05: Tidak ada error boundary atau loading state

Seluruh halaman tidak mengimplementasi:
- `error.tsx` (Next.js error boundary) per route segment
- `loading.tsx` (suspense fallback) per route segment
- Skeleton loading untuk data
- Empty state yang proper

---

## 4. Temuan Minor

### FE-MIN-01: CSS globals sangat besar (51 KB)

`globals.css` berisi 51 KB CSS inline — hampir semua styling dilakukan inline atau di globals, bukan dengan CSS Modules. Tidak ada sistem design token yang konsisten.

### FE-MIN-02: `violationPolicy.action` string berbeda dari backend

```typescript
// mockData menggunakan:
action: "auto-lock"    // ← tidak ada di backend
// Backend Zod schema:
action: z.enum(["warning", "lock", "review"])
```

### FE-MIN-03: Halaman lupa password tidak memiliki backend

`/lupa-password` ada dengan UI form email, tapi:
- Tidak ada `POST /api/auth/forgot-password` di backend
- Tidak ada email service di backend (tidak ada nodemailer/resend)

### FE-MIN-04: Build next.js belum lulus (5 halaman masih error Suspense)

---

## 5. Yang Sudah Baik ✅

| Aspek | Keterangan |
|-------|-----------|
| **UI/UX Quality** | Sangat matang — desain konsisten, responsive, dark/light handling |
| **TypeScript** | Digunakan di semua file, tipe didefinisikan dengan baik |
| **LaTeX rendering** | `LatexRenderer.tsx` sudah ada dengan KaTeX |
| **SVG image handling** | Decode base64 SVG dengan graceful error handling |
| **Proctoring detection** | Logic deteksi tab switch, visibility, copy-paste sudah ada |
| **Timer UI** | Server-time-aware timer sudah diimplementasi (tinggal connect) |
| **Accessibility (partial)** | aria-label ada di beberapa komponen |
| **Next.js 16** | Sudah upgrade ke 16.4.3 (security fix) |
| **Suspense di results** | `/results` sudah punya Suspense wrapper yang benar |

---

## 6. Prioritas Perbaikan Frontend

| # | Item | Effort | Impact |
|---|------|--------|--------|
| 1 | Fix Suspense wrapper di 5 halaman | 🟡 Medium (1-2 jam) | 🔴 Build gagal |
| 2 | Pasang `socket.io-client` & buat `useSocket` hook | 🟡 Medium | 🔴 Real-time tidak jalan |
| 3 | Ganti mockData di `/join` → real API call | 🟢 Low (2-4 jam) | 🔴 P0 feature |
| 4 | Ganti mockData di `/exam/session` → real API | 🔴 High (1-2 hari) | 🔴 P0 feature |
| 5 | Token management (storage + auto-refresh) | 🟡 Medium | 🔴 Auth tidak berfungsi |
| 6 | Sinkronkan `FlagKey` dan `EventType` | 🟢 Low | 🟡 Data integrity |
| 7 | Sanitasi SVG dengan DOMPurify | 🟢 Low | 🟡 Security |
| 8 | Ganti mockData di semua dashboard | 🔴 High (2-3 hari) | 🟡 After P0 done |
| 9 | Tambah `loading.tsx` & `error.tsx` | 🟡 Medium | 🟡 UX |
| 10 | Pecah komponen besar ke file terpisah | 🔴 High | 🟢 Maintainability |

---

*File: `AUDIT/02-FRONTEND-AUDIT.md` | Terakhir diupdate: 26 Oktober 2026*
