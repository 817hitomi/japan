export type QuizLevel = "N5" | "N4" | "N3" | "N2" | "N1";

export const wordOrderQuestionType = "語序排列" as const;
export const grammarChoiceQuestionType = "文法選擇" as const;
export const vocabularyQuizQuestionTypes = ["漢字讀法", "漢字書寫", "前後關係", "近義替換"] as const;
export const quizQuestionTypes = [...vocabularyQuizQuestionTypes, grammarChoiceQuestionType, wordOrderQuestionType] as const;
export type QuizQuestionType = (typeof quizQuestionTypes)[number];

export const vocabularyQuizCategory = "文字．語彙" as const;
export const grammarQuizCategory = "文法" as const;
export const balancedQuizCategories = [vocabularyQuizCategory, grammarQuizCategory] as const;

export type QuizCategoryRecord = {
  id: string;
  level: QuizLevel;
  name: string;
};

export type QuizQuestionRecord = {
  id: number;
  level: QuizLevel;
  category: string;
  questionType: QuizQuestionType;
  theme: string;
  prompt: string;
  note: string;
  answer: string;
  options: string[];
};

export const quizLevels: QuizLevel[] = ["N5", "N4", "N3", "N2", "N1"];

export function isWordOrderQuestionType(questionType: string): questionType is typeof wordOrderQuestionType {
  return questionType === wordOrderQuestionType;
}

export function getQuestionTypesForCategory(category: string): readonly QuizQuestionType[] {
  if (category === grammarQuizCategory) {
    return [grammarChoiceQuestionType, wordOrderQuestionType];
  }

  if (category === vocabularyQuizCategory) {
    return vocabularyQuizQuestionTypes;
  }

  return [wordOrderQuestionType];
}

export function parseWordOrderSegments(value: string) {
  return value
    .split(/[｜|\r\n]+/)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

export function normalizeWordOrderAnswer(value: string) {
  return value
    .replace(/([一-龯々〆ヵヶ]+)[(（]([ぁ-ゖァ-ヺー]+)[)）]/g, "$1")
    .replace(/\s+/g, "")
    .replace(/[。．.!！?？]+$/g, "");
}

export const seedQuizCategories: QuizCategoryRecord[] = [
  { id: "n5-vocabulary", level: "N5", name: vocabularyQuizCategory },
  { id: "n5-grammar", level: "N5", name: grammarQuizCategory }
];

export const seedQuizQuestions: QuizQuestionRecord[] = [
  {
    id: 1,
    level: "N5",
    category: vocabularyQuizCategory,
    questionType: "漢字讀法",
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
      const questionType = quizQuestionTypes.includes(source.questionType as QuizQuestionType)
        ? (source.questionType as QuizQuestionType)
        : "漢字讀法";
      const rawOptions = Array.isArray(source.options)
        ? source.options.map((option) => String(option).trim()).filter(Boolean)
        : [];
      const answer = String(source.answer ?? rawOptions[0] ?? "").trim();
      const options = isWordOrderQuestionType(questionType)
        ? rawOptions
        : Array.from(new Set(rawOptions.filter((option) => option !== answer).slice(0, 3))).filter(Boolean);

      return {
        id: Number(source.id) || Date.now() + index,
        level: quizLevels.includes(source.level as QuizLevel) ? (source.level as QuizLevel) : "N5",
        category: String(source.category || vocabularyQuizCategory).trim() || vocabularyQuizCategory,
        questionType,
        theme: String(source.theme || source.prompt || "").trim(),
        prompt: String(source.prompt || source.theme || "").trim(),
        note: String(source.note || "").trim(),
        answer,
        options
      };
    })
    .filter((question) => question.answer && (isWordOrderQuestionType(question.questionType) || question.prompt));

  if (normalized.length > 0) {
    return normalized;
  }

  return allowEmpty ? [] : seedQuizQuestions;
}

function shuffleWithRandom<T>(items: T[], random: () => number) {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }

  return shuffled;
}

export function selectBalancedQuizQuestions(
  questions: QuizQuestionRecord[],
  questionCount: number,
  random: () => number = Math.random
) {
  const questionsPerCategory = Math.floor(questionCount / balancedQuizCategories.length);
  const categoryPools = balancedQuizCategories.map((category) =>
    questions.filter((question) => question.category === category && !isWordOrderQuestionType(question.questionType))
  );

  if (categoryPools.some((pool) => pool.length < questionsPerCategory)) {
    return [];
  }

  const selectedQuestions = categoryPools.flatMap((pool) =>
    shuffleWithRandom(pool, random).slice(0, questionsPerCategory)
  );

  return selectedQuestions;
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

  const missingSeedCategories = seedQuizCategories.filter(
    (seedCategory) =>
      !normalized.some(
        (category) => category.level === seedCategory.level && category.name === seedCategory.name
      )
  );
  const categoriesWithRequiredEntries = [...normalized, ...missingSeedCategories];

  if (categoriesWithRequiredEntries.length > 0) {
    return categoriesWithRequiredEntries;
  }

  return allowEmpty ? [] : seedQuizCategories;
}
