# EduQuas

- Status: Panel Monitoring dan kartu hero Overview telah diperbarui menjadi card terpadu yang menampilkan ujian sedang berlangsung dan ujian yang akan datang secara simultan tanpa tab switcher eksklusif.
- Hasil: Tab switcher Berlangsung/Persiapan pada Monitoring dihapus; card terpadu memuat dua kolom (Sedang Berlangsung & Akan Datang) dengan aksi buka monitoring/sesi langsung; kartu hero Overview kini menampilkan daftar interaktif kedua kelompok status beserta metriknya.
- Verifikasi: Type-check dan lint frontend/backend lulus (0 error), mechanical design detector lulus (0 temuan), build produksi kedua workspace 100% sukses, unit test backend lulus (27 tests).
- Catatan: Perubahan CSS dan komponen menjaga kontras tinggi, hierarki tipografi ringkas, dan kompatibilitas responsif di semua ukuran layar tanpa emoji.
