# 🔍 Audit Backend Planning vs PRD — LockIt

> **Tanggal Audit:** 9 Oktober 2026
> **Auditor:** Antigravity (Claude Sonnet 4.6 Thinking)
> **Status:** Draft — Keputusan dicatat, belum diimplementasi
>
> Dokumen yang diaudit:
> - `docs/PRD.md` — Product Requirements Document v2.0
> - `docs/DATABASE.md` — Database Schema & Prisma
> - `docs/ANALYSIS.md` — Analisis & Revisi Tech Stack
> - `docs/USER_FLOWS.md` — Alur Penggunaan Aplikasi

---

## Daftar Isi

1. [Ringkasan Eksekutif](#1-ringkasan-eksekutif)
2. [Celah Keamanan (Security Gaps)](#2-celah-keamanan-security-gaps)
3. [Inkonsistensi Antar-Dokumen](#3-inkonsistensi-antar-dokumen)
4. [Risiko yang Terlewat](#4-risiko-yang-terlewat)
5. [Hal yang Sudah Benar](#5-hal-yang-sudah-benar)
6. [Matriks Prioritas & Urutan Tindakan](#6-matriks-prioritas--urutan-tindakan)

---

## 1. Ringkasan Eksekutif

Secara umum, dokumen backend planning sudah **cukup solid dan konsisten** dengan PRD. Namun ditemukan **7 celah keamanan**, **9 inkonsistensi antar-dokumen**, dan **14 risiko yang terlewat** yang perlu ditangani sebelum mulai coding.

Dari semua temuan tersebut, keputusan sudah diambil untuk sebagian besar item. Sisanya dicatat sebagai pertimbangan untuk fase selanjutnya.

---

## 2. Celah Keamanan (Security Gaps)

### SEC-01: Session Token Mahasiswa — Perlu Investigasi Lebih Lanjut

| Aspek | Detail |
|---|---|
| **Sumber** | DATABASE.md §3.5 |
| **Temuan** | `session_token` siswa disimpan **plaintext** di database (`VARCHAR(255)`), berbeda dengan `refresh_token` guru yang di-hash |
| **Risiko awal** | Jika database bocor, attacker bisa impersonate peserta |

**Keputusan:**

Session token siswa memang **sengaja berbeda** dari token guru — ini bukan bug, tapi design decision. Siswa tidak punya akun dan tidak login; token mereka bersifat sementara (berlaku selama ujian aktif saja).

**⚠️ Namun, ada concern tambahan yang perlu diinvestigasi:**

Pernah terjadi kasus di sistem lain: **HP yang belum pernah submit malah mendapat info "sudah pernah submit"**, karena token yang tersimpan di browser (cookie/localStorage) ternyata **sama** di perangkat berbeda, atau token lama tidak dibersihkan dengan benar.

**Skenario yang harus dicegah:**
1. Mahasiswa A join ujian di HP-nya → dapat session token → submit
2. Mahasiswa B pakai HP yang sama (misal: lab komputer, HP pinjaman) → join ujian yang sama → **browser masih menyimpan token mahasiswa A** → sistem menganggap sudah submit

**Mitigasi yang harus diimplementasi:**
- [ ] Saat join ujian (`POST /api/join`), server **selalu generate token baru** — jangan reuse token lama
- [ ] Client-side: sebelum join, **hapus cookie/session lama** untuk domain ini
- [ ] Token harus di-bind ke kombinasi `exam_id + nim + timestamp` — bukan hanya random string
- [ ] Saat validasi session, cek: apakah `student.status` sudah `submitted`? Jika ya, tolak akses ke halaman ujian (bukan cuma cek token valid/tidak)
- [ ] Pertimbangkan tambahkan `device_fingerprint` sederhana (user-agent + IP) sebagai validasi tambahan — bukan untuk blocking, tapi untuk logging anomali

**Status: 🟡 PERLU INVESTIGASI — desain token flow harus diperjelas sebelum implementasi**

---

### SEC-02: Tidak Ada CSRF Protection

| Aspek | Detail |
|---|---|
| **Sumber** | PRD NFR-02, ANALYSIS.md §3 |
| **Temuan** | Tidak ada mekanisme CSRF. Auth guru pakai refresh token di cookie (httpOnly) — endpoint mutating rentan CSRF |
| **Risiko** | Attacker buat halaman jebakan → kirim request pakai cookie guru yang sedang login → hapus ujian, ubah kebijakan, dll |

**Keputusan:**

Harus ditangani. Opsi implementasi:
- **Opsi A (Rekomendasi):** `SameSite=Strict` pada semua cookie + CSRF token header
- **Opsi B:** Double submit cookie pattern
- **Opsi C:** Jika frontend dan backend beda domain (ANALYSIS.md rekomendasi), `SameSite=Lax` + CORS strict sudah cukup karena cross-origin request otomatis tidak kirim cookie

**Status: 🟢 KEPUTUSAN DIAMBIL — implementasi saat fase auth**

---

### SEC-03: Proctoring Event Tanpa Validasi Ownership

| Aspek | Detail |
|---|---|
| **Sumber** | PRD §8 (`POST /api/proctoring/event`) |
| **Temuan** | Endpoint menerima `student_id` dan `exam_id` di body. Tidak ada validasi bahwa event benar datang dari peserta tersebut |
| **Risiko** | Peserta A kirim event palsu atas nama peserta B → peserta B tampak curang di dashboard |

**Keputusan:**

**Sementara dibiarkan, tapi dicatat sebagai catatan penting.**

Alasan: untuk V1, prioritasnya adalah fitur core berjalan. Validasi ownership bisa ditambahkan setelah core stabil.

**Catatan untuk implementasi nanti:**
- `student_id` dan `exam_id` seharusnya di-resolve dari session token (cookie), bukan dari request body
- Server yang menentukan identitas pengirim, bukan client
- Ini menjadi prioritas tinggi jika platform dipakai di skala besar (ujian publik, bukan hanya kelas)

**Status: 🟡 DICATAT — bukan prioritas V1, tapi harus ditangani sebelum production skala besar**

---

### SEC-04: WebSocket Dashboard Hanya untuk Guru Terauthentikasi

| Aspek | Detail |
|---|---|
| **Sumber** | PRD §8 (`/ws/exam/:id/dashboard`) |
| **Temuan** | PRD mendaftarkan WebSocket endpoint tapi tidak menjelaskan mekanisme auth |
| **Risiko** | Tanpa auth, siapa saja bisa connect dan lihat data peserta real-time |

**Keputusan:**

**WebSocket dashboard HANYA bisa diakses oleh user terauthentikasi (guru/pengawas). Siswa TIDAK boleh mengakses.**

Implementasi yang harus dilakukan:
- [ ] Validasi JWT guru saat Socket.IO handshake (`io.use(middleware)`)
- [ ] Pisahkan namespace Socket.IO:
  - `/teacher-dashboard` — butuh JWT guru, untuk monitoring real-time
  - `/student-session` — butuh session token siswa, untuk heartbeat + warning
- [ ] Tolak connection jika token invalid atau expired
- [ ] Saat guru connect ke dashboard ujian, cek apakah ujian tersebut milik guru itu (`exam.teacher_id === currentUser.id`)
- [ ] Pertimbangkan: bisa tidak guru menambahkan "pengawas" lain? → Out of scope V1, tapi desain namespace harus memungkinkan extension ini

**Status: 🟢 KEPUTUSAN DIAMBIL — wajib implementasi di fase WebSocket**

---

### SEC-05: Cascade Delete Berbahaya untuk Data Audit

| Aspek | Detail |
|---|---|
| **Sumber** | DATABASE.md §5 (Prisma), DATABASE.md catatan #4 |
| **Temuan** | Semua relasi `onDelete: Cascade`. Hapus teacher = hapus semua ujian, soal, peserta, jawaban, log proctoring |
| **Risiko** | Data audit hilang permanen — bertentangan dengan soft delete di PRD FR-02.5 |

**Keputusan:**

**Gunakan soft delete secara konsisten.** Ubah strategi cascade:

| Relasi | Sebelum | Sesudah |
|---|---|---|
| Teacher → Exam | Cascade | **Restrict** — guru tidak bisa dihapus kalau masih punya ujian |
| Exam → Student | Cascade | **Restrict** — ujian yang sudah ada peserta tidak bisa hard delete |
| Exam → Question | Cascade | **Cascade** — OK untuk ujian draft tanpa peserta |
| Exam → ProctoringEvent | Cascade | **Restrict** — log proctoring tidak boleh hilang |
| Student → Answer | Cascade | **Restrict** — jawaban yang sudah submit tidak boleh hilang |

Aturan:
- Ujian `draft` tanpa peserta: boleh hard delete (cascade ke questions OK)
- Ujian yang sudah pernah `active` / ada peserta: **hanya soft delete** (status → `archived`)
- Teacher: tidak boleh dihapus sama sekali di V1 (atau hanya soft delete — tambah field `is_active`)

**Status: 🟢 KEPUTUSAN DIAMBIL — update Prisma schema sebelum implementasi**

---

### SEC-06: Auto-save Hanya Berlaku Selama Durasi Ujian

| Aspek | Detail |
|---|---|
| **Sumber** | PRD FR-04.7, USER_FLOWS.md §9 |
| **Temuan** | Tidak ada proteksi replay attack — request auto-save bisa di-replay setelah ujian berakhir |
| **Risiko** | Jawaban bisa dimanipulasi setelah waktu ujian habis |

**Keputusan:**

**Auto-save hanya akan bekerja selama durasi ujian masih berlangsung.** Server WAJIB validasi sebelum menerima jawaban:

```
Pseudocode validasi auto-save:
1. Cek exam.status === 'active'          → tolak jika bukan active
2. Cek current_time < exam.end_time      → tolak jika sudah lewat
3. Cek student.status !== 'submitted'    → tolak jika sudah submit
4. Cek student.is_locked !== true        → tolak jika terkunci
5. Baru proses simpan jawaban
```

Implementasi:
- [ ] Middleware validasi di endpoint `POST /api/exam-session/answer`
- [ ] Middleware yang sama di `POST /api/exam-session/submit`
- [ ] Return HTTP 403 dengan pesan jelas jika validasi gagal
- [ ] Client-side: stop auto-save interval saat menerima response submit / waktu habis

**Status: 🟢 KEPUTUSAN DIAMBIL — implementasi di fase alur ujian**

---

### SEC-07: Rate Limiting pada Endpoint Join

| Aspek | Detail |
|---|---|
| **Sumber** | PRD NFR-02.3, FR-02.3 |
| **Temuan** | Rate limit umum ada (100 req/menit/IP), tapi endpoint `/api/join` tidak punya rate limit khusus untuk mencegah brute force kode akses |
| **Risiko** | Distributed brute force bisa menemukan kode akses yang valid |

**Keputusan:**

**Tambahkan rate limit khusus di endpoint-endpoint kritis:**

| Endpoint | Rate Limit | Alasan |
|---|---|---|
| `POST /api/auth/login` | 5 attempt gagal / 15 menit per IP | Sudah ada di PRD |
| `POST /api/auth/register` | 3 attempt / 15 menit per IP | Cegah spam akun |
| `POST /api/join` | **5 attempt gagal / 5 menit per IP** | Cegah brute force kode akses |
| `POST /api/proctoring/event` | **60 req / menit per student** | Cegah flood event |
| `POST /api/proctoring/events/batch` | **10 req / menit per student** | Cegah flood batch |
| `POST /api/exam-session/answer` | **30 req / menit per student** | Sesuai auto-save interval |
| Global API | 100 req / menit per IP | Sudah ada di PRD |

Implementasi:
- [ ] Gunakan library `express-rate-limit` atau `rate-limiter-flexible`
- [ ] Rate limit di-apply per endpoint, bukan hanya global
- [ ] Response: HTTP 429 Too Many Requests + `Retry-After` header
- [ ] Pertimbangkan: rate limit berbasis IP vs berbasis session token (untuk student endpoints)

**Status: 🟢 KEPUTUSAN DIAMBIL — implementasi di fase keamanan**

---

## 3. Inkonsistensi Antar-Dokumen

### INC-01: Tech Stack — Next.js vs Express.js + React

| Dokumen | Tech Stack |
|---|---|
| PRD (header) | "Next.js (Full-stack Web)" |
| ANALYSIS.md | "Express.js (backend) + React 19 + Vite (frontend)" |
| Project Context (vault) | "Next.js (Full-stack Web)" |

**Keputusan Final: Next.js Monolith (Full-stack).**

ALYSIS.md merekomendasikan pemisahan, tapi setelah dipertimbangkan, Next.js monolith dipilih karena:
- Lebih simpel untuk single developer / tim kecil
- Next.js App Router sudah mendukung Route Handlers sebagai API endpoint
- WebSocket bisa dijalankan di custom server (`server.js`) dengan Socket.IO
- Satu repo, satu deploy — lebih mudah di-maintain

**Implikasi terhadap ANALYSIS.md:**
- Rekomendasi Express.js **tidak dipakai** — digantikan Next.js Route Handlers
- Multer untuk upload → bisa pakai `next/server` atau library kompatibel Next.js
- Socket.IO tetap dipakai tapi di-attach ke custom Next.js server
- ANALYSIS.md tetap disimpan sebagai dokumen historis (bukan dihapus)

**Tindakan:**
- [x] Keputusan diambil: **Next.js Monolith**
- [ ] Update ANALYSIS.md — tandai sebagai "superceded by keputusan final"
- [ ] Pastikan project context di vault tetap akurat

**Status: 🟢 KEPUTUSAN DIAMBIL — 9 Oktober 2026**

---

### INC-02: State Machine Ujian — 5 Status vs 4 Status

| PRD (FR-02.7) | DATABASE.md + Prisma |
|---|---|
| `draft` → `scheduled` → `active` → `ended` → `archived` | `draft` → `active` → `ended` → `archived` |

**Status `scheduled` hilang** di DATABASE.md. Karena keputusan di PRD/project context adalah **Manual Start** (guru klik start, tidak ada auto-start), status `scheduled` kemungkinan tidak dibutuhkan.

**Tindakan:**
- [ ] Jika memang tidak butuh `scheduled` → hapus dari PRD FR-02.7
- [ ] Jika nanti mau support scheduled start → tambahkan ke Prisma schema
- [ ] Update semua dokumen agar konsisten

**Status: 🟡 PERLU KEPUTUSAN — kemungkinan besar hapus `scheduled`**

---

### INC-03: Endpoint `/api/auth/refresh` Tidak Ada di PRD

| ANALYSIS.md §3.1 | PRD §8 (API Inventory) |
|---|---|
| Menyebutkan perlu endpoint refresh token | Endpoint `POST /api/auth/refresh` tidak terdaftar |

**Tindakan:**
- [ ] Tambahkan `POST /api/auth/refresh` ke PRD §8 bagian Auth

---

### INC-04: Field Database Berbeda Antara PRD dan DATABASE.md

Field yang ada di DATABASE.md tapi **tidak ada di PRD §6**:

| Field | Tabel | Status |
|---|---|---|
| `is_locked` | students | Ditambahkan di ANALYSIS.md — benar dibutuhkan |
| `violation_count` | students | Ditambahkan di ANALYSIS.md — benar dibutuhkan |
| `ip_address` | students | Ditambahkan di ANALYSIS.md — untuk audit |
| `user_agent` | students | Ditambahkan di ANALYSIS.md — untuk audit |
| `refresh_tokens` | (tabel baru) | Ditambahkan di ANALYSIS.md — untuk auth |

Field yang ada di PRD §6 tapi **tidak ada di DATABASE.md**:

| Field | Tabel | Status |
|---|---|---|
| `updated_at` | exams | Hilang di DATABASE.md — perlu ditambahkan |
| `created_at` | questions | Hilang di DATABASE.md — bisa diabaikan |

**Tindakan:**
- [ ] Tambahkan `updated_at` ke tabel exams di DATABASE.md / Prisma
- [ ] Update PRD §6 agar match dengan DATABASE.md (tambah field baru)
- [ ] Atau: jadikan DATABASE.md sebagai **single source of truth** untuk schema, dan PRD §6 cukup referensi ke DATABASE.md

---

### INC-05: `violation_policy` — Field `detect_devtools` Tidak Ada

DATABASE.md mendefinisikan schema `violation_policy`:
```json
{
  "max_violations": 5,
  "action": "warning",
  "detect_copy_paste": true,
  "detect_right_click": false
}
```

Tapi **`detect_devtools` tidak ada**, meskipun PRD FR-05.5 menyebutkan devtools detection sebagai fitur opsional.

**Tindakan:**
- [ ] Tambahkan `detect_devtools: boolean` ke schema `violation_policy`
- [ ] Atau: karena ANALYSIS.md sudah menurunkan prioritas devtools ke P2, buat catatan bahwa ini ditambahkan nanti

---

### INC-06: Geolocation — Sudah Dihapus tapi Masih di PRD

ANALYSIS.md §2.1 memutuskan geolocation dipindah ke Out of Scope V1, tapi PRD masih mencantumkan:
- FR-05.6 (Geolocation detection)
- Event type `location_denied` di data model

**Tindakan:**
- [ ] Hapus FR-05.6 dari PRD
- [ ] Hapus `location_denied` dari enum `event_type`
- [ ] Tambahkan "Geolocation detection" ke PRD §14 (Out of Scope V1)

---

### INC-07: Soal Per-Batch vs Sekaligus

| ANALYSIS.md §2.3 | PRD §12 Risiko #4 |
|---|---|
| "Soal dikirim sekaligus saat ujian dimulai" | "Soal dikirim per-batch, bukan sekaligus" |

Keputusan sudah diambil di ANALYSIS.md (kirim sekaligus), tapi PRD belum diupdate.

**Tindakan:**
- [ ] Update PRD §12 Risiko #4 agar konsisten dengan ANALYSIS.md

---

### INC-08: Session Peserta — Detail Implementasi

PRD hanya menyebut "session berlaku selama ujian", sedangkan ANALYSIS.md dan project context sudah memperjelas: **session via httpOnly cookie**.

**Tindakan:**
- [ ] Update PRD FR-01.4 dan NFR-02.6 agar eksplisit menyebutkan cookie-based session

---

### INC-09: Gambar Soal — In-Scope tapi Tanpa Schema

Project context menyebutkan "Bank Soal: XML dan JSON (**mendukung gambar**)" dan gambar soal in-scope V1. Tapi:
- PRD §7 (Bank Soal Schema) tidak ada field gambar
- DATABASE.md `question_text` hanya `TEXT`
- Tidak ada mekanisme upload/storage gambar

**Keputusan:**

**Tambahkan schema soal dengan dukungan gambar.** Berikut desainnya:

#### Opsi yang dipilih: Field `image_url` per soal + per opsi

Tambahkan ke tabel `questions`:
```
image_url     VARCHAR(500)   nullable   — URL gambar soal (jika ada)
```

Update schema `options` di JSONB:
```json
[
  {
    "label": "A",
    "text": "Hyper Text Markup Language",
    "image_url": null
  },
  {
    "label": "B",
    "text": "",
    "image_url": "/uploads/exams/{exam_id}/q1_optB.png"
  }
]
```

Update Bank Soal JSON Schema:
```json
{
  "questions": [
    {
      "id": 1,
      "text": "Perhatikan gambar berikut, apa nama komponen yang ditandai?",
      "image_url": "gambar_soal_1.png",
      "type": "multiple_choice",
      "points": 10,
      "options": [
        { "label": "A", "text": "Resistor", "image_url": null },
        { "label": "B", "text": "Kapasitor", "image_url": null },
        { "label": "C", "text": "Induktor", "image_url": null },
        { "label": "D", "text": "Dioda", "image_url": null }
      ]
    }
  ]
}
```

Update Bank Soal XML Schema:
```xml
<question id="1" type="multiple_choice" points="10">
  <text>Perhatikan gambar berikut, apa nama komponen yang ditandai?</text>
  <image>gambar_soal_1.png</image>
  <options>
    <option label="A">Resistor</option>
    <option label="B" image="optB.png">Kapasitor</option>
  </options>
</question>
```

Mekanisme upload gambar:
- Gambar bisa di-embed di file JSON (base64) atau di-upload terpisah
- Rekomendasi: upload terpisah via form multipart, simpan di `/uploads/exams/{exam_id}/`
- Validasi: max 2MB per gambar, format: PNG, JPG, WEBP
- Saat parsing bank soal, jika ada `image_url` yang merujuk filename lokal, cek apakah file sudah diupload

**Tindakan:**
- [ ] Update DATABASE.md — tambah field `image_url` ke tabel questions
- [ ] Update Prisma schema
- [ ] Update PRD §7 — tambah field gambar di JSON dan XML schema
- [ ] Definisikan endpoint upload gambar: `POST /api/exams/:id/questions/upload-image`
- [ ] Definisikan batas ukuran dan format gambar

**Status: 🟢 KEPUTUSAN DIAMBIL — schema sudah didefinisikan di atas**

---

## 4. Risiko yang Terlewat

### RISK-01: Tidak Ada Auto-End Scheduler

| Aspek | Detail |
|---|---|
| **Sumber** | PRD FR-02.7 (state machine), USER_FLOWS.md §3 |
| **Temuan** | Siapa yang trigger transisi `active` → `ended` saat waktu habis? PRD hanya menyebutkan "guru klik Akhiri" atau "waktu habis", tapi tidak ada mekanisme otomatis |

**Keputusan:**

**Tambahkan auto-end scheduler yang trigger saat ujian berakhir.**

Mekanisme:
1. Saat guru klik "Mulai Ujian" (`PUT /api/exams/:id/status` → active):
   - Set `start_time = now()`
   - Set `end_time = start_time + duration_minutes`
   - **Schedule job** yang akan dieksekusi pada `end_time`

2. Saat `end_time` tercapai, scheduler menjalankan:
   ```
   a. Ubah exam.status → 'ended'
   b. Untuk setiap student yang status !== 'submitted':
      - Ambil jawaban terakhir yang tersimpan
      - Set student.status → 'submitted'
      - Set student.submitted_at → end_time
      - Catat: auto-submitted
   c. Tutup WebSocket room ujian
   d. Trigger auto-grading (batch)
   e. Kirim notifikasi ke dashboard guru: "Ujian telah berakhir"
   ```

3. Guru tetap bisa "Akhiri Ujian" secara manual sebelum `end_time`:
   - Cancel scheduled job
   - Jalankan proses yang sama seperti di atas

Opsi teknologi scheduler (konteks: **Next.js Monolith** dengan custom server):
- **BullMQ** (Redis-backed queue) — robust, persist across restart, direkomendasikan jika Redis tersedia
- **`setTimeout` + re-schedule saat boot** — lebih simpel, cocok untuk V1 tanpa Redis dependency tambahan (cek semua ujian `active` yang `end_time` belum lewat saat `server.js` start)
- ~~`node-cron`~~ — tidak direkomendasikan, tidak persist dan kurang presisi untuk task per-ujian

Rekomendasi untuk Next.js Monolith: **`setTimeout` + re-schedule saat boot** untuk V1 (simpel, tanpa infrastruktur tambahan). Upgrade ke BullMQ jika sudah ada Redis untuk Socket.IO adapter.

**Tindakan:**
- [ ] Pilih teknologi scheduler (default: `setTimeout` + re-schedule)
- [ ] Implementasi di `server.js` custom Next.js — bukan di Route Handler (tidak bisa long-running)
- [ ] Implementasi auto-end di fase alur ujian
- [ ] Handle edge case: server restart saat ujian berlangsung → re-schedule

**Status: 🟢 KEPUTUSAN DIAMBIL — wajib implementasi**

---

### RISK-02: Race Condition pada Auto-save + Submit

| Aspek | Detail |
|---|---|
| **Temuan** | Auto-save setiap 30 detik. Jika auto-save sedang in-flight saat peserta klik submit manual, atau saat server auto-submit karena waktu habis — jawaban mana yang dipakai? |

**Keputusan:**

**Belum diputuskan — perlu pertimbangan lebih lanjut.**

Opsi yang bisa dipertimbangkan:
- **Opsi A:** Submit manual dan auto-submit selalu menang. Jika ada auto-save in-flight, hasilnya diabaikan karena `student.status` sudah `submitted`
- **Opsi B:** Gunakan `updated_at` sebagai version check — jawaban dengan timestamp terbaru yang menang
- **Opsi C:** Database transaction + row-level locking saat submit

Pertimbangan:
- Auto-save hanya menyimpan jawaban yang berubah (delta), bukan semua
- Submit mengirim semua jawaban final sekaligus
- Setelah submit, semua request auto-save harus ditolak (lihat SEC-06)

**Status: ❓ PERLU PERTIMBANGAN LEBIH LANJUT**

---

### RISK-03: Skenario Banyak Ujian Aktif Bersamaan

| Aspek | Detail |
|---|---|
| **Temuan** | PRD hanya membahas "100 peserta per ujian". Tapi bagaimana jika 10 guru masing-masing punya ujian aktif? Total 1000 koneksi WebSocket + heartbeat setiap 10 detik |

Estimasi load per ujian:
- 100 peserta × heartbeat/10 detik = 600 heartbeat req/menit
- 100 peserta × auto-save/30 detik = 200 auto-save req/menit
- Dashboard guru: ~10 WebSocket events/detik
- Total per ujian: ~800-900 req/menit

10 ujian bersamaan = **~8000-9000 req/menit**

Belum tentu masalah untuk **Next.js Monolith + PostgreSQL**, tapi perlu awareness. Next.js Route Handlers berjalan di Node.js yang sama dengan custom server, jadi perhatikan blocking operations. Jika jadi masalah:
- Pertimbangkan Redis adapter untuk Socket.IO (scale horizontal)
- Pisahkan WebSocket server jika bottleneck ada di situ
- Connection pooling Prisma sudah di-handle otomatis

**Status: 🟡 DICATAT — monitor saat testing load**

---

### RISK-04: Tidak Ada Validasi Ukuran File Upload

| Aspek | Detail |
|---|---|
| **Temuan** | Upload bank soal (XML/JSON) tanpa batas ukuran. File 500MB bisa crash server |

**Keputusan:**

Tambahkan validasi:
- Max file size: **5 MB** per upload bank soal
- Max jumlah soal per ujian: **200 soal**
- Max gambar per soal: **2 MB** per gambar
- Format gambar: PNG, JPG, WEBP
- Konfigurasi di Multer

**Status: 🟢 KEPUTUSAN DIAMBIL**

---

### RISK-05: Tidak Ada Strategi Backup Data Ujian

| Aspek | Detail |
|---|---|
| **Temuan** | Data jawaban peserta bersifat irreplaceable. Tidak ada strategi backup di PRD |

Untuk V1 (single VPS):
- PostgreSQL WAL archiving minimal
- Daily pg_dump sebagai baseline
- Pertimbangkan: write-ahead di application level untuk jawaban kritis

**Status: 🟡 DICATAT — implementasi saat deployment**

---

### RISK-06: Timezone di Database

| Aspek | Detail |
|---|---|
| **Temuan** | DATABASE.md pakai `TIMESTAMP` tanpa `WITH TIME ZONE`. Bisa bermasalah jika server pindah timezone |

**Keputusan:**
- Gunakan `TIMESTAMP WITH TIME ZONE` (TIMESTAMPTZ) di PostgreSQL
- Simpan semua waktu dalam **UTC**
- Client yang konversi ke timezone lokal user
- Prisma handle ini secara default

**Status: 🟢 KEPUTUSAN DIAMBIL**

---

### RISK-07: Tidak Ada Audit Log untuk Aksi Guru

| Aspek | Detail |
|---|---|
| **Temuan** | Sistem catat pelanggaran peserta detail, tapi aksi guru tidak di-log (start ujian, kirim warning, unlock, edit soal) |

Untuk V1: fokus dulu ke core. Audit log guru bisa ditambahkan di V2.

Tabel yang dibutuhkan nanti:
```
audit_logs:
  - id (UUID)
  - teacher_id (FK)
  - action (enum: start_exam, end_exam, send_warning, unlock_student, edit_exam, delete_exam)
  - target_entity (string: exam, student, question)
  - target_id (UUID)
  - metadata (JSONB)
  - timestamp (TIMESTAMPTZ)
```

**Status: 🟡 OUT OF SCOPE V1 — catat untuk V2**

---

### RISK-08: NIM Duplikat Lintas Ujian

| Aspek | Detail |
|---|---|
| **Temuan** | Unique constraint `(exam_id, nim)` benar. Tapi mahasiswa bisa join ujian berbeda dengan nama berbeda (NIM sama, nama beda) |

Impact rendah untuk V1. Jika nanti ada fitur "riwayat per mahasiswa", baru jadi masalah.

**Status: 🟡 LOW PRIORITY — awareness saja**

---

### RISK-09: Memory Leak pada Event Buffer Client-Side

| Aspek | Detail |
|---|---|
| **Temuan** | Event yang gagal terkirim di-buffer di client tanpa batas. Koneksi putus lama + banyak event = buffer membengkak |

**Keputusan:**
- Max buffer: 100 events atau 500KB (mana yang tercapai duluan)
- Jika penuh: drop event tertua
- Dokumentasikan di contract frontend-backend

**Status: 🟢 KEPUTUSAN DIAMBIL**

---

### RISK-10: Tidak Ada Health Check Endpoint

Tambahkan:
- `GET /api/health` — return `{ status: "ok", timestamp: "..." }` untuk load balancer
- `GET /api/health/db` — cek koneksi database (optional, hanya untuk internal)

**Status: 🟢 KEPUTUSAN DIAMBIL**

---

### RISK-11: Error Response Format Tidak Didefinisikan

Definisikan standard error response:
```json
{
  "success": false,
  "error": {
    "code": "EXAM_NOT_FOUND",
    "message": "Ujian dengan kode tersebut tidak ditemukan",
    "details": {}
  }
}
```

Success response:
```json
{
  "success": true,
  "data": { ... }
}
```

**Status: 🟢 KEPUTUSAN DIAMBIL**

---

### RISK-12: Concurrency Control untuk Edit Ujian

| Aspek | Detail |
|---|---|
| **Temuan** | Guru buka edit di 2 tab, edit di tab 1, lalu tab 2 — tab 2 overwrite tanpa warning |

Low priority untuk V1 (satu guru kemungkinan kecil edit dari 2 tab). Tapi bisa ditangani sederhana dengan cek `updated_at` saat submit edit.

**Status: 🟡 LOW PRIORITY**

---

### RISK-13: Password Reset Flow Tidak Ada

PRD tidak mendefinisikan alur "Lupa Password". Untuk V1, minimal:
- Tambahkan ke Out of Scope V1
- Atau: implementasi sederhana via email reset link

**Status: 🟡 OUT OF SCOPE V1**

---

### RISK-14: Auto-grading Timing

| Aspek | Detail |
|---|---|
| **Temuan** | Kapan grading dijalankan? Per submit? Saat ujian berakhir? |

**Keputusan:**

Grading dijalankan dalam **dua tahap**:
1. **Saat peserta submit** (manual atau auto) → grade jawaban peserta tersebut saja
2. **Saat ujian berakhir** (auto-end scheduler) → batch grade semua peserta yang belum ter-grade

Ini menghindari delay besar di akhir ujian dan memungkinkan guru melihat nilai peserta yang sudah submit sementara ujian masih berjalan.

**Status: 🟢 KEPUTUSAN DIAMBIL**

---

## 5. Hal yang Sudah Benar

| # | Aspek | Catatan |
|---|---|---|
| 1 | Filosofi best-effort proctoring | Jujur, realistis, tidak over-promise |
| 2 | Composite unique `(exam_id, nim)` | Benar dan sudah ada di Prisma schema |
| 3 | Refresh token guru di-hash | Raw token tidak disimpan di DB |
| 4 | `is_correct` NULL selama ujian | Mencegah client mengetahui jawaban benar |
| 5 | Heartbeat + reconnect handling | Flow sudah jelas dan comprehensive |
| 6 | Event buffering di client | Antisipasi koneksi tidak stabil |
| 7 | Rate limiting di PRD | 5 attempt/15min login, 100 req/min API |
| 8 | JSONB untuk policy/settings | Fleksibel untuk evolusi schema |
| 9 | Index recommendations di DATABASE.md | Sudah dipikirkan dengan baik |
| 10 | Soft delete untuk ujian | Data ujian yang sudah berjalan tidak hilang |
| 11 | Manual Start (guru klik) | Lebih reliable daripada auto-start terjadwal |
| 12 | Fixed Window Timer | Semua peserta selesai di waktu yang sama |
| 13 | Session via httpOnly Cookie | Aman dari XSS untuk peserta |

---

## 6. Matriks Prioritas & Urutan Tindakan

### Prioritas Temuan

| ID | Temuan | Severity | Status Keputusan | Prioritas |
|---|---|---|---|---|
| INC-01 | Tech stack: Next.js Monolith | 🟢 Resolved | 🟢 Diputuskan | ~~P0~~ |
| SEC-01 | Session token collision | 🔴 Critical | 🟡 Perlu investigasi | **P0** |
| SEC-04 | WebSocket auth guru only | 🔴 High | 🟢 Diputuskan | **P0** |
| SEC-05 | Soft delete, bukan cascade | 🔴 High | 🟢 Diputuskan | **P0** |
| RISK-01 | Auto-end scheduler | 🔴 High | 🟢 Diputuskan | **P0** |
| SEC-06 | Auto-save validasi durasi | 🟠 High | 🟢 Diputuskan | **P1** |
| SEC-07 | Rate limit per endpoint | 🟠 High | 🟢 Diputuskan | **P1** |
| SEC-02 | CSRF protection | 🟠 Medium | 🟢 Diputuskan | **P1** |
| INC-09 | Schema soal gambar | 🟠 Medium | 🟢 Diputuskan | **P1** |
| RISK-02 | Race condition auto-save | 🟠 Medium | ❓ Belum diputuskan | **P1** |
| SEC-03 | Ownership validation | 🟡 Medium | 🟡 Dicatat | **P2** |
| INC-02 | State machine konsistensi | 🟡 Low | 🟡 Perlu keputusan | **P2** |
| INC-03–08 | Inkonsistensi docs lain | 🟡 Low | 🟡 Update docs | **P2** |
| RISK-03–14 | Risiko minor | 🟡 Low | Campuran | **P2-P3** |

### Urutan Tindakan yang Disarankan

```
FASE 0 — Sebelum Coding (Wajib)
├── 1. ✅ Tech stack final: Next.js Monolith (INC-01) — SELESAI
├── 2. Investigasi session token flow (SEC-01)
├── 3. Update semua dokumen agar konsisten (INC-02 s/d INC-08)
└── 4. Update Prisma schema: soft delete + image_url (SEC-05, INC-09)

FASE 1 — Saat Implementasi Auth
├── 5. CSRF protection (SEC-02)
├── 6. Rate limiting per endpoint (SEC-07)
└── 7. WebSocket auth middleware (SEC-04)

FASE 2 — Saat Implementasi Alur Ujian
├── 8. Auto-save validasi durasi (SEC-06)
├── 9. Auto-end scheduler (RISK-01)
├── 10. Race condition handling (RISK-02)
└── 11. File upload size limit (RISK-04)

FASE 3 — Sebelum Production
├── 12. Health check endpoint (RISK-10)
├── 13. Error response format (RISK-11)
├── 14. Timezone TIMESTAMPTZ (RISK-06)
└── 15. Buffer limit client-side (RISK-09)
```

---

> **Catatan:** Dokumen ini adalah **living document**. Akan diupdate seiring development berjalan dan keputusan baru diambil.
>
> *Terakhir diupdate: 9 Oktober 2026 — Update: arsitektur monolith dikonfirmasi (Next.js), referensi Express.js lama dibersihkan*
