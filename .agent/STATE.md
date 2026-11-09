# EduQuas

- Status: Perhitungan skor parsial untuk soal `multi_select` telah diimplementasikan penuh menggunakan rumus penalti proporsional `max(0, (opsi_benar / x * 100) - (opsi_salah / n * 100)) * points / 100`. Nilai dihitung langsung dari pilihan tersimpan dan kunci jawaban di seluruh layer (penilaian, ringkasan, riwayat, rekapitulasi matriks, dan ekspor CSV) tanpa perubahan skema database.
- Antarmuka & Review: Komponen `ReviewContent` (siswa) dan modal rincian hasil guru di `Results` kini menampilkan perolehan poin dan poin maksimal per butir soal (misal `Poin: 2.5 / 10`), dilengkapi label status visual (benar, sebagian benar, belum benar, menunggu penilaian guru) sesuai panduan `impeccable`.
- Verifikasi Teknis: 12 unit test pada `backend/src/services/score-calculation.test.ts` lulus 100%, 15 unit test pustaka backend lulus 100%, `npm run type-check --prefix frontend` lulus 0 error, `npm run lint --prefix frontend` lulus 0 error/warning, dan detektor Impeccable mengonfirmasi 0 pelanggaran.
- Next steps: Pemantauan umpan balik dari pengawas dan guru pada sesi ujian dengan ragam tipe soal campuran.
- CI/CD: Workflow `.github/workflows/deploy.yml` kini hanya terpicu oleh push ke branch `production`; trigger pull request dan branch lain dihapus.
- CI/CD: Job CI beserta PostgreSQL disposable `eduquas_test` dan kredensial dummy dihapus; workflow kini hanya deploy pada push `production`.
- Database deploy memakai `backend/.env` yang tersedia di server production lewat `docker-compose.yml`; file kredensial server tidak dibaca atau ditampilkan.
- Verifikasi workflow: Deploy sebelumnya berhenti sebelum `docker compose up`; setelah reset database dan bootstrap manual, pipeline GitHub belum dijalankan ulang.
- Database production `eduquas.public` telah dikosongkan atas persetujuan eksplisit, lalu schema dibangun kembali dari baseline terverifikasi: 16 tabel aplikasi kosong dan 7 migration tercatat; tidak ada seed demo.
- Blocker checksum terselesaikan pada database aktif; deploy berikutnya hanya akan lolos jika commit production membawa schema dan migration baseline yang sama.
- Pemeriksaan target DB: Prisma memakai provider PostgreSQL dan `backend/.env` berisi `DATABASE_URL` PostgreSQL non-local; Compose backend memuat file tersebut tanpa override URL database.
- Pengamanan runtime: Redis cache dinonaktifkan di Compose, fallback URL typo `DATABASE_zURL` dihapus, dan seed data demo memerlukan opt-in serta ditolak di production.
