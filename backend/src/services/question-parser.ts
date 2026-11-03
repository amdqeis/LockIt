import { XMLParser } from "fast-xml-parser";
import { z } from "zod";
import { ValidationError } from "@/lib/errors";

export interface ParsedOption {
  label: string;
  text: string;
  imageUrl?: string | null;
  isCorrect?: boolean;
}

export interface ParsedQuestion {
  orderIndex: number;
  questionText: string;
  imageUrl?: string | null;
  type?: string;
  options: ParsedOption[];
  correctAnswer: string;
  points: number;
}

export interface ParsedExamBank {
  examTitle?: string;
  questions: ParsedQuestion[];
}

const optionSchema = z.object({
  label: z.string().min(1).max(2).toUpperCase(),
  text: z.string().default(""),
  imageUrl: z.string().nullable().optional(),
  isCorrect: z.boolean().default(false),
});

const questionSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  text: z.string().min(1, "Teks soal tidak boleh kosong"),
  imageUrl: z.string().nullable().optional(),
  image: z.string().nullable().optional(),
  type: z.string().default("multiple_choice"),
  points: z.number().int().positive().default(10),
  options: z.array(optionSchema).min(2, "Minimal 2 opsi jawaban").max(6, "Maksimal 6 opsi jawaban"),
});

const jsonBankSchema = z.object({
  exam_title: z.string().optional(),
  examTitle: z.string().optional(),
  questions: z.array(questionSchema).min(1, "Minimal harus ada 1 soal").max(200, "Maksimal 200 soal per ujian"),
});

export function parseJsonQuestionBank(jsonContent: string): ParsedExamBank {
  let rawJson: any;
  try {
    rawJson = JSON.parse(jsonContent);
  } catch (err: any) {
    throw new ValidationError(`Format JSON tidak valid: ${err.message}`);
  }

  const parsed = jsonBankSchema.safeParse(rawJson);
  if (!parsed.success) {
    throw new ValidationError("Validasi bank soal JSON gagal", parsed.error.flatten());
  }

  const { exam_title, examTitle, questions } = parsed.data;

  const validatedQuestions: ParsedQuestion[] = questions.map((q, idx) => {
    // Find correct answer
    const correctOptions = q.options.filter((opt) => opt.isCorrect);
    if (correctOptions.length !== 1) {
      throw new ValidationError(
        `Soal nomor ${idx + 1} ("${q.text.substring(0, 30)}...") harus memiliki tepat 1 kunci jawaban benar (ditemukan: ${correctOptions.length})`
      );
    }

    const correctAnswer = correctOptions[0].label;

    return {
      orderIndex: idx + 1,
      questionText: q.text,
      imageUrl: q.imageUrl || q.image || null,
      options: q.options.map((opt) => ({
        label: opt.label,
        text: opt.text,
        imageUrl: opt.imageUrl || null,
      })),
      correctAnswer,
      points: q.points,
    };
  });

  return {
    examTitle: exam_title || examTitle,
    questions: validatedQuestions,
  };
}

export function parseXmlQuestionBank(xmlContent: string): ParsedExamBank {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    trimValues: true,
  });

  let parsedXml: any;
  try {
    parsedXml = parser.parse(xmlContent);
  } catch (err: any) {
    throw new ValidationError(`Format XML tidak valid: ${err.message}`);
  }

  const examRoot = parsedXml.exam;
  if (!examRoot) {
    throw new ValidationError("Root tag XML harus berupa <exam>");
  }

  const examTitle = examRoot["@_title"] || examRoot.title;

  let rawQuestions = examRoot.question;
  if (!rawQuestions) {
    throw new ValidationError("Tag <question> tidak ditemukan di dalam <exam>");
  }

  if (!Array.isArray(rawQuestions)) {
    rawQuestions = [rawQuestions];
  }

  if (rawQuestions.length > 200) {
    throw new ValidationError("Jumlah soal melebihi batas maksimum 200 soal");
  }

  const validatedQuestions: ParsedQuestion[] = rawQuestions.map((q: any, idx: number) => {
    const text = q.text?.toString() || "";
    if (!text) {
      throw new ValidationError(`Teks soal pada nomor ${idx + 1} tidak boleh kosong`);
    }

    const imageUrl = q.image?.toString() || q["@_image"] || null;
    const points = parseInt(q["@_points"] || "10", 10) || 10;

    const rawOptions = q.options?.option;
    if (!rawOptions) {
      throw new ValidationError(`Pilihan jawaban (<options>) tidak ditemukan pada soal nomor ${idx + 1}`);
    }

    const optionList = Array.isArray(rawOptions) ? rawOptions : [rawOptions];
    if (optionList.length < 2 || optionList.length > 6) {
      throw new ValidationError(`Soal nomor ${idx + 1} harus memiliki 2 hingga 6 opsi jawaban`);
    }

    let correctAnswer = "";
    const options: ParsedOption[] = optionList.map((opt: any, optIdx: number) => {
      const label = (opt["@_label"] || String.fromCharCode(65 + optIdx)).toUpperCase();
      const isCorrect = opt["@_correct"] === "true" || opt["@_correct"] === true;
      const optText = typeof opt === "object" ? opt["#text"] || "" : opt.toString();
      const optImage = opt["@_image"] || null;

      if (isCorrect) {
        if (correctAnswer) {
          throw new ValidationError(`Soal nomor ${idx + 1} memiliki lebih dari satu jawaban benar`);
        }
        correctAnswer = label;
      }

      return {
        label,
        text: optText,
        imageUrl: optImage,
      };
    });

    if (!correctAnswer) {
      throw new ValidationError(`Soal nomor ${idx + 1} tidak memiliki jawaban benar (correct="true")`);
    }

    return {
      orderIndex: idx + 1,
      questionText: text,
      imageUrl,
      options,
      correctAnswer,
      points,
    };
  });

  return {
    examTitle,
    questions: validatedQuestions,
  };
}

export function normalizeQuestionForDb(q: any, idx: number): ParsedQuestion {
  const text = (q.questionText || q.text || `Soal nomor ${idx + 1}`).toString().trim();
  const points = typeof q.points === "number" && q.points > 0 ? q.points : 10;
  const orderIndex = typeof q.orderIndex === "number" && q.orderIndex > 0 ? q.orderIndex : idx + 1;
  const imageUrl = q.imageUrl || q.image || null;

  let rawOptions = Array.isArray(q.options) ? q.options : [];
  const detectedCorrects: string[] = [];

  const options: ParsedOption[] = rawOptions.map((opt: any, optIdx: number) => {
    const letter = String.fromCharCode(65 + optIdx);
    let label = (opt.label || opt.id || opt["@_label"] || letter).toString().toUpperCase();
    if (label.length > 2) {
      label = letter;
    }

    const optText = typeof opt === "string"
      ? opt
      : (opt.text || opt.label || opt["#text"] || opt.content || opt.value || "");
    const optImage = typeof opt === "object" ? (opt.imageUrl || opt.image || opt["@_image"] || null) : null;
    const isCorrect = opt.isCorrect === true || opt["@_correct"] === "true" || opt["@_correct"] === true;

    if (isCorrect) {
      detectedCorrects.push(label);
    }

    return {
      id: label,
      label,
      text: optText.toString(),
      imageUrl: optImage,
    };
  });

  const rawType = (q.type || "").toString().toLowerCase();
  const hasMultipleAnswers =
    (Array.isArray(q.correctAnswers) && q.correctAnswers.length > 1) ||
    detectedCorrects.length > 1 ||
    (typeof q.correctAnswer === "string" && q.correctAnswer.includes(","));
  const isMulti = rawType === "multi_select" || rawType === "multiselect" || rawType === "multiple" || hasMultipleAnswers;
  const type = isMulti ? "multi_select" : (rawType === "latex" ? "latex" : "single_choice");

  let finalCorrectAnswer = "";
  if (Array.isArray(q.correctAnswers) && q.correctAnswers.length > 0) {
    const mapped = q.correctAnswers.map((ca: any) => {
      const target = String(ca).trim().toUpperCase();
      const matched = options.find((o, oIdx) => {
        const rawOpt = rawOptions[oIdx];
        const rawId = rawOpt?.id?.toString()?.toUpperCase();
        return o.label === target || rawId === target;
      });
      return matched ? matched.label : target;
    });
    finalCorrectAnswer = Array.from(new Set(mapped)).sort().join(",");
  } else if (detectedCorrects.length > 0) {
    finalCorrectAnswer = Array.from(new Set(detectedCorrects)).sort().join(",");
  } else if (typeof q.correctAnswer === "string" && q.correctAnswer.trim()) {
    const parts = q.correctAnswer.split(",").map((s: string) => s.trim().toUpperCase()).filter(Boolean);
    const mapped = parts.map((target: string) => {
      const matched = options.find((o, oIdx) => {
        const rawOpt = rawOptions[oIdx];
        const rawId = rawOpt?.id?.toString()?.toUpperCase();
        return o.label === target || rawId === target;
      });
      return matched ? matched.label : target;
    });
    finalCorrectAnswer = Array.from(new Set(mapped)).sort().join(",");
  } else if (options.length > 0) {
    finalCorrectAnswer = options[0].label;
  } else {
    finalCorrectAnswer = "A";
  }

  return {
    orderIndex,
    questionText: text,
    imageUrl,
    type,
    options,
    correctAnswer: finalCorrectAnswer,
    points,
  };
}

