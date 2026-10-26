# Task Tracker — LockIt Backend Implementation

## Tahap 1: Inisialisasi Proyek, Docker & Skema Prisma
- [x] Buat `package.json`, `tsconfig.json`, `next.config.ts`
- [x] Buat `docker-compose.yml` untuk PostgreSQL 16 & `.env.example`
- [x] Buat `prisma/schema.prisma` sesuai `DATABASE.md` & `AUDIT.md` (Restrict relations, `image_url`, TIMESTAMPTZ, soft delete)
- [x] Pasang dependensi (`npm install`)
- [x] Generate Prisma Client (`npx prisma generate`)
- [x] Buat `src/lib/prisma.ts` (Prisma client singleton)
- [x] Buat `src/lib/response.ts` (Format standard response envelope)
- [x] Buat `src/lib/errors.ts` (AppError classes & HTTP status codes)
- [x] Buat `src/lib/rate-limit.ts` (In-memory token bucket / sliding window limiter)

## Tahap 2: Autentikasi Guru & Health Check
- [x] Buat `src/lib/auth.ts` (JWT access/refresh tokens, bcrypt password hashing, cookie management)
- [x] Buat middleware autentikasi `src/lib/middleware/auth.ts`
- [x] Endpoint `GET /api/health`
- [x] Endpoint `POST /api/auth/register` (Zod validation + bcrypt)
- [x] Endpoint `POST /api/auth/login` (Rate limit 5/15m, access token + refresh token cookie)
- [x] Endpoint `POST /api/auth/refresh` (Rotasi refresh token di DB)
- [x] Endpoint `POST /api/auth/logout` (Revoke refresh token di DB)
- [x] Endpoint `GET /api/auth/me` (Ambil data guru saat ini)

## Tahap 3: Manajemen Ujian & Parser Bank Soal
- [x] Endpoint `GET /api/exams` (List ujian milik guru)
- [x] Endpoint `POST /api/exams` (Buat ujian baru, generate kode 6-8 digit unik)
- [x] Endpoint `GET /api/exams/[id]` (Detail ujian)
- [x] Endpoint `PUT /api/exams/[id]` (Update ujian, cek status draft/active)
- [x] Endpoint `DELETE /api/exams/[id]` (Soft delete ujian: status archived)
- [x] Endpoint `POST /api/exams/[id]/regenerate-code` (Generate kode akses baru)
- [x] Endpoint `PUT /api/exams/[id]/status` (Transisi status: start / end)
- [x] Buat `src/services/question-parser.ts` (Parser JSON & XML dengan validasi Zod + image support)
- [x] Endpoint `POST /api/exams/[id]/questions/upload` (Upload bank soal JSON/XML max 5MB, max 200 soal)
- [x] Endpoint `POST /api/exams/[id]/questions/upload-image` (Upload gambar soal max 2MB)
- [x] Endpoint `GET /api/exams/[id]/questions` (List soal dengan kunci jawaban untuk guru)

## Tahap 4: Alur Ujian Mahasiswa & Auto-Save
- [x] Endpoint `POST /api/join` (Rate limit 5/5m, generate fresh student session token)
- [x] Endpoint `GET /api/exam-session` (Metadata + daftar soal tanpa kunci jawaban)
- [x] Endpoint `POST /api/exam-session/answer` (Auto-save jawaban per soal, validasi active window)
- [x] Endpoint `POST /api/exam-session/submit` (Submit manual + picu grading)
- [x] Endpoint `POST /api/proctoring/event` (Ingest single proctoring event + auto-lock)
- [x] Endpoint `POST /api/proctoring/events/batch` (Ingest batched events dari buffer)

## Tahap 5: Socket.IO Real-Time & Auto-End Scheduler
- [x] Buat `server.ts` (Custom Next.js HTTP server dengan Socket.IO)
- [x] Setup Socket.IO namespace `/teacher-dashboard` (Auth JWT guru + ownership check)
- [x] Setup Socket.IO namespace `/student-session` (Auth session token, heartbeat 10s, disconnect >30s)
- [x] Endpoint `POST /api/exams/[id]/students/[sid]/warn` (Guru kirim peringatan ke siswa)
- [x] Endpoint `POST /api/exams/[id]/students/[sid]/unlock` (Guru unlock siswa terkunci)
- [x] Endpoint `GET /api/exams/[id]/students` (List siswa & status live)
- [x] Endpoint `GET /api/exams/[id]/students/[sid]/violations` (Detail timeline pelanggaran siswa)
- [x] Buat `src/lib/scheduler.ts` (Auto-end exam scheduler dengan recovery saat restart)

## Tahap 6: Auto-Grading & Export
- [x] Buat `src/services/grading.ts` (Auto-grading per peserta & batch saat ujian berakhir)
- [x] Endpoint `GET /api/exams/[id]/results` (Rekap nilai & statistik ujian)
- [x] Endpoint `GET /api/exams/[id]/results/[sid]` (Detail jawaban satu peserta)
- [x] Endpoint `GET /api/exams/[id]/export/csv` (Export hasil CSV)
- [x] Endpoint `GET /api/exams/[id]/export/xlsx` (Export hasil Excel rapi dengan ExcelJS)
- [x] Verifikasi build & integrasi server
