import { prisma } from "@/lib/prisma";

export interface StudentAssignment {
  questionIds: string[];
  optionsOrder?: Record<string, string[]>;
}

export function pseudoRandomShuffle<T>(array: T[], seedStr: string, salt: string): T[] {
  const result = [...array];
  const combined = seedStr + "|" + salt;
  let seed = 0;
  for (let i = 0; i < combined.length; i++) {
    seed = (seed * 31 + combined.charCodeAt(i)) & 0xffffffff;
  }

  for (let i = result.length - 1; i > 0; i--) {
    seed = (seed * 1664525 + 1013904223) & 0xffffffff;
    const j = Math.abs(seed) % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function getOptionKey(option: unknown, index: number): string {
  if (typeof option === "string") return String.fromCharCode(65 + index);
  if (option && typeof option === "object") {
    const obj = option as Record<string, unknown>;
    if (typeof obj.key === "string" && obj.key.trim()) return obj.key.trim().toUpperCase();
    if (typeof obj.id === "string" && obj.id.trim()) return obj.id.trim().toUpperCase();
    if (typeof obj.label === "string" && obj.label.trim()) return obj.label.trim().toUpperCase();
  }
  return String.fromCharCode(65 + index);
}

export function parseStudentAssignment(raw: unknown): StudentAssignment | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj.questionIds)) return null;
  const questionIds = obj.questionIds.filter((id): id is string => typeof id === "string");
  const optionsOrder: Record<string, string[]> = {};
  if (obj.optionsOrder && typeof obj.optionsOrder === "object" && !Array.isArray(obj.optionsOrder)) {
    for (const [qId, order] of Object.entries(obj.optionsOrder as Record<string, unknown>)) {
      if (Array.isArray(order)) {
        optionsOrder[qId] = order.filter((item): item is string => typeof item === "string");
      }
    }
  }
  return { questionIds, optionsOrder };
}

export async function ensureStudentAssignment(student: {
  id: string;
  nisn: string;
  assignedQuestions: unknown;
  exam: {
    id: string;
    settings: unknown;
  };
}): Promise<StudentAssignment> {
  const parsed = parseStudentAssignment(student.assignedQuestions);
  if (parsed && parsed.questionIds.length > 0) {
    return parsed;
  }

  const allQuestions = await prisma.question.findMany({
    where: { examId: student.exam.id },
    orderBy: { orderIndex: "asc" },
  });

  const settings = (student.exam.settings && typeof student.exam.settings === "object"
    ? student.exam.settings
    : {}) as Record<string, unknown>;
  const selection = (settings.question_selection && typeof settings.question_selection === "object"
    ? settings.question_selection
    : { mode: "manual" }) as Record<string, unknown>;

  let selected = [...allQuestions];

  if (selection.mode === "random_per_student") {
    const rawCount = typeof selection.count === "number" ? selection.count : allQuestions.length;
    const targetCount = Math.max(1, Math.min(rawCount, allQuestions.length));
    const shuffledPool = pseudoRandomShuffle(allQuestions, student.nisn, student.exam.id);
    selected = shuffledPool.slice(0, targetCount);
  }

  if (settings.randomize_questions) {
    selected = pseudoRandomShuffle(selected, student.nisn, `${student.exam.id}-order`);
  }

  const optionsOrder: Record<string, string[]> = {};
  if (settings.randomize_choices) {
    for (const q of selected) {
      if (Array.isArray(q.options) && q.options.length > 1) {
        const optionKeys = q.options.map((opt, idx) => getOptionKey(opt, idx));
        optionsOrder[q.id] = pseudoRandomShuffle(optionKeys, student.nisn, `${student.exam.id}-${q.id}`);
      }
    }
  }

  const assignment: StudentAssignment = {
    questionIds: selected.map((q) => q.id),
    optionsOrder: Object.keys(optionsOrder).length > 0 ? optionsOrder : undefined,
  };

  await prisma.student.update({
    where: { id: student.id },
    data: {
      assignedQuestions: assignment as any,
    },
  });

  return assignment;
}

export function applyAssignmentToQuestions<T extends { id: string; options?: any }>(
  questions: T[],
  assignment: StudentAssignment | null
): T[] {
  if (!assignment || !assignment.questionIds.length) {
    return questions;
  }

  const questionMap = new Map(questions.map((q) => [q.id, q]));
  const ordered: T[] = [];

  for (const qId of assignment.questionIds) {
    const q = questionMap.get(qId);
    if (!q) continue;

    if (assignment.optionsOrder && assignment.optionsOrder[qId] && Array.isArray(q.options)) {
      const orderKeys = assignment.optionsOrder[qId];
      const optMap = new Map<string, any>();
      q.options.forEach((opt: any, idx: number) => {
        const key = getOptionKey(opt, idx);
        optMap.set(key, opt);
      });

      const reorderedOpts: any[] = [];
      const seen = new Set<string>();
      for (const k of orderKeys) {
        if (optMap.has(k)) {
          reorderedOpts.push(optMap.get(k));
          seen.add(k);
        }
      }
      q.options.forEach((opt: any, idx: number) => {
        const key = getOptionKey(opt, idx);
        if (!seen.has(key)) {
          reorderedOpts.push(opt);
        }
      });

      ordered.push({
        ...q,
        options: reorderedOpts,
      });
    } else {
      ordered.push(q);
    }
  }

  return ordered;
}

