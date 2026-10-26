// Mock data for all pages — no backend required

export const mockTeacher = {
  id: "t1",
  name: "Dr. Ahmad Fauzi, S.T.",
  email: "ahmad.fauzi@univ.ac.id",
  initials: "AF",
};

export type FlagKey = "camera_off" | "out_of_frame" | "switched_tabs" | "multiple_people";

export interface LiveSession {
  examId: string;
  title: string;
  online: number;
  enrolled: number;
  endsAt: string; // ISO 8601
  flags: Record<FlagKey, number>;
}

export const mockLiveSessions: LiveSession[] = [
  {
    examId: "exam-1",
    title: "UTS Pemrograman Web 2026",
    online: 28,
    enrolled: 34,
    endsAt: "2026-10-26T10:30:00+07:00",
    flags: {
      camera_off: 2,
      out_of_frame: 1,
      switched_tabs: 3,
      multiple_people: 0,
    },
  },
];

export const mockExams = [
  {
    id: "exam-1",
    title: "UTS Pemrograman Web 2026",
    description: "Ujian Tengah Semester mata kuliah Pemrograman Web. Materi mencakup HTML, CSS, JavaScript, dan React.",
    status: "active" as const,
    duration: 90,
    questionCount: 25,
    accessCode: "WEB2026",
    createdAt: "2026-10-05",
    totalParticipants: 34,
    online: 28,
    enrolled: 34,
    flagCount: 3,
    endsAt: "2026-10-26T10:30:00+07:00",
    violationPolicy: {
      maxViolations: 3,
      action: "auto-lock",
      detectCopyPaste: true,
      detectRightClick: true,
      detectDevTools: false,
    },
    questionMode: "one-by-one" as const,
    shuffleQuestions: true,
  },
  {
    id: "exam-5",
    title: "UAS Rekayasa Perangkat Lunak",
    description: "Ujian Akhir Semester topik SDLC, agile, dan software testing.",
    status: "scheduled" as const,
    duration: 90,
    questionCount: 30,
    accessCode: "RPL2026",
    createdAt: "2026-10-15",
    startsAt: "2026-11-02T09:00:00+07:00",
    totalParticipants: 40,
    violationPolicy: {
      maxViolations: 3,
      action: "auto-lock",
      detectCopyPaste: true,
      detectRightClick: true,
      detectDevTools: true,
    },
    questionMode: "one-by-one" as const,
    shuffleQuestions: true,
  },
  {
    id: "exam-2",
    title: "UAS Basis Data 2026",
    description: "Ujian Akhir Semester mata kuliah Basis Data.",
    status: "draft" as const,
    duration: 120,
    questionCount: 40,
    accessCode: "BD2026X",
    createdAt: "2026-10-08",
    updatedAt: "2 hari lalu",
    totalParticipants: 0,
    violationPolicy: {
      maxViolations: 5,
      action: "warning",
      detectCopyPaste: false,
      detectRightClick: false,
      detectDevTools: false,
    },
    questionMode: "one-by-one" as const,
    shuffleQuestions: false,
  },
  {
    id: "exam-3",
    title: "Kuis Harian Algoritma #3",
    description: "Kuis singkat topik rekursi dan dynamic programming.",
    status: "ended" as const,
    duration: 30,
    questionCount: 10,
    accessCode: "ALG003K",
    createdAt: "2026-09-28",
    totalParticipants: 38,
    violationPolicy: {
      maxViolations: 3,
      action: "review",
      detectCopyPaste: true,
      detectRightClick: false,
      detectDevTools: true,
    },
    questionMode: "all-at-once" as const,
    shuffleQuestions: true,
  },
  {
    id: "exam-4",
    title: "UTS Jaringan Komputer",
    description: null,
    status: "archived" as const,
    duration: 60,
    questionCount: 20,
    accessCode: "JK2025A",
    createdAt: "2026-08-15",
    totalParticipants: 55,
    violationPolicy: {
      maxViolations: 3,
      action: "auto-lock",
      detectCopyPaste: true,
      detectRightClick: true,
      detectDevTools: true,
    },
    questionMode: "one-by-one" as const,
    shuffleQuestions: false,
  },
];

export const mockDashboardStats = {
  totalExams: 12,
  activeExams: 1,
  scheduledExams: 2,
  draftExams: 3,
  totalParticipants: 340,
  completedExams: 9,
  archivedExams: 1,
};

export const mockParticipants = [
  { id: "p1", name: "Siti Nurhaliza", nim: "1301210001", status: "online" as const, violations: 0, progress: 18, totalQ: 25, lastActivity: "1 mnt lalu", locked: false },
  { id: "p2", name: "Budi Santoso", nim: "1301210023", status: "locked" as const, violations: 4, progress: 12, totalQ: 25, lastActivity: "5 mnt lalu", locked: true },
  { id: "p3", name: "Dewi Anggraini", nim: "1301210045", status: "online" as const, violations: 1, progress: 22, totalQ: 25, lastActivity: "30 dtk lalu", locked: false },
  { id: "p4", name: "Eko Prasetyo", nim: "1301210067", status: "offline" as const, violations: 2, progress: 15, totalQ: 25, lastActivity: "12 mnt lalu", locked: false },
  { id: "p5", name: "Fitria Handayani", nim: "1301210089", status: "submitted" as const, violations: 0, progress: 25, totalQ: 25, lastActivity: "8 mnt lalu", locked: false },
  { id: "p6", name: "Galih Permana", nim: "1301210101", status: "online" as const, violations: 3, progress: 20, totalQ: 25, lastActivity: "45 dtk lalu", locked: false },
  { id: "p7", name: "Hani Rahmawati", nim: "1301210122", status: "online" as const, violations: 0, progress: 8, totalQ: 25, lastActivity: "2 mnt lalu", locked: false },
  { id: "p8", name: "Irfan Hakim", nim: "1301210134", status: "waiting" as const, violations: 0, progress: 0, totalQ: 25, lastActivity: "3 mnt lalu", locked: false },
  { id: "p9", name: "Jasmine Putri", nim: "1301210156", status: "submitted" as const, violations: 1, progress: 25, totalQ: 25, lastActivity: "15 mnt lalu", locked: false },
  { id: "p10", name: "Karima Zahra", nim: "1301210178", status: "online" as const, violations: 0, progress: 23, totalQ: 25, lastActivity: "1 mnt lalu", locked: false },
];

export const mockMonitorStats = {
  totalJoin: 42,
  online: 38,
  offline: 2,
  submitted: 5,
  notSubmitted: 37,
};

export const mockViolations = [
  { id: "v1", type: "tab_switch", time: "10:35:02", detail: "Pelanggaran ke-3 dari batas 3", duration: null },
  { id: "v2", type: "fullscreen_exit", time: "10:32:15", detail: null, duration: "12 detik" },
  { id: "v3", type: "copy_attempt", time: "10:41:30", detail: "Teks yang di-copy: [hidden]", duration: null },
  { id: "v4", type: "reconnect", time: "10:44:00", detail: null, duration: "45 detik" },
  { id: "v5", type: "tab_switch", time: "10:28:47", detail: "Pelanggaran ke-1", duration: null },
  { id: "v6", type: "window_blur", time: "10:30:22", detail: null, duration: "8 detik" },
  { id: "v7", type: "tab_switch", time: "10:33:55", detail: "Pelanggaran ke-2", duration: null },
];

export const mockResults = [
  { id: "r1", name: "Siti Nurhaliza", nim: "1301210001", score: 92, correct: 23, total: 25, violations: 0, submittedAt: "10:42 WIB" },
  { id: "r2", name: "Budi Santoso", nim: "1301210023", score: 48, correct: 12, total: 25, violations: 4, submittedAt: "11:08 WIB" },
  { id: "r3", name: "Dewi Anggraini", nim: "1301210045", score: 88, correct: 22, total: 25, violations: 1, submittedAt: "10:55 WIB" },
  { id: "r4", name: "Eko Prasetyo", nim: "1301210067", score: 60, correct: 15, total: 25, violations: 2, submittedAt: "11:02 WIB" },
  { id: "r5", name: "Fitria Handayani", nim: "1301210089", score: 76, correct: 19, total: 25, violations: 0, submittedAt: "10:38 WIB" },
  { id: "r6", name: "Galih Permana", nim: "1301210101", score: 64, correct: 16, total: 25, violations: 3, submittedAt: "11:10 WIB" },
  { id: "r7", name: "Hani Rahmawati", nim: "1301210122", score: 84, correct: 21, total: 25, violations: 0, submittedAt: "10:48 WIB" },
  { id: "r8", name: "Irfan Hakim", nim: "1301210134", score: 72, correct: 18, total: 25, violations: 0, submittedAt: "10:58 WIB" },
  { id: "r9", name: "Jasmine Putri", nim: "1301210156", score: 56, correct: 14, total: 25, violations: 1, submittedAt: "11:05 WIB" },
  { id: "r10", name: "Karima Zahra", nim: "1301210178", score: 96, correct: 24, total: 25, violations: 0, submittedAt: "10:35 WIB" },
];

export const mockResultStats = {
  average: 73.6,
  highest: 96,
  lowest: 48,
  totalSubmit: 40,
  passPercentage: 75,
};

// =====================================================
// QUESTION TYPES
// =====================================================
// single_choice  : pilihan ganda, 1 jawaban benar (correctAnswer: string)
// multi_select   : pilihan ganda, ≥1 jawaban benar (correctAnswers: string[])
// latex          : soal matematika dengan LaTeX, 1 jawaban benar (correctAnswer: string)

export const mockQuestions = [
  // =================================================================
  // SINGLE CHOICE — Pilihan ganda, 1 jawaban benar
  // Badge biru | correctAnswer: string
  // =================================================================
  {
    id: "q1",
    number: 1,
    type: "single_choice" as const,
    text: "Apa yang dimaksud dengan HTML (HyperText Markup Language)?",
    image: null,
    options: [
      { id: "a", text: "Bahasa pemrograman untuk membuat logika aplikasi" },
      { id: "b", text: "Bahasa markup untuk membuat struktur halaman web" },
      { id: "c", text: "Framework JavaScript untuk membangun UI" },
      { id: "d", text: "Protokol komunikasi antar server" },
    ],
    correctAnswer: "b",
    correctAnswers: null,
    points: 10,
    hint: null,
  },
  {
    id: "q2",
    number: 2,
    type: "single_choice" as const,
    text: "Properti CSS mana yang digunakan untuk mengubah warna teks?",
    image: null,
    options: [
      { id: "a", text: "background-color" },
      { id: "b", text: "font-color" },
      { id: "c", text: "color" },
      { id: "d", text: "text-color" },
    ],
    correctAnswer: "c",
    correctAnswers: null,
    points: 10,
    hint: null,
  },
  {
    id: "q3",
    number: 3,
    type: "single_choice" as const,
    text: "Dalam JavaScript, metode apa yang digunakan untuk menambahkan elemen ke akhir array?",
    image: null,
    options: [
      { id: "a", text: "array.add()" },
      { id: "b", text: "array.append()" },
      { id: "c", text: "array.insert()" },
      { id: "d", text: "array.push()" },
    ],
    correctAnswer: "d",
    correctAnswers: null,
    points: 10,
    hint: null,
  },
  {
    id: "q4",
    number: 4,
    type: "single_choice" as const,
    text: "Manakah selektor CSS yang valid untuk menargetkan elemen dengan class \"btn-primary\"?",
    image: null,
    options: [
      { id: "a", text: "#btn-primary" },
      { id: "b", text: ".btn-primary" },
      { id: "c", text: "*btn-primary" },
      { id: "d", text: "@btn-primary" },
    ],
    correctAnswer: "b",
    correctAnswers: null,
    points: 10,
    hint: null,
  },
  {
    id: "q5",
    number: 5,
    type: "single_choice" as const,
    text: "Apa output dari kode JavaScript berikut?\n\nconsole.log(typeof null);",
    image: null,
    options: [
      { id: "a", text: '"null"' },
      { id: "b", text: '"undefined"' },
      { id: "c", text: '"object"' },
      { id: "d", text: '"boolean"' },
    ],
    correctAnswer: "c",
    correctAnswers: null,
    points: 10,
    hint: null,
  },

  // =================================================================
  // MULTIPLE SELECT — Boleh memilih ≥1 jawaban benar
  // Badge kuning | correctAnswers: string[]
  // =================================================================
  {
    id: "q6",
    number: 6,
    type: "multi_select" as const,
    text: "Pilih SEMUA pernyataan yang benar mengenai JavaScript. (Pilihan bisa lebih dari satu)",
    image: null,
    options: [
      { id: "a", text: "JavaScript adalah bahasa pemrograman yang berjalan di browser" },
      { id: "b", text: "JavaScript hanya bisa digunakan di sisi client (frontend)" },
      { id: "c", text: "Node.js memungkinkan JavaScript berjalan di sisi server" },
      { id: "d", text: "JavaScript adalah bahasa yang strongly-typed secara default" },
      { id: "e", text: "JavaScript mendukung pemrograman berbasis event (event-driven)" },
    ],
    correctAnswer: null,
    correctAnswers: ["a", "c", "e"],
    points: 15,
    hint: null,
  },
  {
    id: "q7",
    number: 7,
    type: "multi_select" as const,
    text: "Manakah dari berikut ini yang merupakan ciri-ciri algoritma yang baik? (Pilih semua yang benar)",
    image: null,
    options: [
      { id: "a", text: "Memiliki langkah-langkah yang terbatas (finite)" },
      { id: "b", text: "Setiap langkah harus ambigu agar fleksibel" },
      { id: "c", text: "Memiliki input nol atau lebih" },
      { id: "d", text: "Menghasilkan minimal satu output" },
      { id: "e", text: "Setiap instruksi harus jelas dan tidak ambigu (definite)" },
    ],
    correctAnswer: null,
    correctAnswers: ["a", "c", "d", "e"],
    points: 15,
    hint: null,
  },
  {
    id: "q8",
    number: 8,
    type: "multi_select" as const,
    text: "Properti CSS berikut mana saja yang termasuk dalam box model sebuah elemen HTML? (Pilih semua yang benar)",
    image: null,
    options: [
      { id: "a", text: "margin" },
      { id: "b", text: "padding" },
      { id: "c", text: "font-size" },
      { id: "d", text: "border" },
      { id: "e", text: "color" },
    ],
    correctAnswer: null,
    correctAnswers: ["a", "b", "d"],
    points: 15,
    hint: null,
  },

  // =================================================================
  // LATEX — Soal matematika dengan rendering KaTeX
  // Badge ungu | teks mengandung $...$ atau $$...$$ | hint bisa LaTeX
  // =================================================================
  {
    id: "q9",
    number: 9,
    type: "latex" as const,
    text: "Diketahui fungsi $f(x) = 3x^2 - 2x + 5$. Hitunglah nilai turunan $f'(x)$ pada $x = 2$.",
    image: null,
    options: [
      { id: "a", text: "$f'(2) = 8$" },
      { id: "b", text: "$f'(2) = 10$" },
      { id: "c", text: "$f'(2) = 12$" },
      { id: "d", text: "$f'(2) = 14$" },
    ],
    correctAnswer: "b",
    correctAnswers: null,
    points: 20,
    hint: "Gunakan aturan turunan: $f'(x) = 6x - 2$, kemudian substitusi $x = 2$.",
  },
  {
    id: "q10",
    number: 10,
    type: "latex" as const,
    text: "Sebuah segitiga siku-siku memiliki dua sisi dengan panjang $a = \\sqrt{12}$ dan $b = \\sqrt{3}$. Berapakah panjang sisi miring (hipotenusa)?",
    image: null,
    options: [
      { id: "a", text: "$6\\sqrt{2}$" },
      { id: "b", text: "$3\\sqrt{2}$" },
      { id: "c", text: "$\\sqrt{15}$" },
      { id: "d", text: "$3$" },
    ],
    correctAnswer: "c",
    correctAnswers: null,
    points: 20,
    hint: "Gunakan Teorema Pythagoras: $c = \\sqrt{a^2 + b^2} = \\sqrt{12 + 3} = \\sqrt{15}$",
  },
  {
    id: "q11",
    number: 11,
    type: "latex" as const,
    text: "Evaluasi integral berikut:\n$$\\int_0^1 (2x + 1)\\, dx$$",
    image: null,
    options: [
      { id: "a", text: "$1$" },
      { id: "b", text: "$2$" },
      { id: "c", text: "$\\dfrac{3}{2}$" },
      { id: "d", text: "$\\dfrac{5}{2}$" },
    ],
    correctAnswer: "b",
    correctAnswers: null,
    points: 20,
    hint: "Gunakan rumus $\\int_a^b f(x)\\,dx = F(b) - F(a)$ dengan $F(x) = x^2 + x$.",
  },
  {
    id: "q12",
    number: 12,
    type: "latex" as const,
    text: "Tentukan nilai dari limit berikut:\n$$\\lim_{x \\to 2} \\frac{x^2 - 4}{x - 2}$$",
    image: null,
    options: [
      { id: "a", text: "$0$" },
      { id: "b", text: "$2$" },
      { id: "c", text: "$4$" },
      { id: "d", text: "Tidak terdefinisi" },
    ],
    correctAnswer: "c",
    correctAnswers: null,
    points: 20,
    hint: "Faktorkan pembilang: $x^2 - 4 = (x+2)(x-2)$, kemudian sederhanakan sebelum substitusi $x = 2$.",
  },

  // =================================================================
  // IMAGE QUESTION — Soal dengan gambar (image: URL | null)
  // imageAlt wajib diisi untuk aksesibilitas
  // =================================================================
  {
    id: "q13",
    number: 13,
    type: "single_choice" as const,
    text: "Perhatikan diagram jaringan komputer berikut. Berdasarkan topologi yang terlihat pada gambar, topologi manakah yang paling banyak digunakan di jaringan rumahan karena kemudahannya?",
    image: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA1NjAgMjYwIiB3aWR0aD0iNTYwIiBoZWlnaHQ9IjI2MCIgZm9udC1mYW1pbHk9IkFyaWFsLHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTEiPgogIDxyZWN0IHdpZHRoPSI1NjAiIGhlaWdodD0iMjYwIiBmaWxsPSIjZjBmOWZmIiByeD0iOCIvPgogIDwhLS0gVGl0bGUgLS0+CiAgPHRleHQgeD0iMjgwIiB5PSIyMiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC1zaXplPSIxMyIgZm9udC13ZWlnaHQ9ImJvbGQiIGZpbGw9IiMxQzMwM0QiPlRvcG9sb2dpIEphcmluZ2FuIEtvbXB1dGVyPC90ZXh0PgoKICA8IS0tIEJVUyBUT1BPTE9HWSAtLT4KICA8dGV4dCB4PSI3MCIgeT0iNTAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtc2l6ZT0iMTAiIGZvbnQtd2VpZ2h0PSJib2xkIiBmaWxsPSIjMDM2OUExIj5CdXM8L3RleHQ+CiAgPGxpbmUgeDE9IjIwIiB5MT0iODAiIHgyPSIxMjAiIHkyPSI4MCIgc3Ryb2tlPSIjMEVBNUU5IiBzdHJva2Utd2lkdGg9IjIuNSIvPgogIDxyZWN0IHg9IjEwIiB5PSI3MiIgd2lkdGg9IjE2IiBoZWlnaHQ9IjE2IiByeD0iMyIgZmlsbD0iIzI5QUJFMiIvPgogIDxyZWN0IHg9IjUyIiB5PSI3MiIgd2lkdGg9IjE2IiBoZWlnaHQ9IjE2IiByeD0iMyIgZmlsbD0iIzI5QUJFMiIvPgogIDxyZWN0IHg9Ijk2IiB5PSI3MiIgd2lkdGg9IjE2IiBoZWlnaHQ9IjE2IiByeD0iMyIgZmlsbD0iIzI5QUJFMiIvPgogIDxsaW5lIHgxPSI2MCIgeTE9IjcyIiB4Mj0iNjAiIHkyPSI4MCIgc3Ryb2tlPSIjMEVBNUU5IiBzdHJva2Utd2lkdGg9IjEuNSIgc3Ryb2tlLWRhc2hhcnJheT0iMywyIi8+CiAgPGNpcmNsZSBjeD0iMjAiIGN5PSI5NyIgcj0iNiIgZmlsbD0iIzI5QUJFMiIvPgogIDxjaXJjbGUgY3g9IjYwIiBjeT0iOTciIHI9IjYiIGZpbGw9IiMyOUFCRTIiLz4KICA8Y2lyY2xlIGN4PSIxMDQiIGN5PSI5NyIgcj0iNiIgZmlsbD0iIzI5QUJFMiIvPgogIDxsaW5lIHgxPSIyMCIgeTE9Ijg4IiB4Mj0iMjAiIHkyPSI5NyIgc3Ryb2tlPSIjNjQ3NDhCIiBzdHJva2Utd2lkdGg9IjEiLz4KICA8bGluZSB4MT0iNjAiIHkxPSI4OCIgeDI9IjYwIiB5Mj0iOTciIHN0cm9rZT0iIzY0NzQ4QiIgc3Ryb2tlLXdpZHRoPSIxIi8+CiAgPGxpbmUgeDE9IjEwNCIgeTE9Ijg4IiB4Mj0iMTA0IiB5Mj0iOTciIHN0cm9rZT0iIzY0NzQ4QiIgc3Ryb2tlLXdpZHRoPSIxIi8+CgogIDwhLS0gUklORyBUT1BPTE9HWSAtLT4KICA8dGV4dCB4PSIyMTAiIHk9IjUwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LXNpemU9IjEwIiBmb250LXdlaWdodD0iYm9sZCIgZmlsbD0iIzAzNjlBMSI+UmluZzwvdGV4dD4KICA8Y2lyY2xlIGN4PSIyMTAiIGN5PSI4MiIgcj0iMzAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzBFQTVFOSIgc3Ryb2tlLXdpZHRoPSIyLjUiLz4KICA8Y2lyY2xlIGN4PSIyMTAiIGN5PSI1MiIgcj0iNyIgZmlsbD0iIzI5QUJFMiIvPgogIDxjaXJjbGUgY3g9IjI0MCIgY3k9IjgyIiByPSI3IiBmaWxsPSIjMjlBQkUyIi8+CiAgPGNpcmNsZSBjeD0iMjEwIiBjeT0iMTEyIiByPSI3IiBmaWxsPSIjMjlBQkUyIi8+CiAgPGNpcmNsZSBjeD0iMTgwIiBjeT0iODIiIHI9IjciIGZpbGw9IiMyOUFCRTIiLz4KCiAgPCEtLSBTVEFSIFRPUE9MT0dZIC0tPgogIDx0ZXh0IHg9IjM2MCIgeT0iNTAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtc2l6ZT0iMTAiIGZvbnQtd2VpZ2h0PSJib2xkIiBmaWxsPSIjMDU5NjY5Ij5TdGFyIOKGkCBSdW1haGFuPC90ZXh0PgogIDxjaXJjbGUgY3g9IjM2MCIgY3k9Ijg1IiByPSIxMCIgZmlsbD0iIzEwQjk4MSIgc3Ryb2tlPSIjMDY1RjQ2IiBzdHJva2Utd2lkdGg9IjEuNSIvPgogIDx0ZXh0IHg9IjM2MCIgeT0iODkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtc2l6ZT0iOCIgZmlsbD0id2hpdGUiIGZvbnQtd2VpZ2h0PSJib2xkIj5TVzwvdGV4dD4KICA8bGluZSB4MT0iMzYwIiB5MT0iNzUiIHgyPSIzNjAiIHkyPSI1OCIgc3Ryb2tlPSIjMTBCOTgxIiBzdHJva2Utd2lkdGg9IjIiLz4KICA8bGluZSB4MT0iMzYwIiB5MT0iOTUiIHgyPSIzNjAiIHkyPSIxMTIiIHN0cm9rZT0iIzEwQjk4MSIgc3Ryb2tlLXdpZHRoPSIyIi8+CiAgPGxpbmUgeDE9IjM1MCIgeTE9Ijg1IiB4Mj0iMzMwIiB5Mj0iODUiIHN0cm9rZT0iIzEwQjk4MSIgc3Ryb2tlLXdpZHRoPSIyIi8+CiAgPGxpbmUgeDE9IjM3MCIgeTE9Ijg1IiB4Mj0iMzkwIiB5Mj0iODUiIHN0cm9rZT0iIzEwQjk4MSIgc3Ryb2tlLXdpZHRoPSIyIi8+CiAgPGxpbmUgeDE9IjM1MiIgeTE9Ijc3IiB4Mj0iMzM4IiB5Mj0iNjMiIHN0cm9rZT0iIzEwQjk4MSIgc3Ryb2tlLXdpZHRoPSIyIi8+CiAgPGxpbmUgeDE9IjM2OCIgeTE9Ijc3IiB4Mj0iMzgyIiB5Mj0iNjMiIHN0cm9rZT0iIzEwQjk4MSIgc3Ryb2tlLXdpZHRoPSIyIi8+CiAgPGNpcmNsZSBjeD0iMzYwIiBjeT0iNTQiIHI9IjYiIGZpbGw9IiMyOUFCRTIiLz48Y2lyY2xlIGN4PSIzNjAiIGN5PSIxMTYiIHI9IjYiIGZpbGw9IiMyOUFCRTIiLz4KICA8Y2lyY2xlIGN4PSIzMjIiIGN5PSI4NSIgcj0iNiIgZmlsbD0iIzI5QUJFMiIvPjxjaXJjbGUgY3g9IjM5OCIgY3k9Ijg1IiByPSI2IiBmaWxsPSIjMjlBQkUyIi8+CiAgPGNpcmNsZSBjeD0iMzM0IiBjeT0iNTkiIHI9IjYiIGZpbGw9IiMyOUFCRTIiLz48Y2lyY2xlIGN4PSIzODYiIGN5PSI1OSIgcj0iNiIgZmlsbD0iIzI5QUJFMiIvPgoKICA8IS0tIE1FU0ggVE9QT0xPR1kgLS0+CiAgPHRleHQgeD0iNDkwIiB5PSI1MCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC1zaXplPSIxMCIgZm9udC13ZWlnaHQ9ImJvbGQiIGZpbGw9IiMwMzY5QTEiPk1lc2g8L3RleHQ+CiAgPGNpcmNsZSBjeD0iNDcwIiBjeT0iNjUiIHI9IjciIGZpbGw9IiMyOUFCRTIiLz4KICA8Y2lyY2xlIGN4PSI1MTAiIGN5PSI2NSIgcj0iNyIgZmlsbD0iIzI5QUJFMiIvPgogIDxjaXJjbGUgY3g9IjQ3MCIgY3k9IjEwNSIgcj0iNyIgZmlsbD0iIzI5QUJFMiIvPgogIDxjaXJjbGUgY3g9IjUxMCIgY3k9IjEwNSIgcj0iNyIgZmlsbD0iIzI5QUJFMiIvPgogIDxsaW5lIHgxPSI0NzciIHkxPSI2NSIgeDI9IjUwMyIgeTI9IjY1IiBzdHJva2U9IiMwRUE1RTkiIHN0cm9rZS13aWR0aD0iMS41Ii8+CiAgPGxpbmUgeDE9IjQ3NyIgeTE9IjEwNSIgeDI9IjUwMyIgeTI9IjEwNSIgc3Ryb2tlPSIjMEVBNUU5IiBzdHJva2Utd2lkdGg9IjEuNSIvPgogIDxsaW5lIHgxPSI0NzAiIHkxPSI3MiIgeDI9IjQ3MCIgeTI9Ijk4IiBzdHJva2U9IiMwRUE1RTkiIHN0cm9rZS13aWR0aD0iMS41Ii8+CiAgPGxpbmUgeDE9IjUxMCIgeTE9IjcyIiB4Mj0iNTEwIiB5Mj0iOTgiIHN0cm9rZT0iIzBFQTVFOSIgc3Ryb2tlLXdpZHRoPSIxLjUiLz4KICA8bGluZSB4MT0iNDc2IiB5MT0iNzAiIHgyPSI1MDQiIHkyPSIxMDAiIHN0cm9rZT0iIzBFQTVFOSIgc3Ryb2tlLXdpZHRoPSIxIiBzdHJva2UtZGFzaGFycmF5PSIzLDIiLz4KICA8bGluZSB4MT0iNTA0IiB5MT0iNzAiIHgyPSI0NzYiIHkyPSIxMDAiIHN0cm9rZT0iIzBFQTVFOSIgc3Ryb2tlLXdpZHRoPSIxIiBzdHJva2UtZGFzaGFycmF5PSIzLDIiLz4KCiAgPCEtLSBMZWdlbmQgLS0+CiAgPHJlY3QgeD0iMTAiIHk9IjE5MCIgd2lkdGg9IjU0MCIgaGVpZ2h0PSI2MCIgcng9IjYiIGZpbGw9IndoaXRlIiBzdHJva2U9IiNEOUU5RjIiIHN0cm9rZS13aWR0aD0iMSIvPgogIDx0ZXh0IHg9IjI4MCIgeT0iMjA3IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LXNpemU9IjEwIiBmb250LXdlaWdodD0iYm9sZCIgZmlsbD0iIzQ3NTU2OSI+S2V0ZXJhbmdhbjo8L3RleHQ+CiAgPGNpcmNsZSBjeD0iMzAiIGN5PSIyMjIiIHI9IjUiIGZpbGw9IiMyOUFCRTIiLz4KICA8dGV4dCB4PSI0MCIgeT0iMjI2IiBmb250LXNpemU9IjkiIGZpbGw9IiMzMzQxNTUiPk5vZGUvUEM8L3RleHQ+CiAgPHJlY3QgeD0iOTAiIHk9IjIxNyIgd2lkdGg9IjEyIiBoZWlnaHQ9IjEwIiByeD0iMiIgZmlsbD0iIzEwQjk4MSIvPgogIDx0ZXh0IHg9IjEwNyIgeT0iMjI2IiBmb250LXNpemU9IjkiIGZpbGw9IiMzMzQxNTUiPlN3aXRjaC9IdWIgKFN0YXIpPC90ZXh0PgogIDxsaW5lIHgxPSIyMjAiIHkxPSIyMjIiIHgyPSIyNDAiIHkyPSIyMjIiIHN0cm9rZT0iIzBFQTVFOSIgc3Ryb2tlLXdpZHRoPSIyIi8+CiAgPHRleHQgeD0iMjQ2IiB5PSIyMjYiIGZvbnQtc2l6ZT0iOSIgZmlsbD0iIzMzNDE1NSI+S2FiZWwgbGFuZ3N1bmc8L3RleHQ+CiAgPGxpbmUgeDE9IjM0MCIgeTE9IjIyMiIgeDI9IjM2MCIgeTI9IjIyMiIgc3Ryb2tlPSIjNjQ3NDhCIiBzdHJva2Utd2lkdGg9IjEuNSIgc3Ryb2tlLWRhc2hhcnJheT0iNCwyIi8+CiAgPHRleHQgeD0iMzY2IiB5PSIyMjYiIGZvbnQtc2l6ZT0iOSIgZmlsbD0iIzMzNDE1NSI+S2FiZWwgb3BzaW9uYWwgKE1lc2gpPC90ZXh0PgogIDxyZWN0IHg9IjE1MCIgeT0iMjM1IiB3aWR0aD0iMjYwIiBoZWlnaHQ9IjE0IiByeD0iNCIgZmlsbD0iI0QxRkFFNSIvPgogIDx0ZXh0IHg9IjI4MCIgeT0iMjQ1IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LXNpemU9IjkiIGZpbGw9IiMwNjVGNDYiIGZvbnQtd2VpZ2h0PSJib2xkIj7imIUgU3RhciBhZGFsYWggdG9wb2xvZ2kgcGFsaW5nIHVtdW0gZGkgamFyaW5nYW4gcnVtYWhhbiAoV2lGaSByb3V0ZXIgPSBodWIgcHVzYXQpPC90ZXh0Pgo8L3N2Zz4=",
    imageAlt: "Diagram berbagai topologi jaringan komputer: Bus, Ring, Star (paling umum di rumahan), dan Mesh",
    options: [
      { id: "a", text: "Topologi Bus" },
      { id: "b", text: "Topologi Ring" },
      { id: "c", text: "Topologi Star" },
      { id: "d", text: "Topologi Mesh" },
    ],
    correctAnswer: "c",
    correctAnswers: null,
    points: 10,
    hint: null,
  },
  {
    id: "q14",
    number: 14,
    type: "latex" as const,
    text: "Perhatikan grafik di bawah ini yang menunjukkan fungsi $f(x) = x^3 - 3x$. Berdasarkan grafik tersebut, tentukan nilai $\\int_{0}^{2} f(x)\\,dx$.",
    image: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0MjAgMjgwIiB3aWR0aD0iNDIwIiBoZWlnaHQ9IjI4MCIgZm9udC1mYW1pbHk9IkFyaWFsLHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTEiPgogIDxyZWN0IHdpZHRoPSI0MjAiIGhlaWdodD0iMjgwIiBmaWxsPSIjZjhmYWZjIiByeD0iOCIvPgogIDx0ZXh0IHg9IjIxMCIgeT0iMjIiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtc2l6ZT0iMTMiIGZvbnQtd2VpZ2h0PSJib2xkIiBmaWxsPSIjMUMzMDNEIj5HcmFmaWsgZih4KSA9IHjCsyDiiJIgM3g8L3RleHQ+CgogIDwhLS0gR3JpZCAtLT4KICA8ZGVmcz4KICAgIDxwYXR0ZXJuIGlkPSJncmlkIiB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHBhdHRlcm5Vbml0cz0idXNlclNwYWNlT25Vc2UiPgogICAgICA8cGF0aCBkPSJNIDQwIDAgTCAwIDAgMCA0MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjRTJFOEYwIiBzdHJva2Utd2lkdGg9IjAuOCIvPgogICAgPC9wYXR0ZXJuPgogIDwvZGVmcz4KICA8cmVjdCB4PSI1MCIgeT0iMzAiIHdpZHRoPSIzMjAiIGhlaWdodD0iMjEwIiBmaWxsPSJ1cmwoI2dyaWQpIi8+CiAgPHJlY3QgeD0iNTAiIHk9IjMwIiB3aWR0aD0iMzIwIiBoZWlnaHQ9IjIxMCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjQ0JENUUxIiBzdHJva2Utd2lkdGg9IjEuNSIgcng9IjQiLz4KCiAgPCEtLSBBeGVzIC0tPgogIDxsaW5lIHgxPSI1MCIgeTE9IjE0MCIgeDI9IjM3MCIgeTI9IjE0MCIgc3Ryb2tlPSIjMzc0MTUxIiBzdHJva2Utd2lkdGg9IjIiLz4KICA8bGluZSB4MT0iMTcwIiB5MT0iMzAiIHgyPSIxNzAiIHkyPSIyNDAiIHN0cm9rZT0iIzM3NDE1MSIgc3Ryb2tlLXdpZHRoPSIyIi8+CiAgPCEtLSBBcnJvdyBoZWFkcyAtLT4KICA8cG9seWdvbiBwb2ludHM9IjM3MCwxMzYgMzgwLDE0MCAzNzAsMTQ0IiBmaWxsPSIjMzc0MTUxIi8+CiAgPHBvbHlnb24gcG9pbnRzPSIxNjYsMzAgMTcwLDIwIDE3NCwzMCIgZmlsbD0iIzM3NDE1MSIvPgogIDx0ZXh0IHg9IjM4NSIgeT0iMTQ0IiBmb250LXNpemU9IjEyIiBmaWxsPSIjMzc0MTUxIiBmb250LXdlaWdodD0iYm9sZCI+eDwvdGV4dD4KICA8dGV4dCB4PSIxNjIiIHk9IjE2IiBmb250LXNpemU9IjEyIiBmaWxsPSIjMzc0MTUxIiBmb250LXdlaWdodD0iYm9sZCI+eTwvdGV4dD4KCiAgPCEtLSBYIGF4aXMgbGFiZWxzOiAtMyB0byAzIC0tPgogIDx0ZXh0IHg9IjUwIiB5PSIxNTgiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtc2l6ZT0iMTAiIGZpbGw9IiM2NDc0OEIiPi0zPC90ZXh0PgogIDx0ZXh0IHg9IjkwIiB5PSIxNTgiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtc2l6ZT0iMTAiIGZpbGw9IiM2NDc0OEIiPi0yPC90ZXh0PgogIDx0ZXh0IHg9IjEzMCIgeT0iMTU4IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LXNpemU9IjEwIiBmaWxsPSIjNjQ3NDhCIj4tMTwvdGV4dD4KICA8dGV4dCB4PSIxNzAiIHk9IjE1OCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC1zaXplPSIxMCIgZmlsbD0iIzY0NzQ4QiI+MDwvdGV4dD4KICA8dGV4dCB4PSIyMTAiIHk9IjE1OCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC1zaXplPSIxMCIgZmlsbD0iIzY0NzQ4QiI+MTwvdGV4dD4KICA8dGV4dCB4PSIyNTAiIHk9IjE1OCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC1zaXplPSIxMCIgZmlsbD0iIzY0NzQ4QiI+MjwvdGV4dD4KICA8dGV4dCB4PSIyOTAiIHk9IjE1OCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC1zaXplPSIxMCIgZmlsbD0iIzY0NzQ4QiI+MzwvdGV4dD4KICA8IS0tIFkgYXhpcyBsYWJlbHMgLS0+CiAgPHRleHQgeD0iNDQiIHk9IjYwIiB0ZXh0LWFuY2hvcj0iZW5kIiBmb250LXNpemU9IjkiIGZpbGw9IiM2NDc0OEIiPjg8L3RleHQ+CiAgPHRleHQgeD0iNDQiIHk9IjEwMCIgdGV4dC1hbmNob3I9ImVuZCIgZm9udC1zaXplPSI5IiBmaWxsPSIjNjQ3NDhCIj40PC90ZXh0PgogIDx0ZXh0IHg9IjQ0IiB5PSIxODAiIHRleHQtYW5jaG9yPSJlbmQiIGZvbnQtc2l6ZT0iOSIgZmlsbD0iIzY0NzQ4QiI+LTQ8L3RleHQ+CiAgPHRleHQgeD0iNDQiIHk9IjIyMCIgdGV4dC1hbmNob3I9ImVuZCIgZm9udC1zaXplPSI5IiBmaWxsPSIjNjQ3NDhCIj4tODwvdGV4dD4KICA8IS0tIEdyaWQgbWFya3Mgb24gYXhlcyAtLT4KICA8bGluZSB4MT0iNTAiIHkxPSIxMzciIHgyPSI1MCIgeTI9IjE0MyIgc3Ryb2tlPSIjMzc0MTUxIiBzdHJva2Utd2lkdGg9IjEuNSIvPgogIDxsaW5lIHgxPSI5MCIgeTE9IjEzNyIgeDI9IjkwIiB5Mj0iMTQzIiBzdHJva2U9IiMzNzQxNTEiIHN0cm9rZS13aWR0aD0iMS41Ii8+CiAgPGxpbmUgeDE9IjEzMCIgeTE9IjEzNyIgeDI9IjEzMCIgeTI9IjE0MyIgc3Ryb2tlPSIjMzc0MTUxIiBzdHJva2Utd2lkdGg9IjEuNSIvPgogIDxsaW5lIHgxPSIyMTAiIHkxPSIxMzciIHgyPSIyMTAiIHkyPSIxNDMiIHN0cm9rZT0iIzM3NDE1MSIgc3Ryb2tlLXdpZHRoPSIxLjUiLz4KICA8bGluZSB4MT0iMjUwIiB5MT0iMTM3IiB4Mj0iMjUwIiB5Mj0iMTQzIiBzdHJva2U9IiMzNzQxNTEiIHN0cm9rZS13aWR0aD0iMS41Ii8+CiAgPGxpbmUgeDE9IjI5MCIgeTE9IjEzNyIgeDI9IjI5MCIgeTI9IjE0MyIgc3Ryb2tlPSIjMzc0MTUxIiBzdHJva2Utd2lkdGg9IjEuNSIvPgogIDxsaW5lIHgxPSIzMzAiIHkxPSIxMzciIHgyPSIzMzAiIHkyPSIxNDMiIHN0cm9rZT0iIzM3NDE1MSIgc3Ryb2tlLXdpZHRoPSIxLjUiLz4KICA8bGluZSB4MT0iMTY3IiB5MT0iNjAiIHgyPSIxNzMiIHkyPSI2MCIgc3Ryb2tlPSIjMzc0MTUxIiBzdHJva2Utd2lkdGg9IjEuNSIvPgogIDxsaW5lIHgxPSIxNjciIHkxPSIxMDAiIHgyPSIxNzMiIHkyPSIxMDAiIHN0cm9rZT0iIzM3NDE1MSIgc3Ryb2tlLXdpZHRoPSIxLjUiLz4KICA8bGluZSB4MT0iMTY3IiB5MT0iMTgwIiB4Mj0iMTczIiB5Mj0iMTgwIiBzdHJva2U9IiMzNzQxNTEiIHN0cm9rZS13aWR0aD0iMS41Ii8+CiAgPGxpbmUgeDE9IjE2NyIgeTE9IjIyMCIgeDI9IjE3MyIgeTI9IjIyMCIgc3Ryb2tlPSIjMzc0MTUxIiBzdHJva2Utd2lkdGg9IjEuNSIvPgoKICA8IS0tIFNoYWRlZCByZWdpb24gZnJvbSB4PTAgdG8geD0yIChpbnRlZ3JhbCByZWdpb24pIC0tPgogIDwhLS0gZih4KSA9IHjCsyAtIDN4LCBzY2FsZTogMSB1bml0ID0gNDBweCwgb3JpZ2luIGF0ICgxNzAsIDE0MCkgLS0+CiAgPCEtLSBTVkcgeSBpcyBpbnZlcnRlZDogeV9zdmcgPSAxNDAgLSBmKHgpKjEwIC0tPgogIDwhLS0gQXQgeD0wOiBmPTAsIHk9MTQwIHwgeD0wLjU6IGY9LTEuMzc1LCB5PTE1NCB8IHg9MTogZj0tMiwgeT0xNjAgfCB4PTEuNTogZj0tMS4xMjUsIHk9MTUxIHwgeD0yOiBmPTIsIHk9MTIwIC0tPgogIDxwYXRoIGQ9Ik0xNzAsMTQwIFExOTAsMTU0IDIxMCwxNjAgUTIzMCwxNTEgMjUwLDEyMCBMMjUwLDE0MCBaIiBmaWxsPSJyZ2JhKDQxLDE3MSwyMjYsMC4yMCkiIHN0cm9rZT0ibm9uZSIvPgogIDx0ZXh0IHg9IjIxNSIgeT0iMTUyIiBmb250LXNpemU9IjkiIGZpbGw9IiMwMzY5QTEiIGZvbnQtd2VpZ2h0PSJib2xkIj7iiKvigoDCsiBmKHgpZHg8L3RleHQ+CgogIDwhLS0gQ3ViaWMgY3VydmUgZih4KSA9IHjCsyAtIDN4IHBsb3R0ZWQgdmlhIFNWRyBwYXRoIChwYXJhbWV0cmljLCB4IGZyb20gLTMgdG8gMykgLS0+CiAgPCEtLSBvcmlnaW4gKDE3MCwxNDApLCBzY2FsZSA0MHB4L3VuaXQgZm9yIHgsIDEwcHgvdW5pdCBmb3IgeSAoY2xhbXBlZCkgLS0+CiAgPCEtLSAoLTMsIC0xOOKGkmNsYW1wKSwgKC0yLjUsLTkuNCksICgtMiwtMiksICgtMS41LDIuNjI1KSwgKC0xLDIpLCAoLS41LC4zNzUpLCAoMCwwKSwgKC41LC0xLjM3NSksICgxLC0yKSwgKDEuNSwtMS4xMjUpLCAoMiwyKSwgKDIuNSw5LjM3NSksICgzLDE44oaSY2xhbXApIC0tPgogIDxwYXRoIGQ9Ik01MCwyMzAgQzcwLDIyMCA5MCwxOTcgOTAsMTk4IEMxMTAsMTk5IDEyMCwxNzcgMTMwLDExNCBDMTQwLDUxIDE1MCw4OSAxNzAsMTQwIEMxOTAsMTkxIDIwMCwxNjAgMjEwLDE2MCBDMjIwLDE2MCAyMzAsMTU1IDI1MCwxMjAgQzI3MCw4NSAyODAsNTMgMzEwLDUzIiBmaWxsPSJub25lIiBzdHJva2U9IiMyNTYzRUIiIHN0cm9rZS13aWR0aD0iMi41IiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+CgogIDwhLS0gTG9jYWwgbWF4OiB4PS0xLCBmPTIg4oaSIFNWRzogKDEzMCwgMTIwKSAtLT4KICA8Y2lyY2xlIGN4PSIxMzAiIGN5PSIxMjAiIHI9IjQiIGZpbGw9IiNFMDUwNTAiLz4KICA8dGV4dCB4PSIxMzIiIHk9IjExNSIgZm9udC1zaXplPSI5IiBmaWxsPSIjRTA1MDUwIj5tYXggKC0xLCAyKTwvdGV4dD4KICA8IS0tIExvY2FsIG1pbjogeD0xLCBmPS0yIOKGkiBTVkc6ICgyMTAsIDE2MCkgLS0+CiAgPGNpcmNsZSBjeD0iMjEwIiBjeT0iMTYwIiByPSI0IiBmaWxsPSIjRTA1MDUwIi8+CiAgPHRleHQgeD0iMjE0IiB5PSIxNzQiIGZvbnQtc2l6ZT0iOSIgZmlsbD0iI0UwNTA1MCI+bWluICgxLCAtMik8L3RleHQ+CiAgPCEtLSBaZXJvIGNyb3NzaW5nczogeD0t4oiaM+KJiC0xLjczICh4X3N2Zz0xMDApLCB4PTAgKDE3MCksIHg94oiaM+KJiDEuNzMgKDI0MCkgLS0+CiAgPGNpcmNsZSBjeD0iMTAwIiBjeT0iMTQwIiByPSIzIiBmaWxsPSIjMzc0MTUxIi8+CiAgPGNpcmNsZSBjeD0iMTcwIiBjeT0iMTQwIiByPSIzIiBmaWxsPSIjMzc0MTUxIi8+CiAgPGNpcmNsZSBjeD0iMjM5IiBjeT0iMTQwIiByPSIzIiBmaWxsPSIjMzc0MTUxIi8+CgogIDwhLS0gSW50ZWdyYWwgYm91bmRzIHZlcnRpY2FsIGxpbmVzIC0tPgogIDxsaW5lIHgxPSIxNzAiIHkxPSIxMjAiIHgyPSIxNzAiIHkyPSIxNTUiIHN0cm9rZT0iIzAyODRDNyIgc3Ryb2tlLXdpZHRoPSIxLjUiIHN0cm9rZS1kYXNoYXJyYXk9IjQsMiIvPgogIDxsaW5lIHgxPSIyNTAiIHkxPSIxMTAiIHgyPSIyNTAiIHkyPSIxNDUiIHN0cm9rZT0iIzAyODRDNyIgc3Ryb2tlLXdpZHRoPSIxLjUiIHN0cm9rZS1kYXNoYXJyYXk9IjQsMiIvPgoKICA8IS0tIExlZ2VuZCAtLT4KICA8cmVjdCB4PSI1MiIgeT0iMjQ4IiB3aWR0aD0iMzE2IiBoZWlnaHQ9IjI0IiByeD0iNSIgZmlsbD0id2hpdGUiIHN0cm9rZT0iI0Q5RTlGMiIgc3Ryb2tlLXdpZHRoPSIxIi8+CiAgPGxpbmUgeDE9IjY0IiB5MT0iMjYwIiB4Mj0iODQiIHkyPSIyNjAiIHN0cm9rZT0iIzI1NjNFQiIgc3Ryb2tlLXdpZHRoPSIyLjUiLz4KICA8dGV4dCB4PSI5MCIgeT0iMjY0IiBmb250LXNpemU9IjkiIGZpbGw9IiMzNzQxNTEiPmYoeCkgPSB4wrMg4oiSIDN4PC90ZXh0PgogIDxyZWN0IHg9IjE2MCIgeT0iMjUzIiB3aWR0aD0iMTIiIGhlaWdodD0iMTIiIHJ4PSIyIiBmaWxsPSJyZ2JhKDQxLDE3MSwyMjYsMC4zKSIgc3Ryb2tlPSIjMEVBNUU5IiBzdHJva2Utd2lkdGg9IjEiLz4KICA8dGV4dCB4PSIxNzYiIHk9IjI2NCIgZm9udC1zaXplPSI5IiBmaWxsPSIjMzc0MTUxIj5BcmVhIGludGVncmFsIFswLCAyXTwvdGV4dD4KICA8Y2lyY2xlIGN4PSIyODAiIGN5PSIyNjAiIHI9IjQiIGZpbGw9IiNFMDUwNTAiLz4KICA8dGV4dCB4PSIyODgiIHk9IjI2NCIgZm9udC1zaXplPSI5IiBmaWxsPSIjMzc0MTUxIj5UaXRpayBrcml0aXM8L3RleHQ+Cjwvc3ZnPg==",
    imageAlt: "Grafik fungsi kubik f(x) = x³ − 3x dengan daerah yang diarsir antara x = 0 dan x = 2",
    options: [
      { id: "a", text: "$-1$" },
      { id: "b", text: "$0$" },
      { id: "c", text: "$1$" },
      { id: "d", text: "$2$" },
    ],
    correctAnswer: "a",
    correctAnswers: null,
    points: 25,
    hint: "Gunakan $\\int_0^2 (x^3 - 3x)\\,dx = \\left[\\dfrac{x^4}{4} - \\dfrac{3x^2}{2}\\right]_0^2 = 4 - 6 = -2$. Periksa kembali batas integralmu.",
  },

];

export const mockStudentAnswers = [
  { questionId: "q1", selectedAnswer: "b" },
  { questionId: "q2", selectedAnswer: "c" },
  { questionId: "q3", selectedAnswer: null },
  { questionId: "q4", selectedAnswer: null },
  { questionId: "q5", selectedAnswer: null },
];

export const mockExamSession = {
  examTitle: "UTS Pemrograman Web 2026",
  studentName: "Siti Nurhaliza",
  studentNim: "1301210001",
  duration: 90 * 60, // seconds
  totalQuestions: 12,
  code: "PWB-2026-UTS",
  teacher: "Dr. Budi Santoso, M.Kom",
  class: "TI-4A / Teknik Informatika",
  startTime: "2026-10-14T08:00:00+07:00",
};

// =====================================================
// QUESTION BANK (BANK SOAL)
// =====================================================
export type QuestionBankStatus = "active" | "draft" | "archived";
export type DifficultyLevel = "easy" | "medium" | "hard" | "mixed";

export interface QuestionBank {
  id: string;
  title: string;
  subject: string;
  description: string | null;
  tags: string[];
  questionCount: number;
  difficulty: DifficultyLevel;
  status: QuestionBankStatus;
  createdAt: string;
  updatedAt: string;
  usedInExams: number;
  totalPoints: number;
  createdBy: string;
}

export const mockQuestionBanks: QuestionBank[] = [
  {
    id: "qb-1",
    title: "Soal UTS Pemrograman Web",
    subject: "Pemrograman Web",
    description: "Kumpulan soal untuk UTS mata kuliah Pemrograman Web. Mencakup materi HTML, CSS, JavaScript, dan React dasar.",
    tags: ["HTML", "CSS", "JavaScript", "React"],
    questionCount: 25,
    difficulty: "medium",
    status: "active",
    createdAt: "2026-10-01",
    updatedAt: "2026-10-05",
    usedInExams: 3,
    totalPoints: 250,
    createdBy: "Dr. Ahmad Fauzi, S.T.",
  },
  {
    id: "qb-2",
    title: "Bank Soal Basis Data Lanjut",
    subject: "Basis Data",
    description: "Soal-soal komprehensif untuk UAS Basis Data, meliputi SQL, normalisasi, dan desain ERD.",
    tags: ["SQL", "Normalisasi", "ERD", "Transaksi"],
    questionCount: 40,
    difficulty: "hard",
    status: "active",
    createdAt: "2026-09-15",
    updatedAt: "2026-10-08",
    usedInExams: 1,
    totalPoints: 480,
    createdBy: "Dr. Ahmad Fauzi, S.T.",
  },
  {
    id: "qb-3",
    title: "Kuis Algoritma & Rekursi",
    subject: "Algoritma & Struktur Data",
    description: "Soal kuis singkat topik rekursi, dynamic programming, dan kompleksitas algoritma.",
    tags: ["Rekursi", "Dynamic Programming", "Sorting"],
    questionCount: 15,
    difficulty: "medium",
    status: "active",
    createdAt: "2026-09-20",
    updatedAt: "2026-09-28",
    usedInExams: 5,
    totalPoints: 150,
    createdBy: "Dr. Ahmad Fauzi, S.T.",
  },
  {
    id: "qb-4",
    title: "Soal Jaringan Komputer Dasar",
    subject: "Jaringan Komputer",
    description: "Materi dasar jaringan komputer: topologi, protokol TCP/IP, dan subnetting.",
    tags: ["TCP/IP", "Topologi", "Subnetting", "OSI Model"],
    questionCount: 20,
    difficulty: "easy",
    status: "active",
    createdAt: "2026-08-10",
    updatedAt: "2026-08-15",
    usedInExams: 2,
    totalPoints: 200,
    createdBy: "Dr. Ahmad Fauzi, S.T.",
  },
  {
    id: "qb-5",
    title: "Matematika Diskret — Draft",
    subject: "Matematika Diskret",
    description: "Bank soal logika proposisional, teori himpunan, dan kombinatorik. Masih dalam pengembangan.",
    tags: ["Logika", "Himpunan", "Kombinatorik", "Graf"],
    questionCount: 12,
    difficulty: "hard",
    status: "draft",
    createdAt: "2026-10-20",
    updatedAt: "2026-10-22",
    usedInExams: 0,
    totalPoints: 240,
    createdBy: "Dr. Ahmad Fauzi, S.T.",
  },
  {
    id: "qb-6",
    title: "Soal Sistem Operasi 2025",
    subject: "Sistem Operasi",
    description: "Soal SO tahun lalu mencakup proses, thread, deadlock, dan manajemen memori.",
    tags: ["Proses", "Thread", "Deadlock", "Memori"],
    questionCount: 30,
    difficulty: "mixed",
    status: "archived",
    createdAt: "2025-10-01",
    updatedAt: "2025-11-15",
    usedInExams: 4,
    totalPoints: 300,
    createdBy: "Dr. Ahmad Fauzi, S.T.",
  },
];

export const violationIcons: Record<string, { icon: string; label: string; color: string }> = {
  fullscreen_exit: { icon: "⛶", label: "Fullscreen Exit", color: "#EA580C" },
  window_blur: { icon: "🪟", label: "Window Blur", color: "#D97706" },
  tab_switch: { icon: "🔁", label: "Tab Switch", color: "#DC2626" },
  copy_attempt: { icon: "📋", label: "Copy Attempt", color: "#DC2626" },
  paste_attempt: { icon: "📌", label: "Paste Attempt", color: "#DC2626" },
  right_click: { icon: "🖱️", label: "Right Click", color: "#6B7280" },
  devtools: { icon: "🔧", label: "DevTools Buka", color: "#DC2626" },
  reconnect: { icon: "🔄", label: "Reconnect", color: "#0284C7" },
  heartbeat_lost: { icon: "💔", label: "Heartbeat Lost", color: "#9CA3AF" },
};
