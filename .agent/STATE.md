# EduQuas

- Status: Pipeline CI/CD telah dimigrasikan untuk memindahkan seluruh proses build image Docker ke GitHub Actions (GHCR) dengan tag sha immutable dan rotasi log.
- Hasil: .github/workflows/deploy.yml kini melakukan buildx dan push ke GHCR dengan cache gha, VPS hanya menjalankan pull dan up -d; skrip SSH disederhanakan menjadi perintah linear tanpa blok kontrol multiline untuk kompatibilitas penuh appleboy/ssh-action; docker-compose.yml menggunakan referensi image registry dengan log driver 10m/3 files; workflow_dispatch mendukung rollback manual via input image_tag.
- Verifikasi: Sintaks YAML valid, docker compose config valid dengan substitusi IMAGE_TAG, lint dan type-check frontend dan backend lulus 100% (0 error).
- Langkah VPS berikutnya: Inisialisasi IMAGE_TAG di .env VPS, deploy rilis baru, lalu jalankan docker builder prune -a -f manual untuk membebaskan cache lama 10 GB.
