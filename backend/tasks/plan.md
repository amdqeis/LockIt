# Implementation Plan — LockIt Backend (Next.js 15 + TypeScript)

> Berdasarkan dokumen di `/docs`: `PRD.md`, `DATABASE.md`, `USER_FLOWS.md`, dan `AUDIT.md` (tidak termasuk `ANALYSIS.md`).
> Folder `/docs` bersifat **READ-ONLY**.

## 1. Arsitektur & Prinsip Utama
- **Tech Stack:** Next.js 15 App Router (TypeScript) + Route Handlers untuk REST API + custom `server.ts` untuk Socket.IO.
- **Database & ORM:** PostgreSQL 16 (via Docker Compose) + Prisma ORM dengan `TIMESTAMPTZ` (UTC).
- **Format Respons API:**
  - Sukses: `{ "success": true, "data": ... }`
  - Gagal: `{ "success": false, "error": { "code": "...", "message": "...", "details": ... } }`
- **Keamanan & Autentikasi:**
  - **Guru:** JWT Access Token (15m, in-memory/header) + Refresh Token (7 hari, httpOnly cookie, disimpan di tabel `refresh_tokens` dengan hash SHA256/bcrypt). Rate limit login 5 attempt / 15m.
  - **Mahasiswa:** Temporary session token via httpOnly cookie, dibuat baru saat join (`exam_id + nim + timestamp`), divalidasi `student.status !== 'submitted'`. Rate limit join 5 attempt / 5m.
  - **Relasi Database (Soft Delete):** Relasi audit di-set `onDelete: Restrict` (Teacher ➔ Exam, Exam ➔ Student, Exam ➔ ProctoringEvent, Student ➔ Answer). Exam `status = 'archived'` untuk soft delete.
  - **Dukungan Gambar Soal:** Field `image_url` di `questions` dan `options` JSON, upload dibatasi 2MB/gambar, max 200 soal, max 5MB file bank soal (XML/JSON).
  - **Socket.IO:** Dua namespace terpisah:
    - `/teacher-dashboard`: Wajib JWT guru + verifikasi kepemilikan ujian (`exam.teacherId === teacher.id`).
    - `/student-session`: Wajib session token mahasiswa. Heartbeat 10 detik, deteksi disconnect > 30 detik.
  - **Scheduler Auto-End:** Timer `setTimeout` di `server.ts` dengan re-schedule otomatis saat boot server.

---

## 2. Rencana Tahapan Eksekusi Backend

### Tahap 1: Inisialisasi Proyek, Docker & Skema Prisma
1. Buat `package.json`, `tsconfig.json`, dan konfigurasi Next.js 15.
2. Buat `docker-compose.yml` untuk PostgreSQL 16 dan `.env.example`.
3. Tulis `prisma/schema.prisma` yang sesuai dengan `DATABASE.md` + penyelarasan `AUDIT.md`:
   - Enums: `ExamStatus` (draft, active, ended, archived), `StudentStatus` (waiting, active, submitted, disconnected), `EventType` (10 event proctoring).
   - Tabel: `teachers`, `refresh_tokens`, `exams` (dengan `updated_at`), `questions` (dengan `image_url`), `students`, `answers`, `proctoring_events`, `warnings`.
   - Foreign key rules: `onDelete: Restrict` untuk entitas audit, `Cascade` hanya untuk `questions` dan `refresh_tokens`.
4. Siapkan utilitas fondasi backend di `src/lib/`:
   - `src/lib/prisma.ts` (Prisma singleton client).
   - `src/lib/response.ts` (Helper respons standar API).
   - `src/lib/errors.ts` (Error class kustom & HTTP status mapping).
   - `src/lib/rate-limit.ts` (Rate limiter in-memory).

### Tahap 2: Autentikasi Guru & Health Check
1. Helper autentikasi di `src/lib/auth.ts`:
   - Hashing password dengan `bcryptjs` (salt 10).
   - Sign & verify JWT (access token) + hash & validasi refresh token.
   - Set/clear secure httpOnly cookies.
2. Endpoint:
   - `GET /api/health` — Status sistem & koneksi database.
   - `POST /api/auth/register` — Registrasi guru baru (validasi Zod).
   - `POST /api/auth/login` — Login guru, terbitkan access token + refresh token cookie, rate limiting.
   - `POST /api/auth/refresh` — Rotasi token refresh dan terbitkan access token baru.
   - `POST /api/auth/logout` — Revoke refresh token di DB dan bersihkan cookie.
   - `GET /api/auth/me` — Ambil profil guru saat ini (middleware auth).

### Tahap 3: Manajemen Ujian & Parser Bank Soal (XML & JSON)
1. Endpoint Ujian:
   - `GET /api/exams` — List ujian milik guru yang login.
   - `POST /api/exams` — Buat ujian baru (validasi Zod, auto-generate access code 6-8 karakter alfanumerik).
   - `GET /api/exams/[id]` — Detail ujian.
   - `PUT /api/exams/[id]` — Update ujian (hanya status `draft` yang bisa edit penuh; status `active` hanya bisa edit policy).
   - `DELETE /api/exams/[id]` — Soft delete ujian (status jadi `archived`).
   - `POST /api/exams/[id]/regenerate-code` — Buat ulang kode akses jika bocor.
   - `PUT /api/exams/[id]/status` — Transisi status manual (`draft` ➔ `active`, `active` ➔ `ended`).
2. Parser Bank Soal & Gambar:
   - `src/services/question-parser.ts`:
     - Parser JSON dengan validasi Zod.
     - Parser XML menggunakan `fast-xml-parser` dengan validasi struktur.
   - `POST /api/exams/[id]/questions/upload` — Upload file bank soal (JSON/XML max 5MB, max 200 soal).
   - `POST /api/exams/[id]/questions/upload-image` — Upload gambar untuk soal (max 2MB, png/jpg/webp).
   - `GET /api/exams/[id]/questions` — Ambil daftar soal untuk guru (dengan kunci jawaban).

### Tahap 4: Alur Ujian Mahasiswa & Auto-Save
1. Endpoint Peserta:
   - `POST /api/join` — Join ujian via access code + nama + NIM. Rate limit 5/5min. Validasi status ujian `active`. Terbitkan session token httpOnly unik.
   - `GET /api/exam-session` — Ambil metadata ujian + daftar soal (opsi diacak jika setting aktif, kunci jawaban `is_correct` dan `correct_answer` disembunyikan).
   - `POST /api/exam-session/answer` — Auto-save jawaban per soal. Validasi ketat: ujian `active`, `current_time < exam.endTime`, peserta belum `submitted` dan tidak `is_locked`. Rate limit 30 req/menit.
   - `POST /api/exam-session/submit` — Submit manual peserta. Set status peserta `submitted` dan langsung picu auto-grading peserta.
2. Endpoint Proctoring:
   - `POST /api/proctoring/event` — Simpan 1 event pelanggaran dari peserta. Update `violation_count` peserta dan auto-lock jika policy = `lock`. Rate limit 60 req/menit.
   - `POST /api/proctoring/events/batch` — Simpan antrean event dari buffer client yang sempat disconnect. Rate limit 10 req/menit.

### Tahap 5: Socket.IO Server & Auto-End Scheduler
1. File `server.ts`:
   - Kustom server HTTP membungkus Next.js App Router handler.
   - Inisialisasi Socket.IO server.
2. Namespace `/teacher-dashboard`:
   - Autentikasi JWT guru pada handshake.
   - Validasi kepemilikan room ujian (`examId`).
   - Event broadcast ke guru saat ada siswa join, submit, heartbeat hilang, atau ada pelanggaran baru.
   - Handler aksi guru: kirim warning (`POST /api/exams/[id]/students/[sid]/warn`) dan unlock siswa (`POST /api/exams/[id]/students/[sid]/unlock`).
3. Namespace `/student-session`:
   - Autentikasi session token mahasiswa.
   - Heartbeat timer 10s: update last seen. Jika tidak ada heartbeat > 30 detik, server tandai `disconnected` dan broadcast ke dashboard guru.
   - Kirim notifikasi warning langsung ke socket mahasiswa jika guru mengirim peringatan.
4. Auto-End Scheduler (`src/lib/scheduler.ts`):
   - Pasang timer saat ujian dimulai (`active`).
   - Saat boot server, periksa semua ujian `active` yang belum lewat `end_time` untuk di-reschedule.
   - Saat timer habis: update status ujian ➔ `ended`, auto-submit siswa yang belum submit, trigger batch grading, broadcast via Socket.IO.

### Tahap 6: Auto-Grading & Export
1. `src/services/grading.ts`:
   - Grading instan per siswa saat submit.
   - Grading batch untuk seluruh siswa yang tersisa saat ujian berakhir.
   - Hitung statistik ujian (rata-rata, min, max, total peserta).
2. Endpoint Hasil & Export:
   - `GET /api/exams/[id]/results` — Rekap nilai seluruh peserta.
   - `GET /api/exams/[id]/results/[sid]` — Detail jawaban per soal untuk satu peserta.
   - `GET /api/exams/[id]/export/csv` — Export hasil ujian format CSV.
   - `GET /api/exams/[id]/export/xlsx` — Export hasil ujian format Excel berformat rapi (ExcelJS).
