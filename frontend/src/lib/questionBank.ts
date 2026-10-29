export type QuestionBankStatus = "active" | "draft" | "archived";
export type DifficultyLevel = "easy" | "medium" | "hard" | "mixed";
export type QuestionType = "single_choice" | "multi_select" | "latex";

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

export interface BankQuestionOption {
  id: string; // 'a', 'b', 'c', ...
  label: string; // 'A', 'B', 'C', ...
  text: string;
  imageUrl?: string | null;
}

export interface BankQuestion {
  id: string;
  bankId: string;
  orderIndex: number;
  type: QuestionType;
  questionText: string;
  imageUrl?: string | null;
  imageAlt?: string | null;
  options: BankQuestionOption[];
  correctAnswer?: string | null; // Untuk single_choice dan latex ('a')
  correctAnswers?: string[] | null; // Untuk multi_select (['a', 'c'])
  points: number;
  hint?: string | null;
  createdAt: string;
  updatedAt: string;
}

export const defaultQuestionBanks: QuestionBank[] = [
  {
    id: "qb-1",
    title: "Soal UTS Pemrograman Web",
    subject: "Pemrograman Web",
    description: "Kumpulan soal untuk UTS mata kuliah Pemrograman Web. Mencakup materi HTML, CSS, JavaScript, dan React dasar.",
    tags: ["HTML", "CSS", "JavaScript", "React"],
    questionCount: 6,
    difficulty: "medium",
    status: "active",
    createdAt: "2026-10-01",
    updatedAt: "2026-10-05",
    usedInExams: 3,
    totalPoints: 75,
    createdBy: "Dr. Ahmad Fauzi, S.T.",
  },
  {
    id: "qb-2",
    title: "Bank Soal Basis Data Lanjut",
    subject: "Basis Data",
    description: "Soal-soal komprehensif untuk UAS Basis Data, meliputi SQL, normalisasi, dan desain ERD.",
    tags: ["SQL", "Normalisasi", "ERD", "Transaksi"],
    questionCount: 3,
    difficulty: "hard",
    status: "active",
    createdAt: "2026-09-15",
    updatedAt: "2026-10-08",
    usedInExams: 1,
    totalPoints: 40,
    createdBy: "Dr. Ahmad Fauzi, S.T.",
  },
  {
    id: "qb-3",
    title: "Kuis Algoritma & Rekursi",
    subject: "Algoritma & Struktur Data",
    description: "Soal kuis singkat topik rekursi, dynamic programming, dan kompleksitas algoritma.",
    tags: ["Rekursi", "Dynamic Programming", "Sorting"],
    questionCount: 3,
    difficulty: "medium",
    status: "active",
    createdAt: "2026-09-20",
    updatedAt: "2026-09-28",
    usedInExams: 5,
    totalPoints: 35,
    createdBy: "Dr. Ahmad Fauzi, S.T.",
  },
  {
    id: "qb-4",
    title: "Soal Jaringan Komputer Dasar",
    subject: "Jaringan Komputer",
    description: "Materi dasar jaringan komputer: topologi, protokol TCP/IP, dan subnetting.",
    tags: ["TCP/IP", "Topologi", "Subnetting", "OSI Model"],
    questionCount: 2,
    difficulty: "easy",
    status: "active",
    createdAt: "2026-08-10",
    updatedAt: "2026-08-15",
    usedInExams: 2,
    totalPoints: 20,
    createdBy: "Dr. Ahmad Fauzi, S.T.",
  },
  {
    id: "qb-5",
    title: "Matematika Diskret & Kalkulus",
    subject: "Matematika",
    description: "Bank soal logika proposisional, kalkulus, dan teori fungsi dengan notasi formula KaTeX.",
    tags: ["Logika", "Kalkulus", "Turunan", "Limit"],
    questionCount: 4,
    difficulty: "hard",
    status: "draft",
    createdAt: "2026-10-20",
    updatedAt: "2026-10-22",
    usedInExams: 0,
    totalPoints: 80,
    createdBy: "Dr. Ahmad Fauzi, S.T.",
  },
  {
    id: "qb-6",
    title: "Soal Sistem Operasi 2025",
    subject: "Sistem Operasi",
    description: "Soal SO tahun lalu mencakup proses, thread, deadlock, dan manajemen memori.",
    tags: ["Proses", "Thread", "Deadlock", "Memori"],
    questionCount: 2,
    difficulty: "mixed",
    status: "archived",
    createdAt: "2025-10-01",
    updatedAt: "2025-11-15",
    usedInExams: 4,
    totalPoints: 20,
    createdBy: "Dr. Ahmad Fauzi, S.T.",
  },
];

export const defaultBankQuestions: BankQuestion[] = [
  // ── qb-1: Pemrograman Web ──────────────────────────────────────
  {
    id: "bq-1",
    bankId: "qb-1",
    orderIndex: 1,
    type: "single_choice",
    questionText: "Apa fungsi utama dari elemen semantic <header> dalam dokumen HTML5?",
    imageUrl: null,
    imageAlt: null,
    options: [
      { id: "a", label: "A", text: "Menentukan bagian pengantar atau navigasi dalam halaman atau artikel" },
      { id: "b", label: "B", text: "Memuat metadata halaman seperti title dan link CSS" },
      { id: "c", label: "C", text: "Menampilkan teks dengan ukuran terbesar (heading level 1)" },
      { id: "d", label: "D", text: "Menyediakan footer hak cipta halaman web" },
    ],
    correctAnswer: "a",
    correctAnswers: null,
    points: 10,
    hint: "Elemen <header> biasanya berisi heading, logo, atau menu navigasi.",
    createdAt: "2026-10-01",
    updatedAt: "2026-10-01",
  },
  {
    id: "bq-2",
    bankId: "qb-1",
    orderIndex: 2,
    type: "single_choice",
    questionText: "Properti CSS mana yang digunakan untuk mengubah tata letak anak elemen menjadi flexbox container?",
    imageUrl: null,
    imageAlt: null,
    options: [
      { id: "a", label: "A", text: "position: flex;" },
      { id: "b", label: "B", text: "display: flex;" },
      { id: "c", label: "C", text: "flex-direction: row;" },
      { id: "d", label: "D", text: "align-items: center;" },
    ],
    correctAnswer: "b",
    correctAnswers: null,
    points: 10,
    hint: "Gunakan properti display dengan nilai flex.",
    createdAt: "2026-10-02",
    updatedAt: "2026-10-02",
  },
  {
    id: "bq-3",
    bankId: "qb-1",
    orderIndex: 3,
    type: "single_choice",
    questionText: "Dalam JavaScript, metode array apa yang digunakan untuk menyaring elemen berdasarkan kondisi logika tertentu?",
    imageUrl: null,
    imageAlt: null,
    options: [
      { id: "a", label: "A", text: "array.map()" },
      { id: "b", label: "B", text: "array.find()" },
      { id: "c", label: "C", text: "array.filter()" },
      { id: "d", label: "D", text: "array.reduce()" },
    ],
    correctAnswer: "c",
    correctAnswers: null,
    points: 10,
    hint: "Metode filter() mengembalikan array baru berisi elemen yang lolos kondisi callback.",
    createdAt: "2026-10-03",
    updatedAt: "2026-10-03",
  },
  {
    id: "bq-4",
    bankId: "qb-1",
    orderIndex: 4,
    type: "multi_select",
    questionText: "Pilih SEMUA pernyataan yang benar mengenai JavaScript ES6+. (Pilihan bisa lebih dari satu)",
    imageUrl: null,
    imageAlt: null,
    options: [
      { id: "a", label: "A", text: "Variabel 'const' tidak dapat di-reassign ke nilai baru" },
      { id: "b", label: "B", text: "Arrow function '() => {}' memiliki binding 'this' leksikal" },
      { id: "c", label: "C", text: "Destructuring hanya bekerja pada array, tidak bisa pada object" },
      { id: "d", label: "D", text: "Promise dapat berada pada status: pending, fulfilled, atau rejected" },
      { id: "e", label: "E", text: "Template literals menggunakan tanda backtick (`) dan mendukung interpolasi ${}" },
    ],
    correctAnswer: null,
    correctAnswers: ["a", "b", "d", "e"],
    points: 15,
    hint: "Ingat bahwa destructuring object sangat umum digunakan di JavaScript modern.",
    createdAt: "2026-10-04",
    updatedAt: "2026-10-04",
  },
  {
    id: "bq-5",
    bankId: "qb-1",
    orderIndex: 5,
    type: "multi_select",
    questionText: "Manakah komponen yang termasuk ke dalam CSS Box Model standar? (Pilih semua yang benar)",
    imageUrl: null,
    imageAlt: null,
    options: [
      { id: "a", label: "A", text: "Content" },
      { id: "b", label: "B", text: "Padding" },
      { id: "c", label: "C", text: "Border" },
      { id: "d", label: "D", text: "Margin" },
      { id: "e", label: "E", text: "Font-Family" },
    ],
    correctAnswer: null,
    correctAnswers: ["a", "b", "c", "d"],
    points: 15,
    hint: "Box model terdiri dari 4 lapisan: content, padding, border, margin.",
    createdAt: "2026-10-04",
    updatedAt: "2026-10-04",
  },
  {
    id: "bq-6",
    bankId: "qb-1",
    orderIndex: 6,
    type: "single_choice",
    questionText: "Perhatikan diagram topologi jaringan berikut. Topologi manakah yang mengandalkan satu kabel utama (backbone) terpusat?",
    imageUrl: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 120' width='400' height='120'><rect width='400' height='120' fill='%23F0F9FF' rx='8'/><line x1='30' y1='60' x2='370' y2='60' stroke='%230284C7' stroke-width='4'/><circle cx='80' cy='60' r='10' fill='%2329ABE2'/><circle cx='180' cy='60' r='10' fill='%2329ABE2'/><circle cx='280' cy='60' r='10' fill='%2329ABE2'/><circle cx='340' cy='60' r='10' fill='%2329ABE2'/><text x='200' y='100' font-family='sans-serif' font-size='12' text-anchor='middle' fill='%230369A1'>Backbone Tunggal</text></svg>",
    imageAlt: "Diagram kabel pusat tunggal dengan beberapa node terhubung",
    options: [
      { id: "a", label: "A", text: "Topologi Bus" },
      { id: "b", label: "B", text: "Topologi Star" },
      { id: "c", label: "C", text: "Topologi Ring" },
      { id: "d", label: "D", text: "Topologi Mesh" },
    ],
    correctAnswer: "a",
    correctAnswers: null,
    points: 15,
    hint: "Topologi ini menggunakan kabel tunggal dengan terminator di kedua ujungnya.",
    createdAt: "2026-10-05",
    updatedAt: "2026-10-05",
  },

  // ── qb-5: Matematika Diskret & Kalkulus ──────────────────────────
  {
    id: "bq-7",
    bankId: "qb-5",
    orderIndex: 1,
    type: "latex",
    questionText: "Diketahui fungsi $f(x) = 3x^2 - 4x + 7$. Tentukan nilai turunan pertama $f'(x)$ pada titik $x = 3$.",
    imageUrl: null,
    imageAlt: null,
    options: [
      { id: "a", label: "A", text: "$f'(3) = 14$" },
      { id: "b", label: "B", text: "$f'(3) = 18$" },
      { id: "c", label: "C", text: "$f'(3) = 22$" },
      { id: "d", label: "D", text: "$f'(3) = 10$" },
    ],
    correctAnswer: "a",
    correctAnswers: null,
    points: 20,
    hint: "Turunkan fungsi: $f'(x) = 6x - 4$. Substitusikan $x = 3$: $f'(3) = 6(3) - 4 = 14$.",
    createdAt: "2026-10-20",
    updatedAt: "2026-10-20",
  },
  {
    id: "bq-8",
    bankId: "qb-5",
    orderIndex: 2,
    type: "latex",
    questionText: "Hitung nilai dari limit aljabar berikut:\n$$\\lim_{x \\to 2} \\frac{x^2 - 4}{x - 2}$$",
    imageUrl: null,
    imageAlt: null,
    options: [
      { id: "a", label: "A", text: "$0$" },
      { id: "b", label: "B", text: "$2$" },
      { id: "c", label: "C", text: "$4$" },
      { id: "d", label: "D", text: "Tidak terdefinisi" },
    ],
    correctAnswer: "c",
    correctAnswers: null,
    points: 20,
    hint: "Faktorkan pembilang: $x^2 - 4 = (x-2)(x+2)$. Coret faktor $(x-2)$, didapat $\\lim_{x \\to 2} (x+2) = 4$.",
    createdAt: "2026-10-21",
    updatedAt: "2026-10-21",
  },
  {
    id: "bq-9",
    bankId: "qb-5",
    orderIndex: 3,
    type: "latex",
    questionText: "Evaluasi nilai integral tentu berikut:\n$$\\int_{0}^{2} (3x^2 + 2x)\\, dx$$",
    imageUrl: null,
    imageAlt: null,
    options: [
      { id: "a", label: "A", text: "$10$" },
      { id: "b", label: "B", text: "$12$" },
      { id: "c", label: "C", text: "$14$" },
      { id: "d", label: "D", text: "$16$" },
    ],
    correctAnswer: "b",
    correctAnswers: null,
    points: 20,
    hint: "Antiturunan: $F(x) = x^3 + x^2$. Evaluasi $F(2) - F(0) = (8 + 4) - 0 = 12$.",
    createdAt: "2026-10-21",
    updatedAt: "2026-10-21",
  },
  {
    id: "bq-10",
    bankId: "qb-5",
    orderIndex: 4,
    type: "latex",
    questionText: "Jika himpunan $A = \\{1, 2, 3\\}$ dan $B = \\{2, 3, 4, 5\\}$, berapakah kardinalitas irisan $|A \\cap B|$?",
    imageUrl: null,
    imageAlt: null,
    options: [
      { id: "a", label: "A", text: "$1$" },
      { id: "b", label: "B", text: "$2$" },
      { id: "c", label: "C", text: "$3$" },
      { id: "d", label: "D", text: "$5$" },
    ],
    correctAnswer: "b",
    correctAnswers: null,
    points: 20,
    hint: "$A \\cap B = \\{2, 3\\}$, sehingga jumlah elemennya adalah $2$.",
    createdAt: "2026-10-22",
    updatedAt: "2026-10-22",
  },

  // ── qb-2: Basis Data Lanjut ────────────────────────────────────
  {
    id: "bq-11",
    bankId: "qb-2",
    orderIndex: 1,
    type: "single_choice",
    questionText: "Klausul SQL apa yang digunakan untuk memfilter baris sebelum pengelompokan (grouping)?",
    imageUrl: null,
    imageAlt: null,
    options: [
      { id: "a", label: "A", text: "WHERE" },
      { id: "b", label: "B", text: "HAVING" },
      { id: "c", label: "C", text: "ORDER BY" },
      { id: "d", label: "D", text: "GROUP BY" },
    ],
    correctAnswer: "a",
    correctAnswers: null,
    points: 10,
    hint: "WHERE memfilter sebelum GROUP BY, sedangkan HAVING memfilter hasil agregasi.",
    createdAt: "2026-09-15",
    updatedAt: "2026-09-15",
  },
  {
    id: "bq-12",
    bankId: "qb-2",
    orderIndex: 2,
    type: "single_choice",
    questionText: "Bentuk normal ketiga (3NF) mensyaratkan sebuah relasi telah memenuhi 2NF dan tidak memiliki ketergantungan apa?",
    imageUrl: null,
    imageAlt: null,
    options: [
      { id: "a", label: "A", text: "Ketergantungan Parsial" },
      { id: "b", label: "B", text: "Ketergantungan Transitif" },
      { id: "c", label: "C", text: "Ketergantungan Multivalued" },
      { id: "d", label: "D", text: "Ketergantungan Fungsional Penuh" },
    ],
    correctAnswer: "b",
    correctAnswers: null,
    points: 15,
    hint: "3NF menghilangkan transitive dependency non-key attributes.",
    createdAt: "2026-09-16",
    updatedAt: "2026-09-16",
  },
  {
    id: "bq-13",
    bankId: "qb-2",
    orderIndex: 3,
    type: "multi_select",
    questionText: "Pilih SEMUA sifat transaksi ACID dalam sistem manajemen basis data relasional:",
    imageUrl: null,
    imageAlt: null,
    options: [
      { id: "a", label: "A", text: "Atomicity" },
      { id: "b", label: "B", text: "Consistency" },
      { id: "c", label: "C", text: "Isolation" },
      { id: "d", label: "D", text: "Durability" },
      { id: "e", label: "E", text: "Availability" },
    ],
    correctAnswer: null,
    correctAnswers: ["a", "b", "c", "d"],
    points: 15,
    hint: "ACID: Atomicity, Consistency, Isolation, Durability.",
    createdAt: "2026-09-17",
    updatedAt: "2026-09-17",
  },

  // ── qb-3: Kuis Algoritma & Rekursi ──────────────────────────────
  {
    id: "bq-14",
    bankId: "qb-3",
    orderIndex: 1,
    type: "single_choice",
    questionText: "Komponen apa yang wajib ada dalam fungsi rekursif untuk mencegah terjadinya Infinite Recursion (Stack Overflow)?",
    imageUrl: null,
    imageAlt: null,
    options: [
      { id: "a", label: "A", text: "Base Case (Kondisi Berhenti)" },
      { id: "b", label: "B", text: "Looping For / While" },
      { id: "c", label: "C", text: "Dynamic Memory Allocation" },
      { id: "d", label: "D", text: "Try-Catch Block" },
    ],
    correctAnswer: "a",
    correctAnswers: null,
    points: 10,
    hint: "Base case adalah kondisi di mana fungsi mengembalikan nilai tanpa memanggil dirinya kembali.",
    createdAt: "2026-09-20",
    updatedAt: "2026-09-20",
  },
  {
    id: "bq-15",
    bankId: "qb-3",
    orderIndex: 2,
    type: "single_choice",
    questionText: "Berapa kompleksitas waktu rata-rata (average time complexity) dari algoritma Merge Sort?",
    imageUrl: null,
    imageAlt: null,
    options: [
      { id: "a", label: "A", text: "O(n²)" },
      { id: "b", label: "B", text: "O(n log n)" },
      { id: "c", label: "C", text: "O(log n)" },
      { id: "d", label: "D", text: "O(n)" },
    ],
    correctAnswer: "b",
    correctAnswers: null,
    points: 15,
    hint: "Merge Sort membagi array menjadi dua secara berulang log(n) dan menggabungkannya dalam O(n).",
    createdAt: "2026-09-21",
    updatedAt: "2026-09-21",
  },
  {
    id: "bq-16",
    bankId: "qb-3",
    orderIndex: 3,
    type: "single_choice",
    questionText: "Teknik optimasi rekursi dengan menyimpan hasil komputasi subproblem yang sudah dihitung disebut:",
    imageUrl: null,
    imageAlt: null,
    options: [
      { id: "a", label: "A", text: "Memoization" },
      { id: "b", label: "B", text: "Tokenization" },
      { id: "c", label: "C", text: "Garbage Collection" },
      { id: "d", label: "D", text: "Pipelining" },
    ],
    correctAnswer: "a",
    correctAnswers: null,
    points: 10,
    hint: "Memoization adalah inti dari pendekatan top-down pada Dynamic Programming.",
    createdAt: "2026-09-22",
    updatedAt: "2026-09-22",
  },

  // ── qb-4: Jaringan Komputer ────────────────────────────────────
  {
    id: "bq-17",
    bankId: "qb-4",
    orderIndex: 1,
    type: "single_choice",
    questionText: "Protokol transport layer mana yang bersifat connection-oriented dan menjamin pengiriman paket data secara andal?",
    imageUrl: null,
    imageAlt: null,
    options: [
      { id: "a", label: "A", text: "UDP (User Datagram Protocol)" },
      { id: "b", label: "B", text: "TCP (Transmission Control Protocol)" },
      { id: "c", label: "C", text: "IP (Internet Protocol)" },
      { id: "d", label: "D", text: "ICMP (Internet Control Message Protocol)" },
    ],
    correctAnswer: "b",
    correctAnswers: null,
    points: 10,
    hint: "TCP menggunakan 3-way handshake untuk keandalan transfer data.",
    createdAt: "2026-08-10",
    updatedAt: "2026-08-10",
  },
  {
    id: "bq-18",
    bankId: "qb-4",
    orderIndex: 2,
    type: "single_choice",
    questionText: "Berapa jumlah host maksimum yang dapat digunakan pada subnet dengan prefix /24?",
    imageUrl: null,
    imageAlt: null,
    options: [
      { id: "a", label: "A", text: "254" },
      { id: "b", label: "B", text: "256" },
      { id: "c", label: "C", text: "128" },
      { id: "d", label: "D", text: "512" },
    ],
    correctAnswer: "a",
    correctAnswers: null,
    points: 10,
    hint: "2^(32-24) - 2 = 256 - 2 = 254 (network & broadcast address dikurangi).",
    createdAt: "2026-08-11",
    updatedAt: "2026-08-11",
  },

  // ── qb-6: Sistem Operasi ───────────────────────────────────────
  {
    id: "bq-19",
    bankId: "qb-6",
    orderIndex: 1,
    type: "single_choice",
    questionText: "Kondisi di mana dua atau lebih proses saling menunggu resource yang sedang ditahan oleh proses lain disebut:",
    imageUrl: null,
    imageAlt: null,
    options: [
      { id: "a", label: "A", text: "Deadlock" },
      { id: "b", label: "B", text: "Starvation" },
      { id: "c", label: "C", text: "Race Condition" },
      { id: "d", label: "D", text: "Thrashing" },
    ],
    correctAnswer: "a",
    correctAnswers: null,
    points: 10,
    hint: "Deadlock terjadi jika keempat Coffman conditions terpenuhi secara simultan.",
    createdAt: "2025-10-01",
    updatedAt: "2025-10-01",
  },
  {
    id: "bq-20",
    bankId: "qb-6",
    orderIndex: 2,
    type: "single_choice",
    questionText: "Bagian memori yang digunakan untuk alokasi memori dinamis saat program berjalan (seperti malloc / new) adalah:",
    imageUrl: null,
    imageAlt: null,
    options: [
      { id: "a", label: "A", text: "Stack" },
      { id: "b", label: "B", text: "Heap" },
      { id: "c", label: "C", text: "Code/Text segment" },
      { id: "d", label: "D", text: "Data segment" },
    ],
    correctAnswer: "b",
    correctAnswers: null,
    points: 10,
    hint: "Stack untuk variabel lokal dan frame fungsi, Heap untuk alokasi dinamis.",
    createdAt: "2025-10-02",
    updatedAt: "2025-10-02",
  },
];

// ─── LocalStorage Helpers & Syncing ──────────────────────────────────────────

const STORAGE_BANKS_KEY = "eduquas_question_banks_v2";
const STORAGE_QUESTIONS_KEY = "eduquas_bank_questions_v2";

export function getStoredQuestionBanks(): QuestionBank[] {
  if (typeof window === "undefined") return defaultQuestionBanks;
  try {
    const raw = localStorage.getItem(STORAGE_BANKS_KEY) || localStorage.getItem("lockit_question_banks_v2");
    if (!raw) {
      localStorage.setItem(STORAGE_BANKS_KEY, JSON.stringify(defaultQuestionBanks));
      return defaultQuestionBanks;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : defaultQuestionBanks;
  } catch {
    return defaultQuestionBanks;
  }
}

export function saveStoredQuestionBanks(banks: QuestionBank[]): boolean {
  if (typeof window === "undefined") return false;
  try {
    localStorage.setItem(STORAGE_BANKS_KEY, JSON.stringify(banks));
    return true;
  } catch (err: any) {
    if (err?.name === "QuotaExceededError" || err?.code === 22) {
      throw new Error("Kapasitas penyimpanan lokal peramban (LocalStorage) penuh. Silakan hapus bank soal yang tidak terpakai.");
    }
    throw new Error(`Gagal menyimpan bank soal: ${err?.message || "Kesalahan penyimpanan"}`);
  }
}

export function getStoredQuestions(bankId?: string): BankQuestion[] {
  if (typeof window === "undefined") {
    return bankId ? defaultBankQuestions.filter(q => q.bankId === bankId) : defaultBankQuestions;
  }
  try {
    const raw = localStorage.getItem(STORAGE_QUESTIONS_KEY) || localStorage.getItem("lockit_bank_questions_v2");
    let allQuestions: BankQuestion[];
    if (!raw) {
      allQuestions = defaultBankQuestions;
      localStorage.setItem(STORAGE_QUESTIONS_KEY, JSON.stringify(defaultBankQuestions));
    } else {
      const parsed = JSON.parse(raw);
      allQuestions = Array.isArray(parsed) ? parsed : defaultBankQuestions;
    }
    return bankId ? allQuestions.filter(q => q.bankId === bankId) : allQuestions;
  } catch {
    return bankId ? defaultBankQuestions.filter(q => q.bankId === bankId) : defaultBankQuestions;
  }
}

export function saveStoredQuestions(questions: BankQuestion[]): boolean {
  if (typeof window === "undefined") return false;
  try {
    localStorage.setItem(STORAGE_QUESTIONS_KEY, JSON.stringify(questions));
    return true;
  } catch (err: any) {
    if (err?.name === "QuotaExceededError" || err?.code === 22) {
      throw new Error("Kapasitas penyimpanan lokal peramban (LocalStorage) penuh. Coba kurangi ukuran gambar atau hapus soal yang tidak terpakai.");
    }
    throw new Error(`Gagal menyimpan butir soal: ${err?.message || "Kesalahan penyimpanan"}`);
  }
}

/**
 * Sinkronisasi otomatis statistik bank soal (questionCount dan totalPoints)
 * berdasarkan butir-butir soal yang ada di penyimpanan.
 */
export function syncBankStats(bankIds: string[]): QuestionBank[] {
  const allBanks = getStoredQuestionBanks();
  const allQuestions = getStoredQuestions();
  const today = new Date().toISOString().slice(0, 10);

  const updatedBanks = allBanks.map(b => {
    if (!bankIds.includes(b.id)) return b;
    const bankQs = allQuestions.filter(q => q.bankId === b.id);
    const totalPoints = bankQs.reduce((acc, q) => acc + (q.points || 0), 0);
    return {
      ...b,
      questionCount: bankQs.length,
      totalPoints,
      updatedAt: today,
    };
  });

  saveStoredQuestionBanks(updatedBanks);
  return updatedBanks;
}

/**
 * Menambahkan butir soal baru ke dalam bank soal tertentu.
 */
export function addQuestionToBank(
  data: Omit<BankQuestion, "id" | "createdAt" | "updatedAt">
): { question: BankQuestion; banks: QuestionBank[] } {
  const allQuestions = getStoredQuestions();
  const today = new Date().toISOString().slice(0, 10);
  const newQuestion: BankQuestion = {
    ...data,
    id: `bq-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    createdAt: today,
    updatedAt: today,
  };

  const updatedQuestions = [newQuestion, ...allQuestions];
  saveStoredQuestions(updatedQuestions);
  const updatedBanks = syncBankStats([data.bankId]);

  return { question: newQuestion, banks: updatedBanks };
}

/**
 * Mengedit butir soal yang sudah ada (bisa sekaligus memindahkan ke folder bank soal lain).
 */
export function updateQuestionInBank(
  id: string,
  updates: Partial<Omit<BankQuestion, "id" | "createdAt">>
): { question: BankQuestion | null; banks: QuestionBank[] } {
  const allQuestions = getStoredQuestions();
  const today = new Date().toISOString().slice(0, 10);
  const existing = allQuestions.find(q => q.id === id);
  if (!existing) return { question: null, banks: getStoredQuestionBanks() };

  const oldBankId = existing.bankId;
  const newBankId = updates.bankId || oldBankId;

  const updatedQuestion: BankQuestion = {
    ...existing,
    ...updates,
    updatedAt: today,
  };

  const updatedQuestions = allQuestions.map(q => q.id === id ? updatedQuestion : q);
  saveStoredQuestions(updatedQuestions);

  const affectedBanks = Array.from(new Set([oldBankId, newBankId]));
  const updatedBanks = syncBankStats(affectedBanks);

  return { question: updatedQuestion, banks: updatedBanks };
}

/**
 * Menghapus butir soal dari bank soal.
 */
export function deleteQuestionFromBank(id: string): { banks: QuestionBank[] } {
  const allQuestions = getStoredQuestions();
  const target = allQuestions.find(q => q.id === id);
  if (!target) return { banks: getStoredQuestionBanks() };

  const updatedQuestions = allQuestions.filter(q => q.id !== id);
  saveStoredQuestions(updatedQuestions);

  const updatedBanks = syncBankStats([target.bankId]);
  return { banks: updatedBanks };
}

/**
 * Menduplikasi soal ke folder bank soal yang sama atau berbeda.
 */
export function duplicateQuestionInBank(
  id: string,
  targetBankId?: string
): { question: BankQuestion | null; banks: QuestionBank[] } {
  const allQuestions = getStoredQuestions();
  const source = allQuestions.find(q => q.id === id);
  if (!source) return { question: null, banks: getStoredQuestionBanks() };

  const destBankId = targetBankId || source.bankId;
  const today = new Date().toISOString().slice(0, 10);

  const duplicated: BankQuestion = {
    ...source,
    id: `bq-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    bankId: destBankId,
    questionText: `${source.questionText} (Salinan)`,
    options: source.options.map(opt => ({ ...opt })),
    correctAnswers: source.correctAnswers ? [...source.correctAnswers] : null,
    createdAt: today,
    updatedAt: today,
  };

  const updatedQuestions = [duplicated, ...allQuestions];
  saveStoredQuestions(updatedQuestions);

  const updatedBanks = syncBankStats([destBankId]);
  return { question: duplicated, banks: updatedBanks };
}

/**
 * Memindahkan soal dari satu folder bank soal ke folder bank soal lain.
 */
export function moveQuestionToBank(
  id: string,
  targetBankId: string
): { question: BankQuestion | null; banks: QuestionBank[] } {
  return updateQuestionInBank(id, { bankId: targetBankId });
}

/**
 * Mengimpor sejumlah butir soal sekaligus ke dalam suatu folder bank soal (batch import).
 */
export function importQuestionsToBank(
  bankId: string,
  questionsData: Array<Omit<BankQuestion, "id" | "bankId" | "createdAt" | "updatedAt">>
): { addedCount: number; banks: QuestionBank[] } {
  if (!questionsData || questionsData.length === 0) {
    return { addedCount: 0, banks: getStoredQuestionBanks() };
  }

  const allQuestions = getStoredQuestions();
  const today = new Date().toISOString().slice(0, 10);
  const now = Date.now();

  const newQuestions: BankQuestion[] = questionsData.map((data, idx) => ({
    ...data,
    id: `bq-${now}-${idx}-${Math.floor(Math.random() * 1000)}`,
    bankId,
    createdAt: today,
    updatedAt: today,
  }));

  const updatedQuestions = [...newQuestions, ...allQuestions];
  saveStoredQuestions(updatedQuestions);
  const updatedBanks = syncBankStats([bankId]);

  return { addedCount: newQuestions.length, banks: updatedBanks };
}

/**
 * Membuat folder bank soal baru sekaligus mengisi butir-butir soal di dalamnya secara atomik.
 */
export function createBankWithQuestions(
  bankData: Omit<QuestionBank, "id" | "createdAt" | "updatedAt" | "questionCount" | "totalPoints" | "usedInExams">,
  questionsData: Array<Omit<BankQuestion, "id" | "bankId" | "createdAt" | "updatedAt">>
): { bank: QuestionBank; questions: BankQuestion[]; banks: QuestionBank[] } {
  const allBanks = getStoredQuestionBanks();
  const allQuestions = getStoredQuestions();
  const today = new Date().toISOString().slice(0, 10);
  const now = Date.now();
  const newBankId = `qb-${now}-${Math.floor(Math.random() * 1000)}`;

  const newQuestions: BankQuestion[] = (questionsData || []).map((data, idx) => ({
    ...data,
    id: `bq-${now}-${idx}-${Math.floor(Math.random() * 1000)}`,
    bankId: newBankId,
    createdAt: today,
    updatedAt: today,
  }));

  const totalPoints = newQuestions.reduce((sum, q) => sum + (q.points || 0), 0);

  const newBank: QuestionBank = {
    ...bankData,
    id: newBankId,
    questionCount: newQuestions.length,
    totalPoints,
    usedInExams: 0,
    createdAt: today,
    updatedAt: today,
  };

  const updatedBanks = [newBank, ...allBanks];
  const updatedQuestions = [...newQuestions, ...allQuestions];

  saveStoredQuestionBanks(updatedBanks);
  saveStoredQuestions(updatedQuestions);

  return { bank: newBank, questions: newQuestions, banks: updatedBanks };
}
