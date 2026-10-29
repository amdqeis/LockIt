# 04 — Docs Audit

> **Tanggal:** 26 Oktober 2026  
> **Path:** `docs/`

---

## 1. Inventaris Dokumen

| File | Ukuran | Isi | Last Updated (berdasarkan konten) |
|------|--------|-----|----------------------------------|
| `PRD.md` | 27 KB | Product Requirements Document v1.0 | 25 Sep 2026 |
| `AUDIT.md` | 30 KB | Audit backend planning vs PRD | 9 Okt 2026 |
| `DATABASE.md` | 20 KB | Schema database & Prisma | — |
| `ANALYSIS.md` | 9 KB | Analisis tech stack | — |
| `USER_FLOWS.md` | 17 KB | Alur penggunaan | — |
| `DETAIL_USER_FLOW.md` | 48 KB | Alur detail | — |
| `UI_REQUIREMENTS.md` | 31 KB | Kebutuhan UI | 10 Okt 2026 |

---

## 2. Temuan per Dokumen

### PRD.md

| Aspek | Status | Catatan |
|-------|--------|---------|
| Problem statement | ✅ Relevan | Masih akurat |
| User stories guru (US-G01–G12) | ✅ Lengkap | Sudah diimplementasi di backend |
| User stories siswa (US-M01–M08) | ✅ Lengkap | Backend ada, frontend belum integrate |
| Non-functional requirements | ⚠️ | NFR tentang "lupa password" — belum ada di backend |
| Status dokumen | 🔴 **Outdated** | Masih "Draft — Menunggu Review", padahal implementasi sudah jalan |
| Tech stack | ⚠️ Sebagian outdated | Disebutkan "Next.js (Full-stack Web)" tapi sekarang sudah monorepo terpisah |
| Versi | ⚠️ | v1.0 — tidak ada tanggal revisi |

**Rekomendasi:** Update status ke "In Development", tambahkan link ke AUDIT folder ini, update tech stack section.

---

### AUDIT.md (lama di docs/)

| Aspek | Status | Catatan |
|-------|--------|---------|
| Cakupan | ⚠️ | Hanya audit *planning docs* vs PRD, bukan kode aktual |
| Tanggal | ⚠️ | 9 Oktober 2026 — sebelum implementasi backend |
| SEC-01 (Session token) | ✅ | Sudah diimplementasi dengan baik di `join/route.ts` |
| SEC-02 (CSRF) | 🟡 | `SameSite=strict` sudah ada. Cookie path restriction (`/api/auth`) juga ada |
| Akurasi saat ini | 🔴 | **Sangat outdated** — semua "PERLU INVESTIGASI" sudah diimplementasi |

**Rekomendasi:** Dokumen ini tidak perlu dihapus (histori), tapi tambahkan header "⚠️ OUTDATED — Lihat AUDIT/ untuk audit terbaru".

---

### DATABASE.md

| Aspek | Status | Catatan |
|-------|--------|---------|
| Schema overview | ✅ | Deskripsi tabel akurat |
| Relasi | ✅ | Cocok dengan schema.prisma |
| Index | ✅ | Sama dengan schema aktual |
| Migration | ❌ | Dokumen menyebut migration tapi folder `migrations/` tidak ada |
| `student.score` field | 🔴 | **Inkonsistensi**: DATABASE.md mungkin menyebut score field, tapi schema tidak punya — grading dihitung on-the-fly |

---

### ANALYSIS.md

| Aspek | Status | Catatan |
|-------|--------|---------|
| Tech stack analysis | ✅ | Reasoning masih valid |
| Keputusan monorepo | ⚠️ | Dokumen mungkin belum membahas monorepo — baru di-setup |
| Arsitektur | ⚠️ | Mungkin perlu update untuk mencerminkan pembagian backend/frontend port |

---

### UI_REQUIREMENTS.md

| Aspek | Status | Catatan |
|-------|--------|---------|
| Design tokens | 🟡 | Token yang didefinisikan (`--color-primary: #4F46E5`) berbeda dengan yang dipakai di `globals.css` (pakai warna berbeda) |
| Halaman yang didefinisikan | ✅ | Semua halaman sudah diimplementasi di frontend |
| Component requirements | ⚠️ | Banyak komponen (Button, Modal, dll) tidak dibuat sebagai file terpisah — inline di page |
| Accessibility requirements | ⚠️ | Didefinisikan tapi partial di implementasi |

---

### USER_FLOWS.md & DETAIL_USER_FLOW.md

| Aspek | Status | Catatan |
|-------|--------|---------|
| Flow siswa join | ✅ | Alur akurat dengan implementasi |
| Flow guru create exam | ✅ | Akurat |
| Flow real-time monitoring | ⚠️ | Socket.IO events terdefinisi tapi belum diimplementasi di frontend |
| Flow auto-end exam | ✅ | Sama dengan `scheduler.ts` |
| Edge cases | ✅ | Reconnect, timeout, dll terdokumentasi |

---

## 3. Dokumen yang Hilang / Perlu Dibuat

| Dokumen | Prioritas | Keterangan |
|---------|-----------|-----------|
| **API Reference** | 🔴 Tinggi | Tidak ada dokumentasi endpoint API (tidak ada OpenAPI/Swagger) |
| **Environment Setup Guide** | 🔴 Tinggi | `.env.example` ada, tapi tidak ada panduan lengkap setup lokal |
| **Deployment Guide** | 🟡 Medium | Docker compose ada, tapi tidak ada panduan step-by-step |
| **Frontend Integration Guide** | 🔴 Tinggi | Tidak ada panduan bagaimana FE harus memanggil BE |
| **Socket.IO Events Reference** | 🔴 Tinggi | Event names, payload shapes, namespaces tidak terdokumentasi di luar kode |
| **Architecture Decision Records (ADR)** | 🟡 Medium | Keputusan seperti "kenapa monorepo", "kenapa in-memory scheduler" tidak tercatat |
| **Changelog** | 🟢 Low | Tidak ada CHANGELOG.md |

---

## 4. Inkonsistensi Antar-Dokumen

| # | Inkonsistensi | Dokumen A | Dokumen B |
|---|---------------|-----------|-----------|
| 1 | Primary color | `UI_REQUIREMENTS.md`: `#4F46E5 (Indigo)` | `globals.css`: `#29ABE2 (Blue)` — berbeda total |
| 2 | Struktur folder | `PRD.md`: "Next.js Full-stack" | `README.md`: Monorepo `backend/` + `frontend/` |
| 3 | Port backend | `README.md`: 3000 | `docker-compose.yml`: backend 3000, frontend 3001 — OK (sudah sync) |
| 4 | Violation action values | `UI_REQUIREMENTS.md`: `"auto-lock"` | `backend/schema Zod`: `"lock"` |
| 5 | EventType FlagKey | `UI_REQUIREMENTS.md` & `live-feed/page.tsx` punya `duplicate_screen` | `prisma schema` tidak punya event ini |

---

## 5. Rekomendasi Dokumentasi

### Jangka Pendek (sebelum integrasi FE-BE)

1. **Buat `docs/API.md`** dengan daftar semua endpoint, request/response shape, dan error codes
2. **Buat `docs/SOCKET_EVENTS.md`** dengan daftar semua event Socket.IO (nama, namespace, payload)
3. **Update `PRD.md`** status dari "Draft" ke "In Development"
4. **Buat `docs/SETUP.md`** panduan setup lokal lengkap (DB, env, migration)

### Jangka Menengah

5. **Tambah header "OUTDATED"** ke `docs/AUDIT.md` lama
6. **Sinkronkan design tokens** antara `UI_REQUIREMENTS.md` dan `globals.css`
7. **Tambahkan `docs/DECISIONS.md`** untuk keputusan arsitektur penting

---

## 6. Ringkasan Status Dokumentasi

```
docs/
├── PRD.md              ← 🟡 Perlu update status & tech stack
├── AUDIT.md            ← 🔴 Outdated (audit ini lebih baru)  
├── DATABASE.md         ← 🟡 Akurat tapi perlu tambahkan catatan migration
├── ANALYSIS.md         ← 🟡 Perlu update untuk monorepo
├── USER_FLOWS.md       ← ✅ Masih relevan
├── DETAIL_USER_FLOW.md ← ✅ Masih relevan
└── UI_REQUIREMENTS.md  ← 🟡 Color token tidak sinkron

AUDIT/                  ← 🆕 Folder baru (dokumen ini)
├── README.md
├── 01-GAP-ANALYSIS.md  ← 🆕 Gap matrix PRD vs implementasi
├── 02-FRONTEND-AUDIT.md← 🆕 Audit kode frontend
├── 03-BACKEND-AUDIT.md ← 🆕 Audit kode backend
└── 04-DOCS-AUDIT.md    ← 🆕 Dokumen ini
```

---

*File: `AUDIT/04-DOCS-AUDIT.md` | Terakhir diupdate: 26 Oktober 2026*
