import { NextRequest } from "next/server";
import { authenticateTeacher } from "@/lib/middleware/auth";
import { prisma } from "@/lib/prisma";
import { generateUniqueAccessCode } from "@/lib/code-generator";
import { successResponse, errorResponse, safeErrorMessage } from "@/lib/response";
import { AppError } from "@/lib/errors";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const teacher = await authenticateTeacher(req);
    const { id: sourceExamId } = await params;

    const sourceExam = await prisma.exam.findUnique({
      where: { id: sourceExamId },
      include: {
        questions: {
          orderBy: { orderIndex: "asc" },
        },
      },
    });

    if (!sourceExam) {
      return errorResponse("NOT_FOUND", "Ujian sumber tidak ditemukan", 404);
    }

    const body = await req.json().catch(() => ({}));
    const newTitle = (body?.title as string)?.trim() || `${sourceExam.title} (Salinan)`;
    const targetClassroomId = body?.classroomId || sourceExam.classroomId;
    let targetSubjectId = body?.subjectId || sourceExam.subjectId;

    let targetClassroom = null;
    if (targetClassroomId) {
      targetClassroom = await prisma.classroom.findUnique({ where: { id: targetClassroomId }, include: { gradeLevel: true } });
      if (!targetClassroom) return errorResponse("NOT_FOUND", "Rombel tujuan tidak ditemukan", 404);
    }

    let targetSubject = null;
    if (targetSubjectId) {
      targetSubject = await prisma.subject.findUnique({ where: { id: targetSubjectId }, include: { gradeLevel: true } });
      if (!targetSubject) return errorResponse("NOT_FOUND", "Mata pelajaran tujuan tidak ditemukan", 404);
    }

    const sourceClassroom = sourceExam.classroomId ? await prisma.classroom.findUnique({ where: { id: sourceExam.classroomId } }) : null;
    const isCrossGrade = targetClassroom && sourceClassroom && targetClassroom.gradeLevelId !== sourceClassroom.gradeLevelId;

    if (isCrossGrade) {
      if (!body?.subjectId || !targetSubject || !targetClassroom || targetSubject.gradeLevelId !== targetClassroom.gradeLevelId) {
        return errorResponse("VALIDATION_ERROR", "Duplikasi lintas tingkat mewajibkan pemilihan ulang mata pelajaran dan sumber soal dari tingkat yang dituju.", 400);
      }
    } else if (targetClassroom && targetSubject && targetClassroom.gradeLevelId !== targetSubject.gradeLevelId) {
      return errorResponse("VALIDATION_ERROR", "Rombel dan mata pelajaran harus berada dalam tingkat yang sama.", 400);
    }

    const resolvedClassName = targetClassroom ? targetClassroom.name : sourceExam.className;
    const resolvedSubjectName = targetSubject ? (targetSubject.gradeLevel ? `${targetSubject.name} · ${targetSubject.gradeLevel.name}` : targetSubject.name) : sourceExam.subjectName;

    const accessCode = await generateUniqueAccessCode(6);

    const duplicatedExam = await prisma.$transaction(async (tx) => {
      const newExam = await tx.exam.create({
        data: {
          teacherId: teacher.teacherId,
          title: newTitle,
          description: sourceExam.description,
          durationMinutes: sourceExam.durationMinutes,
          classroomId: targetClassroom?.id ?? sourceExam.classroomId,
          className: resolvedClassName,
          subjectId: targetSubject?.id ?? sourceExam.subjectId,
          subjectName: resolvedSubjectName,
          academicYear: sourceExam.academicYear,
          semester: sourceExam.semester,
          category: sourceExam.category,
          categoryNumber: sourceExam.categoryNumber,
          passingScore: sourceExam.passingScore,
          accessCode,
          status: "draft",
          revision: 1,
          updatedBy: teacher.teacherId,
          violationPolicy: sourceExam.violationPolicy as any,
          settings: sourceExam.settings as any,
        },
      });

      // Questions are copied only if within the same grade level
      if (!isCrossGrade && Array.isArray(sourceExam.questions) && sourceExam.questions.length > 0) {
        const questionData = sourceExam.questions.map((q) => ({
          examId: newExam.id,
          orderIndex: q.orderIndex,
          questionText: q.questionText,
          content: q.content === null ? undefined : (q.content as any),
          imageUrl: q.imageUrl,
          imageAlt: q.imageAlt,
          hint: q.hint,
          hintContent: q.hintContent === null ? undefined : (q.hintContent as any),
          type: (q as any).type || "single_choice",
          options: q.options as any,
          correctAnswer: q.correctAnswer,
          points: q.points,
        }));
        await tx.question.createMany({ data: questionData });
      }

      return tx.exam.findUnique({
        where: { id: newExam.id },
        include: {
          _count: {
            select: {
              questions: true,
              students: true,
            },
          },
        },
      });
    });

    return successResponse(
      {
        exam: duplicatedExam,
        message: `Ujian berhasil diduplikasi sebagai "${newTitle}"`,
      },
      201
    );
  } catch (err: any) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    return errorResponse("INTERNAL_SERVER_ERROR", safeErrorMessage(err, "Gagal menduplikasi ujian"), 500);
  }
}
