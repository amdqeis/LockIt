# EduQuas

- Status: Opsi "Ingat saya" pada form login guru/admin telah ditambahkan dengan token dan cookie persistent 30 hari (vs session cookie 24 jam jika tidak dicentang).
- Pengalihan Rute: Akses ke "/" kini otomatis mem-forward guru/admin yang sudah login ke "/dashboard", serta mem-forward siswa yang sedang aktif ujian langsung ke "/exam/session" via middleware server dan guard client.
- Verifikasi Teknis: 3 unit test otentikasi login/refresh di backend lulus 100%, `npm run type-check` pada frontend dan backend lulus 0 error, `npm run lint` pada frontend dan backend lulus 0 error/warning, detektor Impeccable mengonfirmasi 0 pelanggaran, serta build produksi kedua aplikasi berhasil.
- Next steps: Pengujian user experience sesi ujian aktif secara end-to-end pada lingkungan staging/production.
