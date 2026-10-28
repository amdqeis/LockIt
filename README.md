# LockIt — Platform Ujian Online dengan Proctoring

Monorepo berisi dua workspace:

| Workspace | Path | Port | Deskripsi |
|-----------|------|------|-----------|
| `frontend` | `./frontend` | `3000` | Next.js UI |
| `backend`  | `./backend`  | `3001` | Next.js API Routes + Socket.IO + Prisma (PostgreSQL) |

## Struktur Folder

```
LockIt/
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
