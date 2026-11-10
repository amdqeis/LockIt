import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authenticateTeacher } from "@/lib/middleware/auth";
import { successResponse, errorResponse, safeErrorMessage } from "@/lib/response";
import { AppError } from "@/lib/errors";
import { normalizeName } from "@/lib/academic";

const createSchema = z.object({
  name: z.string().trim().min(1, "Nama tingkat tidak boleh kosong").max(50),
});

export async function GET(req: NextRequest) {
  try {
    await authenticateTeacher(req);
    const includeArchived = req.nextUrl.searchParams.get("includeArchived") === "true";

    const gradeLevels = await prisma.gradeLevel.findMany({
      where: includeArchived ? {} : { isArchived: false },
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: {
            classrooms: true,
            subjects: true,
          },
        },
      },
    });

    return successResponse(gradeLevels);
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err.code, err.message, err.statusCode, err.details);
    return errorResponse("INTERNAL_SERVER_ERROR", safeErrorMessage(err, "Gagal mengambil daftar tingkat"), 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    await authenticateTeacher(req);
    const body = await req.json().catch(() => null);
    if (!body) return errorResponse("INVALID_BODY", "Request body harus berupa JSON", 400);

    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return errorResponse("VALIDATION_ERROR", "Data tingkat tidak valid", 400, parsed.error.flatten().fieldErrors);

    const name = parsed.data.name.trim();
    const normalizedName = normalizeName(name);

    const existing = await prisma.gradeLevel.findUnique({ where: { normalizedName } });
    if (existing) {
      if (existing.isArchived) {
        // If archived, unarchive it
        const unarchived = await prisma.gradeLevel.update({
          where: { id: existing.id },
          data: { isArchived: false, name },
        });
        return successResponse(unarchived, 200);
      }
      return errorResponse("CONFLICT", `Tingkat dengan nama "${name}" sudah terdaftar.`, 409);
    }

    const created = await prisma.gradeLevel.create({
      data: {
        name,
        normalizedName,
      },
    });

    return successResponse(created, 201);
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err.code, err.message, err.statusCode, err.details);
    return errorResponse("INTERNAL_SERVER_ERROR", safeErrorMessage(err, "Gagal menambahkan tingkat"), 500);
  }
}

