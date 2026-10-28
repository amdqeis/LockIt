import { NextRequest } from "next/server";
import { z } from "zod";
import { authenticateTeacher } from "@/lib/middleware/auth";
import { prisma } from "@/lib/prisma";
import { generateUniqueAccessCode } from "@/lib/code-generator";
import { successResponse, errorResponse, safeErrorMessage } from "@/lib/response";
import { AppError } from "@/lib/errors";

const createExamSchema = z.object({
  title: z.string().min(3, "Judul ujian minimal 3 karakter"),
  description: z.string().optional(),
  durationMinutes: z.number().int().min(5, "Durasi minimal 5 menit").max(360, "Durasi maksimal 360 menit"),
  violationPolicy: z
    .object({
      max_violations: z.number().int().min(1).default(5),
      action: z.enum(["warning", "lock", "review"]).default("warning"),
      detect_copy_paste: z.boolean().default(true),
      detect_right_click: z.boolean().default(false),
      detect_devtools: z.boolean().default(false),
    })
    .default({
      max_violations: 5,
      action: "warning",
      detect_copy_paste: true,
      detect_right_click: false,
      detect_devtools: false,
    }),
  settings: z
    .object({
      randomize_questions: z.boolean().default(true),
      display_mode: z.enum(["one_by_one", "all_at_once"]).default("one_by_one"),
      auto_save_interval_seconds: z.number().int().min(5).max(120).default(30),
    })
    .default({
      randomize_questions: true,
      display_mode: "one_by_one",
      auto_save_interval_seconds: 30,
    }),
});

export async function GET(req: NextRequest) {
  try {
    const teacher = await authenticateTeacher(req);
    const searchParams = req.nextUrl.searchParams;
    const status = searchParams.get("status");

    const where: any = { teacherId: teacher.teacherId };
    if (status) {
      where.status = status;
    }

    const exams = await prisma.exam.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: {
            questions: true,
            students: true,
          },
        },
      },
    });

    return successResponse(exams);
  } catch (err: any) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    return errorResponse("INTERNAL_SERVER_ERROR", safeErrorMessage(err, "Gagal mengambil daftar ujian"), 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const teacher = await authenticateTeacher(req);

    const body = await req.json().catch(() => null);
    if (!body) {
      return errorResponse("INVALID_BODY", "Request body harus berupa JSON", 400);
    }

    const parsed = createExamSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Data ujian tidak valid", 400, parsed.error.flatten().fieldErrors);
    }

    const { title, description, durationMinutes, violationPolicy, settings } = parsed.data;
    const accessCode = await generateUniqueAccessCode(6);

    const exam = await prisma.exam.create({
      data: {
        teacherId: teacher.teacherId,
        title,
        description: description || null,
        durationMinutes,
        accessCode,
        status: "draft",
        violationPolicy,
        settings,
      },
    });

    return successResponse(exam, 201);
  } catch (err: any) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    return errorResponse("INTERNAL_SERVER_ERROR", safeErrorMessage(err, "Gagal membuat ujian"), 500);
  }
}
