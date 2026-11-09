# EduQuas

- Status: Perhitungan skor parsial untuk soal `multi_select` telah diimplementasikan penuh menggunakan rumus penalti proporsional `max(0, (opsi_benar / x * 100) - (opsi_salah / n * 100)) * points / 100`. Nilai dihitung langsung dari pilihan tersimpan dan kunci jawaban di seluruh layer (penilaian, ringkasan, riwayat, rekapitulasi matriks, dan ekspor CSV) tanpa perubahan skema database.
- Antarmuka & Review: Komponen `ReviewContent` (siswa) dan modal rincian hasil guru di `Results` kini menampilkan perolehan poin dan poin maksimal per butir soal (misal `Poin: 2.5 / 10`), dilengkapi label status visual (benar, sebagian benar, belum benar, menunggu penilaian guru) sesuai panduan `impeccable`.
- Verifikasi Teknis: 12 unit test pada `backend/src/services/score-calculation.test.ts` lulus 100%, 15 unit test pustaka backend lulus 100%, `npm run type-check --prefix frontend` lulus 0 error, `npm run lint --prefix frontend` lulus 0 error/warning, dan detektor Impeccable mengonfirmasi 0 pelanggaran.
- Next steps: Pemantauan umpan balik dari pengawas dan guru pada sesi ujian dengan ragam tipe soal campuran.
