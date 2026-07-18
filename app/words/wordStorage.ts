"use client";

import { normalizeWordCards, seedWordCards, WordCardRecord } from "./wordTypes";

const wordStorageKey = "japannote-word-cards";

export type WordCardsReadResult = {
  source: "database" | "local";
  words: WordCardRecord[];
  total: number;
  page: number;
  pageSize: number;
  error?: string;
};

export type WordCardsReadOptions = {
  page?: number;
  pageSize?: number;
  query?: string;
};

function isOldDefaultCards(words: WordCardRecord[]) {
  return (
    words.length === 3 &&
    words.some((word) => word.japanese === "百") &&
    words.some((word) => word.japanese === "君") &&
    words.some((word) => word.japanese === "私")
  );
}

function isOldTrialCard(words: WordCardRecord[]) {
  return words.length === 1 && words[0].japanese === "水" && words[0].exampleJapanese === "水を飲みます。";
}

export function readStoredWordCards() {
  if (typeof window === "undefined") {
    return seedWordCards;
  }

  const raw = window.localStorage.getItem(wordStorageKey);
  if (!raw) {
    window.localStorage.setItem(wordStorageKey, JSON.stringify(seedWordCards));
    return seedWordCards;
  }

  try {
    const words = normalizeWordCards(JSON.parse(raw));

    if (isOldDefaultCards(words) || isOldTrialCard(words)) {
      window.localStorage.setItem(wordStorageKey, JSON.stringify(seedWordCards));
      return seedWordCards;
    }

    return words;
  } catch {
    return seedWordCards;
  }
}

export function writeStoredWordCards(words: WordCardRecord[]) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(wordStorageKey, JSON.stringify(normalizeWordCards(words)));
  }
}

async function parseWordsResponse(response: Response) {
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
  ) as { words?: WordCardRecord[]; word?: WordCardRecord; total?: number; page?: number; pageSize?: number; error?: string };

  if (!response.ok) {
    const error = new Error(payload.error || responseText || `Words API failed: ${response.status}`);
    error.name = response.status === 409 ? "DuplicatedWordError" : "WordsApiError";
    throw error;
  }

  return payload;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown words API error";
}

function getWordsApiUrl(options: WordCardsReadOptions = {}) {
  const params = new URLSearchParams();

  if (options.page) {
    params.set("page", String(options.page));
  }

  if (options.pageSize) {
    params.set("pageSize", String(options.pageSize));
  }

  if (options.query?.trim()) {
    params.set("q", options.query.trim());
  }

  const query = params.toString();
  return query ? `/api/words?${query}` : "/api/words";
}

export async function fetchWordCards(options: WordCardsReadOptions = {}) {
  const response = await fetch(getWordsApiUrl(options), { cache: "no-store" });
  const payload = await parseWordsResponse(response);
  const words = normalizeWordCards(payload.words, true);

  return {
    page: payload.page ?? options.page ?? 1,
    pageSize: payload.pageSize ?? options.pageSize ?? words.length,
    total: payload.total ?? words.length,
    words
  };
}

export async function readWordCardsWithFallback(options: WordCardsReadOptions = {}) {
  const result = await readWordCardsWithSource(options);
  return result.words;
}

export async function readWordCardsWithSource(options: WordCardsReadOptions = {}): Promise<WordCardsReadResult> {
  try {
    const result = await fetchWordCards(options);
    writeStoredWordCards(result.words);
    return { source: "database", ...result };
  } catch (error) {
    const words = readStoredWordCards();
    return {
      source: "local",
      words,
      total: words.length,
      page: options.page ?? 1,
      pageSize: options.pageSize ?? words.length,
      error: getErrorMessage(error)
    };
  }
}

export async function saveWordCard(word: WordCardRecord, mode: "create" | "update") {
  const response = await fetch(mode === "update" ? `/api/words/${word.id}` : "/api/words", {
    method: mode === "update" ? "PUT" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(word)
  });
  const payload = await parseWordsResponse(response);

  if (!payload.word) {
    throw new Error("Save word response missing word");
  }

  return normalizeWordCards([payload.word])[0];
}

export async function deleteWordCards(ids: number[]) {
  const response = await fetch("/api/words", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids })
  });

  await parseWordsResponse(response);
}
