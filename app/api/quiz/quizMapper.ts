import { normalizeQuizCategories, normalizeQuizQuestions, QuizCategoryRecord, QuizQuestionRecord } from "../../quiz/quizTypes";

export type QuizQuestionRow = {
  id: number;
  level: string | null;
  category: string | null;
  theme: string | null;
  prompt: string | null;
  note: string | null;
  answer: string | null;
  options: unknown;
};

export type QuizCategoryRow = {
  id: string;
  level: string | null;
  name: string | null;
};

export function rowToQuizQuestion(row: QuizQuestionRow): QuizQuestionRecord {
  return normalizeQuizQuestions(
    [
      {
        id: Number(row.id),
        level: row.level ?? "N5",
        category: row.category ?? "",
        theme: row.theme ?? "",
        prompt: row.prompt ?? "",
        note: row.note ?? "",
        answer: row.answer ?? "",
        options: Array.isArray(row.options) ? row.options : []
      }
    ],
    true
  )[0];
}

export function quizQuestionToPayload(question: QuizQuestionRecord) {
  const normalized = normalizeQuizQuestions([question], true)[0];

  return {
    level: normalized.level,
    category: normalized.category.trim(),
    theme: normalized.theme.trim(),
    prompt: normalized.prompt.trim(),
    note: normalized.note.trim(),
    answer: normalized.answer.trim(),
    options: normalized.options
  };
}

export function rowToQuizCategory(row: QuizCategoryRow): QuizCategoryRecord {
  return normalizeQuizCategories(
    [
      {
        id: row.id,
        level: row.level ?? "N5",
        name: row.name ?? ""
      }
    ],
    true
  )[0];
}
