# 🎨 UI Requirements — LockIt
## Kebutuhan Antarmuka Pengguna (Lengkap)

> Disusun berdasarkan: `PRD.md` + `AUDIT.md`
> Tanggal: 10 Oktober 2026
> Target tech: Next.js (App Router) — Fully Responsive (360px → 1440px+)

---

## Daftar Isi

1. [Design System & Token](#1-design-system--token)
2. [Shared Components](#2-shared-components)
3. [Halaman Guru — Auth](#3-halaman-guru--auth)
4. [Halaman Guru — Dashboard](#4-halaman-guru--dashboard)
5. [Halaman Guru — Ujian (CRUD)](#5-halaman-guru--ujian-crud)
6. [Halaman Guru — Monitoring Live](#6-halaman-guru--monitoring-live)
7. [Halaman Guru — Hasil & Export](#7-halaman-guru--hasil--export)
8. [Halaman Mahasiswa — Join](#8-halaman-mahasiswa--join)
9. [Halaman Mahasiswa — Ujian](#9-halaman-mahasiswa--ujian)
10. [Halaman Mahasiswa — Selesai](#10-halaman-mahasiswa--selesai)
11. [Notifikasi & Feedback Global](#11-notifikasi--feedback-global)
12. [State & Edge Cases](#12-state--edge-cases)
13. [Accessibility Requirements](#13-accessibility-requirements)

---

## 1. Design System & Token

### Warna
| Token | Nilai | Kegunaan |
|---|---|---|
| `--color-primary` | #4F46E5 (Indigo-600) | CTA utama, highlight |
| `--color-primary-dark` | #3730A3 | Hover primary |
| `--color-danger` | #DC2626 | Error, pelanggaran banyak, hapus |
| `--color-warning` | #D97706 | Warning, pelanggaran sedang |
| `--color-success` | #16A34A | Status berhasil, bersih |
| `--color-neutral-50` | #F9FAFB | Background halaman |
| `--color-neutral-900` | #111827 | Teks utama |
| `--color-surface` | #FFFFFF | Card, modal background |

### Status Badge Colors
| Status | Warna | Keterangan |
|---|---|---|
| `online` | Hijau | Peserta sedang aktif |
| `offline` | Abu | Heartbeat hilang > 30 detik |
| `submitted` | Biru | Sudah submit |
| `locked` | Merah | Auto-lock oleh sistem |
| `waiting` | Kuning | Di waiting room |

### Tipografi
- **Font**: Inter (Google Fonts)
- **Heading 1**: 32px / 700 / leading-tight
- **Heading 2**: 24px / 600
- **Body**: 16px / 400 / leading-relaxed
- **Small/Label**: 14px / 500
- **Caption/Hint**: 12px / 400 / neutral-500

### Spacing Scale
4px base — spacing: 4, 8, 12, 16, 24, 32, 48, 64

### Breakpoints
- **Mobile**: 360px – 767px
- **Tablet**: 768px – 1023px
- **Desktop**: 1024px+

---

## 2. Shared Components

### 2.1 `<Button>`
| Varian | Warna BG | Use-case |
|---|---|---|
| `primary` | Indigo-600 | Submit, Buat, Simpan, Mulai |
| `secondary` | White + border | Cancel, Batal, Kembali |
| `danger` | Red-600 | Hapus, Lock, Akhiri Ujian |
| `ghost` | Transparan | Aksi minor di tabel |
| `icon-only` | Transparan | Tombol dengan ikon saja |

**State wajib diimplementasi:**
- Default
- Hover (gelap 10%)
- Focus (ring outline)
- Loading (spinner + teks disabled)
- Disabled (opacity-50, cursor not-allowed)

**Size variants:** `sm` (32px) · `md` (40px, default) · `lg` (48px)

---

### 2.2 `<Input>` / `<Textarea>`
- Label di atas
- Placeholder teks abu
- Border normal → fokus biru → error merah
- Helper text di bawah (opsional)
- Error message di bawah (merah) + icon ⚠️
- Character count untuk textarea (opsional)

---

### 2.3 `<Badge>`
Pill-shaped label untuk status.
Varian: `green`, `yellow`, `red`, `blue`, `gray`
Size: `sm` · `md`

---

### 2.4 `<Modal>` / Dialog
- Overlay backdrop gelap 50%
- Panel centered, max-width 480px (sm) / 640px (md)
- Header (judul + tombol ✕)
- Body scrollable
- Footer (action buttons: kanan)
- Tutup via: tombol ✕, klik backdrop, tekan Escape

---

### 2.5 `<Toast>` / Snackbar
- Posisi: bottom-right (desktop) / bottom-center (mobile)
- Varian: `success` ✓ · `error` ✗ · `warning` ⚠ · `info` ℹ
- Auto-dismiss: 4 detik
- Bisa dismiss manual

---

### 2.6 `<Table>`
- Header sticky saat scroll
- Row hover highlight
- Sortable column (ikon ↑↓)
- Empty state: ilustrasi + teks
- Loading skeleton rows

---

### 2.7 `<Navbar>` — Guru
- Logo "LockIt" di kiri
- Nama guru + avatar di kanan
- Dropdown menu: Profil · Logout
- Responsive: hamburger di mobile

---

### 2.8 `<Sidebar>` — Dashboard Guru (opsional, atau flat navbar)
Jika pakai sidebar:
- Dashboard (ikon grid)
- Ujian Saya (ikon list)
- Collapse ke icon-only di mobile

---

### 2.9 `<StatusPill>` — Status Ujian
Warna pill sesuai status:
| Status | Warna | Label |
|---|---|---|
| `draft` | Gray | Draft |
| `active` | Green | Sedang Berlangsung |
| `ended` | Blue | Selesai |
| `archived` | Neutral | Diarsipkan |

---

### 2.10 `<ConfirmDialog>`
Dialog konfirmasi sebelum aksi destruktif.
- Judul: teks ringkas
- Body: penjelasan konsekuensi
- Tombol: **[Batal]** [Konfirmasi — warna danger]

---

### 2.11 `<EmptyState>`
- Ikon/ilustrasi
- Judul
- Deskripsi singkat
- CTA button (opsional)

Contoh: "Belum ada ujian. Buat ujian pertamamu!"

---

### 2.12 `<LoadingSkeleton>`
Placeholder abu beranimasi pulse untuk:
- Card ujian
- Tabel peserta
- Data dashboard

---

### 2.13 `<FileUpload>`
- Drag-and-drop area
- Tombol "Pilih File" sebagai fallback
- Format yang diterima: `.json`, `.xml`
- Menampilkan: nama file, ukuran file
- Progress bar saat upload
- Status: idle → uploading → success → error
- Error message (format salah, ukuran > 5MB)

---

## 3. Halaman Guru — Auth

### 3.1 Halaman Login `/login`

**Layout:** Centered card, lebar max 440px

**Elemen:**
| # | Elemen | Detail |
|---|---|---|
| 1 | Logo + nama app | "🔒 LockIt" di atas form |
| 2 | Tagline | "Platform Ujian Online dengan Proctoring" |
| 3 | `<Input>` Email | type=email, required, placeholder "email@kampus.ac.id" |
| 4 | `<Input>` Password | type=password, toggle show/hide (ikon mata) |
| 5 | `<Button primary lg>` | "Masuk" — full width |
| 6 | Link | "Belum punya akun? **Daftar di sini**" → `/register` |

**State & Validasi:**
- Email kosong → "Email wajib diisi"
- Format email salah → "Format email tidak valid"
- Password kosong → "Password wajib diisi"
- Login gagal (401) → Toast error "Email atau password salah"
- Rate limit (429) → "Terlalu banyak percobaan. Coba lagi dalam X menit"
- Loading state pada tombol Masuk

---

### 3.2 Halaman Register `/register`

**Layout:** Centered card, lebar max 440px

**Elemen:**
| # | Elemen | Detail |
|---|---|---|
| 1 | Logo + nama app | |
| 2 | `<Input>` Nama Lengkap | required, min 3 karakter |
| 3 | `<Input>` Email | type=email, required |
| 4 | `<Input>` Password | type=password, toggle show/hide, min 8 karakter |
| 5 | `<Input>` Konfirmasi Password | type=password, harus cocok dengan #4 |
| 6 | `<Button primary lg>` | "Daftar Sekarang" — full width |
| 7 | Link | "Sudah punya akun? **Masuk**" → `/login` |

**State & Validasi:**
- Semua field wajib diisi
- Password < 8 karakter → "Password minimal 8 karakter"
- Konfirmasi tidak cocok → "Password tidak cocok"
- Email sudah terdaftar (409) → "Email sudah digunakan"
- Rate limit (429) → pesan sesuai
- Loading state tombol

---

## 4. Halaman Guru — Dashboard

### 4.1 Dashboard Utama `/dashboard`

**Layout:** Header navbar + grid konten

**Elemen:**

#### Header Section
| # | Elemen | Detail |
|---|---|---|
| 1 | Greeting | "Selamat datang, [Nama Guru]!" |
| 2 | `<Button primary>` | **"+ Buat Ujian Baru"** → navigasi ke `/dashboard/exams/new` |

#### Stats Card Row (4 kartu)
| # | Kartu | Metric |
|---|---|---|
| 1 | Total Ujian | Angka total ujian milik guru |
| 2 | Ujian Aktif | Ujian yang sedang berlangsung |
| 3 | Total Peserta | Akumulasi semua peserta |
| 4 | Ujian Selesai | Ujian berstatus `ended`/`archived` |

#### Filter & Search Bar
| # | Elemen | Detail |
|---|---|---|
| 1 | `<Input>` Search | Cari ujian by judul, placeholder "Cari ujian..." |
| 2 | `<Select>` Filter Status | All · Draft · Aktif · Selesai · Diarsipkan |
| 3 | `<Select>` Urutkan | Terbaru · Terlama · A-Z |

#### Daftar Ujian (Card Grid / List)
Setiap card ujian berisi:
| # | Elemen | Detail |
|---|---|---|
| 1 | Judul ujian | Bold, klik → detail ujian |
| 2 | `<StatusPill>` | Status ujian |
| 3 | Durasi | "XX menit" |
| 4 | Kode Akses | Badge monospace, besar |
| 5 | Jumlah Soal | "XX soal" |
| 6 | Tanggal Dibuat | Format: "12 Sep 2026" |
| 7 | `<Button ghost>` **Detail** | → `/dashboard/exams/:id` |
| 8 | `<Button ghost>` **Monitor** | Hanya muncul jika status `active` → `/dashboard/exams/:id/monitor` |
| 9 | `<Button ghost icon>` ⋯ | Dropdown: Edit · Hapus · Lihat Hasil |

**Dropdown aksi card:**
- **Edit** → `/dashboard/exams/:id/edit` (disabled jika sudah ada peserta aktif)
- **Lihat Hasil** → `/dashboard/exams/:id/results` (hanya jika `ended`/`archived`)
- **Arsipkan** → ConfirmDialog sebelum soft delete
- **Hapus Permanen** → ConfirmDialog (hanya jika `draft` tanpa peserta)

**Empty State:** "Belum ada ujian. Mulai dengan membuat ujian pertamamu!"

---

### 4.2 Halaman Detail Ujian `/dashboard/exams/:id`

**Layout:** Detail info + sidebar aksi

**Elemen:**

#### Info Ujian
| # | Elemen | Detail |
|---|---|---|
| 1 | Judul ujian | H1 |
| 2 | Deskripsi | Paragraf abu (jika ada) |
| 3 | `<StatusPill>` | Status saat ini |
| 4 | Durasi | "XX menit" |
| 5 | Jumlah soal | "XX soal dari upload" |
| 6 | Tanggal dibuat | |
| 7 | Kebijakan pelanggaran | ringkasan: max violations, action |

#### Kode Akses Panel (prominent)
| # | Elemen | Detail |
|---|---|---|
| 1 | Kode akses | Font besar monospace, centered, in a bordered box |
| 2 | `<Button icon>` Copy | Salin ke clipboard → Toast "Kode disalin!" |
| 3 | `<Button secondary sm>` | "Generate Ulang Kode" → ConfirmDialog ("Kode lama akan tidak valid. Lanjutkan?") |

#### Aksi Utama (tombol berdasarkan status)
| Status Ujian | Tombol Tersedia |
|---|---|
| `draft` | **[Mulai Ujian]** (primary) · **[Edit]** · **[Preview Soal]** · **[Hapus]** (danger) |
| `active` | **[Monitor Live]** (primary) · **[Akhiri Ujian]** (danger) |
| `ended` | **[Lihat Hasil]** (primary) · **[Export CSV]** · **[Export Excel]** |
| `archived` | **[Lihat Hasil]** · read-only |

**ConfirmDialog untuk "Mulai Ujian":**
> "Ujian akan dimulai dan peserta yang sudah di waiting room akan langsung bisa mengerjakan. Pastikan semua siap. Lanjutkan?"

**ConfirmDialog untuk "Akhiri Ujian":**
> "Ujian akan diakhiri. Semua peserta yang belum submit akan di-auto-submit. Ini tidak bisa dibatalkan. Lanjutkan?"

---

## 5. Halaman Guru — Ujian (CRUD)

### 5.1 Form Buat Ujian `/dashboard/exams/new`

**Layout:** Wizard multi-step ATAU single long form. Rekomendasi: single form dengan section.

**Section 1: Informasi Dasar**
| # | Elemen | Type | Validasi |
|---|---|---|---|
| 1 | Judul Ujian | `<Input>` text | Required, max 200 char |
| 2 | Deskripsi (opsional) | `<Textarea>` | Max 1000 char, character count |
| 3 | Durasi | `<Input>` number | Required, 1–480 menit |

**Section 2: Bank Soal**
| # | Elemen | Detail |
|---|---|---|
| 1 | `<FileUpload>` | Drag-drop atau klik, accept .json/.xml, max 5MB |
| 2 | Status upload | Idle / Mengupload... / ✓ Berhasil (X soal ditemukan) / ✗ Error (pesan error) |
| 3 | `<Button ghost sm>` | **"Preview Soal"** — muncul setelah upload berhasil |
| 4 | Error parsing | Tampilkan error spesifik: "Soal #3: field 'options' tidak ditemukan" |

**Section 3: Pengaturan Soal**
| # | Elemen | Type | Default |
|---|---|---|---|
| 1 | Acak Urutan Soal | `<Toggle/Switch>` | OFF |
| 2 | Mode Tampilan | `<RadioGroup>` | Satu per satu / Semua sekaligus |

**Section 4: Kebijakan Pelanggaran**
| # | Elemen | Type | Default |
|---|---|---|---|
| 1 | Maksimal pelanggaran | `<Input>` number | 3 |
| 2 | Tindakan setelah melewati batas | `<Select>` | Warning · Review Manual · Auto-lock |
| 3 | Deteksi copy-paste | `<Toggle>` | OFF |
| 4 | Deteksi klik kanan | `<Toggle>` | OFF |
| 5 | Deteksi DevTools | `<Toggle>` | OFF |

**Footer Tombol:**
| Tombol | Aksi |
|---|---|
| `[Batal]` secondary | Kembali ke dashboard (ConfirmDialog jika ada perubahan) |
| `[Simpan sebagai Draft]` secondary | Simpan tanpa mulai |
| `[Simpan & Lihat Detail]` primary | Simpan → redirect ke detail ujian |

---

### 5.2 Form Edit Ujian `/dashboard/exams/:id/edit`

**Sama seperti form Buat**, namun:
- Field diisi dengan data existing
- Jika sudah ada peserta aktif:
  - Section 1 (info dasar) → **read-only** (disabled fields + info banner: "Tidak bisa diubah saat ujian sedang berlangsung")
  - Section 2 (bank soal) → read-only
  - Section 3 (pengaturan) → read-only
  - **Hanya Section 4 (kebijakan pelanggaran) yang bisa diedit**
- Banner kuning: "Kamu sedang mengedit ujian yang sedang berlangsung. Hanya kebijakan pelanggaran yang bisa diubah."

**Footer Tombol:**
| Tombol | Aksi |
|---|---|
| `[Batal]` secondary | Kembali (ConfirmDialog jika ada perubahan) |
| `[Simpan Perubahan]` primary | Update → redirect ke detail ujian |

---

### 5.3 Modal Preview Soal

Trigger: tombol "Preview Soal" di form ujian

**Layout:** Modal ukuran `lg` (max-width 720px)

**Konten:**
| # | Elemen | Detail |
|---|---|---|
| 1 | Header | "Preview Soal — [Judul Ujian]" + tombol ✕ |
| 2 | Soal counter | "Soal 1 dari 25" |
| 3 | Gambar soal | Jika ada `image_url`, tampilkan gambar |
| 4 | Teks soal | Teks pertanyaan |
| 5 | Opsi jawaban | Radio button A–D/E (disabled — preview only) |
| 6 | Indikator jawaban benar | Opsi yang benar di-highlight hijau |
| 7 | Poin per soal | "Poin: 10" |
| 8 | Navigasi | `[← Sebelumnya]` · `[Selanjutnya →]` |
| 9 | Footer | `[Tutup]` secondary |

---

## 6. Halaman Guru — Monitoring Live

### 6.1 Dashboard Monitor `/dashboard/exams/:id/monitor`

> Halaman ini auto-refresh via WebSocket. Real-time.

**Layout:** Full-width, dense layout. Dua panel: Overview atas, Tabel peserta bawah.

#### Panel Atas — Overview Cards (5 kartu)
| # | Kartu | Metric | Warna |
|---|---|---|---|
| 1 | Total Peserta Join | Angka | Neutral |
| 2 | Online | Angka | Hijau |
| 3 | Offline/Putus | Angka | Merah |
| 4 | Sudah Submit | Angka | Biru |
| 5 | Belum Submit | Angka | Kuning |

#### Panel Tengah — Informasi Ujian + Kontrol
| # | Elemen | Detail |
|---|---|---|
| 1 | Timer ujian | Countdown waktu tersisa (besar, merah jika < 5 menit) |
| 2 | Nama ujian | |
| 3 | `<Button danger>` | **"Akhiri Ujian Sekarang"** → ConfirmDialog |
| 4 | Indikator koneksi | "● Live" hijau / "⚠ Reconnecting..." kuning |

#### Panel Bawah — Tabel Peserta Live

**Kolom tabel:**
| # | Kolom | Detail |
|---|---|---|
| 1 | Nama Peserta | Teks |
| 2 | NIM | Teks monospace |
| 3 | Status | `<Badge>` online/offline/submitted/locked/waiting |
| 4 | Pelanggaran | Angka dengan warna: 0=hijau, 1-2=kuning, ≥3=merah |
| 5 | Progress Jawaban | "X/Y soal" atau progress bar mini |
| 6 | Last Activity | Waktu relatif "2 menit lalu" |
| 7 | Aksi | Tombol-tombol aksi |

**Tombol Aksi per baris:**
| Tombol | Kondisi Muncul | Aksi |
|---|---|---|
| `[⚠ Kirim Warning]` ghost-yellow | Selalu | Buka Modal Kirim Warning |
| `[🔓 Unlock]` ghost-green | Hanya jika `locked` | Unlock peserta → ConfirmDialog |
| `[👁 Detail]` ghost | Selalu | Buka Modal/Halaman Detail Pelanggaran |

**Filter tabel:**
- `<Select>` Filter: Semua · Online · Offline · Submitted · Bermasalah
- `<Input>` Search: Cari nama/NIM
- `<Button>` Refresh manual (fallback jika WS putus)

**Notifikasi Pelanggaran Baru:**
- Toast di kanan atas: "⚠ Budi — Tab switch terdeteksi" + link ke detail
- Bisa pakai audio notif (toggle on/off)

---

### 6.2 Modal Kirim Warning ke Peserta

Trigger: Tombol "Kirim Warning" di tabel monitor

| # | Elemen | Detail |
|---|---|---|
| 1 | Header | "Kirim Peringatan ke [Nama Peserta]" |
| 2 | Info peserta | Nama + NIM (read-only) |
| 3 | `<Textarea>` Pesan | Required, placeholder "Mohon perhatikan aturan ujian...", max 500 char |
| 4 | Tombol `[Batal]` | secondary |
| 5 | Tombol `[Kirim Peringatan]` | primary (loading state saat kirim) |

---

### 6.3 Halaman / Modal Detail Pelanggaran `/dashboard/exams/:id/violations/:sid`

Bisa berupa halaman penuh atau slide-over panel di kanan.

**Konten:**
| # | Elemen | Detail |
|---|---|---|
| 1 | Header | Nama + NIM peserta |
| 2 | Summary | Total pelanggaran: X · Jenis: tab switch (3), fullscreen exit (1), dst. |
| 3 | **Timeline** | Daftar event kronologis (dari terlama ke terbaru) |
| 4 | Tombol `[Export Log Pelanggaran]` | opsional, download PDF/CSV pelanggaran peserta ini |

**Setiap item di Timeline:**
```
[Icon Jenis] [Jenis Event]       [Timestamp]
             [Detail/Metadata]   [Durasi jika ada]
```

Contoh:
```
⛶ Fullscreen Exit          10:32:15 WIB
  Durasi keluar: 12 detik

🔁 Tab Switch               10:35:02 WIB
  Pelanggaran ke-3 dari 5

📋 Copy Attempt             10:41:30 WIB
  Teks yang di-copy: [hidden untuk privasi]
```

**Ikon per jenis event:**
| Event | Ikon |
|---|---|
| `fullscreen_exit` | ⛶ |
| `window_blur` | 🪟 |
| `tab_switch` | 🔁 |
| `copy_attempt` | 📋 |
| `paste_attempt` | 📌 |
| `right_click` | 🖱️ |
| `devtools` | 🔧 |
| `reconnect` | 🔄 |
| `heartbeat_lost` | 💔 |

---

## 7. Halaman Guru — Hasil & Export

### 7.1 Halaman Hasil Ujian `/dashboard/exams/:id/results`

**Layout:** Stats atas, tabel bawah

#### Statistik Ujian
| # | Kartu | Detail |
|---|---|---|
| 1 | Rata-rata Nilai | Angka + bintang (visual) |
| 2 | Nilai Tertinggi | |
| 3 | Nilai Terendah | |
| 4 | Persentase Lulus | Jika ada batas lulus yang ditentukan |
| 5 | Total Peserta Submit | |

#### Grafik Distribusi Nilai *(opsional tapi recommended)*
- Bar chart distribusi (0–59, 60–69, 70–79, 80–89, 90–100)

#### Tombol Export (di kanan atas)
| Tombol | Aksi |
|---|---|
| `[📥 Export CSV]` secondary | Download CSV |
| `[📊 Export Excel]` secondary | Download XLSX |

#### Tabel Hasil
**Kolom:**
| # | Kolom | Detail |
|---|---|---|
| 1 | Nama | |
| 2 | NIM | |
| 3 | Nilai | Angka (0–100), warna merah jika < passing grade |
| 4 | Benar / Total | "18/25" |
| 5 | Pelanggaran | Jumlah total pelanggaran |
| 6 | Submit pada | Waktu submit |
| 7 | Aksi | `[Detail Jawaban]` ghost |

**Sort:** Bisa sort by nilai (asc/desc), nama (A-Z), NIM

---

### 7.2 Halaman Detail Jawaban `/dashboard/exams/:id/results/:sid`

**Layout:** Info peserta + daftar soal + jawaban

**Header:**
- Nama peserta + NIM
- Nilai: besar, bold (misal "84/100")
- Total benar/salah

**Daftar Soal (scroll):**
Setiap baris soal:
| # | Elemen | Detail |
|---|---|---|
| 1 | Nomor soal | "Soal 1" |
| 2 | Teks soal | |
| 3 | Gambar soal | Jika ada |
| 4 | Jawaban peserta | Teks opsi yang dipilih |
| 5 | Kunci jawaban | Teks opsi yang benar |
| 6 | Status | ✅ Benar (hijau) / ❌ Salah (merah) |
| 7 | Poin | "+10" atau "0" |

---

## 8. Halaman Mahasiswa — Join

### 8.1 Halaman Join Ujian `/join`

**Layout:** Minimal, centered. Tidak ada navbar guru.

**Elemen:**
| # | Elemen | Detail |
|---|---|---|
| 1 | Logo LockIt | Sederhana, tidak klik-able |
| 2 | Heading | "Ikut Ujian" |
| 3 | Subheading | "Masukkan kode yang diberikan oleh pengawasmu" |
| 4 | `<Input>` Kode Akses | type=text, uppercase otomatis, monospace font, ukuran besar, max 8 char, placeholder "ABCD1234" |
| 5 | `<Button primary lg>` | **"Masuk"** — full width |

**State & Validasi:**
- Kode kosong → "Kode akses wajib diisi"
- Kode < 6 karakter → "Kode terlalu pendek"
- Kode tidak valid (404) → "Kode tidak ditemukan. Periksa kembali."
- Ujian belum aktif → "Ujian belum dimulai. Tunggu pengawas memulai ujian."
- Ujian sudah berakhir → "Ujian sudah selesai."
- Loading state tombol

---

### 8.2 Halaman Identitas `/join/identity`

> Muncul setelah kode valid diverifikasi

**Elemen:**
| # | Elemen | Detail |
|---|---|---|
| 1 | Heading | "[Nama Ujian]" — nama ujian yang akan diikuti |
| 2 | Subheading | "Masukkan identitasmu" |
| 3 | Info ujian | Durasi: XX menit · Jumlah soal: XX |
| 4 | `<Input>` Nama Lengkap | required, min 3 char |
| 5 | `<Input>` NIM | required, alphanumeric |
| 6 | `<Button primary lg>` | **"Bergabung"** — full width |
| 7 | `<Button ghost>` | **"← Kembali"** — ke halaman kode |

**State & Validasi:**
- Nama kosong → "Nama wajib diisi"
- NIM kosong → "NIM wajib diisi"
- NIM duplikat di ujian ini (409) → "NIM ini sudah digunakan di ujian ini. Jika ini milikmu, hubungi pengawas."
- Loading state tombol

---

### 8.3 Waiting Room `/exam/waiting`

> Tampil jika ujian belum dimulai saat peserta join

**Elemen:**
| # | Elemen | Detail |
|---|---|---|
| 1 | Animasi loading/pulse | Lingkaran berputar atau ikon jam |
| 2 | Heading | "Menunggu ujian dimulai..." |
| 3 | Info peserta | "Kamu masuk sebagai: **[Nama]** ([NIM])" |
| 4 | Info ujian | Nama ujian |
| 5 | Pesan instruksi | "Jangan tutup halaman ini. Ujian akan dimulai secara otomatis." |
| 6 | Koneksi status | "● Terhubung" hijau / "⚠ Menghubungkan ulang..." kuning |

**Behavior:**
- Auto-redirect ke halaman ujian saat guru mulai ujian (via WebSocket/SSE)
- Tidak ada tombol manual (tidak bisa skip waiting room)

---

## 9. Halaman Mahasiswa — Ujian

### 9.1 Halaman Ujian `/exam/session`

> Halaman paling kritis. Fullscreen mode.

**Layout:** Tiga zona utama:
1. **Header bar** — timer + info
2. **Konten soal** — area utama
3. **Footer** — navigasi + submit

---

#### Header Bar (sticky, tidak scroll)
| # | Elemen | Detail |
|---|---|---|
| 1 | Nama ujian | Truncated jika panjang |
| 2 | Nama peserta | "[Nama] · [NIM]" |
| 3 | **Timer Countdown** | Format MM:SS — besar, bold. Merah + animasi pulse jika < 5 menit |
| 4 | Indikator auto-save | "✓ Tersimpan" abu / "⟳ Menyimpan..." / "⚠ Belum tersimpan" |
| 5 | Status fullscreen | Icon fullscreen — klik untuk enter fullscreen kembali jika keluar |

---

#### Konten Soal

**Mode "Satu per satu" (default):**
| # | Elemen | Detail |
|---|---|---|
| 1 | Nomor soal | "Soal [X] dari [Y]" |
| 2 | Poin soal | "Poin: 10" |
| 3 | Gambar soal | Tampil jika ada, klikable untuk zoom |
| 4 | Teks soal | |
| 5 | Opsi Jawaban | Radio button list (A, B, C, D/E) — satu pilihan |
| 6 | Setiap opsi | Gambar opsional per opsi |

**Pilihan radio jawaban:**
- Default: unselected
- Selected: border biru, background biru-muda
- Hover: background abu muda
- Font opsi sedikit lebih besar dari normal untuk kemudahan baca

**Mode "Semua sekaligus":**
- Semua soal tampil dalam satu halaman dengan scroll
- Setiap soal dalam card/section terpisah
- Quick-jump sidebar kanan (nomor soal, warna biru jika sudah dijawab)

---

#### Navigasi Soal (Mode Satu per Satu)
| # | Elemen | Detail |
|---|---|---|
| 1 | `<Button secondary>` | **"← Sebelumnya"** — disabled di soal pertama |
| 2 | Soal navigator pill | Daftar nomor soal 1..N. Biru = sudah dijawab, abu = belum |
| 3 | `<Button secondary>` | **"Selanjutnya →"** — disabled di soal terakhir |

---

#### Footer (sticky bottom)
| # | Elemen | Kondisi |
|---|---|---|
| 1 | Progres jawaban | "Dijawab: X dari Y soal" |
| 2 | `<Button primary>` **"Submit Ujian"** | Selalu terlihat. ConfirmDialog sebelum submit |

---

#### Notifikasi Warning dari Guru
Muncul sebagai **overlay banner** di atas halaman (bukan toast — harus lebih mencolok):
- Background merah/kuning
- Icon ⚠️ + teks "Peringatan dari Pengawas:"
- Isi pesan warning
- Tombol `[Tutup]` atau auto-dismiss 10 detik
- Tidak memblokir pengerjaan soal

---

#### ConfirmDialog Submit Manual
> "Apakah kamu yakin ingin submit?"

| # | Elemen | Detail |
|---|---|---|
| 1 | Judul | "Submit Ujian?" |
| 2 | Body | "Kamu baru menjawab **X dari Y soal**. Jawaban yang belum dijawab akan dianggap kosong. Kamu tidak bisa mengubah jawaban setelah submit." |
| 3 | Tombol `[Batal]` | secondary |
| 4 | Tombol `[Ya, Submit Sekarang]` | primary |

---

#### Request Fullscreen Prompt
Muncul di awal saat ujian dimulai, sebelum soal tampil:

| # | Elemen | Detail |
|---|---|---|
| 1 | Heading | "Masuk ke Mode Ujian" |
| 2 | Deskripsi | "Ujian ini sebaiknya dikerjakan dalam mode layar penuh untuk pengalaman terbaik. Keluar dari layar penuh akan dicatat sebagai pelanggaran." |
| 3 | `<Button primary>` | **"Masuk Layar Penuh & Mulai"** |
| 4 | Link teks kecil | "Lanjutkan tanpa layar penuh" (dicatat sebagai pelanggaran pertama) |

---

#### Status Peserta Terkunci (Locked State)
Jika guru/sistem mengunci peserta:

| # | Elemen | Detail |
|---|---|---|
| 1 | Overlay penuh | Blur background soal |
| 2 | Icon 🔒 | Besar, centered |
| 3 | Heading | "Ujianmu Sementara Dikunci" |
| 4 | Body | "Pengawas sedang meninjau aktivitasmu. Tunggu hingga pengawas membuka kunci." |
| 5 | Indikator koneksi | Tetap menunjukkan connected |

---

## 10. Halaman Mahasiswa — Selesai

### 10.1 Halaman Selesai `/exam/done`

**Layout:** Centered, clean, no navbar

**Elemen:**
| # | Elemen | Detail |
|---|---|---|
| 1 | Icon ✅ | Besar, hijau, animated (pop-in) |
| 2 | Heading | "Ujian Selesai!" |
| 3 | Subheading | "Jawabanmu berhasil dikumpulkan." |
| 4 | Info | Nama: [Nama] · NIM: [NIM] · Ujian: [Nama Ujian] |
| 5 | Waktu submit | "Submitted pada 10:42 WIB" |
| 6 | Pesan | "Terima kasih sudah mengikuti ujian. Hasil akan diumumkan oleh pengawasmu." |
| 7 | Tombol | `[Tutup Tab]` atau tidak ada tombol (biarkan user tutup manual) |

**Behavior:**
- Halaman ini tidak bisa di-back (history replace)
- Tidak bisa kembali ke halaman ujian

---

## 11. Notifikasi & Feedback Global

### 11.1 Toast Notification
Posisi: bottom-right desktop, bottom-center mobile

| Tipe | Contoh Pesan |
|---|---|
| ✅ Success | "Ujian berhasil dibuat", "Kode disalin!" |
| ❌ Error | "Terjadi kesalahan. Coba lagi.", "Format file tidak valid" |
| ⚠ Warning | "Kode akses hampir habis masa berlaku" |
| ℹ Info | "Jawaban tersimpan otomatis" |

---

### 11.2 Indikator Koneksi (Mahasiswa)
Persistent di sudut layar saat ujian berlangsung:

| State | Tampilan |
|---|---|
| Connected | "● Online" — hijau kecil |
| Reconnecting | "⟳ Menghubungkan ulang..." — kuning, animasi spin |
| Offline | "✗ Tidak ada koneksi" — merah |

Saat reconnect berhasil → Toast "Koneksi pulih. Jawabanmu tersimpan."

---

### 11.3 Auto-save Indicator
Di header bar halaman ujian:

| State | Tampilan |
|---|---|
| Saved | "✓ Tersimpan" — abu, kecil |
| Saving | "⟳ Menyimpan..." — spinning |
| Failed | "⚠ Gagal simpan — akan retry" — kuning |

---

### 11.4 Page Loading State
- Skeleton loader untuk list ujian & tabel
- Spinner centered untuk navigasi halaman
- Progress bar tipis di top page (NProgress style)

---

## 12. State & Edge Cases

### 12.1 Error Pages
| Error | Halaman / Pesan |
|---|---|
| 404 | "Halaman tidak ditemukan" + link ke dashboard/home |
| 403 | "Kamu tidak punya akses ke halaman ini" + link ke login |
| 500 | "Terjadi kesalahan server" + tombol Coba Lagi |
| Rate limit | "Terlalu banyak permintaan. Coba lagi dalam X detik" |

---

### 12.2 Edge Cases yang Perlu UI

| Skenario | UI Response |
|---|---|
| Upload soal gagal parsing | Error message per-soal yang bermasalah (misal: "Soal #3: kunci jawaban tidak ada") |
| Ujian berakhir saat peserta masih di halaman | Overlay "Waktu Habis" → auto-redirect ke halaman selesai |
| Guru mengakhiri ujian manual | Overlay "Ujian Diakhiri" muncul di semua peserta |
| Peserta coba akses `/exam/session` setelah submit | Redirect ke `/exam/done` |
| Regenerate kode saat ujian aktif | Button di-disabled + tooltip "Tidak bisa regenerate saat ujian berlangsung" |
| Jaringan putus saat auto-save | Indikator merah, queue lokal, retry otomatis |
| Browser tidak support Fullscreen API | Pesan informasi: "Browser ini tidak mendukung fullscreen. Ini sudah dicatat." |
| NIM duplikat saat join | Error spesifik: "NIM ini sudah digunakan. Jika ini milikmu, hubungi pengawas." |

---

### 12.3 Empty States
| Halaman | Pesan |
|---|---|
| Dashboard — no exams | "Belum ada ujian. Mulai dengan **membuat ujian baru**." |
| Monitor — no participants | "Belum ada peserta yang bergabung." |
| Results — no results | "Belum ada peserta yang submit." |
| Violations — no violations | "✅ Tidak ada pelanggaran yang tercatat." |

---

## 13. Accessibility Requirements

| # | Requirement | Detail |
|---|---|---|
| 1 | Semantic HTML | Gunakan `<button>`, `<form>`, `<nav>`, `<main>`, `<h1>`-`<h6>` dengan benar |
| 2 | Focus management | Semua elemen interaktif harus bisa dicapai via keyboard (Tab order logis) |
| 3 | Focus visible | Ring outline jelas saat focus (tidak dihapus) |
| 4 | Alt text | Semua gambar soal harus punya alt text (atau deskripsi dari field soal) |
| 5 | Color tidak satu-satunya indikator | Selalu tambahkan ikon/label selain warna (misal: status badge) |
| 6 | Error association | Error message dikaitkan ke input via `aria-describedby` |
| 7 | Loading state | `aria-busy="true"` saat loading, `aria-live` untuk toast |
| 8 | Timer | Timer countdown punya `aria-live="polite"` update setiap menit |
| 9 | Modal trap focus | Focus terjebak di dalam modal saat buka, kembali saat tutup |
| 10 | Contrast ratio | Minimum 4.5:1 untuk teks normal, 3:1 untuk teks besar |

---

## Ringkasan Inventaris Halaman & Komponen

### Halaman (Total: 14)
| # | Route | Aktor | Prioritas |
|---|---|---|---|
| 1 | `/login` | Guru | P0 |
| 2 | `/register` | Guru | P0 |
| 3 | `/dashboard` | Guru | P0 |
| 4 | `/dashboard/exams/new` | Guru | P0 |
| 5 | `/dashboard/exams/:id` | Guru | P0 |
| 6 | `/dashboard/exams/:id/edit` | Guru | P1 |
| 7 | `/dashboard/exams/:id/monitor` | Guru | P1 |
| 8 | `/dashboard/exams/:id/violations/:sid` | Guru | P1 |
| 9 | `/dashboard/exams/:id/results` | Guru | P1 |
| 10 | `/dashboard/exams/:id/results/:sid` | Guru | P1 |
| 11 | `/join` | Mahasiswa | P0 |
| 12 | `/join/identity` | Mahasiswa | P0 |
| 13 | `/exam/waiting` | Mahasiswa | P1 |
| 14 | `/exam/session` | Mahasiswa | P0 |
| 15 | `/exam/done` | Mahasiswa | P0 |

### Shared Components (Total: 13)
`Button` · `Input` · `Textarea` · `Badge` · `Modal` · `Toast` · `Table` · `Navbar` · `StatusPill` · `ConfirmDialog` · `EmptyState` · `LoadingSkeleton` · `FileUpload`

### Tombol (Per-Halaman, Kritis)
| Halaman | Tombol Kritis |
|---|---|
| Login | Masuk |
| Register | Daftar Sekarang |
| Dashboard | + Buat Ujian Baru, Detail, Monitor, ⋯ (dropdown) |
| Detail Ujian | Mulai Ujian, Akhiri Ujian, Monitor Live, Copy Kode, Generate Ulang Kode |
| Form Buat/Edit | Simpan Draft, Simpan & Lihat Detail, Simpan Perubahan, Batal, Preview Soal |
| Monitor | Kirim Warning, Unlock, Detail, Akhiri Ujian |
| Hasil | Export CSV, Export Excel, Detail Jawaban |
| Join | Masuk |
| Identity | Bergabung, ← Kembali |
| Ujian | Sebelumnya, Selanjutnya, Submit Ujian, Masuk Layar Penuh |

---

> **Catatan:** Dokumen ini adalah **living document**. Update seiring implementasi dan keputusan desain baru diambil.
