import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateScore } from "@/services/score-calculation";
import { authenticateStudent } from "@/lib/middleware/auth";
import { AppError } from "@/lib/errors";
import { errorResponse, successResponse } from "@/lib/response";
import { associateStudentWithBrowser, findBrowserIdentity } from "@/lib/browser-identity";
import { canResumeStudent } from "@/lib/proctoring-events";

const PAGE_SIZE = 20;

function privateResponse(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export async function POST(req: NextRequest) {
  try {
    const { student } = await authenticateStudent(req, { skipSubmittedCheck: true });
    const response = successResponse({ initialized: true });
    await associateStudentWithBrowser(req, student.id, response);
    return privateResponse(response);
  } catch (error) {
    if (error instanceof AppError && error.statusCode === 401) {
      return privateResponse(successResponse({ initialized: false }));
    }
    if (error instanceof AppError) {
      return privateResponse(errorResponse(error.code, error.message, error.statusCode, error.details));
    }
    return privateResponse(errorResponse("INTERNAL_SERVER_ERROR", "Gagal menyiapkan riwayat ujian", 500));
  }
}

export async function GET(req: NextRequest) {
  try {
    const browser = await findBrowserIdentity(req);
    if (!browser) return privateResponse(successResponse({ items: [], nextCursor: null }));

    const cursor = req.nextUrl.searchParams.get("cursor");
    if (cursor) {
      const ownsCursor = await prisma.browserStudent.findUnique({
        where: { browserId_studentId: { browserId: browser.id, studentId: cursor } },
        select: { studentId: true },
      });
      if (!ownsCursor) return privateResponse(errorResponse("INVALID_CURSOR", "Cursor riwayat tidak valid", 400));
    }

    const entries = await prisma.browserStudent.findMany({
      where: { browserId: browser.id },
      orderBy: [{ linkedAt: "desc" }, { studentId: "desc" }],
      take: PAGE_SIZE + 1,
      ...(cursor ? { cursor: { browserId_studentId: { browserId: browser.id, studentId: cursor } }, skip: 1 } : {}),
      include: {
        student: {
          include: {
            exam: {
              select: {
                id: true,
                title: true,
                status: true,
                durationMinutes: true,
                endTime: true,
                settings: true,
                questions: { select: { id: true, type: true, points: true, correctAnswer: true, options: true } },
              },
            },
            answers: { select: { questionId: true, isCorrect: true, selectedOption: true } },
          },
        },
      },
    });

    const hasMore = entries.length > PAGE_SIZE;
    const page = entries.slice(0, PAGE_SIZE);
    const items = page.map(({ linkedAt, student }) => {
      const settings = student.exam.settings && typeof student.exam.settings === "object"
        ? student.exam.settings as Record<string, unknown>
        : {};
      const showScoreToStudent = settings.show_score_to_student !== false;
      const allowAnswerReview = settings.allow_answer_review === true;
      const canResume = canResumeStudent({
        studentStatus: student.status,
        examStatus: student.exam.status,
        endTime: student.exam.endTime,
      });
      let score: number | null = null;
      let pendingManualCount = 0;
      if (student.status === "submitted" && showScoreToStudent) {
        const calculated = calculateScore(student.exam.questions, student.answers);
        score = calculated.finalScore;
        pendingManualCount = calculated.pendingManualCount;
      }
      const examSettings = settings;
      return {
        studentId: student.id,
        studentName: student.name,
        status: student.status,
        joinedAt: student.joinedAt.toISOString(),
        submittedAt: student.submittedAt?.toISOString() ?? null,
        linkedAt: linkedAt.toISOString(),
        exam: {
          id: student.exam.id,
          title: student.exam.title,
          status: student.exam.status,
          className: typeof examSettings.class_name === "string" ? examSettings.class_name : null,
          examType: typeof examSettings.exam_type === "string" ? examSettings.exam_type : null,
        },
        isLocked: student.isLocked,
        score,
        ...(showScoreToStudent ? { pendingManualCount } : {}),
        canResume,
        canReview: student.status === "submitted" && allowAnswerReview,
      };
    });

    return privateResponse(successResponse({
      items,
      nextCursor: hasMore ? page[page.length - 1]?.studentId ?? null : null,
    }));
  } catch {
    return privateResponse(errorResponse("INTERNAL_SERVER_ERROR", "Gagal memuat riwayat ujian", 500));
  }
}
