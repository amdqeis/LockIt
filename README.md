# EduQuas — Platform Ujian Online dengan Proctoring

Monorepo berisi dua workspace:

| Workspace | Path | Port | Deskripsi |
|-----------|------|------|-----------|
| `frontend` | `./frontend` | `3000` | Next.js UI |
| `backend`  | `./backend`  | `3001` | Next.js API Routes + Socket.IO + Prisma (PostgreSQL) |

## Struktur Folder

```
EduQuas/
├── backend/            ← Express/Next.js custom server + Prisma
│   ├── src/app/api/    ← REST API endpoints
│   ├── src/lib/        ← auth, prisma client, middleware
│   ├── src/services/   ← grading, question-parser
│   ├── prisma/         ← schema.prisma + migrations
│   ├── server.ts       ← entry point (Socket.IO + Next.js)
│   ├── Dockerfile
│   └── package.json
├── frontend/           ← Next.js UI (halaman guru & siswa)
│   ├── src/
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml  ← postgres + backend + frontend
└── package.json        ← monorepo root (npm workspaces)
```

## Cara Menjalankan

### Development (lokal)

```bash
# Install semua dependencies
npm install

# Jalankan backend + frontend sekaligus
npm run dev

# Atau terpisah:
npm run dev:backend
npm run dev:frontend
```

### Setup Database (pertama kali)

```bash
cd backend
cp .env.example .env   # isi DATABASE_URL, JWT secrets, dll
npx prisma migrate dev
```

### Docker (production)

```bash
docker-compose up --build
```

## Frontend redesign

`frontend-new` menggunakan workflow dan backend yang sama dengan `frontend`, dengan penyesuaian tampilan Scholastic Sky. Jalankan backend sesuai konfigurasi proyek, lalu jalankan:

```bash
npm install
npm run dev:frontend-new
```

Untuk menjalankan backend dan `frontend-new` sekaligus, gunakan `./start.sh` dari root proyek.

Buka `http://localhost:3002`. Login dan data ujian menggunakan akun serta database backend yang dikonfigurasi; tindakan di frontend ini memengaruhi data yang sama dengan frontend lama. Permintaan `/api` diteruskan ke backend melalui konfigurasi Next.js yang sama dengan frontend lama.

Bank soal bersama disimpan di backend dan dapat dikelola oleh semua guru dan admin. Untuk memperbarui instalasi yang sudah ada, jalankan `npx prisma migrate deploy` dan `npx prisma generate` dari folder `backend` sebelum menjalankan versi baru. Migrasi ini menambahkan tabel bank dan kolom snapshot soal tanpa menghapus data ujian lama. Cadangkan database sebelum migrasi sesuai prosedur instalasi.

Di halaman Bank soal, pilih **Periksa bank lokal** untuk memindahkan bank dari browser ini; impor memerlukan konfirmasi, membuka draf untuk diperiksa, dan tidak menghapus data lokal. Editor menyimpan draf ke browser dan backend, dengan paling banyak 200 soal dalam satu kumpulan. Persamaan disimpan bersama representasi teksnya; soal yang ditambahkan ke ujian menjadi snapshot tersendiri.

Gambar bank soal disimpan di `backend/storage/question-bank/`. Direktori ini harus persisten dan ikut dicadangkan bersama database; pada instalasi dengan beberapa instance backend, direktori penyimpanan harus tersedia bagi setiap instance. Unggahan menerima PNG, JPEG, dan WebP hingga 2 MB.

Jawaban singkat yang terisi diperiksa dari rincian hasil peserta setelah ujian dikumpulkan. Guru dapat memberi nilai benar (bobot penuh), salah (nol), atau membatalkan penilaian. Nilai dihitung dari bobot semua soal dan ditandai sementara selama masih ada jawaban singkat yang menunggu pemeriksaan; jawaban kosong bernilai nol. Perhitungan ini juga berlaku pada hasil ujian lama yang memiliki jawaban singkat.

Socket.IO juga diteruskan melalui origin frontend, sehingga browser tidak perlu mengakses port backend secara langsung. Secara default proxy menuju `http://127.0.0.1:3001`; atur `INTERNAL_BACKEND_URL` pada lingkungan frontend jika backend berada di alamat lain. Mulai ulang frontend setelah mengubah alamat tersebut. Pengaturan database dan kredensial tetap mengikuti petunjuk proyek di atas.
