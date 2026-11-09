# EduQuas participant frontend

Portal peserta memakai Next.js pada port 3002 dan backend pada port 3001. Dari root proyek, jalankan `npm install`, lalu `npm run dev` atau `./start.sh`. Halaman `/` menangani kode, identitas, persetujuan, riwayat dan review; `/exam/session` menangani pengerjaan ujian. Dashboard guru belum dibangun kembali pada tahap ini.

REST menggunakan rewrite server dari `/api/*` dan `/uploads/exams/*` ke `INTERNAL_BACKEND_URL` (default `http://127.0.0.1:3001`). Untuk Socket.IO pada backend terpisah, atur `NEXT_PUBLIC_BACKEND_URL` ke origin backend yang dapat diakses browser dan izinkan origin frontend pada konfigurasi backend. Gunakan hostname yang konsisten agar cookie sesi tersedia.

Pemeriksaan lokal dari root:

```sh
npm run lint --workspace=frontend
npm run type-check --workspace=frontend
npm run build --workspace=frontend
node --import tsx --test backend/src/lib/student-answer.test.ts backend/src/lib/proctoring-events.test.ts
```

Untuk uji browser halaman pengerjaan dengan respons API simulasi, jalankan frontend lalu jalankan `node frontend/tests/exam-workspace.cjs` dari root. Uji ini tidak mengubah database.

`tests/participant-flow.cjs` adalah uji browser terhadap backend dan database nyata. Uji membuat fixture unik sementara dan membersihkannya setelah selesai. Siapkan backend uji pada port 3011 dan frontend uji pada port 3012, atau atur `EDUQUAS_TEST_BACKEND_URL` dan `EDUQUAS_TEST_FRONTEND_URL`; lalu jalankan dari root:

```sh
node --env-file=backend/.env frontend/tests/participant-flow.cjs
```

Server backend uji dapat memakai `EDUQUAS_BACKEND_DIST_DIR=.cache/next-e2e` agar output Next.js terpisah dari proses backend lain. `CHROMIUM_PATH` dapat digunakan jika Chromium tidak berada di `/usr/bin/chromium`.
