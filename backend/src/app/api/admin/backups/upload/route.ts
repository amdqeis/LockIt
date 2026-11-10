import { NextRequest } from "next/server";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { requireAdmin } from "@/lib/middleware/auth";
import { successResponse, errorResponse, safeErrorMessage } from "@/lib/response";
import { AppError } from "@/lib/errors";
import { UPLOADS_DIR, ensureBackupDirectories, validateBackupArchive } from "@/lib/backup-restore";

export async function POST(req: NextRequest) {
  let tempFilePath: string | null = null;
  try {
    await requireAdmin(req);
    await ensureBackupDirectories();

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file || !(file instanceof File)) {
      return errorResponse("VALIDATION_ERROR", "Berkas backup wajib diunggah dalam form field 'file'.", 400);
    }

    const maxUploadBytes = 1024 * 1024 * 1024; // 1 GiB
    if (file.size > maxUploadBytes) {
      return errorResponse("VALIDATION_ERROR", "Ukuran berkas melebihi batas 1 GiB.", 413);
    }

    const uploadId = crypto.randomUUID();
    const uploadFilename = `upload-${uploadId}.tar.gz`;
    tempFilePath = path.join(UPLOADS_DIR, uploadFilename);

    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(tempFilePath, buffer);

    // Validate archive integrity, safety, and manifest
    const manifest = await validateBackupArchive(tempFilePath);

    return successResponse(
      {
        uploadId: uploadFilename,
        originalName: file.name,
        size: file.size,
        manifest,
      },
      201
    );
  } catch (err: any) {
    if (tempFilePath) {
      await fs.rm(tempFilePath, { force: true }).catch(() => {});
    }
    if (err instanceof AppError) return errorResponse(err.code, err.message, err.statusCode, err.details);
    return errorResponse("INTERNAL_SERVER_ERROR", safeErrorMessage(err, "Gagal memproses unggahan backup"), 500);
  }
}

