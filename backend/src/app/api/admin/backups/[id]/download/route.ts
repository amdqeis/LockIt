import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import { createReadStream, existsSync } from "fs";
import path from "path";
import { Readable } from "stream";
import { requireAdmin } from "@/lib/middleware/auth";
import { errorResponse, safeErrorMessage } from "@/lib/response";
import { AppError } from "@/lib/errors";
import { ARCHIVES_DIR } from "@/lib/backup-restore";

type Context = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Context) {
  try {
    await requireAdmin(req);
    const { id: rawFilename } = await params;
    const filename = path.basename(rawFilename);

    if (!filename.endsWith(".tar.gz")) {
      return errorResponse("VALIDATION_ERROR", "Format berkas tidak valid", 400);
    }

    const filePath = path.join(ARCHIVES_DIR, filename);
    if (!existsSync(filePath)) {
      return errorResponse("NOT_FOUND", "Berkas backup tidak ditemukan", 404);
    }

    const stat = await fs.stat(filePath);
    const nodeStream = createReadStream(filePath);
    const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;

    return new NextResponse(webStream, {
      headers: {
        "Content-Type": "application/gzip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(stat.size),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err.code, err.message, err.statusCode, err.details);
    return errorResponse("INTERNAL_SERVER_ERROR", safeErrorMessage(err, "Gagal mengunduh backup"), 500);
  }
}

