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

export const defaultQuestionBanks: QuestionBank[] = [
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
