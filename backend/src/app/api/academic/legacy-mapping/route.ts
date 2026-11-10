import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authenticateTeacher } from "@/lib/middleware/auth";
import { successResponse, errorResponse, safeErrorMessage } from "@/lib/response";
import { AppError } from "@/lib/errors";
import { normalizeName, parseLegacyClassName } from "@/lib/academic";

const mappingActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("mapSubject"),
    subjectId: z.string().min(1),
    gradeLevelId: z.string().min(1),
  }),
  z.object({
    action: z.literal("mapExam"),
    examId: z.string().min(1),
    classroomId: z.string().min(1),
    subjectId: z.string().min(1),
    revision: z.number().int().positive(),
  }),
  z.object({
    action: z.literal("mapBank"),
    bankId: z.string().min(1),
    subjectId: z.string().min(1),
    revision: z.number().int().positive(),
  }),
  z.object({
    action: z.literal("autoMapUnambiguous"),
  }),
]);

export async function GET(req: NextRequest) {
  try {
    await authenticateTeacher(req);

    const [unmappedSubjects, unmappedExams, allSubjects, allGradeLevels, allClassrooms] = await Promise.all([
      prisma.subject.findMany({
        where: { gradeLevelId: null },
        include: { _count: { select: { banks: true, exams: true } } },
      }),
      prisma.exam.findMany({
        where: {
          OR: [{ classroomId: null }, { subjectId: null }],
        },
        select: {
          id: true,
          title: true,
          status: true,
          className: true,
          subjectName: true,
          classroomId: true,
          subjectId: true,
          revision: true,
        },
      }),
      prisma.subject.findMany({
        include: { gradeLevel: { select: { id: true, name: true } } },
      }),
      prisma.gradeLevel.findMany({
        include: { classrooms: true },
      }),
      prisma.classroom.findMany({
        include: { gradeLevel: true },
      }),
    ]);

    const unmappedBanks = await prisma.questionBank.findMany({
      where: {
        OR: [
          { subjectId: null },
          { subjectFolder: { gradeLevelId: null } },
        ],
      },
      select: {
        id: true,
        title: true,
        subject: true,
        subjectId: true,
        revision: true,
        subjectFolder: {
          select: { id: true, name: true, gradeLevelId: true },
        },
      },
    });

    // Generate candidates for auto-mapping
    const candidateClassrooms: { rawClassName: string; parsedGrade: string; parsedClassroom: string }[] = [];
    const seenClasses = new Set<string>();
    for (const exam of unmappedExams) {
      if (exam.className && !seenClasses.has(exam.className)) {
        seenClasses.add(exam.className);
        const parsed = parseLegacyClassName(exam.className);
        if (parsed) {
          candidateClassrooms.push({
            rawClassName: exam.className,
            parsedGrade: parsed.gradeLevelName,
            parsedClassroom: parsed.classroomName,
          });
        }
      }
    }

    return successResponse({
      unmappedSubjects,
      unmappedExams,
      unmappedBanks,
      candidateClassrooms,
      allGradeLevels,
      allClassrooms,
      allSubjects,
      counts: {
        unmappedSubjects: unmappedSubjects.length,
        unmappedExams: unmappedExams.length,
        unmappedBanks: unmappedBanks.length,
      },
    });
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err.code, err.message, err.statusCode, err.details);
    return errorResponse("INTERNAL_SERVER_ERROR", safeErrorMessage(err, "Gagal mengambil data pemetaan"), 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const teacher = await authenticateTeacher(req);
    const body = await req.json().catch(() => null);
    if (!body) return errorResponse("INVALID_BODY", "Request body harus berupa JSON", 400);

    const parsed = mappingActionSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Data pemetaan tidak valid", 400, parsed.error.flatten().fieldErrors);
    }

    const data = parsed.data;

    if (data.action === "mapSubject") {
      const subject = await prisma.subject.findUnique({ where: { id: data.subjectId } });
      if (!subject) return errorResponse("NOT_FOUND", "Mata pelajaran tidak ditemukan", 404);
      const grade = await prisma.gradeLevel.findUnique({ where: { id: data.gradeLevelId } });
      if (!grade) return errorResponse("NOT_FOUND", "Tingkat tidak ditemukan", 404);

      const normalized = normalizeName(subject.name);
      const existing = await prisma.subject.findUnique({
        where: {
          gradeLevelId_normalizedName: {
            gradeLevelId: data.gradeLevelId,
            normalizedName: normalized,
          },
        },
      });
      if (existing && existing.id !== subject.id) {
        return errorResponse("CONFLICT", `Mata pelajaran "${subject.name}" sudah ada pada tingkat ${grade.name}.`, 409);
      }

      const updated = await prisma.subject.update({
        where: { id: data.subjectId },
        data: { gradeLevelId: data.gradeLevelId, normalizedName: normalized },
      });
      return successResponse(updated);
    }

    if (data.action === "mapExam") {
      const exam = await prisma.exam.findUnique({ where: { id: data.examId } });
      if (!exam) return errorResponse("NOT_FOUND", "Ujian tidak ditemukan", 404);
      if (exam.status === "active") {
        return errorResponse("CONFLICT", "Pemetaan ditolak selama ujian aktif.", 409);
      }
      if (exam.revision !== data.revision) {
        return errorResponse("CONFLICT", "Data ujian telah berubah. Muat ulang sebelum memetakan.", 409);
      }

      const classroom = await prisma.classroom.findUnique({ where: { id: data.classroomId } });
      if (!classroom) return errorResponse("NOT_FOUND", "Rombel tidak ditemukan", 404);

      const subject = await prisma.subject.findUnique({ where: { id: data.subjectId } });
      if (!subject) return errorResponse("NOT_FOUND", "Mata pelajaran tidak ditemukan", 404);

      if (classroom.gradeLevelId !== subject.gradeLevelId) {
        return errorResponse("VALIDATION_ERROR", "Rombel dan mata pelajaran harus berada dalam tingkat yang sama.", 400);
      }

      const updated = await prisma.exam.update({
        where: { id: data.examId },
        data: {
          classroomId: data.classroomId,
          subjectId: data.subjectId,
          revision: { increment: 1 },
          updatedBy: teacher.teacherId,
        },
      });
      return successResponse(updated);
    }

    if (data.action === "mapBank") {
      const bank = await prisma.questionBank.findUnique({ where: { id: data.bankId } });
      if (!bank) return errorResponse("NOT_FOUND", "Bank soal tidak ditemukan", 404);
      if (bank.revision !== data.revision) {
        return errorResponse("CONFLICT", "Data bank soal telah berubah. Muat ulang sebelum memetakan.", 409);
      }

      const subject = await prisma.subject.findUnique({ where: { id: data.subjectId } });
      if (!subject) return errorResponse("NOT_FOUND", "Mata pelajaran tidak ditemukan", 404);
      if (!subject.gradeLevelId) {
        return errorResponse("VALIDATION_ERROR", "Mata pelajaran tujuan harus sudah dipetakan ke tingkat.", 400);
      }

      const updated = await prisma.questionBank.update({
        where: { id: data.bankId },
        data: {
          subjectId: data.subjectId,
          subject: subject.name,
          revision: { increment: 1 },
          updatedBy: teacher.teacherId,
        },
      });
      return successResponse(updated);
    }

    if (data.action === "autoMapUnambiguous") {
      // Auto-maps legacy exams and classes that match patterns
      let mappedExamsCount = 0;
      let createdClassroomsCount = 0;
      let createdGradeLevelsCount = 0;

      const unmappedExams = await prisma.exam.findMany({
        where: { classroomId: null, status: { not: "active" } },
      });

      for (const exam of unmappedExams) {
        if (!exam.className) continue;
        const parsed = parseLegacyClassName(exam.className);
        if (!parsed) continue;

        // Find or create grade level
        let gradeLevel = await prisma.gradeLevel.findUnique({
          where: { normalizedName: normalizeName(parsed.gradeLevelName) },
        });
        if (!gradeLevel) {
          gradeLevel = await prisma.gradeLevel.create({
            data: {
              name: parsed.gradeLevelName,
              normalizedName: normalizeName(parsed.gradeLevelName),
            },
          });
          createdGradeLevelsCount++;
        }

        // Find or create classroom
        let classroom = await prisma.classroom.findUnique({
          where: {
            gradeLevelId_normalizedName: {
              gradeLevelId: gradeLevel.id,
              normalizedName: normalizeName(parsed.classroomName),
            },
          },
        });
        if (!classroom) {
          classroom = await prisma.classroom.create({
            data: {
              gradeLevelId: gradeLevel.id,
              name: parsed.classroomName,
              normalizedName: normalizeName(parsed.classroomName),
            },
          });
          createdClassroomsCount++;
        }

        // Map exam classroomId
        await prisma.exam.update({
          where: { id: exam.id },
          data: {
            classroomId: classroom.id,
            revision: { increment: 1 },
            updatedBy: teacher.teacherId,
          },
        });
        mappedExamsCount++;
      }

      return successResponse({
        mappedExamsCount,
        createdClassroomsCount,
        createdGradeLevelsCount,
      });
    }

    return errorResponse("VALIDATION_ERROR", "Aksi tidak dikenali", 400);
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err.code, err.message, err.statusCode, err.details);
    return errorResponse("INTERNAL_SERVER_ERROR", safeErrorMessage(err, "Gagal memproses pemetaan"), 500);
  }
}

