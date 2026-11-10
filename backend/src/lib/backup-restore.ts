import fs from "fs/promises";
import { createReadStream, createWriteStream, existsSync } from "fs";
import path from "path";
import crypto from "crypto";
import { exec, spawn } from "child_process";
import { promisify } from "util";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";

const execAsync = promisify(exec);

export const BACKUP_STORAGE_DIR = process.env.BACKUP_STORAGE_DIR || path.join(process.cwd(), "storage", "backups");
export const ARCHIVES_DIR = path.join(BACKUP_STORAGE_DIR, "archives");
export const UPLOADS_DIR = path.join(BACKUP_STORAGE_DIR, "uploads");
export const SAFETY_DIR = path.join(BACKUP_STORAGE_DIR, "safety");
export const STAGING_DIR = path.join(BACKUP_STORAGE_DIR, "staging");

export const JOB_STATE_FILE = path.join(BACKUP_STORAGE_DIR, "job-state.json");
export const JOURNAL_FILE = path.join(BACKUP_STORAGE_DIR, "journal.json");
export const LOCK_FILE = path.join(BACKUP_STORAGE_DIR, "lock.json");

export const MEDIA_QB_DIR = path.join(process.cwd(), "storage", "question-bank");
export const MEDIA_EXAMS_DIR = path.join(process.cwd(), "public", "uploads", "exams");

export type BackupRestoreStage =
  | "idle"
  | "verifying_prerequisites"
  | "acquiring_lock_and_maintenance"
  | "waiting_for_active_writes"
  | "checking_active_exams"
  | "dumping_database"
  | "copying_media"
  | "generating_manifest"
  | "packaging_archive"
  | "validating_archive"
  | "creating_safety_backup"
  | "staging_media"
  | "restoring_database"
  | "swapping_media"
  | "invalidating_sessions"
  | "verifying_restored_data"
  | "rolling_back"
  | "releasing_maintenance"
  | "completed"
  | "failed"
  | "aborted_active_exams";

export type JobType = "backup" | "restore";

export interface ManifestData {
  formatVersion: "1.0.0";
  createdAt: string;
  schemaHash: string;
  postgresVersion: string;
  counts: Record<string, number>;
  mediaFiles: { path: string; size: number; sha256: string }[];
  databaseDumpChecksum: string;
}

export interface JobState {
  id: string;
  type: JobType;
  status: BackupRestoreStage;
  statusToken: string;
  startedAt: string;
  completedAt: string | null;
  error: string | null;
  activeExams?: { id: string; title: string; accessCode: string }[];
  filename?: string;
  fileSize?: number;
  manifest?: ManifestData;
  steps: { stage: BackupRestoreStage; timestamp: string; details?: string }[];
}

export interface JournalState {
  jobId: string;
  type: "restore";
  stage: "started" | "safety_created" | "media_staged" | "database_restored" | "media_swapped" | "completed" | "failed";
  timestamp: string;
  safetySnapshotDir: string;
  error?: string;
}

// ─── IN-MEMORY STATE & COORDINATOR ───────────────────────────────────────────
type CoordinatorState = {
  maintenance: boolean;
  maintenanceReason: string | null;
  statusToken: string | null;
  activeJob: JobState | null;
  activeWrites: number;
};

const globalCoordinator = globalThis as typeof globalThis & {
  __eduquasCoordinator?: CoordinatorState;
};

const coordinator: CoordinatorState = globalCoordinator.__eduquasCoordinator ??= {
  maintenance: false,
  maintenanceReason: null,
  statusToken: null,
  activeJob: null,
  activeWrites: 0,
};

export function isMaintenanceActive(): boolean {
  return coordinator.maintenance;
}

export function getMaintenanceReason(): string | null {
  return coordinator.maintenanceReason;
}

export function getOperationStatusToken(): string | null {
  return coordinator.statusToken;
}

export function incrementActiveWrites(): void {
  coordinator.activeWrites++;
}

export function decrementActiveWrites(): void {
  if (coordinator.activeWrites > 0) coordinator.activeWrites--;
}

export async function waitForActiveWrites(timeoutMs = 10000): Promise<void> {
  const start = Date.now();
  while (coordinator.activeWrites > 0) {
    if (Date.now() - start > timeoutMs) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

// ─── DIR INITIALIZER ─────────────────────────────────────────────────────────
export async function ensureBackupDirectories(): Promise<void> {
  await fs.mkdir(BACKUP_STORAGE_DIR, { recursive: true });
  await fs.mkdir(ARCHIVES_DIR, { recursive: true });
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
  await fs.mkdir(SAFETY_DIR, { recursive: true });
  await fs.mkdir(STAGING_DIR, { recursive: true });
  await fs.mkdir(MEDIA_QB_DIR, { recursive: true });
  await fs.mkdir(MEDIA_EXAMS_DIR, { recursive: true });
}

export async function readJobState(): Promise<JobState | null> {
  if (coordinator.activeJob) return coordinator.activeJob;
  try {
    const raw = await fs.readFile(JOB_STATE_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function writeJobState(state: JobState): Promise<void> {
  coordinator.activeJob = state;
  await ensureBackupDirectories();
  const tmpFile = `${JOB_STATE_FILE}.tmp.${Date.now()}`;
  await fs.writeFile(tmpFile, JSON.stringify(state, null, 2), "utf-8");
  await fs.rename(tmpFile, JOB_STATE_FILE);
}

export async function readJournal(): Promise<JournalState | null> {
  try {
    const raw = await fs.readFile(JOURNAL_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function writeJournal(journal: JournalState): Promise<void> {
  await ensureBackupDirectories();
  const tmpFile = `${JOURNAL_FILE}.tmp.${Date.now()}`;
  await fs.writeFile(tmpFile, JSON.stringify(journal, null, 2), "utf-8");
  await fs.rename(tmpFile, JOURNAL_FILE);
}

// ─── CHECKSUM & HASH HELPERS ──────────────────────────────────────────────────
export async function calculateFileSha256(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", (err) => reject(err));
  });
}

export async function getSchemaFingerprint(): Promise<string> {
  try {
    const schemaContent = await fs.readFile(path.join(process.cwd(), "prisma", "schema.prisma"), "utf-8");
    return crypto.createHash("sha256").update(schemaContent).digest("hex");
  } catch {
    return "unknown";
  }
}

export async function getPostgresVersion(): Promise<string> {
  try {
    const res: any = await prisma.$queryRaw`SELECT version()`;
    return res[0]?.version || "unknown";
  } catch {
    return "unknown";
  }
}

export async function getDatabaseCounts(): Promise<Record<string, number>> {
  const [
    teachers,
    gradeLevels,
    classrooms,
    subjects,
    questionBanks,
    bankQuestions,
    exams,
    questions,
    students,
    answers,
    proctoringEvents,
  ] = await Promise.all([
    prisma.teacher.count(),
    prisma.gradeLevel.count(),
    prisma.classroom.count(),
    prisma.subject.count(),
    prisma.questionBank.count(),
    prisma.bankQuestion.count(),
    prisma.exam.count(),
    prisma.question.count(),
    prisma.student.count(),
    prisma.answer.count(),
    prisma.proctoringEvent.count(),
  ]);

  return {
    teachers,
    gradeLevels,
    classrooms,
    subjects,
    questionBanks,
    bankQuestions,
    exams,
    questions,
    students,
    answers,
    proctoringEvents,
  };
}

export function parseDatabaseEnv(): {
  env: NodeJS.ProcessEnv;
  database: string;
} {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error("DATABASE_URL env variable tidak ditemukan");
  const parsed = new URL(dbUrl);
  const database = parsed.pathname.slice(1);
  return {
    database,
    env: {
      ...process.env,
      PGHOST: parsed.hostname,
      PGPORT: parsed.port || "5432",
      PGUSER: decodeURIComponent(parsed.username),
      PGPASSWORD: decodeURIComponent(parsed.password),
      PGDATABASE: database,
    },
  };
}

// ─── BACKUP OPERATION ────────────────────────────────────────────────────────
export async function startBackupJob(adminId: string): Promise<{ jobId: string; statusToken: string }> {
  if (coordinator.activeJob && !["completed", "failed", "aborted_active_exams"].includes(coordinator.activeJob.status)) {
    throw new AppError("CONFLICT", "Ada pekerjaan backup atau restore yang sedang berjalan.", 409);
  }

  await ensureBackupDirectories();

  const jobId = crypto.randomUUID();
  const statusToken = crypto.randomBytes(32).toString("hex");

  const job: JobState = {
    id: jobId,
    type: "backup",
    status: "verifying_prerequisites",
    statusToken,
    startedAt: new Date().toISOString(),
    completedAt: null,
    error: null,
    steps: [{ stage: "verifying_prerequisites", timestamp: new Date().toISOString() }],
  };

  coordinator.activeJob = job;
  coordinator.statusToken = statusToken;
  await writeJobState(job);

  // Run asynchronously
  setImmediate(() => {
    void runBackupProcess(job);
  });

  return { jobId, statusToken };
}

async function updateJobStage(job: JobState, stage: BackupRestoreStage, details?: string): Promise<void> {
  job.status = stage;
  job.steps.push({ stage, timestamp: new Date().toISOString(), details });
  await writeJobState(job);
}

async function runBackupProcess(job: JobState): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const workDir = path.join(BACKUP_STORAGE_DIR, `backup-work-${job.id}`);
  const archiveFilename = `eduquas-backup-${timestamp}.tar.gz`;
  const archivePath = path.join(ARCHIVES_DIR, archiveFilename);
  const tempArchivePath = `${archivePath}.tmp`;

  try {
    // 1. Prerequisites
    await updateJobStage(job, "verifying_prerequisites");
    await fs.mkdir(workDir, { recursive: true });

    // 2. Lock & Maintenance
    await updateJobStage(job, "acquiring_lock_and_maintenance");
    coordinator.maintenance = true;
    coordinator.maintenanceReason = "Backup database dan berkas sedang berlangsung.";

    // 3. Wait for writes
    await updateJobStage(job, "waiting_for_active_writes");
    await waitForActiveWrites();

    // 4. Check active exams
    await updateJobStage(job, "checking_active_exams");
    const activeExams = await prisma.exam.findMany({
      where: { status: "active" },
      select: { id: true, title: true, accessCode: true },
    });

    if (activeExams.length > 0) {
      job.activeExams = activeExams;
      job.status = "aborted_active_exams";
      job.completedAt = new Date().toISOString();
      job.error = "Terdapat ujian yang sedang berlangsung. Selesaikan ujian sebelum melakukan backup.";
      job.steps.push({
        stage: "aborted_active_exams",
        timestamp: new Date().toISOString(),
        details: `${activeExams.length} ujian aktif`,
      });
      coordinator.maintenance = false;
      coordinator.maintenanceReason = null;
      await writeJobState(job);
      await fs.rm(workDir, { recursive: true, force: true });
      return;
    }

    // 5. Dump DB
    await updateJobStage(job, "dumping_database");
    const dbDumpPath = path.join(workDir, "database.dump");
    const { env, database } = parseDatabaseEnv();
    await execAsync(`pg_dump --format=custom --no-owner --no-privileges -f "${dbDumpPath}"`, { env });

    const dbDumpChecksum = await calculateFileSha256(dbDumpPath);

    // 6. Copy Media
    await updateJobStage(job, "copying_media");
    const mediaWorkDir = path.join(workDir, "media");
    const qbMediaWorkDir = path.join(mediaWorkDir, "question-bank");
    const examMediaWorkDir = path.join(mediaWorkDir, "exams");
    await fs.mkdir(qbMediaWorkDir, { recursive: true });
    await fs.mkdir(examMediaWorkDir, { recursive: true });

    const mediaFiles: { path: string; size: number; sha256: string }[] = [];

    // Copy Question Bank media
    if (existsSync(MEDIA_QB_DIR)) {
      const qbFiles = await fs.readdir(MEDIA_QB_DIR);
      for (const file of qbFiles) {
        const src = path.join(MEDIA_QB_DIR, file);
        const stat = await fs.stat(src);
        if (stat.isFile()) {
          const dest = path.join(qbMediaWorkDir, file);
          await fs.copyFile(src, dest);
          const sha = await calculateFileSha256(dest);
          mediaFiles.push({ path: `media/question-bank/${file}`, size: stat.size, sha256: sha });
        }
      }
    }

    // Copy Exam media
    if (existsSync(MEDIA_EXAMS_DIR)) {
      const examFiles = await fs.readdir(MEDIA_EXAMS_DIR);
      for (const file of examFiles) {
        const src = path.join(MEDIA_EXAMS_DIR, file);
        const stat = await fs.stat(src);
        if (stat.isFile()) {
          const dest = path.join(examMediaWorkDir, file);
          await fs.copyFile(src, dest);
          const sha = await calculateFileSha256(dest);
          mediaFiles.push({ path: `media/exams/${file}`, size: stat.size, sha256: sha });
        }
      }
    }

    // 7. Generate Manifest
    await updateJobStage(job, "generating_manifest");
    const schemaHash = await getSchemaFingerprint();
    const postgresVersion = await getPostgresVersion();
    const counts = await getDatabaseCounts();

    const manifest: ManifestData = {
      formatVersion: "1.0.0",
      createdAt: new Date().toISOString(),
      schemaHash,
      postgresVersion,
      counts,
      mediaFiles,
      databaseDumpChecksum: dbDumpChecksum,
    };

    await fs.writeFile(path.join(workDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf-8");

    // 8. Package Archive
    await updateJobStage(job, "packaging_archive");
    // Use tar -czf inside workDir
    await execAsync(`tar -czf "${tempArchivePath}" -C "${workDir}" .`);
    await fs.rename(tempArchivePath, archivePath);

    const archiveStat = await fs.stat(archivePath);

    // 9. Completed
    job.filename = archiveFilename;
    job.fileSize = archiveStat.size;
    job.manifest = manifest;
    job.completedAt = new Date().toISOString();
    await updateJobStage(job, "completed", `Arsip ${archiveFilename} (${archiveStat.size} bytes)`);
  } catch (err: any) {
    job.status = "failed";
    job.error = err.message || "Gagal membuat backup";
    job.completedAt = new Date().toISOString();
    job.steps.push({ stage: "failed", timestamp: new Date().toISOString(), details: job.error || undefined });
    await writeJobState(job);
  } finally {
    coordinator.maintenance = false;
    coordinator.maintenanceReason = null;
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
    if (existsSync(tempArchivePath)) await fs.rm(tempArchivePath).catch(() => {});
  }
}

// ─── RESTORE OPERATION ───────────────────────────────────────────────────────
export async function validateBackupArchive(archivePath: string): Promise<ManifestData> {
  const stat = await fs.stat(archivePath);
  const maxUploadBytes = 1024 * 1024 * 1024; // 1 GiB
  if (stat.size > maxUploadBytes) {
    throw new AppError("INVALID_ARCHIVE", "Ukuran arsip melebihi batas 1 GiB.", 400);
  }

  // Inspect tar listing to prevent path traversal and symlinks
  const { stdout } = await execAsync(`tar -ztvf "${archivePath}"`);
  const lines = stdout.split("\n").filter(Boolean);

  for (const line of lines) {
    if (line.startsWith("l") || line.startsWith("h")) {
      throw new AppError("INVALID_ARCHIVE", "Arsip ditolak karena memuat symlink atau hardlink.", 400);
    }
    const parts = line.trim().split(/\s+/);
    const entryName = parts[parts.length - 1];
    if (entryName.includes("..") || path.isAbsolute(entryName)) {
      throw new AppError("INVALID_ARCHIVE", "Arsip ditolak karena memuat path traversal.", 400);
    }
  }

  // Extract manifest only
  const tempExtractDir = path.join(BACKUP_STORAGE_DIR, `inspect-${Date.now()}`);
  await fs.mkdir(tempExtractDir, { recursive: true });

  try {
    await execAsync(`tar -xzf "${archivePath}" -C "${tempExtractDir}" manifest.json`);
    const manifestRaw = await fs.readFile(path.join(tempExtractDir, "manifest.json"), "utf-8");
    const manifest: ManifestData = JSON.parse(manifestRaw);

    if (manifest.formatVersion !== "1.0.0") {
      throw new AppError("INVALID_ARCHIVE", `Versi format backup ${manifest.formatVersion} tidak didukung.`, 400);
    }

    return manifest;
  } finally {
    await fs.rm(tempExtractDir, { recursive: true, force: true }).catch(() => {});
  }
}

export async function startRestoreJob(
  adminId: string,
  source: { type: "saved" | "upload"; identifier: string }
): Promise<{ jobId: string; statusToken: string }> {
  if (coordinator.activeJob && !["completed", "failed", "aborted_active_exams"].includes(coordinator.activeJob.status)) {
    throw new AppError("CONFLICT", "Ada pekerjaan backup atau restore yang sedang berjalan.", 409);
  }

  await ensureBackupDirectories();

  const archivePath = source.type === "saved"
    ? path.join(ARCHIVES_DIR, source.identifier)
    : path.join(UPLOADS_DIR, source.identifier);

  if (!existsSync(archivePath)) {
    throw new AppError("NOT_FOUND", "Berkas arsip backup tidak ditemukan.", 404);
  }

  // Pre-validate archive
  const manifest = await validateBackupArchive(archivePath);

  const jobId = crypto.randomUUID();
  const statusToken = crypto.randomBytes(32).toString("hex");

  const job: JobState = {
    id: jobId,
    type: "restore",
    status: "validating_archive",
    statusToken,
    startedAt: new Date().toISOString(),
    completedAt: null,
    error: null,
    manifest,
    steps: [{ stage: "validating_archive", timestamp: new Date().toISOString() }],
  };

  coordinator.activeJob = job;
  coordinator.statusToken = statusToken;
  await writeJobState(job);

  // Run restore asynchronously
  setImmediate(() => {
    void runRestoreProcess(job, archivePath, manifest);
  });

  return { jobId, statusToken };
}

async function runRestoreProcess(job: JobState, archivePath: string, manifest: ManifestData): Promise<void> {
  const safetySnapshotDir = path.join(SAFETY_DIR, `safety-${job.id}`);
  const extractionDir = path.join(STAGING_DIR, `staging-${job.id}`);
  const { env } = parseDatabaseEnv();

  try {
    // 1. Lock & Maintenance
    await updateJobStage(job, "acquiring_lock_and_maintenance");
    coordinator.maintenance = true;
    coordinator.maintenanceReason = "Restore sistem sedang berlangsung. Semua sesi pengguna dibatalkan.";

    // 2. Wait for writes
    await updateJobStage(job, "waiting_for_active_writes");
    await waitForActiveWrites();

    // 3. Check active exams
    await updateJobStage(job, "checking_active_exams");
    const activeExams = await prisma.exam.findMany({
      where: { status: "active" },
      select: { id: true, title: true, accessCode: true },
    });

    if (activeExams.length > 0) {
      job.activeExams = activeExams;
      job.status = "aborted_active_exams";
      job.completedAt = new Date().toISOString();
      job.error = "Terdapat ujian yang sedang berlangsung. Selesaikan ujian sebelum melakukan restore.";
      coordinator.maintenance = false;
      coordinator.maintenanceReason = null;
      await writeJobState(job);
      return;
    }

    // 4. Create Safety Backup
    await updateJobStage(job, "creating_safety_backup");
    await fs.mkdir(safetySnapshotDir, { recursive: true });
    const safetyDumpPath = path.join(safetySnapshotDir, "safety.dump");
    await execAsync(`pg_dump --format=custom --no-owner --no-privileges -f "${safetyDumpPath}"`, { env });

    // Copy existing media to safety snapshot
    const safetyMediaQb = path.join(safetySnapshotDir, "media", "question-bank");
    const safetyMediaExams = path.join(safetySnapshotDir, "media", "exams");
    await fs.mkdir(safetyMediaQb, { recursive: true });
    await fs.mkdir(safetyMediaExams, { recursive: true });

    if (existsSync(MEDIA_QB_DIR)) {
      await execAsync(`cp -r "${MEDIA_QB_DIR}/." "${safetyMediaQb}/" 2>/dev/null || true`);
    }
    if (existsSync(MEDIA_EXAMS_DIR)) {
      await execAsync(`cp -r "${MEDIA_EXAMS_DIR}/." "${safetyMediaExams}/" 2>/dev/null || true`);
    }

    // Record safety backup in journal
    await writeJournal({
      jobId: job.id,
      type: "restore",
      stage: "safety_created",
      timestamp: new Date().toISOString(),
      safetySnapshotDir,
    });

    // 5. Stage Media & Extract
    await updateJobStage(job, "staging_media");
    await fs.mkdir(extractionDir, { recursive: true });
    await execAsync(`tar -xzf "${archivePath}" -C "${extractionDir}"`);

    // Verify dump checksum
    const dumpPath = path.join(extractionDir, "database.dump");
    if (!existsSync(dumpPath)) {
      throw new Error("Berkas database.dump tidak ditemukan di dalam arsip.");
    }
    const extractedDumpChecksum = await calculateFileSha256(dumpPath);
    if (extractedDumpChecksum !== manifest.databaseDumpChecksum) {
      throw new Error("Checksum database.dump tidak cocok dengan manifest.");
    }

    await writeJournal({
      jobId: job.id,
      type: "restore",
      stage: "media_staged",
      timestamp: new Date().toISOString(),
      safetySnapshotDir,
    });

    // 6. Restore Database via pg_restore
    await updateJobStage(job, "restoring_database");
    // Prompt: pg_restore --clean --if-exists --no-owner --no-privileges --single-transaction
    await execAsync(
      `pg_restore --clean --if-exists --no-owner --no-privileges --single-transaction -d "${env.PGDATABASE}" "${dumpPath}"`,
      { env }
    );

    await writeJournal({
      jobId: job.id,
      type: "restore",
      stage: "database_restored",
      timestamp: new Date().toISOString(),
      safetySnapshotDir,
    });

    // 7. Swap Media
    await updateJobStage(job, "swapping_media");
    const stagedQbDir = path.join(extractionDir, "media", "question-bank");
    const stagedExamsDir = path.join(extractionDir, "media", "exams");

    // Clean and replace question-bank media
    await fs.rm(MEDIA_QB_DIR, { recursive: true, force: true }).catch(() => {});
    await fs.mkdir(MEDIA_QB_DIR, { recursive: true });
    if (existsSync(stagedQbDir)) {
      await execAsync(`cp -r "${stagedQbDir}/." "${MEDIA_QB_DIR}/" 2>/dev/null || true`);
    }

    // Clean and replace exams media
    await fs.rm(MEDIA_EXAMS_DIR, { recursive: true, force: true }).catch(() => {});
    await fs.mkdir(MEDIA_EXAMS_DIR, { recursive: true });
    if (existsSync(stagedExamsDir)) {
      await execAsync(`cp -r "${stagedExamsDir}/." "${MEDIA_EXAMS_DIR}/" 2>/dev/null || true`);
    }

    await writeJournal({
      jobId: job.id,
      type: "restore",
      stage: "media_swapped",
      timestamp: new Date().toISOString(),
      safetySnapshotDir,
    });

    // 8. Invalidate Sessions
    await updateJobStage(job, "invalidating_sessions");
    // Prompt: Ganti sessionVersion seluruh guru dengan UUID acak baru, cabut refresh token, reset hash token sesi peserta, dan putuskan socket dari server.
    await prisma.$executeRawUnsafe(`UPDATE "teachers" SET "session_version" = gen_random_uuid()::TEXT`);
    await prisma.refreshToken.updateMany({ data: { isRevoked: true } });
    await prisma.student.updateMany({ data: { sessionTokenHash: "revoked" } });

    // Disconnect all sockets
    const io = (globalThis as any).io;
    if (io) {
      io.of("/teacher-dashboard").disconnectSockets(true);
      io.of("/student-session").disconnectSockets(true);
    }

    // 9. Verify Restored Data
    await updateJobStage(job, "verifying_restored_data");
    const newCounts = await getDatabaseCounts();

    // 10. Mark Completed
    await writeJournal({
      jobId: job.id,
      type: "restore",
      stage: "completed",
      timestamp: new Date().toISOString(),
      safetySnapshotDir,
    });

    job.completedAt = new Date().toISOString();
    await updateJobStage(job, "completed", "Pemulihan data berhasil diselesaikan.");
  } catch (err: any) {
    // Rollback procedure using safety backup
    await updateJobStage(job, "rolling_back", err.message || "Kegagalan saat restore. Memulai rollback...");

    try {
      const safetyDump = path.join(safetySnapshotDir, "safety.dump");
      if (existsSync(safetyDump)) {
        await execAsync(
          `pg_restore --clean --if-exists --no-owner --no-privileges --single-transaction -d "${env.PGDATABASE}" "${safetyDump}"`,
          { env }
        );
      }

      const safetyMediaQb = path.join(safetySnapshotDir, "media", "question-bank");
      if (existsSync(safetyMediaQb)) {
        await fs.rm(MEDIA_QB_DIR, { recursive: true, force: true }).catch(() => {});
        await fs.mkdir(MEDIA_QB_DIR, { recursive: true });
        await execAsync(`cp -r "${safetyMediaQb}/." "${MEDIA_QB_DIR}/" 2>/dev/null || true`);
      }

      const safetyMediaExams = path.join(safetySnapshotDir, "media", "exams");
      if (existsSync(safetyMediaExams)) {
        await fs.rm(MEDIA_EXAMS_DIR, { recursive: true, force: true }).catch(() => {});
        await fs.mkdir(MEDIA_EXAMS_DIR, { recursive: true });
        await execAsync(`cp -r "${safetyMediaExams}/." "${MEDIA_EXAMS_DIR}/" 2>/dev/null || true`);
      }

      await writeJournal({
        jobId: job.id,
        type: "restore",
        stage: "failed",
        timestamp: new Date().toISOString(),
        safetySnapshotDir,
        error: `Rollback berhasil dieksekusi setelah galat: ${err.message}`,
      });
    } catch (rollbackErr: any) {
      await writeJournal({
        jobId: job.id,
        type: "restore",
        stage: "failed",
        timestamp: new Date().toISOString(),
        safetySnapshotDir,
        error: `Fatal rollback error: ${rollbackErr.message}`,
      });
    }

    job.status = "failed";
    job.error = err.message || "Restore gagal";
    job.completedAt = new Date().toISOString();
    await writeJobState(job);
  } finally {
    coordinator.maintenance = false;
    coordinator.maintenanceReason = null;
    await fs.rm(extractionDir, { recursive: true, force: true }).catch(() => {});
  }
}

// ─── CRASH RECOVERY ON BOOT ──────────────────────────────────────────────────
export async function recoverRestoreJournalOnBoot(): Promise<void> {
  const journal = await readJournal();
  if (!journal) return;

  if (journal.stage !== "completed" && journal.stage !== "failed") {
    console.warn(`[BootRecovery] Ditemukan proses restore '${journal.jobId}' yang belum selesai (stage: ${journal.stage}).`);
    const { env } = parseDatabaseEnv();

    try {
      const safetyDump = path.join(journal.safetySnapshotDir, "safety.dump");
      if (existsSync(safetyDump)) {
        console.log(`[BootRecovery] Memulihkan database dari safety backup: ${safetyDump}`);
        await execAsync(
          `pg_restore --clean --if-exists --no-owner --no-privileges --single-transaction -d "${env.PGDATABASE}" "${safetyDump}"`,
          { env }
        );
      }

      const safetyMediaQb = path.join(journal.safetySnapshotDir, "media", "question-bank");
      if (existsSync(safetyMediaQb)) {
        await fs.rm(MEDIA_QB_DIR, { recursive: true, force: true }).catch(() => {});
        await fs.mkdir(MEDIA_QB_DIR, { recursive: true });
        await execAsync(`cp -r "${safetyMediaQb}/." "${MEDIA_QB_DIR}/" 2>/dev/null || true`);
      }

      const safetyMediaExams = path.join(journal.safetySnapshotDir, "media", "exams");
      if (existsSync(safetyMediaExams)) {
        await fs.rm(MEDIA_EXAMS_DIR, { recursive: true, force: true }).catch(() => {});
        await fs.mkdir(MEDIA_EXAMS_DIR, { recursive: true });
        await execAsync(`cp -r "${safetyMediaExams}/." "${MEDIA_EXAMS_DIR}/" 2>/dev/null || true`);
      }

      journal.stage = "failed";
      journal.error = "Dipulihkan secara otomatis saat server boot dari kondisi pengaman.";
      await writeJournal(journal);
      console.log(`[BootRecovery] Database dan media berhasil dipulihkan dari kondisi pengaman.`);
    } catch (err: any) {
      console.error(`[BootRecovery] Gagal memulihkan dari kondisi pengaman:`, err);
      coordinator.maintenance = true;
      coordinator.maintenanceReason = "Sistem dalam pemeliharaan darurat: kegagalan pemulihan restore.";
    }
  }
}

