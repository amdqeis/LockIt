# 01 — Gap Analysis: PRD/Docs vs Implementasi Aktual

> **Tanggal:** 26 Oktober 2026  
> **Referensi:** `docs/PRD.md`, `docs/UI_REQUIREMENTS.md`, `docs/AUDIT.md` (lama), kode aktual

---

## Metodologi

Setiap **User Story (US)** dari PRD dicocokkan dengan keberadaan:
- **Backend**: endpoint API tersedia?
- **Frontend**: halaman/komponen tersedia?
- **Integrasi**: frontend benar-benar memanggil backend?

---

## 1. Gap Matrix per User Story (Guru/Dosen)

| ID | User Story | Backend | Frontend | Integrasi | Prioritas PRD |
|----|-----------|---------|----------|-----------|---------------|
| US-G01 | Login ke dashboard | ✅ `POST /api/auth/login` | ✅ `/login` page ada | ❌ Mock/hardcoded | P0 |
| US-G02 | Membuat ujian baru | ✅ `POST /api/exams` | ✅ `/dashboard/exams/new` ada | ❌ Mock | P0 |
| US-G03 | Upload bank soal (XML/JSON) | ✅ `POST /api/exams/[id]/questions/upload` | ✅ UI upload ada | ❌ Belum terhubung | P0 |
| US-G04 | Kode akses unik otomatis | ✅ Auto-generate di POST /exams | ✅ Ditampilkan di UI | ❌ Data dari mock | P0 |
| US-G05 | Kebijakan pelanggaran | ✅ `violationPolicy` di schema | ✅ Form edit ada | ❌ Mock | P1 |
| US-G06 | Monitor real-time | ✅ Socket.IO `/teacher-dashboard` | ✅ `/live-feed`, `/monitor` ada | ❌ Socket client belum ada | P1 |
| US-G07 | Kirim peringatan ke siswa | ✅ `POST /api/exams/[id]/students/[sid]/warn` | ⚠️ Tombol ada, belum terhubung | ❌ | P1 |
| US-G08 | Unlock siswa | ✅ `POST /api/exams/[id]/students/[sid]/unlock` | ⚠️ Tombol ada | ❌ | P2 |
| US-G09 | Log pelanggaran per siswa | ✅ `GET /api/exams/[id]/students/[sid]/violations` | ✅ `/violations/[sid]` ada | ❌ Mock | P1 |
| US-G10 | Hasil ujian auto-graded | ✅ `autoGradeStudent()` service | ✅ `/results` page ada | ❌ Mock | P1 |
| US-G11 | Export CSV/Excel | ✅ `/export/csv`, `/export/xlsx` | ✅ Tombol ada | ❌ Belum terhubung | P1 |
| US-G12 | Edit/hapus ujian | ✅ `PUT/DELETE /api/exams/[id]` | ✅ `/edit` page ada | ❌ Mock | P1 |

## 2. Gap Matrix per User Story (Mahasiswa)

| ID | User Story | Backend | Frontend | Integrasi | Prioritas PRD |
|----|-----------|---------|----------|-----------|---------------|
| US-M01 | Join dengan kode akses | ✅ `POST /api/join` | ✅ `/join` page ada | ❌ **Mock total** — hardcoded "WEB2026" | P0 |
| US-M02 | Isi nama & NIM | ✅ Ditangani di `POST /api/join` | ✅ `/join/identity` ada | ❌ Tidak POST ke API | P0 |
| US-M03 | Kerjakan soal ujian | ✅ `GET /api/exam-session` | ✅ `/exam/session` ada (1431 baris) | ❌ Pakai mockData | P0 |
| US-M04 | Timer server-based | ✅ `serverTime` di response | ✅ Timer ada di UI | ❌ Timer dari mock, bukan server | P0 |
| US-M05 | Auto-save jawaban | ✅ `POST /api/exam-session/answer` | ✅ Auto-save UI ada | ❌ Tidak memanggil API | P1 |
| US-M06 | Proctoring events | ✅ `POST /api/proctoring/event` | ⚠️ Deteksi event ada di kode | ❌ Tidak dikirim ke backend | P0 |
| US-M07 | Peringatan dari guru | ✅ Socket.IO `warning` event | ❌ Tidak ada Socket client | ❌ | P1 |
| US-M08 | Submit ujian | ✅ `POST /api/exam-session/submit` | ✅ Tombol submit ada | ❌ Mock — langsung redirect | P0 |

---

## 3. Gap Fitur yang Tidak Ada di Manapun

| Fitur | Status | Keterangan |
|-------|--------|-----------|
| **Waiting Room siswa** | ⚠️ UI ada (`/exam/waiting`), BE ada (`status: waiting`) | Tapi tidak ada logic poll/socket untuk deteksi ujian dimulai |
| **Lupa password guru** | ⚠️ Halaman ada (`/lupa-password`) | Backend endpoint tidak ada — sama sekali tidak diimplementasi |
| **Register guru** | ✅ Backend ada | ✅ Frontend ada | ❌ Integrasi belum |
| **Refresh token rotasi** | ✅ Backend ada | Tidak diperlukan UI | ❌ Frontend tidak request refresh saat accessToken expired |
| **Socket.IO student namespace** | ✅ Backend ada `/student-session` | ❌ Frontend tidak connect | Gap besar |
| **Heartbeat** | ✅ `POST /api/exam-session/heartbeat` | ❌ Frontend tidak mengirim heartbeat | Siswa akan dianggap disconnected dalam 30 detik |
| **Question Bank** | ✅ `/dashboard/question-bank` UI ada | ❌ Tidak ada endpoint backend untuk question bank terpisah | Endpoint hanya di level exam |

---

## 4. Inkonsistensi Schema vs Frontend

| Aspek | Backend Schema | Frontend (mockData) | Status |
|-------|---------------|---------------------|--------|
| `violationPolicy.action` | `"warning" \| "lock" \| "review"` | `"auto-lock" \| "warning" \| "review_manual"` | ❌ Tidak sinkron |
| `FlagKey` di live-feed | — | `"tab_switch" \| "copy_paste" \| ...` | Berbeda dari `EventType` di schema DB |
| `EventType` di DB | `fullscreen_exit, tab_switch, copy_attempt, paste_attempt, right_click, devtools, reconnect, heartbeat_lost` | UI menampilkan `camera_off, out_of_frame` (tidak ada di DB) | ❌ |
| Student `status` | `waiting, active, submitted, disconnected` | Mock pakai `"offline"` juga | ⚠️ Minor |

---

## 5. Ringkasan Gap Berdasarkan Prioritas

### 🔴 KRITIS — Harus difix sebelum demo/launch

1. **Frontend-Backend Integrasi (P0 Stories)**: US-G01, US-M01, US-M02, US-M03, US-M04, US-M08 semua masih mock
2. **Heartbeat tidak dikirim** — semua siswa akan disconnect setelah 30 detik walau koneksi bagus
3. **Proctoring event tidak dikirim** — seluruh fitur proctoring tidak berfungsi

### 🟡 PENTING — Harus difix sebelum production

4. **Socket.IO client** untuk dashboard guru dan sesi siswa
5. **Sinkronisasi tipe** `violationPolicy.action` dan `EventType` antara FE & BE
6. **Token refresh** — frontend akan logout otomatis setelah 15 menit tanpa silent refresh
7. **Lupa Password** — halaman ada, endpoint tidak ada

### 🟢 BISA DITUNDA — Fase berikutnya

8. **Question Bank terpisah** — saat ini soal hanya bisa diupload per ujian
9. **Waiting Room polling** — siswa tidak tahu kapan ujian dimulai tanpa refresh manual

---

*File: `AUDIT/01-GAP-ANALYSIS.md` | Terakhir diupdate: 26 Oktober 2026*
