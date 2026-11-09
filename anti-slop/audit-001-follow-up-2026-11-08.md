# Tindak lanjut audit 001: editor persamaan

Temuan 1, 2, dan 3 diperbaiki sesuai permintaan pengguna.

- **1 / R-39:** Kolom persamaan kosong kini menampilkan petunjuk “Ketik persamaan di sini” di area input.
- **2 / R-31:** Label tombol diringkas menjadi “+ Persamaan”; shortcut tetap tersedia lewat Alt+= dan title tombol. Padding toolbar dikurangi.
- **3 / R-31:** Kotak inline kini memakai garis tipis bersudut tegas, latar putih, dan jarak dalam yang lebih jelas.

## Keluhan lanjutan

- **4 / R-39:** Petunjuk kosong sebelumnya ditempatkan menimpa area rumus. Petunjuk dipindah ke baris terpisah di bawah field agar tidak bertabrakan dengan hasil persamaan.

## Pemeriksaan

- `npm run lint` di `FE/`: lulus.
- `npm run type-check` di `FE/`: lulus.
- Pemeriksaan whitespace dengan `git diff --no-index --check` pada berkas sumber dan laporan: lulus.
