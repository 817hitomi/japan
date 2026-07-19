export type QuizLevel = "N5" | "N4" | "N3" | "N2" | "N1";

export type QuizCategoryRecord = {
  id: string;
  level: QuizLevel;
  name: string;
};

export type QuizQuestionRecord = {
  id: number;
  level: QuizLevel;
  category: string;
  theme: string;
  prompt: string;
  note: string;
  answer: string;
  options: string[];
};

export const quizLevels: QuizLevel[] = ["N5", "N4", "N3", "N2", "N1"];

export const seedQuizCategories: QuizCategoryRecord[] = [
  { id: "n5-vocabulary", level: "N5", name: "文字．語彙" }
];

export const seedQuizQuestions: QuizQuestionRecord[] = [
  {
    id: 1,
    level: "N5",
    category: "文字．語彙",
    theme: "あしたは雨ですか",
    prompt: "あしたは雨ですか",
    note: "あしたは雨(あめ)ですか\n明天下雨嗎",
    answer: "あめ",
    options: ["ゆき", "はれ", "くもり", "あめ"]
  }
];

export function normalizeQuizQuestions(questions: unknown, allowEmpty = false): QuizQuestionRecord[] {
  if (!Array.isArray(questions)) {
    return allowEmpty ? [] : seedQuizQuestions;
  }

  const normalized = questions
    .map((question, index) => {
      const source = question as Partial<QuizQuestionRecord>;
      const rawOptions = Array.isArray(source.options)
        ? source.options.map((option) => String(option).trim()).filter(Boolean)
        : [];
      const answer = String(source.answer ?? rawOptions[0] ?? "").trim();
      const options = rawOptions.filter((option) => option !== answer).slice(0, 3);
      const nextOptions = Array.from(new Set(options)).filter(Boolean);

      return {
        id: Number(source.id) || Date.now() + index,
        level: quizLevels.includes(source.level as QuizLevel) ? (source.level as QuizLevel) : "N5",
        category: String(source.category || "文字．語彙").trim() || "文字．語彙",
        theme: String(source.theme || source.prompt || "").trim(),
        prompt: String(source.prompt || source.theme || "").trim(),
        note: String(source.note || "").trim(),
        answer,
        options: nextOptions
      };
    })
    .filter((question) => question.prompt && question.answer);

  if (normalized.length > 0) {
    return normalized;
  }

  return allowEmpty ? [] : seedQuizQuestions;
}

export function normalizeQuizCategories(categories: unknown, allowEmpty = false): QuizCategoryRecord[] {
  if (!Array.isArray(categories)) {
    return allowEmpty ? [] : seedQuizCategories;
  }

  const normalized = categories
    .map((category, index) => {
      const source = category as Partial<QuizCategoryRecord>;
      const level = quizLevels.includes(source.level as QuizLevel) ? (source.level as QuizLevel) : "N5";
      const name = String(source.name || "").trim();

      return {
        id: String(source.id || `${level}-${name || index}`),
        level,
        name
      };
    })
    .filter((category) => category.name);

  if (normalized.length > 0) {
    return normalized;
  }

  return allowEmpty ? [] : seedQuizCategories;
}
