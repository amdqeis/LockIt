# 🛠️ Working On — Pelacakan Perbaikan Hasil Audit LockIt

> **Tanggal Mulai:** 26 Oktober 2026  
> **Status:** Active / In Progress  
> **Dasar Perbaikan:** [`01-GAP-ANALYSIS.md`](./01-GAP-ANALYSIS.md), [`02-FRONTEND-AUDIT.md`](./02-FRONTEND-AUDIT.md), [`03-BACKEND-AUDIT.md`](./03-BACKEND-AUDIT.md), [`04-DOCS-AUDIT.md`](./04-DOCS-AUDIT.md)

---

## 📌 Ringkasan Status Pengerjaan

Audit menyeluruh menemukan bahwa **backend API dan schema database sudah siap**, serta **desain UI frontend sudah sangat matang**, namun **keduanya belum terhubung sama sekali (frontend masih 100% menggunakan `mockData`)**.

Dokumen ini berfungsi sebagai papan kerja aktif (action tracker & checklist) yang memetakan apa yang **sedang dikerjakan (In Progress)**, **prioritas mendesak (Up Next)**, dan **tahapan perbaikan berikutnya (Backlog/Roadmap)** berdasarkan temuan audit.

---

## 🏃 1. Sedang Dikerjakan (In Progress) — Sprint 1: Stabilisasi Build & Fondasi

Fokus saat ini adalah memastikan fondasi proyek stabil, build frontend tidak gagal, dan celah konfigurasi kritis tertutup sebelum integrasi data dimulai.

- [ ] **Fix Suspense Wrapper di 5 Halaman Frontend (`FE-MED-01`, `FE-MIN-04`)**
  - **Masalah:** Penggunaan `useParams()` di root komponen tanpa wrapper `<Suspense>` menyebabkan error saat production build di Next.js 16 (`next build`).
  - **Halaman terdampak:**
    - [ ] `frontend/src/app/dashboard/exams/[id]/monitor/page.tsx`
    - [ ] `frontend/src/app/dashboard/exams/[id]/edit/page.tsx`
    - [ ] `frontend/src/app/dashboard/exams/[id]/page.tsx`
    - [ ] `frontend/src/app/dashboard/exams/[id]/violations/[sid]/page.tsx`
    - [ ] `frontend/src/app/dashboard/exams/[id]/results/[sid]/page.tsx`
  - **Verifikasi:** Jalankan `npm run build` di folder `frontend/` dan pastikan compile berhasil tanpa error Suspense.

- [ ] **Pengamanan Default JWT Secret Backend (`BE-CRIT-05`)**
  - **Masalah:** Fallback hardcoded `"lockit_access_default_secret_key"` berisiko tinggi jika env tidak disetel.
  - **Solusi:** Throw explicit configuration error saat runtime startup jika `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` tidak didefinisikan.
  - **Verifikasi:** Server menolak jalan jika secret kosong; lulus tes auth saat env tersedia.

- [ ] **Inisialisasi & Commit Formal Prisma Migrations (`BE-CRIT-04`)**
  - **Masalah:** Folder `backend/prisma/migrations/` belum ada; skema hanya di-push tanpa histori migrasi.
  - **Solusi:** Jalankan migrasi inisial dan pastikan folder migration tercatat di git repository.
  - **Verifikasi:** `npx prisma migrate status` menunjukkan status database up-to-date.

---

## 🎯 2. Antrean Berikutnya (Up Next) — Sprint 2: Integrasi Alur Kritis Siswa (P0 Flow)

Setelah build dan security dasar bersih, perbaikan langsung masuk ke integrasi fungsional paling penting (Student Exam Flow).

- [ ] **Integrasi Halaman Join Siswa (`US-M01`, `US-M02`, `FE-CRIT-02`)**
  - Ganti hardcoded check `"BD2026X"` di `frontend/src/app/join/page.tsx` dan `frontend/src/app/join/identity/page.tsx` dengan pemanggilan riil ke `POST /api/join`.
  - Simpan cookie token sesi siswa dari backend response (`student_session`).

- [ ] **Fondasi Token & Auth Client Management (`FE-CRIT-05`, `US-G01`)**
  - Buat API client / fetch wrapper di frontend (`lib/api.ts` atau `lib/auth.ts`) yang menangani:
    - Penyimpanan `accessToken`
    - Silent refresh otomatis via `POST /api/auth/refresh` saat token 15 menit kedaluwarsa
    - Redirect otomatis ke `/login` saat menerima status HTTP 401 Unauthorized.

- [ ] **Integrasi Pengerjaan Ujian Siswa (`US-M03`, `US-M04`, `US-M05`, `US-M08`, `FE-CRIT-03`)**
  - Ganti pemanggilan `mockQuestions` dan `mockExamSession` di `frontend/src/app/exam/session/page.tsx` (1431 baris) dengan:
    - `GET /api/exam-session` untuk fetch soal acak per NIM
    - Sinkronisasi timer dengan `serverTime` dari respons backend
    - Auto-save jawaban ke `POST /api/exam-session/answer`
    - Heartbeat periodik ke `POST /api/exam-session/heartbeat` (mencegah timeout 30s)
    - Submit final ke `POST /api/exam-session/submit`.

- [ ] **Sanitasi SVG pada Renderer Soal (`FE-CRIT-04`)**
  - Sanitasi konten SVG di `exam/session/page.tsx` menggunakan `DOMPurify` sebelum dirender via `dangerouslySetInnerHTML` guna mencegah celah XSS.

---

## ⚡ 3. Tahap Lanjutan (Medium Term) — Sprint 3: Real-Time & Proctoring

- [ ] **Integrasi Socket.IO Client Frontend (`FE-MED-02`, `US-G06`, `US-M07`)**
  - Install `socket.io-client` di `frontend/package.json`.
  - Buat hook `useSocket.ts` terpusat untuk namespace `/teacher-dashboard` dan `/student-session`.
  - Hubungkan live feed guru (`live-feed/page.tsx`) dan monitoring (`monitor/page.tsx`) ke streaming event riil.

- [ ] **Sinkronisasi Deteksi & Pengiriman Proctoring Event (`FE-CRIT-03`, `FE-MED-03`, `US-M06`)**
  - Hubungkan deteksi event frontend (tab switch, fullscreen exit, devtools) ke `POST /api/proctoring/event` dan `/batch`.
  - Selaraskan definisi tipe `FlagKey` di frontend dengan enum `EventType` di Prisma schema backend.

- [ ] **Implementasi Auto-Lock Pelanggaran (`BE-CRIT-04` / `US-G05`)**
  - Implementasikan logika auto-lock di violation event handler backend jika pelanggaran siswa melebihi batas kebijakan ujian (`violationPolicy`).

---

## 📊 4. Matriks Pelacakan Remediasi Temuan Audit

| ID Temuan | Asal Audit | Deskripsi Singkat | Prioritas | Status | Target Solusi / File |
|-----------|------------|-------------------|-----------|--------|----------------------|
| **FE-MED-01** | Frontend | 5 Halaman error `useParams()` tanpa Suspense | P0 (Blocker) | 🔄 **In Progress** | Bungkus dengan `<Suspense>` di masing-masing page |
| **BE-CRIT-05**| Backend | Hardcoded default fallback `JWT_ACCESS_SECRET` | P0 (Security) | 🔄 **In Progress** | Throw startup error di `backend/src/lib/auth.ts` |
| **BE-CRIT-04**| Backend | Migrasi database Prisma belum dicommit | P0 (Infra) | 🔄 **In Progress** | `prisma migrate dev` & commit folder `migrations/` |
| **FE-CRIT-02**| Frontend | `/join/page.tsx` hardcoded mockup | P0 (Feature) | ⏳ Up Next | Integrasi `POST /api/join` & session cookie |
| **FE-CRIT-05**| Frontend | Tidak ada token storage & silent refresh | P0 (Auth) | ⏳ Up Next | Buat `frontend/src/lib/apiClient.ts` |
| **FE-CRIT-03**| Frontend | `/exam/session` 100% menggunakan `mockData` | P0 (Feature) | ⏳ Up Next | Hubungkan ke 5 endpoint student session |
| **FE-CRIT-04**| Frontend | `dangerouslySetInnerHTML` SVG tanpa sanitasi | P1 (Security) | ⏳ Up Next | Tambah `dompurify` sanitizer |
| **FE-MED-02** | Frontend | Socket.IO client belum ada di frontend | P1 (Feature) | 📋 Planned | Install `socket.io-client` + buat `useSocket.ts` |
| **FE-MED-03** | Frontend | Inkonsistensi `FlagKey` vs `EventType` DB | P1 (Data) | 📋 Planned | Sinkronkan enum di FE dan BE |
| **BE-CRIT-01**| Backend | Rate limiter in-memory tidak scale di multi-worker | P2 (Scaling) | 📋 Planned | Migrasi ke Redis / `rate-limiter-flexible` |
| **BE-MED-01** | Backend | Endpoint daftar ujian/siswa tanpa pagination | P2 (Perf) | 📋 Planned | Tambah `take`/`skip` query params |
| **DOC-01**    | Docs | Tidak ada OpenAPI / API Reference terpusat | P1 (Docs) | 📋 Planned | Buat `docs/API.md` lengkap |
| **DOC-02**    | Docs | Socket.IO event payload tidak terdokumentasi | P1 (Docs) | 📋 Planned | Buat `docs/SOCKET_EVENTS.md` |

---

## 📝 5. Catatan Riwayat Remediasi yang Sudah Selesai (Completed)

1. ✅ **Pemisahan Monorepo (`frontend/` & `backend/`)**:
   - Struktur repositori berhasil dipisahkan menjadi dua workspace mandiri yang rapi.
2. ✅ **Resolusi Konflik Port Docker & Compose**:
   - Backend berjalan di port `3000`, frontend di port `3001` (dengan reverse proxy/mapping yang konsisten).
3. ✅ **Upgrade Next.js Security**:
   - Upgrade ke Next.js `16.4.3` untuk menutup kerentanan keamanan sebelumnya.
4. ✅ **Suspense Fix pada `live-feed/page.tsx`**:
   - Berhasil dibungkus dengan `<Suspense>` sebagai proof-of-concept perbaikan Next.js App Router client boundary.
5. ✅ **Dokumentasi Audit Komprehensif (`AUDIT/`)**:
   - Selesai menyusun `01-GAP-ANALYSIS.md`, `02-FRONTEND-AUDIT.md`, `03-BACKEND-AUDIT.md`, dan `04-DOCS-AUDIT.md`.

---

*File ini di-update secara berkala seiring berjalannya perbaikan kode.*
