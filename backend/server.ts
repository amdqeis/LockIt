import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server as SocketIOServer } from "socket.io";
import { verifyAccessToken, verifyStudentSessionToken } from "./src/lib/auth";
import { prisma } from "./src/lib/prisma";
import { rescheduleActiveExamsOnBoot } from "./src/lib/scheduler";

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// In-memory heartbeat tracker: studentId -> last timestamp
const studentLastHeartbeat = new Map<string, number>();

app.prepare().then(async () => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url!, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error("Error occurred handling", req.url, err);
      res.statusCode = 500;
      res.end("internal server error");
    }
  });

  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
      credentials: true,
    },
    pingInterval: 10000,
    pingTimeout: 5000,
  });

  // Attach global io instance so API Route Handlers can emit events
  (globalThis as any).io = io;

  // ─── NAMESPACE: /teacher-dashboard ──────────────────────────────────────────
  const teacherNs = io.of("/teacher-dashboard");

  teacherNs.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace("Bearer ", "");

      if (!token) {
        return next(new Error("Token autentikasi guru wajib disertakan"));
      }

      const payload = verifyAccessToken(token);
      if (!payload) {
        return next(new Error("Token tidak valid atau kedaluwarsa"));
      }

      socket.data.teacher = payload;
      next();
    } catch (err) {
      next(new Error("Autentikasi gagal"));
    }
  });

  teacherNs.on("connection", (socket) => {
    const teacher = socket.data.teacher;
    console.log(`[Socket] Teacher connected: ${teacher.email} (${socket.id})`);

    socket.on("join_exam_dashboard", async (data: { examId: string }) => {
      try {
        const { examId } = data;
        const exam = await prisma.exam.findUnique({ where: { id: examId } });

        if (!exam || exam.teacherId !== teacher.teacherId) {
          socket.emit("error", { message: "Akses dashboard ujian ditolak" });
          return;
        }

        socket.join(`exam:${examId}`);
        console.log(`[Socket] Teacher ${teacher.email} joined dashboard for exam ${examId}`);
        socket.emit("joined_exam_dashboard", { examId, message: "Berhasil terhubung ke dashboard ujian" });
      } catch (err: any) {
        socket.emit("error", { message: err.message });
      }
    });

    socket.on("leave_exam_dashboard", (data: { examId: string }) => {
      socket.leave(`exam:${data.examId}`);
    });

    socket.on("disconnect", () => {
      console.log(`[Socket] Teacher disconnected: ${socket.id}`);
    });
  });

  // ─── NAMESPACE: /student-session ───────────────────────────────────────────
  const studentNs = io.of("/student-session");

  studentNs.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) {
        return next(new Error("Token sesi peserta wajib disertakan"));
      }

      const payload = verifyStudentSessionToken(token);
      if (!payload) {
        return next(new Error("Sesi ujian tidak valid atau telah kedaluwarsa"));
      }

      const student = await prisma.student.findUnique({
        where: { id: payload.studentId },
      });

      if (!student || student.sessionToken !== token) {
        return next(new Error("Sesi peserta tidak ditemukan"));
      }

      socket.data.student = student;
      next();
    } catch (err) {
      next(new Error("Autentikasi peserta gagal"));
    }
  });

  studentNs.on("connection", (socket) => {
    const student = socket.data.student;
    console.log(`[Socket] Student connected: ${student.name} (${student.nim})`);

    studentLastHeartbeat.set(student.id, Date.now());

    // Join student specific room and exam room
    socket.join(`student:${student.id}`);
    socket.join(`exam:${student.examId}`);

    // Notify teacher dashboard of online presence
    teacherNs.to(`exam:${student.examId}`).emit("student_presence", {
      studentId: student.id,
      name: student.name,
      nim: student.nim,
      status: "active",
      lastSeen: new Date().toISOString(),
    });

    // Heartbeat listener (every 10s from client)
    socket.on("heartbeat", async () => {
      const now = Date.now();
      studentLastHeartbeat.set(student.id, now);

      // If student was marked disconnected, update back to active
      if (student.status === "disconnected") {
        await prisma.student
          .update({
            where: { id: student.id },
            data: { status: "active" },
          })
          .catch(() => {});

        student.status = "active";

        teacherNs.to(`exam:${student.examId}`).emit("student_presence", {
          studentId: student.id,
          name: student.name,
          nim: student.nim,
          status: "active",
          lastSeen: new Date(now).toISOString(),
        });
      }
    });

    socket.on("disconnect", () => {
      console.log(`[Socket] Student socket disconnected: ${student.id}`);
    });
  });

  // ─── BACKGROUND HEARTBEAT MONITOR (Check every 10s) ─────────────────────────
  setInterval(async () => {
    const now = Date.now();
    for (const [studentId, lastSeen] of studentLastHeartbeat.entries()) {
      if (now - lastSeen > 30000) {
        // Disconnected (> 30s no signal)
        studentLastHeartbeat.delete(studentId);

        try {
          const student = await prisma.student.findUnique({ where: { id: studentId } });
          if (student && student.status === "active") {
            await prisma.student.update({
              where: { id: studentId },
              data: { status: "disconnected" },
            });

            // Record heartbeat_lost proctoring event
            await prisma.proctoringEvent.create({
              data: {
                studentId,
                examId: student.examId,
                eventType: "heartbeat_lost",
                metadata: { lastSeen: new Date(lastSeen).toISOString() },
              },
            });

            // Notify Teacher Dashboard
            teacherNs.to(`exam:${student.examId}`).emit("student_presence", {
              studentId,
              name: student.name,
              nim: student.nim,
              status: "disconnected",
              lastSeen: new Date(lastSeen).toISOString(),
            });
          }
        } catch (err) {
          console.error(`[HeartbeatMonitor] Error updating disconnected student ${studentId}:`, err);
        }
      }
    }
  }, 10000);

  // ─── RE-SCHEDULE ACTIVE EXAMS ON BOOT ────────────────────────────────────────
  await rescheduleActiveExamsOnBoot(io);

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(`> Socket.IO server running on namespaces: /teacher-dashboard, /student-session`);
  });
});
