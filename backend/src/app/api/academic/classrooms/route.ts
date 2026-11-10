import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authenticateTeacher } from "@/lib/middleware/auth";
import { successResponse, errorResponse, safeErrorMessage } from "@/lib/response";
import { AppError } from "@/lib/errors";
import { normalizeName } from "@/lib/academic";

const createSchema = z.object({
  gradeLevelId: z.string().min(1, "Tingkat wajib dipilih"),
  name: z.string().trim().min(1, "Nama rombel tidak boleh kosong").max(50),
});

export async function GET(req: NextRequest) {
  try {
    await authenticateTeacher(req);
    const searchParams = req.nextUrl.searchParams;
    const gradeLevelId = searchParams.get("gradeLevelId");
    const includeArchived = searchParams.get("includeArchived") === "true";

    const where: any = {};
    if (gradeLevelId) where.gradeLevelId = gradeLevelId;
    if (!includeArchived) where.isArchived = false;

    const classrooms = await prisma.classroom.findMany({
      where,
      orderBy: { name: "asc" },
      include: {
        gradeLevel: {
          select: { id: true, name: true, isArchived: true },
        },
        _count: {
          select: {
            exams: true,
          },
        },
      },
    });

    return successResponse(classrooms);
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err.code, err.message, err.statusCode, err.details);
    return errorResponse("INTERNAL_SERVER_ERROR", safeErrorMessage(err, "Gagal mengambil daftar rombel"), 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    await authenticateTeacher(req);
    const body = await req.json().catch(() => null);
    if (!body) return errorResponse("INVALID_BODY", "Request body harus berupa JSON", 400);

    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return errorResponse("VALIDATION_ERROR", "Data rombel tidak valid", 400, parsed.error.flatten().fieldErrors);

    const { gradeLevelId } = parsed.data;
    const name = parsed.data.name.trim();
    const normalizedName = normalizeName(name);

    const gradeLevel = await prisma.gradeLevel.findUnique({ where: { id: gradeLevelId } });
    if (!gradeLevel) return errorResponse("NOT_FOUND", "Tingkat tidak ditemukan", 404);
    if (gradeLevel.isArchived) return errorResponse("CONFLICT", "Tingkat yang diarsipkan tidak dapat menerima rombel baru.", 409);

    const existing = await prisma.classroom.findUnique({
      where: {
        gradeLevelId_normalizedName: {
          gradeLevelId,
          normalizedName,
        },
      },
    });

    if (existing) {
      if (existing.isArchived) {
        const unarchived = await prisma.classroom.update({
          where: { id: existing.id },
          data: { isArchived: false, name },
          include: { gradeLevel: { select: { id: true, name: true } } },
        });
        return successResponse(unarchived, 200);
      }
      return errorResponse("CONFLICT", `Rombel "${name}" sudah terdaftar pada tingkat tersebut.`, 409);
    }

    const created = await prisma.classroom.create({
      data: {
        gradeLevelId,
        name,
        normalizedName,
      },
      include: {
        gradeLevel: {
          select: { id: true, name: true },
        },
      },
    });

    return successResponse(created, 201);
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err.code, err.message, err.statusCode, err.details);
    return errorResponse("INTERNAL_SERVER_ERROR", safeErrorMessage(err, "Gagal menambahkan rombel"), 500);
  }
}

