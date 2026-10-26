# 03 — Backend Audit

> **Tanggal:** 26 Oktober 2026  
> **Path:** `backend/`  
> **Stack:** Next.js 15 (App Router), TypeScript, Prisma, PostgreSQL, Socket.IO, Zod

---

## 1. Inventaris Endpoint API

### Auth (`/api/auth/`)

| Method | Endpoint | Auth | Status |
|--------|----------|------|--------|
| POST | `/api/auth/register` | — | ✅ Implementasi lengkap |
| POST | `/api/auth/login` | — | ✅ + httpOnly cookie + rate limit |
| POST | `/api/auth/logout` | Teacher | ✅ Revoke refresh token |
| GET | `/api/auth/me` | Teacher | ✅ |
| POST | `/api/auth/refresh` | Cookie | ✅ |

### Exam Management (`/api/exams/`)

| Method | Endpoint | Auth | Status |
|--------|----------|------|--------|
| GET | `/api/exams` | Teacher | ✅ Filter by status |
| POST | `/api/exams` | Teacher | ✅ Zod validation |
| GET | `/api/exams/[id]` | Teacher | ✅ |
| PUT | `/api/exams/[id]` | Teacher | ✅ State-aware (draft vs active) |
| DELETE | `/api/exams/[id]` | Teacher | ✅ Soft delete jika ada siswa |
| PUT | `/api/exams/[id]/status` | Teacher | ✅ State machine (draft→active→ended→archived) |
| GET | `/api/exams/[id]/questions` | Teacher | ✅ |
| POST | `/api/exams/[id]/questions/upload` | Teacher | ✅ XML/JSON parsing |
| POST | `/api/exams/[id]/questions/upload-image` | Teacher | ✅ |
| GET | `/api/exams/[id]/questions/preview` | Teacher | ✅ |
| POST | `/api/exams/[id]/regenerate-code` | Teacher | ✅ |
| GET | `/api/exams/[id]/students` | Teacher | ✅ |
| POST | `/api/exams/[id]/students/[sid]/warn` | Teacher | ✅ Socket broadcast |
| POST | `/api/exams/[id]/students/[sid]/unlock` | Teacher | ✅ |
| GET | `/api/exams/[id]/students/[sid]/violations` | Teacher | ✅ |
| GET | `/api/exams/[id]/results` | Teacher | ✅ Auto-graded |
| GET | `/api/exams/[id]/results/[sid]` | Teacher | ✅ Detail per siswa |
| GET | `/api/exams/[id]/dashboard` | Teacher | ✅ Real-time stats |
| GET | `/api/exams/[id]/export/csv` | Teacher | ✅ |
| GET | `/api/exams/[id]/export/xlsx` | Teacher | ✅ |
| GET | `/api/exams/[id]/export/violations` | Teacher | ✅ |

### Student Session (`/api/`)

| Method | Endpoint | Auth | Status |
|--------|----------|------|--------|
| POST | `/api/join` | — | ✅ Rate limit, cookie |
| GET | `/api/exam-session` | Student | ✅ Shuffle soal per NIM |
| POST | `/api/exam-session/answer` | Student | ✅ Upsert |
| POST | `/api/exam-session/heartbeat` | Student | ✅ |
| POST | `/api/exam-session/submit` | Student | ✅ Auto-grade + socket |
| POST | `/api/exam-session/warning/[wid]/read` | Student | ✅ |
| POST | `/api/proctoring/event` | Student | ✅ |
| POST | `/api/proctoring/events/batch` | Student | ✅ Batch insert |

### Utility

| Method | Endpoint | Status |
|--------|----------|--------|
| GET | `/api/health` | ✅ |

---

## 2. Temuan Kritis

### BE-CRIT-01: Rate Limiter In-Memory — Tidak Production-Safe

```typescript
// backend/src/lib/rate-limit.ts
const rateLimitStore = new Map<string, RateLimitRecord>();
```

Rate limiter menggunakan `Map` in-process. Konsekuensinya:
- **Multi-instance deployment**: Limit tidak dishare antar pod/worker
- **Server restart**: Semua counter reset — attacker bisa brute-force ulang setelah restart
- **PM2 cluster mode**: Setiap worker punya counter sendiri (limit efektif dibagi N worker)

**Solusi:** Ganti dengan Redis (via `ioredis` + `rate-limiter-flexible`) atau external limiter.

---

### BE-CRIT-02: Scheduler Exam Auto-End In-Memory

```typescript
// backend/src/lib/scheduler.ts
const activeTimers = new Map<string, NodeJS.Timeout>();
```

Timer auto-end ujian disimpan di memory proses Node. Konsekuensinya:
- **Server crash/restart**: Timer hilang — ujian tidak pernah berakhir otomatis
- **Sudah ada mitigasi**: `rescheduleActiveExamsOnBoot()` dipanggil saat server start — ini **BAIK**
- **Namun**: Jika downtime lebih lama dari `durationMinutes`, ujian baru di-end saat boot — OK
- **Masalah**: Di multi-process/cluster, setiap worker akan re-schedule semua timer (duplicate execution risk)

**Solusi jangka pendek:** Pastikan hanya 1 worker (sudah OK dengan `tsx server.ts`). Jangka panjang: BullMQ atau pg_cron.

---

### BE-CRIT-03: `correctAnswer` Tersimpan di DB sebagai Plain Text

```prisma
// prisma/schema.prisma
model Question {
  correctAnswer String @map("correct_answer")
}
```

`correctAnswer` diambil langsung dari DB dan **TIDAK** disertakan di response `GET /api/exam-session` (sudah diexclude dengan `select`). Ini **benar**.

```typescript
// exam-session/route.ts — sudah aman
select: {
  id: true,
  questionText: true,
  options: true,
  points: true,
  // correctAnswer TIDAK di-select
}
```

**Namun risiko tetap ada**: Siapa pun dengan akses DB bisa lihat jawaban. Tidak ada enkripsi at-rest.

**Rekomendasi:** Untuk exam sensitif, pertimbangkan hash jawaban dengan salt exam-specific.

---

### BE-CRIT-04: No Migration Files

```bash
backend/prisma/
├── schema.prisma   ✅
└── (tidak ada folder migrations/)
```

Folder `migrations/` tidak ada di repo. Ini berarti:
- `prisma migrate dev` belum pernah dijalankan secara formal
- Schema hanya bisa diterapkan dengan `prisma db push` (tidak production-safe)
- Tidak ada histori perubahan schema

**Solusi:** Jalankan `npx prisma migrate dev --name init` dan commit folder `migrations/`.

---

### BE-CRIT-05: JWT Secret Default Hardcoded

```typescript
// backend/src/lib/auth.ts
const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "lockit_access_default_secret_key";
```

Fallback ke string hardcoded berbahaya jika env tidak diset. Jika server jalan tanpa `.env`, token yang dibuat dengan secret default bisa di-forge oleh siapa saja yang tahu kodenya (repo ini mungkin public).

**Solusi:**
```typescript
const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
if (!JWT_ACCESS_SECRET) throw new Error("JWT_ACCESS_SECRET is required");
```

---

## 3. Temuan Medium

### BE-MED-01: Tidak Ada Pagination di List Endpoint

```typescript
// exams/route.ts
const exams = await prisma.exam.findMany({ where, orderBy });  // No limit/offset
```

Semua list endpoint (`GET /api/exams`, `GET /api/exams/[id]/students`, dll) tidak ada pagination. Pada skala besar (1000+ siswa per ujian), query ini akan lambat.

**Solusi:** Tambahkan `take` dan `skip` parameter dengan default limit 50.

---

### BE-MED-02: `grading.ts` — Sequential N+1 Query

```typescript
// services/grading.ts
export async function autoGradeExam(examId: string) {
  const students = await prisma.student.findMany({ where: { examId } });
  for (const s of students) {
    const summary = await autoGradeStudent(s.id);  // ← 1 query per siswa
  }
}
```

`autoGradeExam` melakukan 1 query per siswa secara berurutan. Untuk 100 siswa = 100 roundtrips ke DB.

**Solusi:** Gunakan `Promise.all()` untuk parallel, atau refactor menjadi satu query aggregate.

---

### BE-MED-03: `CORS` Origin `"*"` di Socket.IO

```typescript
// server.ts
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: "*",   // ← terlalu permisif
    methods: ["GET", "POST"],
    credentials: true,
  },
});
```

`origin: "*"` tidak boleh digunakan bersamaan dengan `credentials: true` (browser akan reject). Di production, harus diganti dengan `origin: process.env.FRONTEND_URL`.

---

### BE-MED-04: Tidak Ada Validasi Maximum Violations Sebelum Auto-Lock

Backend memiliki `violationPolicy.max_violations` dan `violationPolicy.action`, tapi:

- `POST /api/proctoring/event` tidak otomatis menambah `student.violationCount`
- `POST /api/proctoring/events/batch` — perlu dicek apakah ada auto-lock logic
- Tidak ada middleware yang mengecek apakah siswa sudah mencapai batas dan harus di-lock

**Risiko:** Siswa bisa mengirim 1000 proctoring event tanpa pernah di-lock, meskipun policy mengatakan lock di 5 violations.

---

### BE-MED-05: `globalThis.io` Pattern — Tidak Type-Safe

```typescript
// submit/route.ts, exams/[id]/students/[sid]/warn/route.ts
const io = (globalThis as any).io;
```

Penggunaan `(globalThis as any).io` tersebar di banyak route handler. Ini:
- Tidak type-safe (any casting)
- Sulit di-test (global state)
- Tidak bekerja di environment serverless

**Solusi:** Buat singleton module `src/lib/socket.ts` yang export `getIO()`.

---

### BE-MED-06: Tidak Ada Test

Tidak ada folder `__tests__/`, `*.spec.ts`, atau `*.test.ts` di seluruh backend. Tidak ada konfigurasi Jest/Vitest.

---

## 4. Temuan Minor

### BE-MIN-01: `lupa-password` — Endpoint Tidak Ada

Halaman frontend `/lupa-password` ada, tapi tidak ada:
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- Email service (nodemailer, Resend, dll)

### BE-MIN-02: `POST /api/auth/register` Terbuka Tanpa Invite

Siapa saja bisa register sebagai guru. Tidak ada:
- Invite code
- Domain email whitelist (misal: hanya `@university.ac.id`)
- Admin approval flow

Sesuai PRD ini mungkin by design (fase awal), tapi perlu dikonfirmasi.

### BE-MIN-03: Upload Image Soal — Disimpan ke `public/uploads/`

```typescript
// questions/upload-image/route.ts (kemungkinan)
// Gambar disimpan ke filesystem lokal
```

Jika deploy ke Docker/cloud, gambar yang di-upload akan hilang saat container di-restart karena `public/uploads/` tidak persistent. Perlu volume mount atau cloud storage (S3/GCS/Cloudflare R2).

### BE-MIN-04: `next.config.ts` — `experimental: {}` Kosong

```typescript
const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "bcryptjs"],
  experimental: {},  // ← tidak perlu
};
```

---

## 5. Yang Sudah Baik ✅

| Aspek | Keterangan |
|-------|-----------|
| **Zod Validation** | Semua endpoint punya schema validation |
| **Error handling** | `AppError` class + `errorResponse` helper konsisten |
| **JWT Auth** | Access token 15m + refresh token 7d + httpOnly cookie |
| **Refresh token hashing** | SHA-256 hash disimpan, bukan plaintext |
| **Student session** | JWT dengan `studentId + examId + nim + timestamp` |
| **Session cookie SameSite** | `SameSite: strict` di semua cookie |
| **Rate limiting** | Login (5/15min) dan join (5/5min) sudah ada |
| **State machine ujian** | Transisi `draft→active→ended→archived` divalidasi |
| **Auto-grade** | Grading otomatis saat submit dan saat ujian berakhir |
| **Scheduler dengan boot recovery** | `rescheduleActiveExamsOnBoot()` mencegah zombie exam |
| **Soft delete** | Exam dengan siswa tidak dihapus permanen |
| **Deterministic shuffle** | Soal diacak per NIM — konsisten antar reconnect |
| **Reconnect flow** | Siswa bisa rejoin dengan token baru tanpa kehilangan jawaban |
| **Batch proctoring** | `POST /proctoring/events/batch` untuk batch insert |
| **Health check** | `GET /api/health` untuk load balancer |

---

## 6. Prioritas Perbaikan Backend

| # | Item | Effort | Impact |
|---|------|--------|--------|
| 1 | Ganti default JWT secret dengan error jika tidak diset | 🟢 Low | 🔴 Security |
| 2 | Jalankan dan commit Prisma migrations | 🟢 Low | 🔴 Production-readiness |
| 3 | Fix CORS origin `"*"` → domain spesifik | 🟢 Low | 🔴 Security |
| 4 | Implementasi auto-lock di violation event handler | 🟡 Medium | 🔴 Proctoring feature |
| 5 | Pagination di list endpoint | 🟡 Medium | 🟡 Scalability |
| 6 | Parallel grading dengan `Promise.all()` | 🟡 Medium | 🟡 Performance |
| 7 | Type-safe Socket.IO singleton | 🟡 Medium | 🟡 Maintainability |
| 8 | Persistent file storage untuk upload gambar | 🟡 Medium | 🟡 Operational |
| 9 | Ganti in-memory rate limiter dengan Redis | 🔴 High | 🟡 Scalability |
| 10 | Tambah unit test | 🔴 High | 🟡 Quality |

---

*File: `AUDIT/03-BACKEND-AUDIT.md` | Terakhir diupdate: 26 Oktober 2026*
