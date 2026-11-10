import { NextRequest } from "next/server";
import fs from "fs/promises";
import path from "path";
import { existsSync } from "fs";
import { requireAdmin } from "@/lib/middleware/auth";
import { successResponse, errorResponse, safeErrorMessage } from "@/lib/response";
import { AppError } from "@/lib/errors";
import {
  ARCHIVES_DIR,
  ensureBackupDirectories,
  startBackupJob,
  readJobState,
  validateBackupArchive,
} from "@/lib/backup-restore";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    await ensureBackupDirectories();

    const files = await fs.readdir(ARCHIVES_DIR);
    const backups: any[] = [];

    for (const filename of files) {
      if (!filename.endsWith(".tar.gz")) continue;
      const filePath = path.join(ARCHIVES_DIR, filename);
      try {
        const stat = await fs.stat(filePath);
        let manifest = null;
        try {
          manifest = await validateBackupArchive(filePath);
        } catch {
          // If manifest cannot be read, still list the file
        }

        backups.push({
          filename,
          size: stat.size,
          createdAt: stat.birthtime.toISOString() || stat.mtime.toISOString(),
          manifest,
        });
      } catch {
        // Skip unreadable files
      }
    }

    // Sort newest first
    backups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const currentJob = await readJobState();

    return successResponse({
      backups,
      currentJob,
    });
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err.code, err.message, err.statusCode, err.details);
    return errorResponse("INTERNAL_SERVER_ERROR", safeErrorMessage(err, "Gagal mengambil daftar backup"), 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin(req);
    const result = await startBackupJob(admin.teacherId);
    return successResponse(result, 202);
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err.code, err.message, err.statusCode, err.details);
    return errorResponse("INTERNAL_SERVER_ERROR", safeErrorMessage(err, "Gagal memulai pekerjaan backup"), 500);
  }
}

