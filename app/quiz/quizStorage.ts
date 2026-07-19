"use client";

import {
  normalizeQuizCategories,
  normalizeQuizQuestions,
  QuizCategoryRecord,
  QuizLevel,
  QuizQuestionRecord,
  seedQuizCategories,
  seedQuizQuestions
} from "./quizTypes";

const quizStorageKey = "japannote-quiz-questions";
const quizCategoryStorageKey = "japannote-quiz-categories";

export type QuizQuestionsReadResult = {
  source: "database" | "local";
  questions: QuizQuestionRecord[];
  total: number;
  error?: string;
};

export type QuizQuestionsReadOptions = {
  level?: QuizLevel;
  category?: string;
  query?: string;
  page?: number;
  pageSize?: number;
};

async function parseQuizResponse(response: Response) {
  const responseText = await response.text();
  const payload = (
    responseText
      ? (() => {
          try {
            return JSON.parse(responseText);
          } catch {
            return {};
          }
        })()
      : {}
  ) as {
    categories?: QuizCategoryRecord[];
    question?: QuizQuestionRecord;
    questions?: QuizQuestionRecord[];
    total?: number;
    error?: string;
  };

  if (!response.ok) {
    throw new Error(payload.error || responseText || `Quiz API failed: ${response.status}`);
  }

  return payload;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown quiz API error";
}

function getQuizApiUrl(options: QuizQuestionsReadOptions = {}) {
  const params = new URLSearchParams();

  if (options.level) {
    params.set("level", options.level);
  }

  if (options.category?.trim()) {
    params.set("category", options.category.trim());
  }

  if (options.query?.trim()) {
    params.set("q", options.query.trim());
  }

  if (options.page) {
    params.set("page", String(options.page));
  }

  if (options.pageSize) {
    params.set("pageSize", String(options.pageSize));
  }

  const query = params.toString();
  return query ? `/api/quiz?${query}` : "/api/quiz";
}

export function readStoredQuizQuestions() {
  if (typeof window === "undefined") {
    return seedQuizQuestions;
  }

  const raw = window.localStorage.getItem(quizStorageKey);
  if (!raw) {
    window.localStorage.setItem(quizStorageKey, JSON.stringify(seedQuizQuestions));
    return seedQuizQuestions;
  }

  try {
    return normalizeQuizQuestions(JSON.parse(raw));
  } catch {
    return seedQuizQuestions;
  }
}

export function writeStoredQuizQuestions(questions: QuizQuestionRecord[]) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(quizStorageKey, JSON.stringify(normalizeQuizQuestions(questions)));
  }
}

export function readStoredQuizCategories() {
  if (typeof window === "undefined") {
    return seedQuizCategories;
  }

  const raw = window.localStorage.getItem(quizCategoryStorageKey);
  if (!raw) {
    window.localStorage.setItem(quizCategoryStorageKey, JSON.stringify(seedQuizCategories));
    return seedQuizCategories;
  }

  try {
    return normalizeQuizCategories(JSON.parse(raw));
  } catch {
    return seedQuizCategories;
  }
}

export function writeStoredQuizCategories(categories: QuizCategoryRecord[]) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(quizCategoryStorageKey, JSON.stringify(normalizeQuizCategories(categories)));
  }
}

export async function fetchQuizQuestions(options: QuizQuestionsReadOptions = {}) {
  const response = await fetch(getQuizApiUrl(options), { cache: "no-store" });
  const payload = await parseQuizResponse(response);
  const questions = normalizeQuizQuestions(payload.questions, true);

  return {
    questions,
    total: payload.total ?? questions.length
  };
}

export async function readQuizQuestionsWithSource(options: QuizQuestionsReadOptions = {}): Promise<QuizQuestionsReadResult> {
  try {
    const result = await fetchQuizQuestions(options);
    writeStoredQuizQuestions(result.questions);
    return { source: "database", ...result };
  } catch (error) {
    const localQuestions = readStoredQuizQuestions().filter(
      (question) =>
        (!options.level || question.level === options.level) &&
        (!options.category?.trim() || question.category === options.category.trim()) &&
        (!options.query?.trim() ||
          [question.category, question.theme, question.prompt, question.note]
            .join(" ")
            .toLowerCase()
            .includes(options.query.trim().toLowerCase()))
    );
    const seedQuestions = seedQuizQuestions.filter(
      (question) =>
        (!options.level || question.level === options.level) &&
        (!options.category?.trim() || question.category === options.category.trim()) &&
        (!options.query?.trim() ||
          [question.category, question.theme, question.prompt, question.note]
            .join(" ")
            .toLowerCase()
            .includes(options.query.trim().toLowerCase()))
    );
    const questions = localQuestions.length > 0 ? localQuestions : seedQuestions;
    const page = options.page && options.page > 0 ? options.page : 1;
    const pageSize = options.pageSize && options.pageSize > 0 ? options.pageSize : questions.length;
    const from = (page - 1) * pageSize;
    const to = from + pageSize;

    return {
      source: "local",
      questions: questions.slice(from, to),
      total: questions.length,
      error: getErrorMessage(error)
    };
  }
}

export async function fetchQuizCategories() {
  const response = await fetch("/api/quiz/categories", { cache: "no-store" });
  const payload = await parseQuizResponse(response);

  return normalizeQuizCategories(payload.categories, true);
}

export async function readQuizCategoriesWithFallback() {
  try {
    const categories = await fetchQuizCategories();
    writeStoredQuizCategories(categories);
    return categories.length > 0 ? categories : seedQuizCategories;
  } catch {
    return readStoredQuizCategories();
  }
}

export async function saveQuizQuestion(question: QuizQuestionRecord, mode: "create" | "update") {
  const response = await fetch(mode === "update" ? `/api/quiz/${question.id}` : "/api/quiz", {
    method: mode === "update" ? "PUT" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(question)
  });
  const payload = await parseQuizResponse(response);

  if (!payload.question) {
    throw new Error("Save quiz response missing question");
  }

  return normalizeQuizQuestions([payload.question], true)[0];
}

export async function deleteQuizQuestions(ids: number[]) {
  const response = await fetch("/api/quiz", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids })
  });

  await parseQuizResponse(response);
}
