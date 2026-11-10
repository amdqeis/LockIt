# EduQuas

- Status: Pengawasan web diperketat dengan siklus pelanggaran, layar persiapan fullscreen on-click, layar hitam pemulihan, review peserta dan preview tersimpan guru memakai shared component ExamWorkspace, serta 3 mode pemilihan soal (manual, acak sekali, acak per peserta).
- Hasil: Sinyal fullscreen/tab/blur digabung per insiden, deteksi split screen berdasar geometri stabil tanpa penalti resize murni, IP diverifikasi server dari proxy tepercaya, penugasan soal stabil dan divalidasi ketat di seluruh jalur pengerjaan dan penilaian.
- Verifikasi: Lint dan type-check kedua workspace lulus (0 error), build frontend dan backend 100% sukses, unit test backend lulus (32 tests), layout responsif 320, 390, 768, 1440 px terverifikasi, audit antislop dicatat di anti-slop/audit-003-2026-11-11.md.
- Batasan: Screenshot OS dan pemisahan jendela fisik tetap memiliki batasan teknis di lingkungan web; migrasi database hanya diaplikasikan pada database lokal/dev dan tidak ke produksi.
