# Keputusan

### 2026-11-08 — Penanda soal dan navigasi ujian
- Keputusan: Penanda “Periksa lagi” disimpan berdasarkan ujian dan siswa di browser; navigasi ponsel berbentuk deretan horizontal.
- Alasan: Siswa dapat kembali ke soal yang ditandai tanpa perubahan kontrak backend dan tetap memiliki ruang baca di ponsel.
- Ditolak: Menyimpan penanda sebagai jawaban atau menambah skema dan endpoint baru.

### 2026-11-09 — Pengumpulan dan hasil ujian
- Keputusan: Pengumpulan hanya tersedia di akhir soal dan meminta dua konfirmasi; halaman selesai memakai riwayat browser yang sudah membatasi nilai dan review.
- Alasan: Siswa dapat memeriksa soal yang belum dijawab dan hasil mengikuti izin pengawas.
- Ditolak: Menyimpan izin atau nilai sebagai keputusan sisi klien dan menambahkan label pilihan visual.

### 2026-11-09 — Popup pada ponsel
- Keputusan: Popup memakai tinggi viewport, konten bergulir yang mengikuti tinggi header, dan tombol aksi bertumpuk.
- Alasan: Judul panjang dan tombol tetap dapat digunakan pada layar sempit.
- Ditolak: Menghitung ruang konten berdasarkan tinggi header tetap.

### 2026-11-09 — Layout ringkasan soal
- Keputusan: Tampilkan ringkasan status dan navigasi di samping soal pada desktop, serta deretan nomor di atas soal pada ponsel.
- Alasan: Mengikuti referensi pengguna dan menjaga navigasi tetap dapat digunakan pada layar sempit.
- Ditolak: Timer berwarna mencolok dan pengumpulan sebelum soal terakhir.

### 2026-11-09 — Feedback pilihan dan progres
- Keputusan: Tampilkan pilihan terpilih dengan garis tegas, progress bar soal terisi, dan ikon panah pada navigasi serta pengumpulan.
- Alasan: Mengikuti referensi dan membuat pilihan serta langkah berikutnya lebih mudah dikenali.
- Ditolak: Label huruf tambahan pada pilihan dan progres yang tidak mencerminkan jawaban terisi.

### 2026-11-09 — Bilah kontrol soal
- Keputusan: Gabungkan navigasi nomor, progres, dan penanda pada bilah soal; mode semua soal mempertahankan penanda pada setiap soal.
- Alasan: Mengikuti referensi sambil mempertahankan akses penanda di kedua mode.
- Ditolak: Bilah yang hanya dapat digunakan pada mode satu soal.

### 2026-11-09 — Dashboard dan salinan bank soal
- Keputusan: Pakai cookie HttpOnly untuk sesi guru, folder mata pelajaran bersama, dan salin soal dari bank melalui transaksi dengan pemeriksaan revisi.
- Alasan: Menjaga sesi, menghindari penimpaan edit bersama, dan mempertahankan isi ujian ketika bank berubah.
- Ditolak: Token di localStorage dan membuat ujian dari isi soal yang dikirim bebas oleh browser.

### 2026-11-09 — Insiden fokus peserta
- Keputusan: Gabungkan blur dan perubahan visibilitas selama satu kehilangan fokus menjadi satu insiden; catat shortcut devtools dan keluar fullscreen hanya jika diaktifkan.
- Alasan: Mengikuti kebijakan ujian yang dipilih tanpa menghitung dua event browser untuk perpindahan yang sama.
- Ditolak: Menyatakan kehilangan fokus sebagai bukti screenshot atau menghitung reconnect sebagai pelanggaran.

### 2026-11-09 — Rekap, XML, dan antrean insiden
- Keputusan: Filter dan pagination rekap dikerjakan server; XML divalidasi server dan menyertakan media terkelola; insiden tertunda disimpan per peserta dengan ID yang tetap.
- Alasan: Membatasi data yang dimuat, memvalidasi cadangan sebelum impor, dan memungkinkan pengiriman ulang tanpa menghitung insiden dua kali.
- Ditolak: Memuat seluruh rekap di browser, mengunduh gambar dari URL eksternal, dan membuat ID baru setiap retry.

### 2026-11-09 — Overview mengikuti Example
- Keputusan: Gunakan komposisi kartu, gradien, dan panel aktivitas dari DESIGN/Example dengan angka serta daftar dari API dashboard.
- Alasan: Mempertahankan referensi visual yang diminta tanpa menampilkan grafik atau aktivitas yang direkayasa.
- Ditolak: Menyalin data keuangan dan grafik contoh sebagai data ujian.

### 2026-11-09 — Navigasi dashboard
- Keputusan: Pertahankan shell dan autentikasi guru dalam layout dashboard bersama, dengan indikator menu aktif Framer Motion.
- Alasan: Perpindahan URL tetap mempertahankan konteks dan tidak memuat ulang sesi; indikator bergerak mengikuti Example.
- Ditolak: Membuat ulang dashboard dan meminta sesi pada setiap halaman menu.

### 2026-11-09 — Cache ringkasan dashboard
- Keputusan: Gunakan Redis opsional selama 10 detik untuk ringkasan, dipisahkan per guru dan admin, dengan fallback PostgreSQL.
- Alasan: Mengurangi query berulang tanpa mencampur data antarguru atau membuat kegagalan Redis menghentikan dashboard.
- Ditolak: Men-cache monitoring, jawaban, status kunci, atau token sesi.

### 2026-11-09 — Akses cepat dan navigasi akhir halaman
- Keputusan: Pencarian memakai daftar menu dan API ujian, notifikasi memakai ringkasan pekerjaan, serta tarikan lanjutan di akhir halaman membuka menu berikutnya dengan tautan yang bisa diakses keyboard.
- Alasan: Mempertahankan fungsi nyata dan menyediakan cara navigasi untuk perangkat sentuh, mouse, dan keyboard.
- Ditolak: Notifikasi buatan dan perpindahan otomatis ketika dialog terbuka atau pengguna sedang mengisi input.
