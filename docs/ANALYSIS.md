# Analisis & Revisi — LockIt

> Dokumen ini berisi analisis kebutuhan proyek LockIt — apa yang perlu diubah dan kenapa.

---

## 1. Revisi Tech Stack

### Masalah: Next.js Full-stack Kurang Cocok

Rencana awal menetapkan **Next.js** sebagai satu-satunya tech stack. Ini bermasalah karena:

| Masalah | Penjelasan |
|---|---|
| **Bundle besar** | Next.js mengirim banyak JavaScript ke browser. Berat di HP murah atau koneksi lambat |
| **WebSocket tidak langsung jalan** | Next.js (apalagi di Vercel) tidak mendukung WebSocket secara bawaan. Padahal kita butuh koneksi dua arah untuk heartbeat, dashboard live, dan kirim warning |
| **Frontend & backend campur** | Sulit dibagi kerjanya kalau backend dev dan frontend dev berbeda orang |
| **Deploy ribet** | Kalau butuh WebSocket, harus deploy di server sendiri. Setup Next.js di server lebih rumit dibanding Express biasa |

### Rekomendasi: Pisahkan Frontend dan Backend

| Lapisan | Teknologi | Kenapa |
|---|---|---|
| **Frontend** | React 19 + Vite | Bundle kecil (~80KB), build cepat, bisa jalan di HP murah |
| **Styling** | TailwindCSS | Cepat bikin UI, tidak perlu tulis CSS manual |
| **Backend** | Express.js (Node.js) | Ringan, simpel, WebSocket langsung bisa, banyak referensi |
| **Database** | PostgreSQL | Gratis, stabil, cocok untuk data yang saling berhubungan (relasional) |
| **ORM** | Prisma | Penghubung backend ke database, bikin query lebih aman dan mudah |
| **Real-time** | Socket.IO | Untuk koneksi dua arah (heartbeat, dashboard live, warning). Otomatis punya cadangan kalau WebSocket tidak jalan |
| **Auth** | JWT (access token + refresh token) | Simpel, tidak butuh penyimpanan session di server |
| **Validasi input** | Zod | Memastikan data yang masuk ke server formatnya benar |
| **Upload file** | Multer | Untuk upload bank soal (XML/JSON) |
| **Export** | ExcelJS + csv-writer | Untuk download hasil ujian dalam format Excel dan CSV |
| **Hashing password** | bcrypt | Mengacak password sebelum disimpan, standar keamanan |

### Keuntungan Pemisahan

```
SEBELUM (Next.js full-stack):
┌─────────────────────────┐
│   Next.js               │
│   Frontend + Backend    │ ← Satu project, satu deploy, sulit dibagi
│   campur jadi satu      │
└─────────────────────────┘

SESUDAH (Terpisah):
┌────────────────┐     ┌────────────────┐
│   React + Vite │ ──→ │   Express.js   │
│   (Frontend)   │ API │   (Backend)    │
│   Tim Frontend │     │   Tim Backend  │
└────────────────┘     └────┬───────────┘
                            │
                       ┌────▼───────────┐
                       │  PostgreSQL    │
                       │  (Database)    │
                       └────────────────┘
```

---

## 2. Revisi Fitur

### 2.1 Hapus: Geolocation Detection (FR-05.6)

**Status: Pindahkan ke "Out of Scope V1"**

| Alasan |
|---|
| Lokasi dari browser tidak akurat — bisa meleset ratusan meter di laptop/desktop |
| Mudah dipalsukan pakai VPN atau pengaturan browser |
| Banyak pengguna akan menolak izin lokasi, jadi datanya tidak lengkap |
| Menambah kompleksitas tanpa manfaat yang sepadan |

### 2.2 Turunkan Prioritas: Devtools Detection (FR-05.5)

**Dari P1 jadi P2 (opsional)**

Fitur ini pada kenyataannya mudah dilewati oleh pengguna (misalnya: buka browser lain, matikan JavaScript, dll). Cukup implementasi sederhana saja, lalu fokus ke fitur yang lebih berdampak.

### 2.3 Ubah: Pengiriman Soal (Risiko #4)

**Sebelum:** Soal dikirim per-batch (sebagian-sebagian)
**Sesudah:** Soal dikirim sekaligus saat ujian dimulai

| Alasan |
|---|
| Kirim per-batch menambah kerumitan kode yang tidak sebanding |
| Mahasiswa yang mau curang tetap bisa foto layar kapan saja |
| Lebih simpel = lebih sedikit bug |

### 2.4 Ubah Istilah: "VPS" → "Server" (FR-02.2)

"VPS" itu istilah spesifik untuk satu jenis hosting. Yang penting konsepnya: **waktu dihitung di server, bukan di browser pengguna**. Mau deploy di mana saja, prinsipnya sama.

---

## 3. Revisi Keamanan

### 3.1 Session / Token (NFR-02.6)

**Sebelum:**
> JWT dengan masa berlaku 24 jam (guru). Peserta: session berlaku selama ujian aktif

**Masalah:** Kalau token dicuri, pencuri punya akses selama 24 jam penuh tanpa bisa dicegah.

**Sesudah:**

| Jenis Token | Untuk Siapa | Masa Berlaku | Disimpan Di |
|---|---|---|---|
| Access token | Guru | 15 menit | Memory browser (variabel JavaScript) |
| Refresh token | Guru | 7 hari | Cookie (httpOnly, tidak bisa diakses JavaScript) |
| Session token | Mahasiswa | Selama ujian aktif | Cookie |

**Cara kerja:**
1. Guru login → dapat access token (15 menit) + refresh token (7 hari)
2. Setiap request ke API, kirim access token
3. Kalau access token kedaluwarsa, otomatis minta yang baru pakai refresh token
4. Kalau refresh token juga kedaluwarsa, guru harus login ulang
5. Refresh token disimpan di database supaya bisa dicabut paksa kalau perlu

### 3.2 Password Hashing (NFR-02.1)

**Sebelum:** bcrypt **atau** argon2
**Sesudah:** bcrypt saja (10 salt rounds)

| Alasan |
|---|
| Pilih satu supaya konsisten |
| bcrypt sudah cukup aman dan mudah di-setup di Node.js |
| Argon2 lebih baru tapi kadang bermasalah saat instalasi di beberapa OS |

---

## 4. Revisi Data Model

### 4.1 Tambah Field di Tabel STUDENTS

| Field Baru | Tipe | Fungsi |
|---|---|---|
| `is_locked` | boolean | Menandai apakah peserta terkunci karena terlalu banyak pelanggaran |
| `violation_count` | integer | Jumlah total pelanggaran (supaya dashboard tidak hitung ulang dari awal setiap kali) |
| `ip_address` | string | IP peserta saat join — untuk bukti audit |
| `user_agent` | string | Info browser/device peserta — untuk bukti audit |

### 4.2 Tambah Tabel Baru: REFRESH_TOKENS

Dibutuhkan untuk mendukung sistem auth yang lebih aman (lihat bagian 3.1).

| Field | Tipe | Fungsi |
|---|---|---|
| `id` | UUID | ID unik |
| `teacher_id` | UUID (FK) | Punya guru mana |
| `token_hash` | string | Hash dari refresh token (jangan simpan token mentah) |
| `expires_at` | datetime | Kapan kedaluwarsa |
| `created_at` | datetime | Kapan dibuat |
| `is_revoked` | boolean | Apakah sudah dicabut paksa |

### 4.3 Tambah Endpoint API

| Method | Endpoint | Fungsi |
|---|---|---|
| POST | `/api/auth/refresh` | Minta access token baru pakai refresh token |

---

## 5. Revisi Roadmap

### Masalah

Roadmap sebelumnya menggunakan diagram `gantt` yang tidak didukung semua alat baca Mermaid. Selain itu, fase-fasenya perlu disesuaikan dengan tech stack baru (frontend dan backend terpisah).

### Roadmap Revisi

| Fase | Modul | Perkiraan |
|---|---|---|
| **1 — Fondasi** | Setup project (Express + Prisma + PostgreSQL) | 2-3 hari |
| | Auth guru (register, login, logout, refresh token) | 2 hari |
| | CRUD ujian + generate kode akses | 3 hari |
| **2 — Alur Ujian** | Upload & parsing bank soal (XML/JSON) | 2 hari |
| | Endpoint soal + timer (hitung waktu di server) | 3 hari |
| | Join ujian + session mahasiswa | 2 hari |
| | Auto-save jawaban + submit | 2 hari |
| **3 — Proctoring** | Endpoint terima event proctoring | 2 hari |
| | Endpoint batch event (untuk buffer/retry) | 1 hari |
| | Heartbeat + deteksi offline | 2 hari |
| **4 — Dashboard** | Socket.IO setup + real-time dashboard | 4 hari |
| | Aksi guru: kirim warning + unlock peserta | 2 hari |
| | Detail log pelanggaran per peserta | 2 hari |
| **5 — Hasil** | Auto-grading soal pilihan ganda | 2 hari |
| | Rekap nilai + statistik | 2 hari |
| | Export CSV dan Excel | 2 hari |
| **6 — Penyempurnaan** | Keamanan (rate limit, sanitasi input, dll) | 2 hari |
| | Testing + perbaikan bug | 3 hari |

> Roadmap ini **hanya untuk backend**. Frontend punya timeline sendiri yang dikerjakan paralel oleh tim frontend.

---

## 6. Hal yang Sudah Bagus (Tidak Perlu Diubah)

| Bagian | Catatan |
|---|---|
| **Problem Statement** | Jujur dan realistis, tidak berlebihan |
| **User Personas** | Relevan — guru dan mahasiswa, cukup untuk V1 |
| **User Stories** | Lengkap, prioritas jelas (P0/P1/P2) |
| **Filosofi proctoring "best-effort"** | Pendekatan yang benar — jujur soal keterbatasan |
| **Struktur Data Model** | Relasi antar tabel sudah benar |
| **API Inventory** | Lengkap dan terorganisir per fitur |
| **Flow Diagrams** | Jelas, mudah diikuti |
| **Acceptance Criteria** | Bisa langsung dijadikan checklist testing |
| **Batasan & Risiko** | Realistis, bukan formalitas |
| **Out of Scope** | Tepat — tidak memaksakan fitur yang belum perlu |

---

*Dokumen ini dibuat pada 25 September 2026*
