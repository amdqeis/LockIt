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

Socket.IO juga diteruskan melalui origin frontend, sehingga browser tidak perlu mengakses port backend secara langsung. Secara default proxy menuju `http://127.0.0.1:3001`; atur `INTERNAL_BACKEND_URL` pada lingkungan frontend jika backend berada di alamat lain. Mulai ulang frontend setelah mengubah alamat tersebut. Pengaturan database dan kredensial tetap mengikuti petunjuk proyek di atas.
