import { NextRequest } from "next/server";
import path from "path";
import fs from "fs/promises";
import crypto from "crypto";
import { authenticateTeacher } from "@/lib/middleware/auth";
import { prisma } from "@/lib/prisma";
import { successResponse, errorResponse, safeErrorMessage } from "@/lib/response";
import { AppError } from "@/lib/errors";

const ALLOWED_MIME_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2 MB

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const teacher = await authenticateTeacher(req);
    const { id } = await params;

    const exam = await prisma.exam.findUnique({ where: { id } });
    if (!exam || (teacher.role !== "ADMIN" && exam.teacherId !== teacher.teacherId)) {
      return errorResponse("NOT_FOUND", "Ujian tidak ditemukan", 404);
    }

    const formData = await req.formData();
    const image = formData.get("image") as File | null;

    if (!image) {
      return errorResponse("IMAGE_REQUIRED", "File gambar wajib disertakan dalam field 'image'", 400);
    }

    if (!ALLOWED_MIME_TYPES.includes(image.type)) {
      return errorResponse("INVALID_IMAGE_TYPE", "Format gambar harus berupa PNG, JPG, atau WEBP", 400);
    }

    if (image.size > MAX_IMAGE_SIZE) {
      return errorResponse("IMAGE_TOO_LARGE", "Ukuran gambar maksimal 2MB", 400);
    }

    const ext = path.extname(image.name) || ".png";
    const randomName = `${crypto.randomBytes(12).toString("hex")}${ext}`;

    const uploadDir = path.join(process.cwd(), "public", "uploads", "exams", id);
    await fs.mkdir(uploadDir, { recursive: true });

    const filePath = path.join(uploadDir, randomName);
    const buffer = Buffer.from(await image.arrayBuffer());
    await fs.writeFile(filePath, buffer);

    const imageUrl = `/uploads/exams/${id}/${randomName}`;

    return successResponse({
      imageUrl,
      fileName: image.name,
      size: image.size,
    });
  } catch (err: any) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    return errorResponse("INTERNAL_SERVER_ERROR", safeErrorMessage(err, "Gagal mengunggah gambar"), 500);
  }
}
