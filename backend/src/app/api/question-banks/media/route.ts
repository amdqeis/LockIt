import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { bankError, bankTeacher } from "@/lib/question-bank";
import { errorResponse, successResponse } from "@/lib/response";

const maxSize = 2 * 1024 * 1024;
export async function POST(req: NextRequest) {
  try {
    const teacher = await bankTeacher(req);
    const length = Number(req.headers.get("content-length") || 0);
    if (length > maxSize + 64 * 1024) return errorResponse("IMAGE_TOO_LARGE", "Ukuran gambar maksimal 2 MB", 413);
    const file = (await req.formData()).get("image");
    if (!(file instanceof File) || file.size === 0 || file.size > maxSize) return errorResponse("INVALID_IMAGE", "Pilih gambar berukuran maksimal 2 MB", 400);
    const bytes = Buffer.from(await file.arrayBuffer());
    const png = bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
    const jpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    const webp = bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
    const expected = png ? ["image/png", "png"] : jpeg ? ["image/jpeg", "jpg"] : webp ? ["image/webp", "webp"] : null;
    if (!expected || file.type !== expected[0]) return errorResponse("INVALID_IMAGE_TYPE", "Format gambar harus PNG, JPEG, atau WebP yang valid", 400);
    const filename = `${randomUUID()}.${expected[1]}`;
    const dir = path.join(process.cwd(), "storage", "question-bank");
    await mkdir(dir, { recursive: true });
    const target = path.join(dir, filename);
    await writeFile(target, bytes, { flag: "wx" });
    try {
      const media = await prisma.questionBankMedia.create({ data: { filename, mimeType: expected[0], size: bytes.length, uploadedBy: teacher.teacherId } });
      return successResponse({ id: media.id, url: `/api/question-banks/media/${media.id}` }, 201);
    } catch (err) { await unlink(target).catch(() => {}); throw err; }
  } catch (err) { return bankError(err); }
}
