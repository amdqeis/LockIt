import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authenticateTeacher } from "@/lib/middleware/auth";
import { successResponse, errorResponse, safeErrorMessage } from "@/lib/response";
import { AppError } from "@/lib/errors";
import { normalizeName, formatSubjectDisplayName } from "@/lib/academic";

const createSchema = z.object({
  name: z.string().trim().min(1, "Nama mata pelajaran tidak boleh kosong").max(100),
  gradeLevelId: z.string().min(1, "Tingkat wajib dipilih"),
});

export async function GET(req: NextRequest) {
  try {
    await authenticateTeacher(req);
    const searchParams = req.nextUrl.searchParams;
    const gradeLevelId = searchParams.get("gradeLevelId");
    const includeArchived = searchParams.get("includeArchived") === "true";
    const search = searchParams.get("search")?.trim();

    const where: any = {};
    if (gradeLevelId) where.gradeLevelId = gradeLevelId;
    if (!includeArchived) where.isArchived = false;
    if (search) {
      where.name = { contains: search, mode: "insensitive" };
    }

    const subjects = await prisma.subject.findMany({
      where,
      orderBy: [{ name: "asc" }, { id: "asc" }],
      include: {
        gradeLevel: {
          select: { id: true, name: true, isArchived: true },
        },
        _count: {
          select: { banks: true, exams: true },
        },
      },
    });

    const items = subjects.map((s) => ({
      ...s,
      displayName: formatSubjectDisplayName(s.name, s.gradeLevel?.name),
    }));

    return successResponse(items);
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err.code, err.message, err.statusCode, err.details);
    return errorResponse("INTERNAL_SERVER_ERROR", safeErrorMessage(err, "Gagal mengambil daftar mata pelajaran"), 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    await authenticateTeacher(req);
    const body = await req.json().catch(() => null);
    if (!body) return errorResponse("INVALID_BODY", "Request body harus berupa JSON", 400);

    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Data mata pelajaran tidak valid", 400, parsed.error.flatten().fieldErrors);
    }

    const { gradeLevelId } = parsed.data;
    const name = parsed.data.name.trim();
    const normalizedName = normalizeName(name);

    const gradeLevel = await prisma.gradeLevel.findUnique({ where: { id: gradeLevelId } });
    if (!gradeLevel) return errorResponse("NOT_FOUND", "Tingkat tidak ditemukan", 404);
    if (gradeLevel.isArchived) return errorResponse("CONFLICT", "Tingkat yang diarsipkan tidak dapat menerima mata pelajaran baru.", 409);

    const existing = await prisma.subject.findUnique({
      where: {
        gradeLevelId_normalizedName: {
          gradeLevelId,
          normalizedName,
        },
      },
      include: { gradeLevel: { select: { id: true, name: true } } },
    });

    if (existing) {
      if (existing.isArchived) {
        const unarchived = await prisma.subject.update({
          where: { id: existing.id },
          data: { isArchived: false, name },
          include: { gradeLevel: { select: { id: true, name: true } } },
        });
        return successResponse({
          ...unarchived,
          displayName: formatSubjectDisplayName(unarchived.name, unarchived.gradeLevel?.name),
        }, 200);
      }
      return errorResponse("CONFLICT", `Mata pelajaran "${name}" sudah terdaftar pada tingkat tersebut.`, 409);
    }

    const created = await prisma.subject.create({
      data: {
        name,
        normalizedName,
        gradeLevelId,
      },
      include: {
        gradeLevel: { select: { id: true, name: true } },
      },
    });

    return successResponse({
      ...created,
      displayName: formatSubjectDisplayName(created.name, created.gradeLevel?.name),
    }, 201);
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err.code, err.message, err.statusCode, err.details);
    return errorResponse("INTERNAL_SERVER_ERROR", safeErrorMessage(err, "Gagal menambahkan mata pelajaran"), 500);
  }
}
