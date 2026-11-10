import { retrySerializable } from "@/lib/transaction-retry";
import { NextRequest } from "next/server";
import { z } from "zod";
import { authenticateTeacher } from "@/lib/middleware/auth";
import { prisma } from "@/lib/prisma";
import { generateUniqueAccessCode } from "@/lib/code-generator";
import { successResponse, errorResponse, safeErrorMessage } from "@/lib/response";
import { AppError } from "@/lib/errors";
import { normalizeQuestionForDb } from "@/services/question-parser";

const createExamSchema = z.object({
  title: z.string().min(3, "Judul ujian minimal 3 karakter"),
  description: z.string().nullable().optional(),
  durationMinutes: z.number().int().min(5, "Durasi minimal 5 menit").max(360, "Durasi maksimal 360 menit"),
  classroomId: z.string().min(1).nullable().optional(),
  subjectId: z.string().min(1).nullable().optional(),
  className: z.string().trim().min(1).max(100).nullable().optional(),
  academicYear: z.string().trim().min(1).max(30).nullable().optional(),
  semester: z.enum(["ganjil", "genap"]).nullable().optional(),
  category: z.string().trim().min(1).max(100).nullable().optional(),
  categoryNumber: z.number().int().positive().nullable().optional(),
  scheduledStartAt: z.string().datetime({ offset: true }).nullable().optional(),
  passingScore: z.number().int().min(0).max(100).nullable().optional(),
  bankId: z.string().min(1).nullable().optional(),
  bankRevision: z.number().int().positive().nullable().optional(),
  questionIds: z.array(z.string().min(1)).min(1).max(200).nullable().optional(),
  violationPolicy: z
    .object({
      max_violations: z.number().int().min(1).default(3),
      action: z.enum(["warning", "lock", "review", "auto_end"]).default("lock"),
      detect_copy_paste: z.boolean().optional(),
      detect_right_click: z.boolean().default(true),
      detect_devtools: z.boolean().default(true),
      detect_tab_switch: z.boolean().default(true),
      detect_fullscreen_exit: z.boolean().default(true),
      detect_screenshot: z.boolean().default(true),
      detect_ip_change: z.boolean().default(true),
      detect_focus_loss: z.boolean().default(true),
      detect_split_screen: z.boolean().default(true),
    })
    .passthrough()
    .default({
      max_violations: 3,
      action: "lock",
      detect_copy_paste: false,
      detect_right_click: true,
      detect_devtools: true,
      detect_tab_switch: true,
      detect_fullscreen_exit: true,
      detect_screenshot: true,
      detect_ip_change: true,
      detect_focus_loss: true,
      detect_split_screen: true,
    }),
  settings: z
    .object({
      randomize_questions: z.boolean().default(true),
      randomize_choices: z.boolean().default(true),
      display_mode: z.enum(["one_by_one", "all_at_once"]).default("one_by_one"),
      auto_save_interval_seconds: z.number().int().min(5).max(120).default(30),
      bank_id: z.string().optional(),
      bank_title: z.string().optional(),
      show_score_to_student: z.boolean().default(true),
      allow_answer_review: z.boolean().default(false),
      question_selection: z
        .object({
          mode: z.enum(["manual", "random_once", "random_per_student"]).default("manual"),
          count: z.number().int().positive().max(200).nullable().optional(),
        })
        .nullable()
        .optional(),
    })
    .passthrough()
    .default({
      randomize_questions: true,
      randomize_choices: true,
      display_mode: "one_by_one",
      auto_save_interval_seconds: 30,
      show_score_to_student: true,
      allow_answer_review: false,
      question_selection: { mode: "manual" },
    }),
  questions: z.array(z.any()).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const teacher = await authenticateTeacher(req);
    const searchParams = req.nextUrl.searchParams;
    const status = searchParams.get("status");
    const teacherIdFilter = searchParams.get("teacherId");
    const classroomIdFilter = searchParams.get("classroomId");
    const subjectIdFilter = searchParams.get("subjectId");
    const gradeLevelIdFilter = searchParams.get("gradeLevelId");

    const where: any = {};
    if (teacherIdFilter) {
      where.teacherId = teacherIdFilter;
    }
    if (searchParams.get("unmappedClassroom") === "true") {
      where.classroomId = null;
    } else if (classroomIdFilter) {
      where.classroomId = classroomIdFilter;
    }
    if (subjectIdFilter) {
      where.subjectId = subjectIdFilter;
    }
    if (searchParams.get("unmappedGrade") === "true") {
      where.AND = [{ OR: [{ subjectId: null }, { subjectFolder: { gradeLevelId: null } }] }];
    } else if (gradeLevelIdFilter) {
      where.AND = [{ OR: [
        { classroom: { gradeLevelId: gradeLevelIdFilter } },
        { subjectFolder: { gradeLevelId: gradeLevelIdFilter } },
      ] }];
    }
    if (status) {
      where.status = status;
    }
    if (searchParams.get("missingClassName") === "true") {
      where.AND = [...(where.AND || []), { OR: [{ className: null }, { className: "" }] }];
    }

    // Opt-in pagination for dashboard clients; requests without limit keep the existing response.
    if (searchParams.has("limit")) {
      const parsed = z.object({
        limit: z.coerce.number().int().min(1).max(50),
        cursor: z.string().min(1).max(128).optional(),
        status: z.enum(["draft", "active", "ended", "archived"]).optional(),
        search: z.string().trim().max(100).optional(),
        subject: z.string().trim().max(100).optional(),
        className: z.string().trim().max(100).optional(),
        academicYear: z.string().trim().max(30).optional(),
        semester: z.enum(["ganjil", "genap"]).optional(),
        category: z.string().trim().max(100).optional(),
      }).safeParse({
        limit: searchParams.get("limit"),
        cursor: searchParams.get("cursor") ?? undefined,
        status: status ?? undefined,
        search: searchParams.get("search") || undefined,
        subject: searchParams.get("subject") || undefined,
        className: searchParams.get("className") || undefined,
        academicYear: searchParams.get("academicYear") || undefined,
        semester: searchParams.get("semester") || undefined,
        category: searchParams.get("category") || undefined,
      });
      if (!parsed.success) return errorResponse("VALIDATION_ERROR", "Parameter halaman ujian tidak valid", 400);

      const { limit, cursor } = parsed.data;
      const filters = parsed.data;
      if (filters.subject) where.subjectName = filters.subject;
      if (filters.className) where.className = filters.className;
      if (filters.academicYear) where.academicYear = filters.academicYear;
      if (filters.semester) where.semester = filters.semester;
      if (filters.category) where.category = filters.category;
      if (filters.search) where.OR = ["title", "subjectName", "className", "category", "academicYear"].map(field => ({ [field]: { contains: filters.search, mode: "insensitive" } }));
      if (cursor) {
        const anchor = await prisma.exam.findFirst({ where: { ...where, id: cursor }, select: { id: true } });
        if (!anchor) return errorResponse("INVALID_CURSOR", "Halaman ujian tidak ditemukan", 400);
      }
      const exams = await prisma.exam.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        select: {
          id: true, title: true, status: true, accessCode: true, durationMinutes: true,
          createdAt: true, startTime: true, endTime: true,
          description: true, subjectId: true, subjectName: true, className: true, academicYear: true, semester: true,
          category: true, categoryNumber: true, scheduledStartAt: true, passingScore: true, revision: true, settings: true, violationPolicy: true,
          _count: { select: { questions: true, students: true } },
        },
      });
      const items = exams.slice(0, limit);
      return successResponse({ items, nextCursor: exams.length > limit ? items[items.length - 1]?.id ?? null : null }, 200, { "Cache-Control": "private, no-store" });
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
      const fieldErrors = parsed.error.flatten().fieldErrors;
      const detailsStr = Object.entries(fieldErrors)
        .map(([field, errs]) => `${field}: ${errs?.join(", ")}`)
        .join("; ");
      return errorResponse(
        "VALIDATION_ERROR",
        detailsStr ? `Data ujian tidak valid (${detailsStr})` : "Data ujian tidak valid",
        400,
        fieldErrors
      );
    }

    const { title, description, durationMinutes, violationPolicy, settings, questions } = parsed.data;
    const accessCode = await generateUniqueAccessCode(6);

    const exam = await retrySerializable(() => prisma.$transaction(async (tx) => {
      const selection = parsed.data;
      const classroom = selection.classroomId ? await tx.classroom.findUnique({ where: { id: selection.classroomId }, include: { gradeLevel: true } }) : null;
      if (selection.classroomId && !classroom) throw new AppError("NOT_FOUND", "Kelas tidak ditemukan", 404);

      const subject = selection.subjectId ? await tx.subject.findUnique({ where: { id: selection.subjectId }, include: { gradeLevel: true } }) : null;
      if (selection.subjectId && !subject) throw new AppError("NOT_FOUND", "Mata pelajaran tidak ditemukan", 404);

      if (classroom && subject && classroom.gradeLevelId !== subject.gradeLevelId) {
        throw new AppError("VALIDATION_ERROR", "Kelas dan mata pelajaran harus berada dalam tingkat yang sama.", 400);
      }

      const bank = selection.bankId ? await tx.questionBank.findUnique({ where: { id: selection.bankId }, include: { questions: { orderBy: { orderIndex: "asc" } }, subjectFolder: true } }) : null;
      if (selection.bankId && (!bank || bank.revision !== selection.bankRevision)) throw new AppError("CONFLICT", "Bank soal berubah. Muat ulang dan pilih soal kembali.", 409);
      if (bank && subject && bank.subjectId !== subject.id) throw new AppError("VALIDATION_ERROR", "Bank soal tidak berada dalam mata pelajaran yang dipilih.", 400);
      const selected = bank ? bank.questions.filter(q => !selection.questionIds || selection.questionIds.includes(q.id)) : [];
      if (bank && (!selected.length || (selection.questionIds && selected.length !== new Set(selection.questionIds).size))) throw new AppError("VALIDATION_ERROR", "Pilih soal yang tersedia dalam bank.", 400);
      if (bank && selected.length > 200) throw new AppError("VALIDATION_ERROR", "Kandidat soal tidak boleh melebihi batas 200 soal.", 400);

      const qSel = (settings as any)?.question_selection;
      if (qSel && bank) {
        const count = typeof qSel.count === "number" ? qSel.count : selected.length;
        if (qSel.mode === "random_per_student" || qSel.mode === "random_once") {
          if (count < 1 || count > selected.length) {
            throw new AppError("VALIDATION_ERROR", "Jumlah soal harus antara 1 dan jumlah kandidat soal yang tersedia.", 400);
          }
        }
      }

      const resolvedClassName = classroom ? classroom.name : (selection.className ?? null);
      const resolvedSubjectName = subject ? (subject.gradeLevel ? `${subject.name} · ${subject.gradeLevel.name}` : subject.name) : null;

      const created = await tx.exam.create({
        data: {
          teacherId: teacher.teacherId,
          title,
          description: description || null,
          durationMinutes,
          accessCode,
          status: "draft",
          classroomId: classroom?.id ?? null,
          className: resolvedClassName,
          subjectId: subject?.id ?? null,
          subjectName: resolvedSubjectName,
          academicYear: selection.academicYear,
          semester: selection.semester,
          category: selection.category,
          categoryNumber: selection.categoryNumber,
          scheduledStartAt: selection.scheduledStartAt ? new Date(selection.scheduledStartAt) : null,
          passingScore: selection.passingScore,
          updatedBy: teacher.teacherId,
          revision: 1,
          violationPolicy: { ...violationPolicy, detect_copy_paste: false } as any,
          settings: settings as any,
        },
      });

      if (bank) {
        await tx.question.createMany({ data: selected.map((q, idx) => ({
          examId: created.id, orderIndex: idx + 1, questionText: q.questionText,
          content: q.content === null ? undefined : q.content as any, imageUrl: q.imageUrl, imageAlt: q.imageAlt,
          hint: q.hint, hintContent: q.hintContent === null ? undefined : q.hintContent as any, type: q.type,
          options: q.options as any, correctAnswer: Array.isArray(q.correctAnswers) && q.correctAnswers.length ? q.correctAnswers.join(",") : q.correctAnswer || "", points: q.points,
        })) });
      }

      if (!bank && Array.isArray(questions) && questions.length > 0) {
        const questionData = questions.map((q, idx) => {
          const norm = normalizeQuestionForDb(q, idx);
          return {
            examId: created.id,
            orderIndex: norm.orderIndex,
            questionText: norm.questionText,
            content: norm.content === undefined ? undefined : norm.content as any,
            imageUrl: norm.imageUrl,
            imageAlt: norm.imageAlt,
            hint: norm.hint,
            hintContent: norm.hintContent === undefined ? undefined : norm.hintContent as any,
            type: norm.type || "single_choice",
            options: norm.options as any,
            correctAnswer: norm.correctAnswer,
            points: norm.points,
          };
        });
        await tx.question.createMany({ data: questionData });
      }

      return tx.exam.findUnique({
        where: { id: created.id },
        include: {
          _count: {
            select: {
              questions: true,
              students: true,
            },
          },
        },
      });
    }, { isolationLevel: "Serializable" }));

    return successResponse(exam, 201);

  } catch (err: any) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    return errorResponse("INTERNAL_SERVER_ERROR", safeErrorMessage(err, "Gagal membuat ujian"), 500);
  }
}
