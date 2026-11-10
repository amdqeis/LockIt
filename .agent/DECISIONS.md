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

### 2026-11-09 — Editor bank soal in-place 3-tahap dan rollover tahun ajaran
- Keputusan: Editor bank soal diubah dari pop up modal menjadi tampilan in-place 3-tahap (Buat Soal, Pratinjau Siswa, Konfirmasi Unggah) dengan live preview split di sisi kanan, navigator nomor compact, CTA simbol-saja tanpa teks panjang, dan pita simbol matematika Mathway; aksi pratinjau bank dari tabel tetap berupa pop up modal; form ujian menghapus input teks tahun ajaran manual (otomatis kalender akademik); aksi rollover tahun ajaran khusus admin mengarsipkan massal ujian non-archived.
- Alasan: Guru mendapatkan ruang kerja yang leluasa tanpa batasan dialog modal, formula KaTeX dan tata letak siswa dapat dipratinjau langsung secara interaktif, kontrol lebih hemat tempat, dan tahun ajaran terkelola secara otomatis tanpa kesalahan ketik manual.
- Ditolak: Membiarkan editor bank soal di dalam dialog sempit, mewajibkan input teks tahun ajaran manual di form ujian, dan menghapus ujian secara destruktif saat pergantian tahun ajaran.

### 2026-11-09 — Penyesuaian skala font size dashboard mengikuti referensi Example
- Keputusan: Skala tipografi dashboard guru disesuaikan ke standar compact `DESIGN/Example/src/styles.css` (base 11px-12px, heading utama 26px, section head 20px, subhead/card title 15px-16px, button 11px tinggi 40px, field label 11px, helper/muted 9px-10px, tags/badges 8px-9px).
- Alasan: Mengembalikan tampilan dashboard agar proporsional, rapi, dan identik dengan desain referensi Example tanpa elemen teks yang tampak kebesaran.
- Ditolak: Mempertahankan base font 14px warisan umum yang membuat komponen dan tabel menjadi terlalu renggang dan melebar.

### 2026-11-09 — Revisi antarmuka Add Soal bank soal sesuai mockup visual
- Keputusan: Mengadopsi struktur visual mockup secara presisi: Top nav dengan tombol kembali dan horizontal 3-step wizard di tengah; banner metadata bank soal dengan badge ungu muda, judul bank dengan tombol pensil edit inline, serta metadata mata pelajaran, jumlah butir soal, dan tanggal pembaruan; layout grid split 2 kolom ("Buat Soal Baru" di kiri dan "Pratinjau Soal" di kanan); kolom kiri memuat dropdown jenis soal, input bobot dengan suffix Poin, rich editor terintegrasi toolbar (Paragraf, B, I, U, list, lampiran gambar, dan toggle pita rumus Mathway Eq), baris opsi jawaban dengan stepper kuantitas opsi, drag handle, input teks, tombol hapus, dan highlight border/background ungu pada opsi kunci jawaban terpilih, serta footer aksi (Simpan & Tambah Soal Lagi, Batal, Simpan Soal); kolom kanan memuat header dengan device switcher desktop/mobile dan pratinjau lembar soal siswa berbingkai rapi yang menyorot kunci jawaban berwarna ungu.
- Alasan: Memberikan pengalaman kerja penyusunan butir soal yang bersih, modern, dan selaras 100% dengan rancangan visual yang diinstruksikan oleh pengguna.
- Ditolak: Mempertahankan tata letak lama satu kolom sempit dan memisahkan toolbar rumus di luar alur pengeditan pertanyaan.

### 2026-11-09 — Redesain antarmuka Exam Proctoring sesuai mockup visual
- Keputusan: Mengadopsi struktur tampilan Exam Proctoring modern secara penuh: Top bar dengan badge hijau Live dan tombol End Proctoring hitam; kartu banner ujian dengan mortarboard icon, judul/kelas ujian, quiz code yang dapat disalin, serta widget waktu mundur (Time Remaining capsule); 5 kartu ringkasan metrik statistik (Total Students, Taking Quiz, Completed, Flagged, Average Score); layout split 2 kolom: sisi kiri memuat filter tabs (All, In Progress, Completed, Flagged), search bar, dan grid 3-kolom kartu siswa (avatar, nama, status pill, progres soal/nilai/pelanggaran, riwayat aktivitas/pelanggaran terkini, tombol Unlock dan Kick Participant); sisi kanan memuat panel Live Event Feed dengan filter tab (All, Lobby, Violations, Status, System) dan timeline bergaris; serta pop-up kartu melayang Lobby Requests dengan tombol View, Approve, dan Reject langsung.
- Alasan: Pengawas ujian mendapatkan visibilitas integritas akademik yang komprehensif, interaktif, dan modern sesuai spesifikasi mockup yang diberikan pengguna, tanpa menghilangkan kompatibilitas alur drawer modal tindakan peserta.
- Ditolak: Mempertahankan tata letak daftar pengawasan lama yang kaku dan teks status yang terpisah.

### 2026-11-09 — Perbaikan penempatan kontrol rumus matematika dan box persamaan
- Keputusan: Di dalam area teks editor pertanyaan, node persamaan hanya menampilkan box input rumus murni (`math-field`) tanpa label teks "Persamaan", tanpa ikon tombol tambahan di dalam teks, dan tanpa pita ribbon di bawahnya. Tombol Simbol Keyboard (toggle keyboard virtual MathLive) dan tombol Garis Tiga (menu opsi / LaTeX) dipindahkan ke toolbar header editor, diletakkan sejajar berdampingan langsung dengan tombol `Eq`. Pita kategori rumus Mathway (`Dasar`, `Operator`, `Simbol & Yunani`, `Aljabar & Kalkulus`, `Kurung & Matriks`, `LaTeX`) beserta tombol simbolnya tetap mekar di bawah toolbar header editor, dan simbol yang dipilih di header langsung masuk ke box rumus aktif yang sedang difokuskan oleh pengguna.
- Alasan: Mencegah area pengetikan soal menjadi penuh dan berantakan akibat pita simbol ganda di dalam teks, menjaga kerapian dokumen soal, serta memudahkan guru menyisipkan dan memanipulasi rumus matematika langsung dari bilah alat di atas.
- Ditolak: Menumpuk pita tab dan tombol simbol di dalam inline node view teks pertanyaan serta membiarkan tombol kontrol virtual keyboard terisolasi di dalam kotak teks.

### 2026-11-09 — Penonjolan visibilitas tombol dan akses cepat Buat Ujian
- Keputusan: Mengubah posisi tombol primer "Buat ujian" di halaman Daftar Ujian menjadi yang pertama (paling kiri di bilah aksi) mendahului tombol administratif "Mulai Tahun Ajaran Baru"; menghapus selector CSS bergaris bawah (`text-decoration: underline`) yang merusak tampilan tombol aksi primer dan sekunder; menambahkan tombol aksi langsung "Buat ujian" di kartu Ringkasan Ujian dan Ujian Aktif pada halaman Beranda (Overview) dengan query param auto-open (`/dashboard/ujian?create=true`); serta menyertakan tombol aksi primer berukuran besar pada tampilan daftar kosong (empty state).
- Alasan: Guru dan administrator dapat menemukan tombol pembuatan ujian secara instan dari halaman mana pun tanpa merasa tersembunyi atau terdorong ke sudut tersembunyi, serta tampilan tombol kembali bersih dan proporsional tanpa garis bawah tautan yang mengganggu.
- Ditolak: Menempatkan tombol administratif rollover di depan tombol pembuatan ujian harian dan membiarkan halaman beranda tanpa pintasan pembuatan ujian langsung.

### 2026-11-09 — Aksi langsung tombol Eq untuk menyisipkan kotak persamaan inline murni
- Keputusan: Tombol `Eq` pada bilah toolbar editor pertanyaan diubah perilakunya agar ketika diklik langsung menyisipkan box kotak tipis inline di dalam teks dan mengaktifkan kursor persamaan di dalamnya; seluruh ikon internal bawaan MathLive (`virtual-keyboard-toggle` dan `menu-toggle`) disembunyikan menggunakan CSS shadow parts sehingga box di dalam teks benar-benar murni kotak tipis tanpa simbol apa pun; serta pita simbol kategori Mathway di header tetap mekar agar guru dapat memilih simbol yang langsung disuntikkan ke dalam kotak persamaan aktif.
- Alasan: Memenuhi ekspektasi interaksi pengguna di mana klik tombol `Eq` langsung menghasilkan wadah pengetikan persamaan di dalam paragraf tanpa langkah perantara tambahan dan tanpa elemen dekoratif pengganggu di dalam kotak teks.
- Ditolak: Membatasi klik tombol `Eq` hanya sebagai toggle pita formula di header tanpa menyisipkan kotak persamaan ke dalam teks.

### 2026-11-09 — Penanganan validasi skema pembuatan dan pembaruan ujian
- Keputusan: Mengubah skema validasi Zod backend (`createExamSchema` di `/api/exams` dan `updateExamSchema` di `/api/exams/[id]`) agar menerima nilai `null` pada kolom opsional (`description`, `className`, `academicYear`, `semester`, `category`, `categoryNumber`, `scheduledStartAt`, `passingScore`, `bankId`, `bankRevision`, `questionIds`); mengizinkan format waktu ISO dengan offset zona waktu (`datetime({ offset: true })`); mengganti validasi strict UUID menjadi `z.string().min(1)` untuk fleksibilitas ID; menyertakan detail nama kolom yang gagal pada pesan respons 400; serta menyelaraskan sanitasi payload di sisi frontend (`Exams.tsx`).
- Alasan: Frontend mengirimkan `null` ketika deskripsi, nomor kategori, atau jadwal tidak diisi oleh guru, yang sebelumnya ditolak oleh backend karena skema `description: z.string().optional()` hanya mengizinkan `undefined` dan menolak `null`, memicu galat "Data ujian tidak valid".
- Ditolak: Memaksa frontend mengirimkan string kosong yang melanggar batasan `min(1)` atau membiarkan pesan kesalahan validasi tanpa rincian kolom yang bermasalah.

### 2026-11-09 — Arsitektur data caching SWR zero-dependency, intelligent prefetch, dan skeleton context-aware
- Keputusan: Menggunakan modul client-side cache internal (`data-cache.ts`) berbasis in-flight deduplication dan stale-while-revalidate tanpa menambah dependensi baru; prefetch rute dan data berbasis hover, keyboard focus, touch, dan idle background scheduling (`requestIdleCallback`); transisi halaman Framer Motion berdasar token gerak terpadu; serta mengganti seluruh indikator teks statis ("Memuat...") dengan varian skeleton context-aware (Dashboard, Ujian, Bank Soal, Proctoring, Hasil, Sesi Ujian Siswa).
- Alasan: Menjaga ukuran bundle tetap ringan tanpa conflict React 19, mencegah cumulative layout shift, memastikan navigasi antarmenu terasa instan (0ms dari cache), serta memenuhi standar aksesibilitas dan reduced-motion.
- Ditolak: Memasang dependensi eksternal tambahan (TanStack Query/SWR) dan menggunakan spinner layar penuh generik di setiap navigasi menu.

### 2026-11-09 — Penyesuaian antarmuka Exam Proctoring sesuai mockup visual Pulse
- Keputusan: Mengubah komposisi dan styling dashboard pengawasan ujian: Banner atas hanya memuat metadata ujian di kiri dan kode kuis di kanan; baris 5 kartu metrik memindahkan Time Remaining ke kartu ke-5 dengan latar hitam kontras tinggi dan font angka tabular digital; grid 3 kolom kartu siswa membedakan status dengan background dan border tematik (`is-completed` berlatar hijau muda dengan box nilai `proctor-completed-box` dan tombol `View Results`, `is-locked` berlatar merah muda dengan pill locked solid dan tombol `Unlock` aktif, `is-warning` beraksen kuning amber, serta `is-progress` beraksen hijau); Live Event Feed menampilkan timeline kegiatan real-time; serta pop-up kartu melayang Lobby Requests menyertakan 3 aksi langsung (View, Approve, Reject).
- Alasan: Menyelaraskan 100% tata letak dan hierarki visual dengan gambar referensi desain pengguna, memperjelas pembacaan status kritis siswa tanpa navigasi terpisah, dan menjaga seluruh alur aksi pengawas tetap bekerja normal.
- Ditolak: Menyimpan widget hitung mundur di dalam banner atas dan menggunakan warna kartu siswa seragam yang menyulitkan pengawas mengenali siswa yang selesai atau terkunci secara cepat.

### 2026-11-09 — Perbaikan ikon filter horizontal dan penataan kotak pencarian peserta
- Keputusan: Mengubah path SVG ikon `sliders` pada `Dashboard.tsx` dari slider vertikal menjadi slider horizontal (tiga garis horizontal kontinu dengan knob penggeser vertikal di posisi selang-seling) sesuai rancangan mockup; serta menambahkan aturan reset spesifisitas tinggi pada `.staff-app .proctor-search-box input` di `dashboard.css` (`border: 0 !important; background: transparent !important; padding: 0 !important; height: 100% !important; min-height: unset !important; border-radius: 0 !important;`).
- Alasan: Ikon filter di mockup menggunakan representasi horizontal adjustment lines, dan input pencarian sebelumnya terpengaruh style global `.staff-app input` yang menyisipkan border sekunder serta tinggi 40px berlebih.
- Ditolak: Membiarkan ikon vertikal default atau mengubah border container luar menjadi transparan.


### 2026-11-09 — Penilaian parsial multi-select dan rincian poin per soal
- Keputusan: Mengimplementasikan penilaian parsial untuk tipe soal `multi_select` dengan rumus penalti `max(0, (opsi_benar_dipilih / x * 100) - (opsi_salah_dipilih / n * 100)) * points / 100`, dihitung secara dinamis dari jawaban tersimpan (`selectedOption`) dan kunci jawaban (`correctAnswer` + `options`) tanpa migrasi skema database. Di antarmuka review siswa dan detail jawaban guru, sertakan perolehan poin dan poin maksimal per soal (misal `Poin: 2.5 / 10`) serta badge status (benar, sebagian benar, belum benar, menunggu penilaian guru).
- Alasan: Memberikan penilaian yang adil dan akurat terhadap pemahaman siswa tanpa membiarkan pemilihan seluruh opsi mendapat skor penuh, sekaligus menjaga konsistensi nilai di seluruh ringkasan, riwayat, rekapitulasi matriks, dan ekspor CSV untuk percobaan lama maupun baru.
- Ditolak: Mengubah skema database `Answer.isCorrect` menjadi float (skema tetap boolean/null) dan menerapkan penalti pada opsi benar yang tidak dipilih.

### 2026-11-09 — Trigger CI/CD hanya pada branch production
- Keputusan: Workflow `.github/workflows/deploy.yml` hanya berjalan pada event `push` ke branch `production`.
- Alasan: Menjalankan pipeline dan deploy produksi hanya ketika perubahan masuk ke branch rilis yang dituju.
- Ditolak: Trigger `pull_request`, push ke `integration`, atau branch lain karena berada di luar permintaan trigger khusus production.

### 2026-11-09 — Deploy production paralel dengan CI
- Keputusan: Menghapus `needs: ci` dari job `deploy` dan mengganti nama langkah deploy agar tidak mengklaim commit sudah diverifikasi CI.
- Alasan: Push ke `production` langsung memulai deploy tanpa menunggu backend test atau job CI lainnya; CI tetap berjalan paralel.
- Ditolak: Menonaktifkan tes backend atau seluruh job CI karena pipeline tetap perlu memberi hasil pemeriksaan kualitas.

### 2026-11-09 — Hapus database disposable dari workflow deploy
- Keputusan: Menghapus seluruh job `ci` dari workflow production, termasuk PostgreSQL `eduquas_test`, URL database lokal, kredensial dummy, dan langkah test/build terkait; deployment tetap hanya berjalan pada push `production`.
- Alasan: Workflow deployment tidak boleh membuat atau memakai database test lokal; migrasi dijalankan oleh Docker Compose di server dengan `backend/.env` production.
- Ditolak: Mengarahkan test ke database production karena test dapat mengubah atau menghapus data asli.

### 2026-11-09 — Satu database runtime PostgreSQL dan tanpa seed demo production
- Keputusan: Compose menonaktifkan Redis cache dan menghapus servicenya; deploy memakai `--remove-orphans` agar container Redis lama dilepas setelah deployment berhasil. Backend hanya membaca `DATABASE_URL`, dan seed demo ditolak di production serta memerlukan opt-in eksplisit di lingkungan lain.
- Alasan: Menjaga satu-satunya penyimpanan data aplikasi tetap PostgreSQL yang diatur oleh `backend/.env`, tanpa membuat datastore atau akun/ujian dummy di production.
- Ditolak: Menghapus volume media/upload yang bukan database dan menyimpan file aplikasi; menghubungkan proses build ke database production.

### 2026-11-09 — Reset schema PostgreSQL production yang disetujui pengguna
- Keputusan: Mengosongkan schema `public` pada database `eduquas` secara transaksional, lalu menjalankan `bootstrap-database.mjs` setelah baseline hash cocok; seed demo tidak dijalankan.
- Alasan: Riwayat/checksum deployment tidak cocok dan migration pertama memerlukan tabel lama (`students`), sehingga replay migration dari schema kosong bukan jalur bootstrap yang valid.
- Ditolak: Mengubah checksum `_prisma_migrations` secara manual atau menjalankan `migrate reset`; prosedur bootstrap repo menjaga schema saat ini dan mencatat tujuh migration baseline dengan benar.

### 2026-11-10 — Opsi Ingat Saya dan auto-forward halaman utama
- Keputusan: Menyediakan opsi "Ingat saya" pada login guru/admin yang memperpanjang masa berlaku refresh token dan cookie menjadi 30 hari persistent (dibanding 24 jam session cookie jika tidak dicentang). Pada rute "/", gunakan Next.js middleware di server dan guard di client untuk langsung me-redirect guru ke "/dashboard" jika memiliki sesi guru, serta siswa yang berstatus ujian aktif ("active"/"disconnected" dan exam "active") langsung ke "/exam/session".
- Alasan: Guru tidak perlu login berulang saat membuka browser kembali dan tidak diarahkan ke portal siswa ketika mengakses root domain; siswa yang berada di tengah pengerjaan ujian terlindungi dari kedipan formulir kode ujian dan langsung kembali ke sesi pengerjaannya.
- Ditolak: Menyimpan status remember me di localStorage klien, atau me-redirect siswa hanya berdasarkan kepemilikan cookie tanpa memverifikasi keaktifan sesi ujian di server.

### 2026-11-10 — Icon web favicon dan app icon dari logo EduQuas
- Keputusan: Mengekstrak simbol resmi EduQuas dari `eduquas-logo.png` menjadi icon berpusat pada kanvas persegi dengan padding 6% dan latar transparan. Disimpan sebagai `favicon.ico` multi-ukuran (16/32/48 px), `icon.png` (512x512), dan `apple-icon.png` (180x180) di level App Router (`frontend/src/app`) dan `frontend/public`, serta didaftarkan pada metadata RootLayout.
- Alasan: Menghilangkan icon kosong/default pada tab browser, bookmark, dan perangkat mobile dengan format standar Next.js App Router yang kompatibel di semua peramban.
- Ditolak: Memakai SVG generik pihak ketiga atau logo horizontal penuh yang akan mengecil dan tidak terbaca di ukuran favicon 16x16.

### 2026-11-10 — Hierarki akademik, akses kolaboratif, backup & restore, dan identitas siswa
- Keputusan: Mengadopsi hierarki Tingkat (`GradeLevel`) → Mata Pelajaran (`Subject`) → Bank Soal (`QuestionBank`), dengan Ujian (`Exam`) terikat ke satu Rombel (`Classroom`) dan satu Mata Pelajaran. Guru dan Admin memiliki akses kolaboratif penuh ke seluruh data; `teacherId` digunakan untuk atribusi pembuat/pengubah. Sesi ujian peserta mengingat nama dan NISN via cookie `studentBrowser` (`GET /api/student-profile`) dengan prefill otomatis yang tetap dapat diedit. Backup & restore dijalankan oleh koordinator asinkron tunggal menggunakan `pg_dump -Fc` / `pg_restore`, proteksi mode pemeliharaan HTTP 503, safety snapshot darurat, pembatalan sesi instan via rotasi `sessionVersion`, serta pencegahan backup saat ada ujian aktif.
- Alasan: Menghilangkan ambiguitas materi lintas tingkat (misal Matematika X vs XI), memungkinkan kolaborasi guru tanpa sekat kepemilikan kaku, mencegah inkonsistensi data saat backup/restore, dan mempercepat proses masuk ujian siswa tanpa membatasi perbaikan identitas.
- Ditolak: Menambahkan `gradeLevelId` redundan pada QuestionBank (tingkat diturunkan dari Subject); sistem penugasan izin per-ujian yang rumit; backup otomatis berkala tanpa pengawasan; serta menimpa input siswa saat identitas diedit secara manual.

### 2026-11-10 — Penguncian layar dan jawaban tertunda
- Keputusan: Status kunci sesi mengendalikan dialog modal browser yang tidak dapat ditutup siswa; antrean jawaban dicoba kembali setelah sinkronisasi menyatakan sesi terbuka.
- Alasan: Fokus keyboard dan dialog pengumpulan harus mengikuti status kunci, sedangkan jawaban yang belum terkirim harus bertahan saat koneksi atau status berubah.
- Ditolak: Lapisan visual tanpa pengendalian fokus dan pengiriman ulang jawaban sebelum status sesi diperbarui.

### 2026-11-10 — Segmented capsule tingkat, layout cards overview, dan modal mata pelajaran
- Keputusan: Mengganti filter teks tingkat dengan segmented capsule switcher (wadah kapsul putih rounded-full dengan tombol aktif hitam pekat sesuai referensi visual); menyusun layout Kelas & Mata Pelajaran dengan 4 kartu metrik statistik (Total Kelas, Mata Pelajaran, Bank Soal, Ujian Terkait) dan grid 2 kolom berdampingan ala Overview; mengganti form inline mata pelajaran dengan tombol aksi primer "+ Tambah Mata Pelajaran" yang membuka dialog pop-up modal; serta mengganti frasa teknis "Hierarki Kelas" di seluruh dashboard dengan istilah umum sekolah ("Per Kelas", "Semua Ujian").
- Alasan: Menghilangkan kebingungan pengguna terhadap form inline yang tampak terkunci, pemilihan tingkat langsung memfilter seluruh konten secara instan, kartu informatif memberikan gambaran lengkap kapasitas tingkat, dan bahasa antarmuka ramah pengguna sekolah.
- Ditolak: Mempertahankan form input inline di dalam kartu mata pelajaran dan menggunakan dropdown filter tingkat bertingkat.

### 2026-11-10 — Standarisasi segmented capsule lintas modul, peletakan tombol kanan, dan larangan teks visual "MEMUAT DATA"
- Keputusan: Menerapkan segmented capsule switcher pemilihan tingkat (X, XI, XII) secara seragam ke modul Bank Soal, Ujian, dan Monitoring serta menghapus filter teks kaku; meletakkan seluruh tombol aksi utama di sisi kanan baris segmented capsule (.grade-capsule-right); menambahkan animasi transisi Framer Motion saat perpindahan tingkat dan tab; serta menetapkan aturan wajib: dilarang menampilkan teks visual statis "MEMUAT DATA" atau "Memuat..." di layar pengguna. Setiap pemuatan data harus menggunakan animated loading screen (shimmer skeleton atau pulsing spinner ring) dengan teks penjelas terisolasi khusus pembaca layar (sr-only).
- Alasan: Menyelaraskan hierarki dan estetika dashboard sesuai gambar referensi pengguna, menata tombol aksi agar mudah diakses di sisi kanan, serta memberikan umpan balik pemuatan data yang modern, halus, dan bebas kedipan teks kaku.
- Ditolak: Menampilkan teks statis "Memuat data...", membiarkan tombol aksi utama terpisah dari baris tingkat, dan menggunakan filter bertingkat konvensional.

### 2026-11-10 — Penyelarasan motion spring Framer Motion dan shared-layout segmented capsule
- Keputusan: Mengadopsi motion tokens resmi dari DESIGN/MOTION_GUIDE.md (softSpring: stiffness 270, damping 31, mass 0.95; spring: stiffness 420, damping 34; press: stiffness 580, damping 30); mengganti mekanisme switch tingkat (X, XI, XII) dan tab status/mode di seluruh dashboard (AcademicManagement, Banks, Exams, Monitoring, Results) menggunakan LayoutGroup dan shared layoutId (.grade-capsule-thumb, .staff-segment-thumb, .proctor-filter-thumb) dengan tactile press scale 0.96; mengupgrade MotionButton dengan token spring press dan scale hover/tap; serta menambahkan transisi AnimatePresence pada accordion data lama.
- Alasan: Menghilangkan pergantian instan tanpa animasi pada switcher tingkat sehingga thumb hitam meluncur mulus (smooth spring glide) antar-kapsul pill sesuai rancangan gerak Aurora UI dan spesifikasi desain.
- Ditolak: Menggunakan transisi CSS biasa tanpa perhitungan layoutId bounding box dinamis yang menyebabkan thumb tidak dapat meluncur antar-elemen button yang berbeda ukuran.

### 2026-11-10 — Penghapusan filter tingkat, navigasi Box per Kelas, dan perbaikan visibilitas hasil ujian
- Keputusan: Menghapus seluruh filter tingkat (grade selector strip dan switcher capsule tingkat) di seluruh modul dashboard dan menggantikannya dengan navigasi Box per Kelas (grid kartu informatif per kelas yang langsung dapat diklik untuk membuka detail); pada modul Hasil Ujian (`/dashboard/hasil`), query backend diperluas agar mencakup status ujian `active`, `ended`, dan `archived`, enum mode mendukung `hierarchy`, serta mapping respons groups dipadukan dengan tampilan detail hasil dan ekspor CSV kelas terpilih.
- Alasan: Pengguna sekolah berpikir dalam entitas kelas nyata bukan filter tingkat berjenjang yang menyembunyikan data; ujian yang baru selesai dikerjakan siswa berstatus active harus langsung muncul di menu Hasil tanpa menunggu guru mengakhiri ujian manual; dan antarmuka per box per kelas memberikan ringkasan statistik yang informatif dan akses satu klik yang intuitif.
- Ditolak: Mempertahankan filter tingkat kaku yang membatasi tampilan konten dan memblokir ujian aktif dari rekapan hasil.

### 2026-11-10 — Navigasi bertingkat dan cakupan ekspor hasil
- Keputusan: Mengganti pintu masuk per kelas dengan card tingkatan, lalu card kelas pada lima tab; mapel dan bank soal tetap menjadi katalog bersama per tingkat. Ekspor hasil dikelompokkan per tingkat/mapel dan memakai ID kelas atau ujian, dengan penanganan khusus data lama tanpa pemetaan.
- Alasan: Mengikuti alur dan referensi visual yang dipilih pengguna, tetap menyediakan kelas kosong dan mencegah hasil kelas bernama sama tercampur.
- Ditolak: Menyimpan kepemilikan bank soal per kelas atau memakai nama kelas sebagai identitas untuk kelas yang sudah terpetakan.

### 2026-11-11 — Pengawasan ujian terpadu, workspace bersama, dan pemilihan soal tiga mode
- Keputusan: Pengawasan web menggunakan siklus pelanggaran berjenjang (siklus 1 peringatan jeda, siklus 2+ layar hitam pemulihan via `/api/exam-session/recover` dengan validasi visible/focus/fullscreen); penggabungan sinyal tab_switch/window_blur/fullscreen_exit dalam window 350ms menjadi 1 pelanggaran; shortcut screenshot menaikkan sanksi kunci server idempoten tanpa hitung ganda; geometri split screen dideteksi dari jendela sempit non-fullscreen stabil tanpa menghukum resize murni; shared component `ExamWorkspace` diekstrak untuk melayani mode pengerjaan, review peserta (`/exam/review/[studentId]`), dan preview tersimpan guru (`/dashboard/preview/exam/[id]` dan `bank/[id]`); pemilihan soal dipecah menjadi manual, acak sekali per ujian (dengan preview & tombol acak ulang), dan acak per peserta yang snapshot-nya menyimpan seluruh kandidat dan penugasan soal dikunci stabil di database.
- Alasan: Menutup celah kecurangan berbasis web tanpa menghukum perilaku normal sistem operasi/browser (seperti pergeseran keyboard virtual, rotasi, zoom, atau multievent Alt-Tab), menyatukan kode rendering soal antar-layanan, serta memberikan fleksibilitas evaluasi bagi guru dengan integritas penilaian yang konsisten di semua jalur reporting.
- Ditolak: Menilai resize sendirian sebagai pelanggaran, menerima klaim IP dari klien, mereset hitungan pelanggaran saat kembali fullscreen, dan membiarkan penugasan soal berubah-ubah saat peserta melakukan refresh atau unlock.
