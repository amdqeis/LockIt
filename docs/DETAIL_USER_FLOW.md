# 🗺️ Detail User Flow — LockIt
## Panduan Lengkap End-to-End per Role & Fitur (untuk Mockup)

> **Tujuan dokumen ini:** Menjadi acuan desainer dalam membuat mockup screen-by-screen.
> Setiap layar didefinisikan: elemen apa yang muncul, state apa yang aktif, aksi apa yang bisa dilakukan, dan ke mana user diarahkan selanjutnya.
>
> **Sumber:** `PRD.md` · `USER_FLOWS.md` · `UI_REQUIREMENTS.md`
> **Tanggal:** 11 Oktober 2026

---

## Daftar Isi

### 🧑‍🏫 Role: Guru / Dosen
1. [F1 — Registrasi Akun Guru](#f1--registrasi-akun-guru)
2. [F2 — Login Guru](#f2--login-guru)
3. [F3 — Dashboard Utama](#f3--dashboard-utama)
4. [F4 — Membuat Ujian Baru](#f4--membuat-ujian-baru)
5. [F5 — Detail Ujian & Kode Akses](#f5--detail-ujian--kode-akses)
6. [F6 — Edit Ujian](#f6--edit-ujian)
7. [F7 — Memulai & Mengakhiri Ujian](#f7--memulai--mengakhiri-ujian)
8. [F8 — Monitoring Ujian Real-Time](#f8--monitoring-ujian-real-time)
9. [F9 — Kirim Warning ke Peserta](#f9--kirim-warning-ke-peserta)
10. [F10 — Unlock Peserta Terkunci](#f10--unlock-peserta-terkunci)
11. [F11 — Detail Pelanggaran Peserta](#f11--detail-pelanggaran-peserta)
12. [F12 — Hasil Ujian & Grading](#f12--hasil-ujian--grading)
13. [F13 — Detail Jawaban Per Peserta](#f13--detail-jawaban-per-peserta)
14. [F14 — Export Hasil Ujian](#f14--export-hasil-ujian)
15. [F15 — Logout Guru](#f15--logout-guru)

### 🧑‍🎓 Role: Mahasiswa / Peserta
16. [M1 — Join Ujian (Input Kode)](#m1--join-ujian-input-kode)
17. [M2 — Input Identitas (Nama & NIM)](#m2--input-identitas-nama--nim)
18. [M3 — Waiting Room](#m3--waiting-room)
19. [M4 — Request Fullscreen & Mulai Ujian](#m4--request-fullscreen--mulai-ujian)
20. [M5 — Mengerjakan Soal (Mode Satu per Satu)](#m5--mengerjakan-soal-mode-satu-per-satu)
21. [M6 — Mengerjakan Soal (Mode Semua Sekaligus)](#m6--mengerjakan-soal-mode-semua-sekaligus)
22. [M7 — Menerima Warning dari Guru](#m7--menerima-warning-dari-guru)
23. [M8 — Kondisi Peserta Terkunci (Locked)](#m8--kondisi-peserta-terkunci-locked)
24. [M9 — Submit Manual](#m9--submit-manual)
25. [M10 — Auto-Submit (Waktu Habis / Ujian Diakhiri)](#m10--auto-submit-waktu-habis--ujian-diakhiri)
26. [M11 — Halaman Selesai](#m11--halaman-selesai)

### ⚙️ Sistem / Background
27. [S1 — Proctoring Event Detection](#s1--proctoring-event-detection)
28. [S2 — Heartbeat & Reconnect](#s2--heartbeat--reconnect)
29. [S3 — Auto-Save Jawaban](#s3--auto-save-jawaban)

---

## Konvensi Dokumen

| Simbol | Arti |
|---|---|
| 🖥️ **Layar** | Screen / halaman yang perlu dibuat mockup-nya |
| 📦 **State** | Kondisi UI yang berbeda pada layar yang sama |
| ➡️ **Navigasi** | User diarahkan ke layar mana |
| ⚠️ **Error State** | Tampilan saat ada error |
| 💡 **Catatan Mockup** | Hal penting untuk desainer |

---
---

# 🧑‍🏫 ROLE: GURU / DOSEN

---

## F1 — Registrasi Akun Guru

**Route:** `/register`
**Kondisi akses:** Hanya bisa diakses jika belum login. Jika sudah login, redirect ke `/dashboard`.

### 🖥️ Layar F1.1: Halaman Register

**Layout:** Centered card (max-width 440px), background neutral-50, vertikal tengah layar.

**Elemen yang tampil:**

| No | Elemen | Detail Visual |
|---|---|---|
| 1 | Logo + nama app | Icon 🔒 + teks **"LockIt"** (font bold, indigo), di atas form |
| 2 | Heading | **"Buat Akun Guru"** — H1, 28px |
| 3 | Subheading | "Isi data di bawah untuk mulai menggunakan LockIt" — abu |
| 4 | Input: Nama Lengkap | Label: "Nama Lengkap", placeholder: "Ahmad Fauzi, S.T.", required |
| 5 | Input: Email | Label: "Email", type=email, placeholder: "ahmad@kampus.ac.id", required |
| 6 | Input: Password | Label: "Password", type=password, toggle show/hide (ikon mata), min 8 karakter |
| 7 | Input: Konfirmasi Password | Label: "Konfirmasi Password", harus cocok dengan #6 |
| 8 | Button: "Daftar Sekarang" | Primary, lg, full-width |
| 9 | Link bawah | "Sudah punya akun? **Masuk**" → `/login` |

**State & Validasi (error inline di bawah field):**

| 📦 State | Trigger | Tampilan |
|---|---|---|
| Default | Halaman baru dibuka | Semua field kosong, tombol aktif |
| Loading | Tombol diklik, request dikirim | Tombol disabled + spinner, teks "Mendaftar..." |
| Error: Nama kosong | Submit tanpa nama | Error merah: "Nama wajib diisi" |
| Error: Email kosong | Submit tanpa email | Error merah: "Email wajib diisi" |
| Error: Format email salah | Email bukan format valid | Error merah: "Format email tidak valid" |
| Error: Password pendek | Password < 8 karakter | Error merah: "Password minimal 8 karakter" |
| Error: Konfirmasi tidak cocok | Konfirmasi tidak sama dengan password | Error merah: "Password tidak cocok" |
| Error: Email sudah ada | API return 409 | Toast error: "Email sudah digunakan, coba email lain" |
| Error: Rate limit | API return 429 | Toast error: "Terlalu banyak percobaan. Coba lagi dalam 15 menit." |
| Sukses | API return 201 | Redirect ke `/login` + Toast success: "Akun berhasil dibuat, silakan masuk" |

**Navigasi dari layar ini:**
- Sukses daftar → `/login`
- Klik link "Masuk" → `/login`

💡 **Catatan Mockup:** Buat 4 variant frame: Default, Loading, Error (satu field), Error Email Duplikat.

---

## F2 — Login Guru

**Route:** `/login`
**Kondisi akses:** Hanya bisa diakses jika belum login.

### 🖥️ Layar F2.1: Halaman Login

**Layout:** Centered card (max-width 440px), background neutral-50, vertikal tengah layar.

**Elemen yang tampil:**

| No | Elemen | Detail Visual |
|---|---|---|
| 1 | Logo + nama app | Icon 🔒 + teks **"LockIt"** |
| 2 | Tagline | "Platform Ujian Online dengan Proctoring" — abu, kecil |
| 3 | Input: Email | Label: "Email", type=email, required |
| 4 | Input: Password | Label: "Password", type=password, toggle show/hide |
| 5 | Button: "Masuk" | Primary, lg, full-width |
| 6 | Link bawah | "Belum punya akun? **Daftar di sini**" → `/register` |

**State & Validasi:**

| 📦 State | Trigger | Tampilan |
|---|---|---|
| Default | Halaman baru dibuka | Semua field kosong |
| Loading | Tombol diklik | Tombol disabled + spinner, teks "Masuk..." |
| Error: Field kosong | Submit kosong | Error inline merah di tiap field kosong |
| Error: Salah kredensial | API return 401 | Toast error: "Email atau password salah" |
| Error: Rate limit | 5 gagal dalam 15 menit | Pesan di atas form: "Terlalu banyak percobaan. Coba lagi dalam **X menit**." |
| Sukses | API return 200 + token | Redirect ke `/dashboard` |

**Navigasi dari layar ini:**
- Login berhasil → `/dashboard`
- Klik "Daftar di sini" → `/register`

💡 **Catatan Mockup:** 4 variant frame: Default, Loading, Error Kredensial, Rate Limit.

---

## F3 — Dashboard Utama

**Route:** `/dashboard`
**Kondisi akses:** Harus login sebagai guru. Jika tidak, redirect ke `/login`.

### 🖥️ Layar F3.1: Dashboard — State Normal (Ada Ujian)

**Layout:** Navbar atas + konten utama dengan grid.

**Elemen Navbar:**

| No | Elemen | Detail Visual |
|---|---|---|
| 1 | Logo "🔒 LockIt" | Kiri atas, klik → `/dashboard` |
| 2 | Nama guru + avatar | Kanan atas, inisial di circle (fallback jika tidak ada foto) |
| 3 | Dropdown menu | Klik avatar → opsi: "Profil", "Keluar" |

**Elemen Konten — Header Section:**

| No | Elemen | Detail Visual |
|---|---|---|
| 1 | Greeting | "Selamat datang, **Ahmad**! 👋" — H1 |
| 2 | Sub-greeting | "Kelola ujian online Anda dengan mudah." — abu |
| 3 | Button: "+ Buat Ujian Baru" | Primary, kanan atas halaman → `/dashboard/exams/new` |

**Stats Card Row (4 kartu horizontal):**

| # | Kartu | Contoh nilai | Warna ikon |
|---|---|---|---|z
| 1 | 🗒️ Total Ujian | 12 | Indigo |
| 2 | 🟢 Ujian Aktif | 2 | Hijau |
| 3 | 👤 Total Peserta | 340 | Biru |
| 4 | ✅ Ujian Selesai | 9 | Abu |

**Filter & Search Bar:**

| No | Elemen | Detail Visual |
|---|---|---|
| 1 | Input Search | Icon 🔍 + placeholder "Cari ujian...", lebar ~280px |
| 2 | Select Filter Status | "Semua Status" default, opsi: Draft · Aktif · Selesai · Diarsipkan |
| 3 | Select Urutkan | "Terbaru" default, opsi: Terlama · A-Z |

**Daftar Ujian — Setiap Card Berisi:**

| No | Elemen | Detail Visual |
|---|---|---|
| 1 | Judul ujian | Bold 18px, klik → `/dashboard/exams/:id` |
| 2 | StatusPill | Pill berwarna sesuai status |
| 3 | Kode Akses | Monospace, background abu muda, border, contoh: **"ABC123"** |
| 4 | Metadata | "⏱ 90 menit · 📝 25 soal · 📅 5 Okt 2026" |
| 5 | Button: "Detail" | Ghost → `/dashboard/exams/:id` |
| 6 | Button: "Monitor" | Ghost biru, **hanya jika status Aktif** → `/dashboard/exams/:id/monitor` |
| 7 | Button: "⋯" | Dropdown aksi |

**Dropdown "⋯" per card:**

| Opsi | Kondisi | Aksi |
|---|---|---|
| ✏️ Edit | Selalu (disabled jika ada peserta aktif) | → `/dashboard/exams/:id/edit` |
| 👁 Lihat Hasil | Hanya jika `ended` atau `archived` | → `/dashboard/exams/:id/results` |
| 📦 Arsipkan | Jika belum archived | ConfirmDialog → soft delete |
| 🗑️ Hapus Permanen | Hanya jika `draft` & tanpa peserta | ConfirmDialog → hard delete |

### 📦 State F3.2: Dashboard — Empty State (Belum Ada Ujian)

| No | Elemen | Detail Visual |
|---|---|---|
| 1 | Ilustrasi | Gambar/icon ujian kosong |
| 2 | Heading | "Belum ada ujian" |
| 3 | Deskripsi | "Mulai dengan membuat ujian pertamamu!" |
| 4 | Button: "+ Buat Ujian Baru" | Primary → `/dashboard/exams/new` |

### 📦 State F3.3: Dashboard — Ada Ujian Aktif (Live Highlight)

Card ujian dengan status **Aktif** memiliki:
- Border kiri tebal hijau atau background hijau muda subtle
- Badge "LIVE" berdenyut (pulse animation)
- Button "Monitor" lebih prominent

**Navigasi dari layar ini:**
- Klik "+ Buat Ujian Baru" → `/dashboard/exams/new`
- Klik nama ujian → `/dashboard/exams/:id`
- Klik "Monitor" → `/dashboard/exams/:id/monitor`

💡 **Catatan Mockup:** 3 variant frame: Normal (ada ujian mix status), Empty State, Ada Ujian Live.

---

## F4 — Membuat Ujian Baru

**Route:** `/dashboard/exams/new`

### 🖥️ Layar F4.1: Form Buat Ujian — Default (Kosong)

**Layout:** Single long form dengan 4 section terpisah.

**Breadcrumb:** Dashboard → Buat Ujian Baru

**Section 1: Informasi Dasar**

| No | Elemen | Detail Visual |
|---|---|---|
| 1 | Section heading | "📋 Informasi Dasar" — bold, separator |
| 2 | Input: Judul Ujian | Label: "Judul Ujian*", placeholder: "UTS Pemrograman Web 2026", max 200 char |
| 3 | Textarea: Deskripsi | Label: "Deskripsi (Opsional)", max 1000 char, character counter kanan bawah |
| 4 | Input: Durasi | Label: "Durasi (menit)*", type=number, min=1, max=480, suffix label: "menit" |

**Section 2: Bank Soal**

| No | Elemen | Detail Visual |
|---|---|---|
| 1 | Section heading | "📁 Bank Soal" |
| 2 | FileUpload area | Drag-drop zone dashed, icon ☁️, teks "Drag file ke sini atau **klik untuk pilih**", subtext "Format: .json atau .xml · Maks. 5MB" |
| 3 | Status upload | Idle / Uploading (progress bar) / Sukses (✅ "25 soal ditemukan") / Error (❌ pesan) |
| 4 | Button: "Preview Soal" | Ghost, muncul hanya setelah upload sukses |

**Section 3: Pengaturan Soal**

| No | Elemen | Detail Visual |
|---|---|---|
| 1 | Section heading | "⚙️ Pengaturan Soal" |
| 2 | Toggle: Acak Urutan Soal | Default OFF, helper text: "Setiap peserta mendapat urutan soal berbeda" |
| 3 | RadioGroup: Mode Tampilan | Opsi: ● "Satu per satu" (default) · ○ "Semua sekaligus" |

**Section 4: Kebijakan Pelanggaran**

| No | Elemen | Detail Visual |
|---|---|---|
| 1 | Section heading | "🛡️ Kebijakan Pelanggaran" |
| 2 | Input: Maks. Pelanggaran | Number, default: 3 |
| 3 | Select: Tindakan | Opsi: "Beri Peringatan" · "Tandai untuk Review Manual" · "Kunci Peserta (Auto-lock)" |
| 4 | Toggle: Deteksi Copy-Paste | Default OFF |
| 5 | Toggle: Deteksi Klik Kanan | Default OFF |
| 6 | Toggle: Deteksi DevTools | Default OFF |

**Footer Tombol:**

| Tombol | Posisi | Aksi |
|---|---|---|
| "Batal" | Kiri, secondary | ConfirmDialog → kembali ke dashboard jika ada perubahan |
| "Simpan sebagai Draft" | Tengah, secondary | Simpan, tetap di halaman |
| "Simpan & Lihat Detail" | Kanan, primary | Simpan → redirect ke `/dashboard/exams/:id` |

### 📦 State F4.2: Upload Soal — Sukses

| No | Elemen | Detail Visual |
|---|---|---|
| 1 | Checkmark hijau ✅ | Di area upload |
| 2 | Nama file | "soal-uts-web.json" |
| 3 | Info soal | "25 soal berhasil diproses · Total poin: 250" |
| 4 | Button "Preview Soal" | Muncul, ghost biru |
| 5 | Button "Ganti File" | Muncul, ghost abu |

### 📦 State F4.3: Upload Soal — Error Parsing

| No | Elemen | Detail Visual |
|---|---|---|
| 1 | Icon ❌ merah | |
| 2 | Judul error | "File tidak valid" |
| 3 | Detail per error | "• Soal #3: field 'options' wajib ada" · "• Soal #7: tidak ada jawaban benar" |
| 4 | Button "Upload Ulang" | Primary kecil |

### 🖥️ Layar F4.4: Modal Preview Soal

Trigger: Klik "Preview Soal" setelah upload sukses.

**Layout:** Modal lg (max-width 720px), overlay backdrop.

| No | Elemen | Detail Visual |
|---|---|---|
| 1 | Header modal | "Preview Soal — [Nama Ujian]" + tombol ✕ |
| 2 | Counter soal | "Soal 1 dari 25" — kanan atas |
| 3 | Teks soal | Pertanyaan, font 18px |
| 4 | Gambar soal | Jika ada, tampilkan. Klik untuk zoom. |
| 5 | Opsi jawaban | Radio button list A–D/E, **semua disabled** (preview only) |
| 6 | Highlight jawaban benar | Opsi benar di-highlight hijau muda + ikon ✅ |
| 7 | Info poin | Badge kecil: "Poin: 10" |
| 8 | Navigasi | [← Sebelumnya] · [Selanjutnya →] |
| 9 | Footer modal | [Tutup] secondary |

**Navigasi dari F4:**
- Simpan berhasil → `/dashboard/exams/:id`
- Batal → ConfirmDialog → `/dashboard`

💡 **Catatan Mockup:** Frame yang dibutuhkan: Default form kosong, Upload sukses, Upload error, Modal Preview Soal, Loading submit.

---

## F5 — Detail Ujian & Kode Akses

**Route:** `/dashboard/exams/:id`

### 🖥️ Layar F5.1: Detail Ujian — Status Draft

**Breadcrumb:** Dashboard → Detail Ujian

**Panel Info Ujian:**

| No | Elemen | Detail Visual |
|---|---|---|
| 1 | Judul ujian | H1, bold, besar |
| 2 | StatusPill | "Draft" — abu |
| 3 | Deskripsi | Paragraf abu |
| 4 | Durasi | ⏱️ "90 menit" |
| 5 | Jumlah soal | 📝 "25 soal" |
| 6 | Tanggal dibuat | 📅 "5 Oktober 2026" |
| 7 | Kebijakan pelanggaran | 🛡️ Ringkasan singkat |

**Panel Kode Akses (Prominent):**

| No | Elemen | Detail Visual |
|---|---|---|
| 1 | Label | "Kode Akses Ujian" — label abu kecil |
| 2 | Kode | **"ABC123"** — font monospace, 40px, bold, centered, dalam box dengan border |
| 3 | Button Copy | Ikon 📋, klik → Toast: "✅ Kode disalin!" |
| 4 | Button "Generate Ulang" | Secondary sm → ConfirmDialog sebelum regenerate |

**Tombol Aksi Utama berdasarkan Status:**

| Status Ujian | Tombol Tersedia |
|---|---|
| `draft` | 🚀 "Mulai Ujian" (primary) · ✏️ "Edit Ujian" · 👁 "Preview Soal" · 🗑️ "Hapus Ujian" (danger) |
| `active` | 📊 "Monitor Live" (primary) · ⛔ "Akhiri Ujian" (danger) |
| `ended` | 🏆 "Lihat Hasil" (primary) · 📥 "Export CSV" · 📊 "Export Excel" |
| `archived` | 🏆 "Lihat Hasil" (secondary) · semua lain read-only |

**ConfirmDialog "Mulai Ujian":**
> "Ujian akan dimulai. Peserta yang sudah menunggu di waiting room akan langsung bisa mengerjakan. Pastikan semua siap. Tindakan ini **tidak bisa dibatalkan**."
> Tombol: [Batal] · [Mulai Ujian Sekarang] (primary)

**ConfirmDialog "Akhiri Ujian":**
> "Ujian akan diakhiri. Semua peserta yang belum submit akan di-auto-submit dengan jawaban terakhir yang tersimpan. **Tindakan ini tidak bisa dibatalkan.**"
> Tombol: [Batal] · [Akhiri Ujian] (danger)

**Catatan:** Saat status `active`, button "Generate Ulang Kode" di-disabled + tooltip "Tidak bisa regenerate saat ujian berlangsung."

**Navigasi dari F5:**
- "Monitor Live" → `/dashboard/exams/:id/monitor`
- "Edit Ujian" → `/dashboard/exams/:id/edit`
- "Lihat Hasil" → `/dashboard/exams/:id/results`

💡 **Catatan Mockup:** 4 variant frame berdasarkan status ujian + ConfirmDialog untuk "Mulai" dan "Akhiri".

---

## F6 — Edit Ujian

**Route:** `/dashboard/exams/:id/edit`

### 🖥️ Layar F6.1: Form Edit — Status Draft (Semua Editable)

Sama dengan F4 (Form Buat Ujian), namun:
- Semua field terisi dengan data existing
- Heading: "Edit Ujian"
- Footer: [Batal] · [Simpan Perubahan] (primary)

### 📦 State F6.2: Form Edit — Status Active (Ujian Berlangsung)

**Banner kuning di atas form:**
> ⚠️ **Kamu sedang mengedit ujian yang sedang berlangsung. Hanya kebijakan pelanggaran yang bisa diubah.**

**Yang disabled (read-only):**
- Section 1 (Informasi Dasar): semua field disabled, style abu muda
- Section 2 (Bank Soal): disabled
- Section 3 (Pengaturan Soal): disabled

**Yang bisa diedit:**
- Section 4 (Kebijakan Pelanggaran): **aktif dan bisa diubah**

**Navigasi dari F6:**
- Simpan → `/dashboard/exams/:id` + Toast "Perubahan berhasil disimpan"
- Batal (jika ada perubahan) → ConfirmDialog → `/dashboard/exams/:id`

💡 **Catatan Mockup:** 2 variant: Edit draft (all editable) + Edit saat active (sebagian read-only + banner kuning).

---

## F7 — Memulai & Mengakhiri Ujian

> Aksi ini terjadi via ConfirmDialog dari F5. Tidak ada halaman baru, hanya perubahan state.

**Flow Memulai Ujian:**
```
F5 (Detail Ujian, Status Draft)
  → Klik "Mulai Ujian"
  → ConfirmDialog muncul
  → Klik "Mulai Ujian Sekarang"
  → API: PUT /api/exams/:id/status { status: "active" }
  → Loading state di tombol dialog
  → Sukses → Dialog tutup → halaman refresh → Status menjadi Active
  → Toast: "Ujian berhasil dimulai!"
  → Peserta di waiting room otomatis diarahkan ke halaman ujian
```

**Flow Mengakhiri Ujian:**
```
F5 (Detail, Active) atau F8 (Monitor)
  → Klik "Akhiri Ujian"
  → ConfirmDialog muncul
  → Klik "Akhiri Ujian"
  → API: PUT /api/exams/:id/status { status: "ended" }
  → Server auto-submit semua peserta yang belum submit
  → Peserta mendapat overlay "Ujian Diakhiri" di layar mereka
  → Halaman guru refresh → Status menjadi Ended
  → Toast: "Ujian telah diakhiri. Semua jawaban tersimpan."
```

---

## F8 — Monitoring Ujian Real-Time

**Route:** `/dashboard/exams/:id/monitor`
**Kondisi akses:** Guru pemilik, ujian status `active`.

### 🖥️ Layar F8.1: Dashboard Monitor — State Normal

**Layout:** Full-width, dense. Header → Overview Cards → Filter + Tabel Peserta.

**Header Bar:**

| No | Elemen | Detail Visual |
|---|---|---|
| 1 | Breadcrumb | Dashboard → [Nama Ujian] → Monitor |
| 2 | Nama ujian | H2 |
| 3 | Timer countdown | MM:SS besar, bold. **Merah + pulse jika < 5 menit** |
| 4 | Indikator koneksi | "● Live" hijau kecil |
| 5 | Button "Akhiri Ujian Sekarang" | Danger → ConfirmDialog |

**Overview Cards (5 kartu sejajar):**

| # | Label | Contoh | Warna |
|---|---|---|---|
| 1 | 👥 Total Join | 42 | Neutral |
| 2 | 🟢 Online | 38 | Hijau |
| 3 | 🔴 Offline/Putus | 2 | Merah |
| 4 | ✅ Sudah Submit | 5 | Biru |
| 5 | ⏳ Belum Submit | 37 | Kuning |

**Filter Tabel:**

| No | Elemen | Detail |
|---|---|---|
| 1 | Input Search | "Cari nama atau NIM..." |
| 2 | Select Filter | Semua · Online · Offline · Submitted · Bermasalah |
| 3 | Button "Refresh" | Ghost, fallback jika WS putus |

**Tabel Peserta Live — Kolom:**

| Kolom | Detail |
|---|---|
| Nama Peserta | Teks |
| NIM | Monospace |
| Status | Badge: online/offline/submitted/locked/waiting |
| Pelanggaran | Angka: 0=hijau, 1-2=kuning, ≥3=merah bold |
| Progress | "18/25 soal" atau progress bar mini |
| Last Aktif | "2 mnt lalu" — merah jika lama |
| Aksi | Tombol-tombol per baris |

**Tombol Aksi Per Baris:**

| Tombol | Kondisi | Aksi |
|---|---|---|
| "⚠ Warning" | Selalu | Buka Modal Kirim Warning (F9) |
| "🔓 Unlock" | Hanya jika status `locked` | ConfirmDialog → unlock (F10) |
| "👁 Detail" | Selalu | Buka halaman Detail Pelanggaran (F11) |

### 📦 State F8.2: Ada Pelanggaran Baru (Real-Time)

- Toast notification muncul: "⚠ **Budi Santoso** — Tab switch terdeteksi [Lihat Detail]"
- Baris peserta terkait: angka pelanggaran update + berkedip sebentar
- Warna update sesuai threshold baru

### 📦 State F8.3: Peserta Offline

- Badge status: "Offline" — abu, ikon sinyal merah
- Last aktif: "12 mnt lalu" — merah
- Row background abu sangat muda

### 📦 State F8.4: Peserta Terkunci

- Badge status: "Terkunci" 🔒 — merah
- Tombol "🔓 Unlock" tampil di kolom aksi
- Row background merah sangat muda

### 📦 State F8.5: WS Disconnect (Koneksi Guru Putus)

- Banner kuning muncul: "⚠ Koneksi real-time terputus. Mencoba menghubungkan ulang..."
- Button "Refresh Manual" muncul

**Navigasi dari F8:**
- Klik "Detail" peserta → `/dashboard/exams/:id/violations/:sid`
- Klik "Akhiri Ujian" → ConfirmDialog → ujian diakhiri → status Ended

💡 **Catatan Mockup:** 5 variant frame: Normal, Ada Pelanggaran Baru, Peserta Offline, Peserta Terkunci, WS Disconnect + Empty state.

---

## F9 — Kirim Warning ke Peserta

**Trigger:** Tombol "⚠ Warning" di tabel monitor (F8).

### 🖥️ Layar F9.1: Modal Kirim Warning

| No | Elemen | Detail Visual |
|---|---|---|
| 1 | Header modal | "Kirim Peringatan" + tombol ✕ |
| 2 | Info peserta | Avatar inisial + "**Budi Santoso**" + NIM "1301210023" — read-only |
| 3 | Label pelanggaran | "Pelanggaran tercatat: **4**" — merah |
| 4 | Textarea Pesan | Label: "Pesan Peringatan*", placeholder: "Mohon perhatikan aturan ujian...", max 500 char |
| 5 | Button "Batal" | Secondary |
| 6 | Button "Kirim Peringatan" | Primary (loading state saat request) |

**State:**

| 📦 State | Tampilan |
|---|---|
| Default | Textarea kosong |
| Loading | Button "Kirim..." + spinner, disabled |
| Sukses | Modal tutup + Toast: "✅ Peringatan berhasil dikirim ke Budi Santoso" |
| Error | Toast error: "Gagal mengirim peringatan. Coba lagi." |

**Efek di sisi peserta:** Overlay banner peringatan muncul di layar peserta (→ M7).

---

## F10 — Unlock Peserta Terkunci

**Trigger:** Tombol "🔓 Unlock" di tabel monitor (F8), hanya jika status `locked`.

### 🖥️ Layar F10.1: ConfirmDialog Unlock

| No | Elemen | Detail Visual |
|---|---|---|
| 1 | Judul | "Buka Kunci Peserta?" |
| 2 | Body | "**Budi Santoso** (1301210023) saat ini terkunci. Kamu yakin ingin membuka kuncinya?" |
| 3 | Button "Batal" | Secondary |
| 4 | Button "Ya, Buka Kunci" | Primary |

**State Sukses:**
- Dialog tutup
- Badge peserta di tabel: "Terkunci" → "Online"
- Toast: "✅ Budi Santoso berhasil di-unlock"

**Efek di sisi peserta:** Overlay terkunci hilang, peserta bisa lanjut mengerjakan.

---

## F11 — Detail Pelanggaran Peserta

**Route:** `/dashboard/exams/:id/violations/:sid`
(Atau slide-over panel dari halaman monitor)

### 🖥️ Layar F11.1: Detail Pelanggaran — Ada Data

**Layout:** Header info → Summary box → Timeline event.

**Header Peserta:**

| No | Elemen | Detail Visual |
|---|---|---|
| 1 | Back button | "← Kembali ke Monitor" |
| 2 | Avatar inisial | Lingkaran besar dengan inisial |
| 3 | Nama peserta | H1 bold |
| 4 | NIM | Monospace, abu |
| 5 | Status badge | Online / Offline / Submitted |

**Summary Box:**

| No | Elemen | Contoh |
|---|---|---|
| 1 | Total pelanggaran | "**7** pelanggaran tercatat" — merah bold |
| 2 | Breakdown per tipe | Tab switch: 4 · Fullscreen exit: 2 · Copy attempt: 1 |
| 3 | Waktu mulai | "Mulai: 10:00 WIB" |

**Timeline Event (kronologis):**

Format setiap item:
```
[Ikon]  [Jenis Event]                [Timestamp]
        [Detail/Metadata tambahan]   [Durasi jika ada]
```

Contoh:
```
⛶  Fullscreen Exit                    10:32:15 WIB
    Durasi keluar: 12 detik

🔁  Tab Switch                         10:35:02 WIB
    Pelanggaran ke-3 dari batas 3

📋  Copy Attempt                       10:41:30 WIB

🔄  Reconnect                          10:44:00 WIB
    Terputus selama: 45 detik
```

**Ikon per event type:**

| Event | Ikon | Warna |
|---|---|---|
| `fullscreen_exit` | ⛶ | Orange |
| `window_blur` | 🪟 | Kuning |
| `tab_switch` | 🔁 | Merah |
| `copy_attempt` | 📋 | Merah |
| `paste_attempt` | 📌 | Merah |
| `right_click` | 🖱️ | Abu |
| `devtools` | 🔧 | Merah |
| `reconnect` | 🔄 | Biru |
| `heartbeat_lost` | 💔 | Abu-merah |

**Aksi:**

| Tombol | Aksi |
|---|---|
| "⚠ Kirim Warning" | Buka Modal Kirim Warning (F9) |
| "📥 Export Log Pelanggaran" | Download CSV/PDF log peserta ini |

### 📦 State F11.2: Tidak Ada Pelanggaran

- Icon ✅ hijau besar
- Teks: "Tidak ada pelanggaran yang tercatat untuk peserta ini."

💡 **Catatan Mockup:** 2 variant: Ada banyak pelanggaran (timeline panjang) + Empty state (bersih).

---

## F12 — Hasil Ujian & Grading

**Route:** `/dashboard/exams/:id/results`
**Kondisi akses:** Ujian berstatus `ended` atau `archived`.

### 🖥️ Layar F12.1: Halaman Hasil Ujian

**Layout:** Stats row atas → Grafik distribusi (opsional) → Tabel hasil.

**Breadcrumb:** Dashboard → [Nama Ujian] → Hasil Ujian

**Stats Row (5 kartu):**

| # | Kartu | Contoh | Warna |
|---|---|---|---|
| 1 | 📊 Rata-rata Nilai | 74.5 | Indigo |
| 2 | 🏆 Nilai Tertinggi | 98 | Hijau |
| 3 | 📉 Nilai Terendah | 40 | Merah |
| 4 | 👥 Total Submit | 40 | Biru |
| 5 | ✅ Persentase Lulus | 78% | Hijau |

**Grafik Distribusi Nilai (recommended):**
- Bar chart dengan rentang: 0–59 (merah) · 60–69 (kuning) · 70–79 · 80–89 · 90–100 (hijau)

**Tombol Export (kanan atas area tabel):**

| Tombol | Aksi |
|---|---|
| "📥 Export CSV" | Download CSV |
| "📊 Export Excel" | Download XLSX |

**Tabel Hasil — Kolom:**

| Kolom | Sortable | Keterangan |
|---|---|---|
| # | — | Nomor urut |
| Nama | ↑↓ | Nama peserta |
| NIM | — | Monospace |
| Nilai | ↑↓ | Merah jika < passing grade |
| Benar/Total | — | "18/25" |
| Pelanggaran | ↑↓ | Angka + warna |
| Submit Pada | ↑↓ | Waktu submit |
| Aksi | — | "Detail Jawaban" |

**Navigasi dari F12:**
- Klik "Detail Jawaban" → `/dashboard/exams/:id/results/:sid`

💡 **Catatan Mockup:** 2 variant: Ada data (tabel berisi + grafik) + Empty state.

---

## F13 — Detail Jawaban Per Peserta

**Route:** `/dashboard/exams/:id/results/:sid`

### 🖥️ Layar F13.1: Detail Jawaban Peserta

**Layout:** Header info → Stats ringkas → Daftar soal scroll.

**Breadcrumb:** Dashboard → Hasil Ujian → [Nama Peserta]

**Header Info Peserta:**

| No | Elemen | Detail Visual |
|---|---|---|
| 1 | Nama peserta | H1 bold |
| 2 | NIM | Monospace abu |
| 3 | Nilai besar | **"84 / 100"** — besar, bold, hijau jika lulus |
| 4 | Ringkasan | "✅ 21 benar · ❌ 4 salah · — 0 tidak dijawab" |
| 5 | Waktu submit | "Submitted: 10:42 WIB" |

**Daftar Soal — Setiap Soal dalam Card:**

| No | Elemen | Detail Visual |
|---|---|---|
| 1 | Nomor soal | "Soal 1" — abu kecil |
| 2 | Teks soal | Pertanyaan |
| 3 | Gambar soal | Jika ada |
| 4 | Jawaban peserta | Highlight biru muda: "B. High Tech Modern Language" |
| 5 | Kunci jawaban | Jika salah: tampilkan kunci, highlight hijau |
| 6 | Status | ✅ Benar (hijau) / ❌ Salah (merah) — badge kecil |
| 7 | Poin | "+10 poin" (benar) / "0 poin" (salah) |

---

## F14 — Export Hasil Ujian

> Tidak ada layar khusus. Terjadi via button di F12 (Hasil Ujian) dan F5 (Detail Ujian status Ended).

**Flow:**
```
Klik "Export CSV" atau "Export Excel"
  → Button loading state sebentar
  → Browser download file: "lockit-hasil-[nama-ujian]-[tanggal].(csv|xlsx)"
  → Toast: "✅ File berhasil didownload"
```

**Isi file CSV:**
```
Nama,NIM,Nilai,Benar,Total Soal,Pelanggaran,Status,Submit Pada
Siti Nurhaliza,1301210001,85,21,25,2,Submitted,2026-10-05 10:42:00
```

---

## F15 — Logout Guru

**Trigger:** Dropdown menu di navbar → klik "Keluar"

**Flow:**
```
Klik avatar di navbar
  → Dropdown: ["Profil", "Keluar"]
  → Klik "Keluar"
  → API: POST /api/auth/logout
  → Browser hapus cookie/token
  → Redirect ke /login
  → Toast: "Kamu telah keluar dari LockIt."
```

---
---

# 🧑‍🎓 ROLE: MAHASISWA / PESERTA

---

## M1 — Join Ujian (Input Kode)

**Route:** `/join`
**Kondisi akses:** Publik — tanpa login, tanpa registrasi.

### 🖥️ Layar M1.1: Halaman Join — Default

**Layout:** Minimal, centered vertikal & horizontal. Tidak ada navbar guru.

| No | Elemen | Detail Visual |
|---|---|---|
| 1 | Logo "🔒 LockIt" | Kecil, di atas form |
| 2 | Heading | "Ikut Ujian" — H1 bold |
| 3 | Subheading | "Masukkan kode yang diberikan oleh pengawasmu" — abu |
| 4 | Input Kode Akses | Font monospace, uppercase otomatis saat ketik, 24px, centered, max 8 char, placeholder: "ABCD1234" |
| 5 | Button "Masuk" | Primary, lg, full-width |

**State & Validasi:**

| 📦 State | Trigger | Tampilan |
|---|---|---|
| Default | Halaman dibuka | Field kosong |
| Typing | User ketik | Uppercase otomatis, max 8 char |
| Loading | Klik "Masuk" | Button disabled + spinner "Memeriksa..." |
| Error: Kosong | Submit kosong | Error inline: "Kode akses wajib diisi" |
| Error: Pendek | < 6 karakter | Error inline: "Kode terlalu pendek" |
| Error: Tidak Ditemukan | API 404 | Error inline: "Kode tidak ditemukan. Periksa kembali." |
| Info: Ujian Belum Mulai | Ujian status draft | Info box biru: "Ujian belum dimulai. Tunggu pengawas memulai ujian." |
| Error: Ujian Sudah Selesai | Ujian status ended | Error inline: "Ujian sudah selesai." |
| Sukses: Kode Valid | API 200 | Redirect ke `/join/identity` |

**Navigasi dari M1:**
- Sukses → `/join/identity`

💡 **Catatan Mockup:** 5 variant: Default, Loading, Error tidak ditemukan, Info belum mulai, Error sudah selesai.

---

## M2 — Input Identitas (Nama & NIM)

**Route:** `/join/identity`
**Kondisi akses:** Hanya setelah kode valid diverifikasi di M1.

### 🖥️ Layar M2.1: Halaman Identitas

| No | Elemen | Detail Visual |
|---|---|---|
| 1 | Nama ujian | H2 bold: "UTS Pemrograman Web" |
| 2 | Subheading | "Masukkan identitasmu" — abu |
| 3 | Info ujian chip | "⏱ 90 menit · 📝 25 soal" — badge kecil horizontal |
| 4 | Input: Nama Lengkap | Label: "Nama Lengkap*", required, min 3 char |
| 5 | Input: NIM | Label: "NIM*", required, alphanumeric |
| 6 | Button "Bergabung" | Primary, lg, full-width |
| 7 | Button "← Kembali" | Ghost, kecil, kembali ke M1 |

**State & Validasi:**

| 📦 State | Trigger | Tampilan |
|---|---|---|
| Default | Halaman dibuka | Semua field kosong |
| Loading | Klik "Bergabung" | Button disabled + spinner |
| Error: Nama kosong | Submit tanpa nama | Error inline: "Nama wajib diisi" |
| Error: NIM kosong | Submit tanpa NIM | Error inline: "NIM wajib diisi" |
| Error: NIM duplikat | API 409 | Error inline: "NIM ini sudah digunakan di ujian ini. Jika ini milikmu, hubungi pengawas." |
| Sukses: Ujian Belum Mulai | Ujian masih draft | Redirect ke `/exam/waiting` |
| Sukses: Ujian Aktif | Ujian sudah active | Redirect ke `/exam/session` |

💡 **Catatan Mockup:** 3 variant: Default, Error NIM Duplikat, Loading.

---

## M3 — Waiting Room

**Route:** `/exam/waiting`
**Kondisi akses:** Peserta sudah join, ujian belum aktif.

### 🖥️ Layar M3.1: Waiting Room

| No | Elemen | Detail Visual |
|---|---|---|
| 1 | Animasi | Lingkaran pulse berdenyut (CSS animation) — warna indigo |
| 2 | Heading | "Menunggu Ujian Dimulai..." — H2 |
| 3 | Info peserta | "Kamu masuk sebagai: **Siti Nurhaliza** (1301210001)" |
| 4 | Info ujian | Nama ujian |
| 5 | Pesan instruksi | "Jangan tutup halaman ini. Ujian akan dimulai secara otomatis." |
| 6 | Indikator koneksi | "● Terhubung" — dot hijau kecil |

**Behavior:**
- Tidak ada tombol manual untuk skip
- Saat guru mulai ujian → WebSocket push → browser otomatis redirect ke `/exam/session`

### 📦 State M3.2: Waiting Room — Koneksi Putus

- Indikator: "⟳ Menghubungkan ulang..." — kuning, spinner

💡 **Catatan Mockup:** 2 variant: Normal (menunggu) + Koneksi Putus.

---

## M4 — Request Fullscreen & Mulai Ujian

**Route:** `/exam/session` (awal, sebelum soal tampil)

### 🖥️ Layar M4.1: Prompt Fullscreen

**Layout:** Overlay centered, background soal terlihat blur di belakang.

| No | Elemen | Detail Visual |
|---|---|---|
| 1 | Icon | ⛶ besar, indigo/abu |
| 2 | Heading | "Masuk ke Mode Ujian" — H2 |
| 3 | Deskripsi | "Ujian ini sebaiknya dikerjakan dalam mode layar penuh. Keluar dari layar penuh akan dicatat sebagai pelanggaran." |
| 4 | Button: "Masuk Layar Penuh & Mulai" | Primary, lg |
| 5 | Link kecil | "Lanjutkan tanpa layar penuh" — abu kecil, underline |

**State setelah klik:**

| Pilihan | Efek |
|---|---|
| "Masuk Layar Penuh & Mulai" | Browser request fullscreen → Soal tampil → Proctoring aktif |
| "Lanjutkan tanpa layar penuh" | Event `fullscreen_rejected` dicatat → Soal tampil → Proctoring aktif |

### 📦 State M4.2: Browser Tidak Support Fullscreen (iOS Safari)

- Pesan informasi biru: "Browser ini tidak mendukung mode layar penuh. Hal ini sudah dicatat. Ujian tetap bisa dikerjakan."
- Hanya ada: Button "Mulai Ujian"

**Navigasi dari M4:**
- Setelah konfirmasi → tampil soal (M5 atau M6 tergantung mode)

💡 **Catatan Mockup:** 2 variant: Normal + No-Fullscreen Support (iOS).

---

## M5 — Mengerjakan Soal (Mode Satu per Satu)

**Route:** `/exam/session`

### 🖥️ Layar M5.1: Halaman Ujian — Soal Aktif

**Layout:** Header sticky → Konten soal → Navigator → Footer sticky.

**Header Bar (sticky):**

| No | Elemen | Detail Visual |
|---|---|---|
| 1 | Nama ujian | "UTS Pemrograman Web" — truncated kiri |
| 2 | Info peserta | "Siti · 1301210001" — kecil abu |
| 3 | Timer Countdown | **"01:23:45"** — font besar bold. **Merah + pulse jika < 5 menit** |
| 4 | Indikator auto-save | "✓ Tersimpan" — abu kecil, kanan |
| 5 | Icon fullscreen | Kanan sudut — klik untuk kembali ke fullscreen |

**Konten Soal:**

| No | Elemen | Detail Visual |
|---|---|---|
| 1 | Counter soal | "**Soal 3** dari 25" — abu di atas |
| 2 | Badge poin | "Poin: 10" — kecil kanan |
| 3 | Gambar soal | Jika ada — full-width, klikable untuk zoom |
| 4 | Teks soal | Paragraf besar, 18px, leading-relaxed |
| 5 | Opsi jawaban | Radio button list A–D/E |

**Format opsi jawaban:**
- Hover: background abu sangat muda
- Selected: border biru indigo + background indigo-50 + radio filled biru

**Navigasi Soal:**

| No | Elemen | Detail Visual |
|---|---|---|
| 1 | Button "← Sebelumnya" | Secondary, disabled jika soal #1 |
| 2 | Pill navigator | Nomor 1..N. Biru = sudah dijawab, abu = belum. Klikable untuk jump |
| 3 | Button "Selanjutnya →" | Secondary, disabled jika soal terakhir |

**Footer (sticky bottom):**

| No | Elemen | Detail Visual |
|---|---|---|
| 1 | Progres | "📝 Dijawab: **18** dari **25** soal" |
| 2 | Button "Submit Ujian" | Primary, kanan footer, selalu terlihat |

### 📦 State M5.2: Timer < 5 Menit

- Timer warna → **merah bold + pulse animation**
- Toast warning satu kali: "⚠ Sisa waktu kurang dari 5 menit!"

### 📦 State M5.3: Indikator Auto-Save

| State | Tampilan |
|---|---|
| Saved | "✓ Tersimpan" — abu, kecil |
| Saving | "⟳ Menyimpan..." — spinning |
| Failed | "⚠ Gagal simpan — akan retry" — kuning |

### 📦 State M5.4: Koneksi Putus Saat Ujian

- Indikator pojok bawah: "✗ Tidak ada koneksi" — merah
- Auto-save: "⚠ Gagal simpan — akan retry"
- Peserta tetap bisa menjawab soal (offline mode sementara)
- Saat koneksi pulih: Toast "✅ Koneksi pulih. Jawabanmu tersimpan."

💡 **Catatan Mockup:** 5 variant: Soal awal (belum ada jawaban), Soal dengan jawaban terpilih, Timer warning, Auto-save states, Koneksi putus.

---

## M6 — Mengerjakan Soal (Mode Semua Sekaligus)

**Route:** `/exam/session`
**Mode:** Semua soal tampil dalam satu halaman, scroll.

### 🖥️ Layar M6.1: Mode Semua Soal (Scroll View)

**Layout:** Header sticky + konten scroll panjang + quick-jump sidebar kanan + footer sticky.

- Header Bar: sama seperti M5.1
- Setiap soal dalam card/section terpisah dengan divider
- Nomor soal di atas card: "Soal 1" · "Soal 2" dst

**Quick-Jump Sidebar (kanan, sticky):**
- Grid nomor soal 1..N
- Biru = sudah dijawab, abu = belum dijawab
- Klik nomor → smooth scroll ke soal tersebut

**Footer:** Sama seperti M5.

---

## M7 — Menerima Warning dari Guru

**Trigger:** Guru kirim warning (F9) → WebSocket push ke peserta.

### 🖥️ Layar M7.1: Overlay Banner Warning

**Layout:** Banner di atas halaman ujian, full-width. **Tidak memblokir pengerjaan soal.**

| No | Elemen | Detail Visual |
|---|---|---|
| 1 | Background | Merah/kuning tua, full-width |
| 2 | Icon | ⚠️ besar di kiri |
| 3 | Label | "**Peringatan dari Pengawas:**" — bold |
| 4 | Isi pesan | Teks pesan dari guru |
| 5 | Button "Tutup" | Kecil di kanan |
| 6 | Counter dismiss | "(Tutup otomatis dalam 8 detik)" |

**Behavior:**
- Peserta tetap bisa melihat soal di bawah
- Klik "Tutup" → banner menghilang
- Auto-dismiss setelah 10 detik

💡 **Catatan Mockup:** 1 frame — overlay banner di atas halaman ujian yang masih terlihat di bawahnya.

---

## M8 — Kondisi Peserta Terkunci (Locked)

**Trigger:** Auto-lock threshold tercapai atau guru kunci manual → WebSocket push.

### 🖥️ Layar M8.1: Layar Terkunci

**Layout:** Overlay penuh di atas halaman ujian, background blur gelap.

| No | Elemen | Detail Visual |
|---|---|---|
| 1 | Overlay | Backdrop blur + gelap 80% |
| 2 | Icon | 🔒 besar, centered, merah |
| 3 | Heading | "Ujianmu Sementara Dikunci" — H2 putih |
| 4 | Body | "Pengawas sedang meninjau aktivitasmu. Tunggu hingga pengawas membuka kunci untuk melanjutkan." |
| 5 | Indikator koneksi | "● Terhubung" — masih aktif |
| 6 | Timer | Tetap berjalan di belakang overlay |

**Behavior:**
- Peserta tidak bisa berinteraksi dengan soal
- Timer tetap berjalan (tidak ditahan)
- Saat guru unlock → overlay hilang → Toast: "🔓 Kunci dibuka oleh pengawas. Kamu bisa melanjutkan."

💡 **Catatan Mockup:** 1 frame — overlay terkunci, halaman soal terlihat blur di belakang.

---

## M9 — Submit Manual

**Trigger:** Peserta klik "Submit Ujian" di footer halaman ujian.

### 🖥️ Layar M9.1: ConfirmDialog Submit Manual

| No | Elemen | Detail Visual |
|---|---|---|
| 1 | Judul | "Submit Ujian?" |
| 2 | Counter jawaban | "Kamu baru menjawab **18 dari 25 soal**." |
| 3 | Body | "Jawaban yang belum dijawab akan dianggap kosong. Kamu **tidak bisa mengubah jawaban** setelah submit." |
| 4 | List soal belum dijawab | (Opsional) "Soal yang belum dijawab: 7, 12, 19, 23, 25" |
| 5 | Button "Batal" | Secondary — kembali ke soal |
| 6 | Button "Ya, Submit Sekarang" | Primary |

**State:**

| State | Tampilan |
|---|---|
| Loading | Button disabled + spinner "Mengirim jawaban..." |
| Sukses | Redirect ke `/exam/done` |
| Error | Toast error: "Gagal mengirim. Coba lagi." |

**Navigasi dari M9:**
- Sukses → `/exam/done` (M11)
- Batal → kembali ke halaman soal

💡 **Catatan Mockup:** 2 variant: Dialog default + Dialog loading state.

---

## M10 — Auto-Submit (Waktu Habis / Ujian Diakhiri)

> Tidak ada aksi dari peserta. Otomatis oleh sistem.

### 🖥️ Layar M10.1: Overlay "Waktu Habis"

**Trigger:** Timer countdown mencapai 00:00.

| No | Elemen | Detail Visual |
|---|---|---|
| 1 | Overlay penuh | Background semi-transparan gelap |
| 2 | Icon | ⏰ besar, merah |
| 3 | Heading | "Waktu Habis!" — H2 merah |
| 4 | Body | "Jawabanmu sedang dikirim otomatis..." |
| 5 | Spinner | Loading indicator |

**Flow:**
```
Timer = 00:00
  → Overlay "Waktu Habis" muncul
  → Server auto-submit jawaban terakhir yang tersimpan
  → Auto-redirect ke /exam/done (~3 detik)
```

### 🖥️ Layar M10.2: Overlay "Ujian Diakhiri Guru"

**Trigger:** Guru klik "Akhiri Ujian" → WebSocket push ke semua peserta.

| No | Elemen | Detail Visual |
|---|---|---|
| 1 | Overlay penuh | Background gelap |
| 2 | Icon | 🛑 besar |
| 3 | Heading | "Ujian Telah Diakhiri" — H2 |
| 4 | Body | "Pengawas telah mengakhiri ujian. Jawabanmu sedang dikumpulkan..." |
| 5 | Spinner | Loading indicator |
| 6 | Auto-redirect | Setelah ~3 detik → `/exam/done` |

💡 **Catatan Mockup:** 2 variant: Waktu Habis + Diakhiri Guru.

---

## M11 — Halaman Selesai

**Route:** `/exam/done`
**Kondisi akses:** Hanya setelah submit berhasil. Tidak bisa di-back.

### 🖥️ Layar M11.1: Halaman Ujian Selesai

**Layout:** Centered, clean, minimal. Tidak ada navbar.

| No | Elemen | Detail Visual |
|---|---|---|
| 1 | Icon ✅ | Besar (80px+), hijau, animasi pop-in saat muncul |
| 2 | Heading | "Ujian Selesai!" — H1 hijau |
| 3 | Subheading | "Jawabanmu berhasil dikumpulkan." — abu |
| 4 | Card info | Background putih, shadow ringan |
| | → Nama | "Siti Nurhaliza" |
| | → NIM | "1301210001" |
| | → Nama Ujian | "UTS Pemrograman Web" |
| | → Waktu submit | "Submitted pada **10:42 WIB**, 5 Oktober 2026" |
| 5 | Pesan penutup | "Terima kasih sudah mengikuti ujian. Hasil akan diumumkan oleh pengawasmu." |

**Behavior:**
- Tidak bisa back ke halaman soal (history replace)
- Tidak ada link navigasi yang membawa kembali ke ujian

💡 **Catatan Mockup:** 1 frame — state sukses.

---
---

# ⚙️ SISTEM / BACKGROUND

---

## S1 — Proctoring Event Detection

> Proses background otomatis. Tidak ada UI khusus kecuali notifikasi di dashboard guru.

**Flow per event:**
```
Browser peserta mendeteksi event
  → Client catat: timestamp, jenis, metadata
  → Coba kirim: POST /api/proctoring/event
      Berhasil → Server simpan ke DB
               → Push ke dashboard guru via WebSocket
      Gagal    → Simpan di buffer browser
               → Retry saat koneksi pulih (batch)
```

**Jenis event & trigger JavaScript:**

| Event | Trigger | Yang Dicatat |
|---|---|---|
| `fullscreen_exit` | `document.fullscreenchange` | Timestamp + durasi keluar |
| `window_blur` | `visibilitychange` + `blur` | Timestamp + durasi |
| `tab_switch` | `visibilitychange` (hidden) | Timestamp, increment counter |
| `copy_attempt` | `document.oncopy` | Timestamp |
| `paste_attempt` | `document.onpaste` | Timestamp |
| `right_click` | `document.oncontextmenu` | Timestamp |
| `devtools` | Resize heuristic / shortcut | Timestamp |
| `reconnect` | Socket.io reconnect event | Timestamp, durasi disconnect |
| `heartbeat_lost` | Server-side: tidak ada ping > 30 detik | Server catat otomatis |

**Logika kebijakan (dikonfigurasi guru):**
```
Jika jumlah_pelanggaran >= max_violations:
  if policy == "warning":     → Kirim warning ke peserta (F9)
  elif policy == "auto-lock": → Lock peserta (M8)
  elif policy == "review":    → Tandai peserta untuk review manual (highlight merah di tabel F8)
```

---

## S2 — Heartbeat & Reconnect

> Background process. UI-nya adalah indikator koneksi di layar peserta.

**Flow Heartbeat:**
```
Setiap 10 detik:
  Client kirim: POST /api/exam-session/heartbeat
  Server update: student.last_heartbeat = now()

Server check setiap 15 detik:
  Cari peserta dengan last_heartbeat > 30 detik lalu
  → Update status: "disconnected"
  → Push ke dashboard guru: peserta "X" offline
```

**Flow Reconnect:**
```
Peserta reconnect:
  → Client kirim heartbeat baru
  → Server update status: "active"
  → Log event: reconnect (dengan durasi disconnect)
  → Kirim semua event dan jawaban yang di-buffer
  → Dashboard guru: badge peserta kembali "Online"
  → Toast di layar peserta: "Koneksi pulih. Jawabanmu tersimpan."
```

**State koneksi yang terlihat peserta:**

| State | Indikator Pojok Layar |
|---|---|
| Online | "● Online" — dot hijau kecil |
| Reconnecting | "⟳ Menghubungkan ulang..." — kuning, spin |
| Offline | "✗ Tidak ada koneksi" — merah |
| Pulih | Toast: "✅ Koneksi pulih" |

---

## S3 — Auto-Save Jawaban

> Background process. Terlihat via indikator auto-save di header ujian.

**Flow:**
```
Saat peserta pilih jawaban:
  → Update state lokal instantly
  → Mark: "pending save"

Setiap 30 detik:
  Jika ada jawaban pending:
    Kirim: POST /api/exam-session/answer
    Indikator: "⟳ Menyimpan..."
    
    Berhasil:
      → Indikator: "✓ Tersimpan"
    Gagal:
      → Indikator: "⚠ Gagal simpan — akan retry"
      → Masuk antrian retry

Saat waktu habis / submit manual:
  Kirim semua jawaban terakhir
  → Server simpan final state
  → Tandai: auto_submitted atau manually_submitted
```

---
---

## Ringkasan Semua Layar (Checklist Mockup)

### Role: Guru — 27 Frame

| # | Frame | Route |
|---|---|---|
| F1.1 | Login — Default | `/login` |
| F1.2 | Login — Loading | `/login` |
| F1.3 | Login — Error | `/login` |
| F2.1 | Register — Default | `/register` |
| F2.2 | Register — Error | `/register` |
| F3.1 | Dashboard — Ada Ujian | `/dashboard` |
| F3.2 | Dashboard — Empty State | `/dashboard` |
| F3.3 | Dashboard — Ujian Live | `/dashboard` |
| F4.1 | Form Buat Ujian — Default | `/dashboard/exams/new` |
| F4.2 | Form Buat Ujian — Upload Sukses | `/dashboard/exams/new` |
| F4.3 | Form Buat Ujian — Upload Error | `/dashboard/exams/new` |
| F4.4 | Modal Preview Soal | (modal) |
| F5.1 | Detail Ujian — Draft | `/dashboard/exams/:id` |
| F5.2 | Detail Ujian — Active | `/dashboard/exams/:id` |
| F5.3 | Detail Ujian — Ended | `/dashboard/exams/:id` |
| F5.4 | Detail Ujian — Archived | `/dashboard/exams/:id` |
| F5.5 | ConfirmDialog Mulai Ujian | (dialog) |
| F5.6 | ConfirmDialog Akhiri Ujian | (dialog) |
| F6.1 | Edit Ujian — Draft | `/dashboard/exams/:id/edit` |
| F6.2 | Edit Ujian — Active (restricted) | `/dashboard/exams/:id/edit` |
| F8.1 | Monitor — Normal | `/dashboard/exams/:id/monitor` |
| F8.2 | Monitor — Ada Pelanggaran | `/dashboard/exams/:id/monitor` |
| F8.3 | Monitor — Peserta Offline | `/dashboard/exams/:id/monitor` |
| F8.4 | Monitor — Peserta Locked | `/dashboard/exams/:id/monitor` |
| F9.1 | Modal Kirim Warning | (modal) |
| F11.1 | Detail Pelanggaran — Ada Data | `/dashboard/exams/:id/violations/:sid` |
| F11.2 | Detail Pelanggaran — Empty | `/dashboard/exams/:id/violations/:sid` |
| F12.1 | Hasil Ujian | `/dashboard/exams/:id/results` |
| F13.1 | Detail Jawaban Peserta | `/dashboard/exams/:id/results/:sid` |

### Role: Mahasiswa — 17 Frame

| # | Frame | Route |
|---|---|---|
| M1.1 | Join — Default | `/join` |
| M1.2 | Join — Error Tidak Ditemukan | `/join` |
| M1.3 | Join — Info Belum Mulai | `/join` |
| M2.1 | Identitas — Default | `/join/identity` |
| M2.2 | Identitas — Error NIM Duplikat | `/join/identity` |
| M3.1 | Waiting Room — Normal | `/exam/waiting` |
| M3.2 | Waiting Room — Koneksi Putus | `/exam/waiting` |
| M4.1 | Prompt Fullscreen | `/exam/session` (awal) |
| M4.2 | Prompt Fullscreen — No Support | `/exam/session` (awal) |
| M5.1 | Soal — Mode Satu per Satu | `/exam/session` |
| M5.2 | Soal — Timer Warning < 5 mnt | `/exam/session` |
| M5.3 | Soal — Koneksi Putus | `/exam/session` |
| M6.1 | Soal — Mode Semua Sekaligus | `/exam/session` |
| M7.1 | Overlay Warning dari Guru | `/exam/session` |
| M8.1 | Layar Terkunci (Locked) | `/exam/session` |
| M9.1 | ConfirmDialog Submit | (dialog) |
| M10.1 | Overlay Waktu Habis | `/exam/session` |
| M10.2 | Overlay Ujian Diakhiri Guru | `/exam/session` |
| M11.1 | Halaman Selesai | `/exam/done` |

---

## Urutan Prioritas Mockup

**Fase 1 — Core Flow (MVP):**

1. F1.1 Login
2. F2.1 Register
3. F3.1 Dashboard (ada ujian)
4. F4.1 Form Buat Ujian (default)
5. F4.2 Upload Soal Sukses
6. F5.1 Detail Ujian (Draft)
7. F5.2 Detail Ujian (Active)
8. F5.3 Detail Ujian (Ended)
9. M1.1 Join
10. M2.1 Identitas
11. M5.1 Halaman Soal (mode satu per satu)
12. M11.1 Selesai

**Fase 2 — Monitoring & Proctoring:**

13. F8.1 Monitor Normal
14. F8.2 Monitor Ada Pelanggaran
15. F9.1 Modal Kirim Warning
16. F11.1 Detail Pelanggaran
17. M7.1 Overlay Warning
18. M8.1 Layar Terkunci
19. M3.1 Waiting Room
20. M4.1 Fullscreen Prompt

**Fase 3 — Hasil, Edge Cases, & Polish:**

21. F12.1 Hasil Ujian
22. F13.1 Detail Jawaban
23. F3.2 Dashboard Empty State
24. F6.1 Edit Ujian (Draft)
25. F6.2 Edit Ujian (Active/Restricted)
26. M6.1 Mode Semua Sekaligus
27. M10.1 Overlay Waktu Habis
28. M10.2 Overlay Diakhiri Guru
29. Semua error states dan edge cases

---

*Dokumen ini dibuat pada 11 Oktober 2026 sebagai acuan mockup end-to-end untuk semua role dan fitur LockIt.*
*Sumber: `PRD.md` · `USER_FLOWS.md` · `UI_REQUIREMENTS.md`*
