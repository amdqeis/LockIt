import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { requireAdmin } from "@/lib/middleware/auth";
import { successResponse, errorResponse, safeErrorMessage } from "@/lib/response";
import { AppError } from "@/lib/errors";

// ─── SCHEMA ──────────────────────────────────────────────────────────────────

const listQuerySchema = z.object({
  page:     z.coerce.number().int().min(1).default(1),
  limit:    z.coerce.number().int().min(1).max(100).default(20),
  search:   z.string().optional(),
  role:     z.enum(["TEACHER", "ADMIN"]).optional(),
  isActive: z.enum(["true", "false"]).optional(),
});

const createTeacherSchema = z.object({
  email:    z.string().email("Format email tidak valid"),
  fullName: z.string().min(2, "Nama lengkap minimal 2 karakter"),
  phone:    z.string().max(20).optional().nullable(),
  password: z.string().min(8, "Password minimal 8 karakter"),
  role:     z.enum(["TEACHER", "ADMIN"]).default("TEACHER"),
});

// ─── GET /api/admin/teachers ──────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);

    const { searchParams } = new URL(req.url);
    const parsed = listQuerySchema.safeParse(Object.fromEntries(searchParams));
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Parameter query tidak valid", 400, parsed.error.flatten().fieldErrors);
    }

    const { page, limit, search, role, isActive } = parsed.data;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};
    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: "insensitive" } },
        { email:    { contains: search, mode: "insensitive" } },
      ];
    }
    if (role)     where.role     = role;
    if (isActive !== undefined) where.isActive = isActive === "true";

    const [teachers, total] = await Promise.all([
      prisma.teacher.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id:          true,
          email:       true,
          fullName:    true,
          role:        true,
          isActive:    true,
          phone:       true,
          lastLoginAt: true,
          createdAt:   true,
          _count:      { select: { exams: true } },
        },
      }),
      prisma.teacher.count({ where }),
    ]);

    const data = teachers.map((t) => ({
      id:          t.id,
      email:       t.email,
      fullName:    t.fullName,
      role:        t.role,
      isActive:    t.isActive,
      phone:       t.phone,
      lastLoginAt: t.lastLoginAt,
      examCount:   t._count.exams,
      createdAt:   t.createdAt,
    }));

    return successResponse({
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err: any) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    return errorResponse("INTERNAL_SERVER_ERROR", safeErrorMessage(err, "Gagal mengambil daftar guru"), 500);
  }
}

// ─── POST /api/admin/teachers ─────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);

    const body = await req.json().catch(() => null);
    if (!body) return errorResponse("INVALID_BODY", "Request body harus berupa JSON", 400);

    const parsed = createTeacherSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Data tidak valid", 400, parsed.error.flatten().fieldErrors);
    }

    const { email, fullName, phone, password, role } = parsed.data;
    const normalizedEmail = email.toLowerCase();

    // Cek duplikat email
    const existing = await prisma.teacher.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      return errorResponse("CONFLICT", "Email sudah terdaftar", 409);
    }

    const passwordHash = await hashPassword(password);

    const teacher = await prisma.teacher.create({
      data: {
        email:        normalizedEmail,
        fullName,
        phone:        phone ?? null,
        passwordHash,
        role,
        isActive:     true,
      },
      select: {
        id:        true,
        email:     true,
        fullName:  true,
        role:      true,
        isActive:  true,
        phone:     true,
        createdAt: true,
      },
    });

    return successResponse(teacher, 201);
  } catch (err: any) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    return errorResponse("INTERNAL_SERVER_ERROR", safeErrorMessage(err, "Gagal membuat akun guru"), 500);
  }
}
