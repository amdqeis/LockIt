import { retrySerializable } from "@/lib/transaction-retry";
import { NextRequest } from "next/server";
import { z } from "zod";
import { authenticateTeacher } from "@/lib/middleware/auth";
import { prisma } from "@/lib/prisma";
import { successResponse, errorResponse, safeErrorMessage } from "@/lib/response";
import { AppError } from "@/lib/errors";
import { normalizeQuestionForDb } from "@/services/question-parser";

const updateExamSchema = z.object({
  title: z.string().min(3).optional(),
  description: z.string().nullable().optional(),
  durationMinutes: z.number().int().min(5).max(360).optional(),
  revision: z.number().int().positive().optional(),
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
      max_violations: z.number().int().min(1).optional(),
      action: z.enum(["warning", "lock", "review"]).optional(),
      detect_copy_paste: z.boolean().optional(),
      detect_right_click: z.boolean().optional(),
      detect_devtools: z.boolean().optional(),
      detect_tab_switch: z.boolean().optional(),
      detect_fullscreen_exit: z.boolean().optional(),
      detect_screenshot: z.boolean().optional(),
      detect_ip_change: z.boolean().optional(),
      detect_focus_loss: z.boolean().optional(),
      detect_split_screen: z.boolean().optional(),
    })
    .passthrough()
    .optional(),
  settings: z
    .object({
      randomize_questions: z.boolean().optional(),
      randomize_choices: z.boolean().optional(),
      display_mode: z.enum(["one_by_one", "all_at_once"]).optional(),
      auto_save_interval_seconds: z.number().int().min(5).max(120).optional(),
      bank_id: z.string().optional(),
      bank_title: z.string().optional(),
      show_score_to_student: z.boolean().optional(),
      allow_answer_review: z.boolean().optional(),
      question_selection: z
        .object({
          mode: z.enum(["manual", "random_once", "random_per_student"]).optional(),
          count: z.number().int().positive().max(200).nullable().optional(),
        })
        .nullable()
        .optional(),
    })
    .passthrough()
    .optional(),
  questions: z.array(z.any()).optional(),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const teacher = await authenticateTeacher(req);
    const { id } = await params;

    const exam = await prisma.exam.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            questions: true,
            students: true,
          },
        },
      },
    });

    // Collaborative access: Guru & Admin dapat melihat semua ujian
    if (!exam) {
      return errorResponse("NOT_FOUND", "Ujian tidak ditemukan", 404);
    }

    return successResponse(exam);
  } catch (err: any) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    return errorResponse("INTERNAL_SERVER_ERROR", safeErrorMessage(err, "Gagal mengambil data ujian"), 500);
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const teacher = await authenticateTeacher(req);
    const { id } = await params;

    const exam = await prisma.exam.findUnique({
      where: { id },
      include: { _count: { select: { students: true } } },
    });

    // Collaborative access: Guru & Admin dapat mengedit semua ujian
    if (!exam) {
      return errorResponse("NOT_FOUND", "Ujian tidak ditemukan", 404);
    }

    if (exam.status === "ended" || exam.status === "archived") {
      return errorResponse("INVALID_STATE", "Ujian yang telah selesai atau diarsipkan tidak dapat diubah", 400);
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return errorResponse("INVALID_BODY", "Request body harus berupa JSON", 400);
    }

    const parsed = updateExamSchema.safeParse(body);
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      const detailsStr = Object.entries(fieldErrors)
        .map(([field, errs]) => `${field}: ${errs?.join(", ")}`)
        .join("; ");
      return errorResponse(
        "VALIDATION_ERROR",
        detailsStr ? `Data update tidak valid (${detailsStr})` : "Data update tidak valid",
        400,
        fieldErrors
      );
    }

    if (parsed.data.revision && parsed.data.revision !== exam.revision) {
      return errorResponse("CONFLICT", "Ujian telah berubah. Muat ulang sebelum menyimpan.", 409);
    }

    const updateData: any = {
      updatedBy: teacher.teacherId,
    };
    const normalizedViolationPolicy = parsed.data.violationPolicy
      ? { ...parsed.data.violationPolicy, detect_copy_paste: false }
      : undefined;

    if (exam.status === "active") {
      // When exam is active, only violation policy and review/score display settings can be modified
      if (normalizedViolationPolicy) {
        updateData.violationPolicy = {
          ...(typeof exam.violationPolicy === "object" && exam.violationPolicy !== null ? exam.violationPolicy : {}),
          ...normalizedViolationPolicy,
        };
      }
      if (parsed.data.settings) {
        if (parsed.data.settings.question_selection !== undefined) {
          return errorResponse("INVALID_STATE", "Pengaturan pemilihan soal tidak dapat diubah setelah ujian aktif.", 409);
        }
        const currentSettings = typeof exam.settings === "object" && exam.settings !== null ? exam.settings as any : {};
        updateData.settings = {
          ...currentSettings,
          show_score_to_student: parsed.data.settings.show_score_to_student !== undefined
            ? parsed.data.settings.show_score_to_student
            : currentSettings.show_score_to_student,
          allow_answer_review: parsed.data.settings.allow_answer_review !== undefined
            ? parsed.data.settings.allow_answer_review
            : currentSettings.allow_answer_review,
        };
      }
    } else {
      // Draft status: all fields can be edited
      if (parsed.data.title !== undefined) updateData.title = parsed.data.title;
      if (parsed.data.description !== undefined) updateData.description = parsed.data.description;
      if (parsed.data.durationMinutes !== undefined) updateData.durationMinutes = parsed.data.durationMinutes;

      const targetClassroomId = parsed.data.classroomId !== undefined ? parsed.data.classroomId : exam.classroomId;
      const targetSubjectId = parsed.data.subjectId !== undefined ? parsed.data.subjectId : exam.subjectId;

      let classroom = null;
      if (targetClassroomId) {
        classroom = await prisma.classroom.findUnique({ where: { id: targetClassroomId }, include: { gradeLevel: true } });
        if (!classroom) return errorResponse("NOT_FOUND", "Kelas tidak ditemukan", 404);
        updateData.classroomId = classroom.id;
        updateData.className = classroom.name;
      } else if (parsed.data.className !== undefined) {
        updateData.className = parsed.data.className;
      }

      let subject = null;
      if (targetSubjectId) {
        subject = await prisma.subject.findUnique({ where: { id: targetSubjectId }, include: { gradeLevel: true } });
        if (!subject) return errorResponse("NOT_FOUND", "Mata pelajaran tidak ditemukan", 404);
        updateData.subjectId = subject.id;
        updateData.subjectName = subject.gradeLevel ? `${subject.name} · ${subject.gradeLevel.name}` : subject.name;
      }

      if (classroom && subject && classroom.gradeLevelId !== subject.gradeLevelId) {
        return errorResponse("VALIDATION_ERROR", "Kelas dan mata pelajaran harus berada dalam tingkat yang sama.", 400);
      }

      for (const key of ["academicYear", "semester", "category", "categoryNumber", "passingScore"] as const) {
        if (parsed.data[key] !== undefined) updateData[key] = parsed.data[key];
      }
      if (parsed.data.scheduledStartAt !== undefined) updateData.scheduledStartAt = parsed.data.scheduledStartAt ? new Date(parsed.data.scheduledStartAt) : null;
      if (normalizedViolationPolicy !== undefined) {
        updateData.violationPolicy = {
          ...(typeof exam.violationPolicy === "object" && exam.violationPolicy !== null ? exam.violationPolicy : {}),
          ...normalizedViolationPolicy,
          detect_copy_paste: false,
        } as any;
      }
      if (parsed.data.settings !== undefined) {
        updateData.settings = {
          ...(typeof exam.settings === "object" && exam.settings !== null ? exam.settings : {}),
          ...parsed.data.settings,
        };
      }
    }

    const updated = await retrySerializable(() => prisma.$transaction(async (tx) => {
      const changed = await tx.exam.updateMany({
        where: { id, status: exam.status, ...(parsed.data.revision ? { revision: parsed.data.revision } : {}) },
        data: { ...updateData, revision: { increment: 1 } },
      });
      if (!changed.count) throw new AppError("CONFLICT", "Ujian telah berubah. Muat ulang sebelum menyimpan.", 409);

      if (exam.status === "draft" && parsed.data.bankId) {
        const source = await tx.questionBank.findUnique({ where: { id: parsed.data.bankId }, include: { questions: { orderBy: { orderIndex: "asc" } } } });
        if (!source || source.revision !== parsed.data.bankRevision) throw new AppError("CONFLICT", "Bank soal berubah. Muat ulang dan pilih soal kembali.", 409);
        if (exam.subjectId && source.subjectId !== exam.subjectId) throw new AppError("VALIDATION_ERROR", "Bank soal tidak sesuai mata pelajaran ujian.", 400);
        const selected = source.questions.filter(q => parsed.data.questionIds?.includes(q.id));
        if (!selected.length || selected.length !== new Set(parsed.data.questionIds).size) throw new AppError("VALIDATION_ERROR", "Pilih soal yang tersedia dalam bank.", 400);
        if (selected.length > 200) throw new AppError("VALIDATION_ERROR", "Kandidat soal tidak boleh melebihi batas 200 soal.", 400);

        const qSel = (updateData.settings as any)?.question_selection;
        if (qSel && (qSel.mode === "random_per_student" || qSel.mode === "random_once")) {
          const count = typeof qSel.count === "number" ? qSel.count : selected.length;
          if (count < 1 || count > selected.length) {
            throw new AppError("VALIDATION_ERROR", "Jumlah soal harus antara 1 dan jumlah kandidat soal yang tersedia.", 400);
          }
        }
        await tx.question.deleteMany({ where: { examId: id } });
        await tx.question.createMany({ data: selected.map((q, index) => ({
          examId: id, orderIndex: index + 1, questionText: q.questionText,
          content: q.content === null ? undefined : q.content as any, imageUrl: q.imageUrl, imageAlt: q.imageAlt,
          hint: q.hint, hintContent: q.hintContent === null ? undefined : q.hintContent as any, type: q.type,
          options: q.options as any, correctAnswer: Array.isArray(q.correctAnswers) && q.correctAnswers.length ? q.correctAnswers.join(",") : q.correctAnswer || "", points: q.points,
        })) });
        await tx.exam.update({ where: { id }, data: { settings: { ...(updateData.settings || (typeof exam.settings === "object" && exam.settings !== null ? exam.settings : {})), bank_id: source.id, bank_title: source.title } } });
      }

      if (exam.status === "draft" && !parsed.data.bankId && Array.isArray(parsed.data.questions)) {
        await tx.question.deleteMany({ where: { examId: id } });
        if (parsed.data.questions.length > 0) {
          const questionData = parsed.data.questions.map((q, idx) => {
            const norm = normalizeQuestionForDb(q, idx);
            return {
              examId: id,
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
      }

      return tx.exam.findUnique({
        where: { id },
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

    return successResponse(updated);
  } catch (err: any) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    return errorResponse("INTERNAL_SERVER_ERROR", safeErrorMessage(err, "Gagal mengupdate ujian"), 500);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const teacher = await authenticateTeacher(req);
    const { id } = await params;

    const exam = await prisma.exam.findUnique({
      where: { id },
      include: { _count: { select: { students: true } } },
    });

    // Collaborative access: Guru & Admin dapat mengedit semua ujian
    if (!exam) {
      return errorResponse("NOT_FOUND", "Ujian tidak ditemukan", 404);
    }

    if (exam._count.students > 0 || exam.status === "active" || exam.status === "ended") {
      // Soft delete: status -> archived
      await prisma.exam.update({
        where: { id },
        data: { status: "archived" },
      });
      return successResponse({ message: "Ujian berhasil diarsipkan", archived: true });
    }

    // No students and still in draft: hard delete permitted
    await prisma.question.deleteMany({ where: { examId: id } });
    await prisma.exam.delete({ where: { id } });

    return successResponse({ message: "Ujian draft berhasil dihapus permanen", deleted: true });
  } catch (err: any) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    return errorResponse("INTERNAL_SERVER_ERROR", safeErrorMessage(err, "Gagal menghapus ujian"), 500);
  }
}
