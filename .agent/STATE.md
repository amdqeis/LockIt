# EduQuas

- Status: Dashboard guru, rekap terpaginasikan, XML server, dan antrean insiden tersedia di working tree; integrasi diuji pada PostgreSQL sementara.
- Next: Periksa dashboard di browser dengan sesi pengguna pada lingkungan target; layout bersama mempertahankan sesi dan navigasi antarmenu.
- Migrasi: `20261109_dashboard_metadata` sudah diterapkan setelah persetujuan; status Prisma mutakhir dan endpoint overview, subjects, serta exams merespons sukses pada database target.
- Audit database: Perbedaan dashboard cocok dengan migrasi; `questions.type` pada database masih nullable `varchar`, berbeda dari schema Prisma, dan tidak diubah migrasi dashboard.
- Validasi: Lint frontend, TypeScript, build, uji database sementara, browser simulasi dashboard, dan alur peserta terhadap backend sementara lulus; lint backend standar belum tersedia.
- Catatan: Antrean insiden menggunakan penyimpanan browser jika tersedia; scheduler multi-instance dan Engram tetap belum ditangani.
- Cache: Ringkasan dashboard memakai Redis opsional TTL 10 detik; Compose menyediakan Redis internal, `start.sh` memerlukan `REDIS_URL` dan server Redis lokal.
- Dashboard: Pencarian, notifikasi, profil, dan navigasi akhir halaman tersedia; indikator menunjukkan progres tarikan, termasuk saat reduced motion aktif.
