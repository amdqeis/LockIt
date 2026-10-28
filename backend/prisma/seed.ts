import { PrismaClient, ExamStatus, StudentStatus, EventType } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Memulai seeding database LockIt...");

  // 1. Bersihkan data lama jika ada (berurutan sesuai foreign key constraints)
  console.log("🧹 Membersihkan tabel...");
  await prisma.warning.deleteMany({});
  await prisma.proctoringEvent.deleteMany({});
  await prisma.answer.deleteMany({});
  await prisma.question.deleteMany({});
  await prisma.student.deleteMany({});
  await prisma.refreshToken.deleteMany({});
  await prisma.exam.deleteMany({});
  await prisma.teacher.deleteMany({});

  // 2. Buat Akun Admin (Administrator Institusi) + Guru Default
  console.log("👤 Membuat akun admin dan guru...");
  const salt = await bcrypt.genSalt(10);
  const adminPasswordHash = await bcrypt.hash("admin123", salt);
  const teacherPasswordHash = await bcrypt.hash("password123", salt);

  // Admin pertama — dibuat via seed (tidak ada endpoint publik untuk buat Admin)
  const admin = await prisma.teacher.create({
    data: {
      email: "admin@lockit.id",
      fullName: "Administrator LockIt",
      passwordHash: adminPasswordHash,
      role: "ADMIN",
      isActive: true,
    },
  });
  console.log(`✅ Admin dibuat: ${admin.fullName} (${admin.email}) — password: admin123`);

  const teacher = await prisma.teacher.create({
    data: {
      email: "guru@lockit.id",
      fullName: "Dr. Ahmad Fauzi, S.T., M.Kom.",
      passwordHash: teacherPasswordHash,
      role: "TEACHER",
      isActive: true,
    },
  });
  console.log(`✅ Guru dibuat: ${teacher.fullName} (${teacher.email}) — password: password123`);

  // 3. Buat Ujian 1: AKTIF (Sedang Berlangsung)
  console.log("📝 Membuat Ujian Aktif (UTS Pemrograman Web)...");
  const now = new Date();
  const startTime = new Date(now.getTime() - 25 * 60 * 1000); // dimulai 25 menit lalu
  const endTime = new Date(now.getTime() + 65 * 60 * 1000);   // berakhir 65 menit lagi

  const activeExam = await prisma.exam.create({
    data: {
      teacherId: teacher.id,
      title: "Ujian Tengah Semester — Pemrograman Web Modern",
      description: "Materi: HTML5 Semantik, CSS Flexbox & Grid, JavaScript Asynchronous, dan DOM Security.",
      accessCode: "TI2026",
      durationMinutes: 90,
      status: ExamStatus.active,
      startTime,
      endTime,
      settings: {
        randomize_questions: true,
        allow_backtrack: true,
        show_result: true,
      },
      violationPolicy: {
        max_violations: 3,
        warn_at: 2,
        action: "lock",
      },
    },
  });

  // Soal untuk Ujian 1
  const questionsData = [
    {
      orderIndex: 1,
      questionText: "Manakah elemen HTML5 berikut yang paling tepat digunakan untuk konten artikel mandiri yang dapat didistribusikan secara independen?",
      options: [
        { id: "A", text: "<section>" },
        { id: "B", text: "<article>" },
        { id: "C", text: "<aside>" },
        { id: "D", text: "<main>" },
      ],
      correctAnswer: "B",
      points: 20,
    },
    {
      orderIndex: 2,
      questionText: "Dalam CSS Grid, unit pecahan manakah yang membagi sisa ruang secara proporsional dalam container?",
      options: [
        { id: "A", text: "% (percentage)" },
        { id: "B", text: "vw (viewport width)" },
        { id: "C", text: "fr (fractional unit)" },
        { id: "D", text: "rem (root em)" },
      ],
      correctAnswer: "C",
      points: 20,
    },
    {
      orderIndex: 3,
      questionText: "Metode HTTP manakah yang bersifat idempoten dan digunakan untuk memperbarui seluruh representasi resource di server?",
      options: [
        { id: "A", text: "POST" },
        { id: "B", text: "PATCH" },
        { id: "C", text: "PUT" },
        { id: "D", text: "CONNECT" },
      ],
      correctAnswer: "C",
      points: 20,
    },
    {
      orderIndex: 4,
      questionText: "Dalam JavaScript, apa perbedaan utama antara Promise.all() dan Promise.allSettled()?",
      options: [
        { id: "A", text: "Promise.all() menunggu semua promise selesai baik reject maupun resolve" },
        { id: "B", text: "Promise.all() langsung reject jika ada salah satu promise yang gagal, sedangkan allSettled() menunggu seluruhnya selesai" },
        { id: "C", text: "Promise.allSettled() hanya berjalan di Web Workers" },
        { id: "D", text: "Tidak ada perbedaan, keduanya alias identik" },
      ],
      correctAnswer: "B",
      points: 20,
    },
    {
      orderIndex: 5,
      questionText: "Strategi keamanan browser manakah yang paling efektif mencegah serangan Cross-Site Scripting (XSS) berbasis injeksi script pihak ketiga?",
      options: [
        { id: "A", text: "Mengaktifkan CORS Access-Control-Allow-Origin: *" },
        { id: "B", text: "Content Security Policy (CSP) dan sanitasi input/output (DOMPurify)" },
        { id: "C", text: "Menyimpan token autentikasi di LocalStorage" },
        { id: "D", text: "Menggunakan metode GET untuk seluruh formulir" },
      ],
      correctAnswer: "B",
      points: 20,
    },
  ];

  const createdQuestions = [];
  for (const q of questionsData) {
    const question = await prisma.question.create({
      data: {
        examId: activeExam.id,
        orderIndex: q.orderIndex,
        questionText: q.questionText,
        options: q.options,
        correctAnswer: q.correctAnswer,
        points: q.points,
      },
    });
    createdQuestions.push(question);
  }
  console.log(`✅ ${createdQuestions.length} soal dibuat untuk UTS Pemrograman Web`);

  // Buat Peserta / Siswa untuk Ujian Aktif
  const studentsData = [
    {
      name: "Budi Pratama",
      nisn: "0012345678",
      status: StudentStatus.active,
      isLocked: false,
      violationCount: 1,
      joinedAt: new Date(now.getTime() - 20 * 60 * 1000),
      answers: [
        { qIdx: 0, option: "B", isCorrect: true },
        { qIdx: 1, option: "C", isCorrect: true },
        { qIdx: 2, option: "C", isCorrect: true },
      ],
      events: [
        { type: EventType.tab_switch, durationMs: 4500, metadata: { reason: "Pindah tab ke peramban lain" } },
      ],
    },
    {
      name: "Siti Rahmawati",
      nisn: "0012345679",
      status: StudentStatus.submitted,
      isLocked: false,
      violationCount: 0,
      joinedAt: new Date(now.getTime() - 24 * 60 * 1000),
      submittedAt: new Date(now.getTime() - 5 * 60 * 1000),
      answers: [
        { qIdx: 0, option: "B", isCorrect: true },
        { qIdx: 1, option: "C", isCorrect: true },
        { qIdx: 2, option: "C", isCorrect: true },
        { qIdx: 3, option: "B", isCorrect: true },
        { qIdx: 4, option: "B", isCorrect: true },
      ],
      events: [],
    },
    {
      name: "Rizky Firmansyah",
      nisn: "0012345680",
      status: StudentStatus.active,
      isLocked: true, // Terkunci karena mencapai batas pelanggaran 3
      violationCount: 3,
      joinedAt: new Date(now.getTime() - 22 * 60 * 1000),
      answers: [
        { qIdx: 0, option: "A", isCorrect: false },
        { qIdx: 1, option: "C", isCorrect: true },
      ],
      events: [
        { type: EventType.tab_switch, durationMs: 8200, metadata: { reason: "Pindah jendela aplikasi" } },
        { type: EventType.copy_attempt, durationMs: 0, metadata: { reason: "Mencoba copy teks soal" } },
        { type: EventType.devtools, durationMs: 3500, metadata: { reason: "Membuka Developer Tools F12" } },
      ],
    },
    {
      name: "Dewi Anggraini",
      nisn: "0012345681",
      status: StudentStatus.waiting,
      isLocked: false,
      violationCount: 0,
      joinedAt: new Date(now.getTime() - 2 * 60 * 1000),
      answers: [],
      events: [],
    },
  ];

  for (const s of studentsData) {
    const rawToken = crypto.randomBytes(32).toString("hex");
    const sessionTokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

    const student = await prisma.student.create({
      data: {
        examId: activeExam.id,
        name: s.name,
        nisn: s.nisn,
        sessionTokenHash,
        status: s.status,
        isLocked: s.isLocked,
        violationCount: s.violationCount,
        joinedAt: s.joinedAt,
        submittedAt: s.submittedAt || null,
        ipAddress: "127.0.0.1",
        userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/128.0",
      },
    });

    // Simpan jawaban
    for (const a of s.answers) {
      await prisma.answer.create({
        data: {
          studentId: student.id,
          questionId: createdQuestions[a.qIdx].id,
          selectedOption: a.option,
          isCorrect: a.isCorrect,
          answeredAt: new Date(s.joinedAt.getTime() + 3 * 60 * 1000),
        },
      });
    }

    // Simpan event proctoring
    for (const ev of s.events) {
      await prisma.proctoringEvent.create({
        data: {
          examId: activeExam.id,
          studentId: student.id,
          eventType: ev.type,
          durationMs: ev.durationMs,
          metadata: ev.metadata,
          timestamp: new Date(s.joinedAt.getTime() + 5 * 60 * 1000),
        },
      });
    }

    // Beri warning jika terkunci
    if (s.isLocked) {
      await prisma.warning.create({
        data: {
          examId: activeExam.id,
          studentId: student.id,
          teacherId: teacher.id,
          message: "Ujian Anda terkunci otomatis karena terdeteksi 3 pelanggaran berturut-turut. Hubungi pengawas untuk membuka kunci.",
          isRead: true,
        },
      });
    }
  }
  console.log(`✅ ${studentsData.length} peserta ditambahkan ke UTS Pemrograman Web`);

  // 4. Buat Ujian 2: DRAFT
  console.log("📝 Membuat Ujian Draft (Kuis Basis Data)...");
  await prisma.exam.create({
    data: {
      teacherId: teacher.id,
      title: "Kuis Basis Data — Normalisasi & Relasional",
      description: "Pengujian 1NF, 2NF, 3NF, BCNF serta sintaks SQL agregasi dan relasi antar-tabel.",
      accessCode: "BD9912",
      durationMinutes: 45,
      status: ExamStatus.draft,
      settings: {
        randomize_questions: false,
        allow_backtrack: true,
      },
      violationPolicy: {
        max_violations: 2,
        action: "warn",
      },
    },
  });

  // 5. Buat Ujian 3: ENDED (Ujian Selesai)
  console.log("📝 Membuat Ujian Selesai (UAS Algoritma)...");
  const pastStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 hari lalu
  const pastEnd = new Date(pastStart.getTime() + 120 * 60 * 1000);

  const endedExam = await prisma.exam.create({
    data: {
      teacherId: teacher.id,
      title: "Ujian Akhir Semester — Algoritma & Struktur Data",
      description: "Materi rekursi, binary search tree, graf, Dijkstra, dan kompleksitas Big-O.",
      accessCode: "AL5521",
      durationMinutes: 120,
      status: ExamStatus.ended,
      startTime: pastStart,
      endTime: pastEnd,
      settings: {
        randomize_questions: true,
        allow_backtrack: true,
        show_result: true,
      },
      violationPolicy: {
        max_violations: 3,
        action: "lock",
      },
    },
  });

  // Soal untuk UAS Selesai
  const endedQuestion = await prisma.question.create({
    data: {
      examId: endedExam.id,
      orderIndex: 1,
      questionText: "Berapakah kompleksitas waktu rata-rata (average time complexity) dari algoritma QuickSort?",
      options: [
        { id: "A", text: "O(n)" },
        { id: "B", text: "O(n log n)" },
        { id: "C", text: "O(n^2)" },
        { id: "D", text: "O(log n)" },
      ],
      correctAnswer: "B",
      points: 100,
    },
  });

  // Siswa untuk UAS Selesai
  const endedStudent = await prisma.student.create({
    data: {
      examId: endedExam.id,
      name: "Fajar Nugraha",
      nisn: "0012345682",
      sessionTokenHash: crypto.randomBytes(32).toString("hex"),
      status: StudentStatus.submitted,
      isLocked: false,
      violationCount: 0,
      joinedAt: pastStart,
      submittedAt: new Date(pastStart.getTime() + 85 * 60 * 1000),
    },
  });

  await prisma.answer.create({
    data: {
      studentId: endedStudent.id,
      questionId: endedQuestion.id,
      selectedOption: "B",
      isCorrect: true,
      answeredAt: new Date(pastStart.getTime() + 30 * 60 * 1000),
    },
  });

  console.log("🎉 Seeding database berhasil selesai!");
}

main()
  .catch((e) => {
    console.error("❌ Gagal melakukan seeding database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
