# EduQuas

- Status: Rencana implementasi EduQuas untuk hierarki akademik (Tingkat → Mapel → Bank Soal, Ujian per Rombel), akses kolaboratif guru/admin, modul Backup & Restore, serta prefill identitas peserta telah selesai diimplementasikan penuh.
- Frontend & Backend: Menu Kelas & Mapel (`AcademicManagement`) dan Backup & Restore (`BackupRestore`) telah ditambahkan, panel Ujian (`Exams`), Bank Soal (`Banks`), dan Hasil (`Results`) telah mengadopsi hierarki rombel dan penanganan revisi `409 Conflict`, serta halaman join siswa memuat profil otomatis tanpa mengunci pengeditan.
- Verifikasi Teknis: `npm run type-check --prefix backend` dan `npm run lint --prefix backend` lulus 0 error, 35 backend tests lulus, `npm run type-check --prefix frontend` dan `npm run lint --prefix frontend` lulus 0 error, `npm run build --prefix frontend` sukses, dan detektor Impeccable mengonfirmasi 0 pelanggaran.
- Next steps: Verifikasi operasional alur pencadangan dan pemulihan arsip di server produksi.
