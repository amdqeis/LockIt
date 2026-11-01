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

    if (!sourceExam || (teacher.role !== "ADMIN" && sourceExam.teacherId !== teacher.teacherId)) {
      return errorResponse("NOT_FOUND", "Ujian sumber tidak ditemukan", 404);
    }

    const body = await req.json().catch(() => ({}));
    const newTitle = (body?.title as string)?.trim() || `${sourceExam.title} (Salinan)`;

    const accessCode = await generateUniqueAccessCode(6);

    const duplicatedExam = await prisma.$transaction(async (tx) => {
      const newExam = await tx.exam.create({
        data: {
          teacherId: teacher.teacherId,
          title: newTitle,
          description: sourceExam.description,
          durationMinutes: sourceExam.durationMinutes,
          accessCode,
          status: "draft",
          violationPolicy: sourceExam.violationPolicy as any,
          settings: sourceExam.settings as any,
        },
      });

      if (Array.isArray(sourceExam.questions) && sourceExam.questions.length > 0) {
        for (const q of sourceExam.questions) {
          await tx.question.create({
            data: {
              examId: newExam.id,
              orderIndex: q.orderIndex,
              questionText: q.questionText,
              imageUrl: q.imageUrl,
              options: q.options as any,
              correctAnswer: q.correctAnswer,
              points: q.points,
            },
          });
        }
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
    return errorResponse(
      "INTERNAL_SERVER_ERROR",
      safeErrorMessage(err, "Gagal menduplikasi ujian"),
      500
    );
  }
}
