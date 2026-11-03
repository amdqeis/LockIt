import { NextRequest } from "next/server";
import { authenticateTeacher } from "@/lib/middleware/auth";
import { prisma } from "@/lib/prisma";
import { parseJsonQuestionBank, parseXmlQuestionBank, ParsedQuestion } from "@/services/question-parser";
import { successResponse, errorResponse, safeErrorMessage } from "@/lib/response";
import { AppError } from "@/lib/errors";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const teacher = await authenticateTeacher(req);
    const { id } = await params;

    const exam = await prisma.exam.findUnique({
      where: { id },
    });

    if (!exam || (teacher.role !== "ADMIN" && exam.teacherId !== teacher.teacherId)) {
      return errorResponse("NOT_FOUND", "Ujian tidak ditemukan", 404);
    }

    if (exam.status !== "draft") {
      return errorResponse("EXAM_NOT_DRAFT", "Soal hanya dapat diupload saat ujian berstatus draft", 400);
    }

    const contentType = req.headers.get("content-type") || "";
    let fileContent = "";
    let fileType: "json" | "xml" = "json";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;

      if (!file) {
        return errorResponse("FILE_REQUIRED", "File bank soal wajib disertakan dalam field 'file'", 400);
      }

      // Max 5MB limit
      if (file.size > 5 * 1024 * 1024) {
        return errorResponse("FILE_TOO_LARGE", "Ukuran file melebihi batas 5MB", 400);
      }

      const fileName = file.name.toLowerCase();
      if (fileName.endsWith(".xml")) {
        fileType = "xml";
      } else if (fileName.endsWith(".json")) {
        fileType = "json";
      } else {
        return errorResponse("INVALID_FILE_TYPE", "Format file harus berupa .json atau .xml", 400);
      }

      fileContent = await file.text();
    } else if (contentType.includes("xml")) {
      fileType = "xml";
      fileContent = await req.text();
    } else {
      fileType = "json";
      fileContent = await req.text();
    }

    if (!fileContent.trim()) {
      return errorResponse("EMPTY_CONTENT", "Isi file atau body tidak boleh kosong", 400);
    }

    let questions: ParsedQuestion[] = [];
    let examTitle = exam.title;

    if (fileType === "xml") {
      const parsedBank = parseXmlQuestionBank(fileContent);
      questions = parsedBank.questions;
      if (parsedBank.examTitle) examTitle = parsedBank.examTitle;
    } else {
      try {
        const parsedBank = parseJsonQuestionBank(fileContent);
        questions = parsedBank.questions;
        if (parsedBank.examTitle) examTitle = parsedBank.examTitle;
      } catch (err: any) {
        let raw: any;
        try {
          raw = JSON.parse(fileContent);
        } catch {
          throw err;
        }
        const rawList = Array.isArray(raw) ? raw : (Array.isArray(raw?.questions) ? raw.questions : null);
        if (rawList && rawList.length > 0) {
          const { normalizeQuestionForDb } = await import("@/services/question-parser");
          questions = rawList.map((q: any, idx: number) => normalizeQuestionForDb(q, idx));
          if (raw?.title || raw?.examTitle || raw?.exam_title) {
            examTitle = raw.title || raw.examTitle || raw.exam_title;
          }
        } else {
          throw err;
        }
      }
    }


    // Use transaction: remove previous draft questions, insert new ones
    await prisma.$transaction(async (tx) => {
      await tx.question.deleteMany({ where: { examId: id } });

      if (questions.length > 0) {
        await tx.question.createMany({
          data: questions.map((q) => ({
            examId: id,
            orderIndex: q.orderIndex,
            questionText: q.questionText,
            imageUrl: q.imageUrl,
            options: q.options as any,
            correctAnswer: q.correctAnswer,
            points: q.points,
          })),
        });
      }
    });

    return successResponse({
      examId: id,
      questionsCount: questions.length,
      examTitle,
      message: `Berhasil mengupload ${questions.length} soal`,
    });
  } catch (err: any) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.statusCode, err.details);
    }
    return errorResponse("INTERNAL_SERVER_ERROR", safeErrorMessage(err, "Gagal memproses bank soal"), 500);
  }
}
