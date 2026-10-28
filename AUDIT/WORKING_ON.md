# 🛠️ Working On — Pelacakan Perbaikan Hasil Audit LockIt

> **Tanggal Mulai:** 26 Oktober 2026  
> **Status:** Active / In Progress  
> **Dasar Perbaikan:** [`01-GAP-ANALYSIS.md`](./01-GAP-ANALYSIS.md), [`02-FRONTEND-AUDIT.md`](./02-FRONTEND-AUDIT.md), [`03-BACKEND-AUDIT.md`](./03-BACKEND-AUDIT.md), [`04-DOCS-AUDIT.md`](./04-DOCS-AUDIT.md)
> **Plan Integrasi:** [`05-FE-BE-INTEGRATION-PLAN.md`](./05-FE-BE-INTEGRATION-PLAN.md) ← **BACA INI SEBELUM EKSEKUSI**

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

## 🎯 2. Antrean Berikutnya (Up Next) — Sprint I: Integrasi FE ↔ BE (6 Sprint)

> 📋 **Dokumen planning lengkap ada di [`05-FE-BE-INTEGRATION-PLAN.md`](./05-FE-BE-INTEGRATION-PLAN.md)**
> Versi 1.1 — Keputusan D-01~D-06 sudah resolved.

### ✅ Keputusan Sudah Dibuat
- **D-01** ✅ Tambah `GET /api/join/validate` di backend (endpoint baru)
- **D-02** ✅ FlagKey: `tab_switch`, `copy_paste`, `devtools`, `reconnect` (NO kamera/wajah)
- **D-03** ✅ **NIM → NISN** (10 digit angka, Prisma migration wajib)
- **D-04** ✅ Token in-memory React context
- **D-05** ✅ Next.js proxy rewrites
- **D-06** ✅ Proctoring berbasis perilaku browser only

### Pre-condition (Wajib Selesai Dulu)
- [ ] Fix 5 halaman Suspense (`FE-MED-01`) — blocker build
- [ ] Setup proxy di `frontend/next.config.ts` + buat `frontend/.env.local`

### Sprint I-1: Backend — NISN Migration + Validate Endpoint (1 hari)
- [ ] Prisma migration: rename `nim` → `nisn` di Student model
- [ ] Update `join/route.ts` — schema nisn (10 digit regex), semua query & response
- [ ] Update `auth.ts` — `StudentTokenPayload.nim` → `nisn`
- [ ] Update `exam-session/route.ts` — shuffle seed ganti ke `student.nisn`
- [ ] **Buat `src/app/api/join/validate/route.ts`** — GET endpoint validasi kode
- [ ] Verifikasi: `npx prisma migrate status` clean; validate endpoint berfungsi

### Sprint I-2: Auth Guru Frontend (1-2 hari)
- [ ] Buat `frontend/src/lib/apiClient.ts` (HTTP client + silent refresh)
- [ ] Buat `AuthContext` + `useTeacherAuth` hook
- [ ] Update `login/page.tsx` → POST /api/auth/login real
- [ ] Buat `frontend/src/middleware.ts` route guard /dashboard

### Sprint I-3: Dashboard Data Real (1-2 hari)
- [ ] `dashboard/page.tsx` → GET /api/exams + live stats polling
- [ ] FlagKey mapping: `eventTypeToFlagKey()` dari recentEvents
- [ ] `dashboard/exams/page.tsx` data real; `DashboardShell` user chip real

### Sprint I-4: Alur Siswa P0 (2-3 hari — terbesar)
- [ ] `page.tsx` (halaman /) → GET /api/join/validate
- [ ] `join/identity/page.tsx` → form NISN (10 digit) + POST /api/join
- [ ] Buat `examSession.ts` + `proctoring.ts` (event listeners + mapping)
- [ ] `exam/session/page.tsx` Fase A→E: load → autosave → heartbeat → proctoring → submit

### Sprint I-5: CRUD Ujian Guru (1-2 hari)
- [ ] Detail, edit, new exam pages → real API
- [ ] Status change actions (mulai, akhiri, arsipkan)

### Sprint I-6: Monitoring Live (1 hari)
- [ ] `monitor/page.tsx` polling GET /api/exams/[id]/dashboard
- [ ] WebSocket setup (opsional)



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
