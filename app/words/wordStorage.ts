"use client";

import { normalizeWordCards, seedWordCards, WordCardRecord } from "./wordTypes";

const wordStorageKey = "japannote-word-cards";

export type WordCardsReadResult = {
  source: "database" | "local";
  words: WordCardRecord[];
  error?: string;
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
  ) as { words?: WordCardRecord[]; word?: WordCardRecord; error?: string };

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

export async function fetchWordCards() {
  const response = await fetch("/api/words", { cache: "no-store" });
  const payload = await parseWordsResponse(response);
  return normalizeWordCards(payload.words, true);
}

export async function readWordCardsWithFallback() {
  const result = await readWordCardsWithSource();
  return result.words;
}

export async function readWordCardsWithSource(): Promise<WordCardsReadResult> {
  try {
    const remoteWords = await fetchWordCards();
    writeStoredWordCards(remoteWords);
    return { source: "database", words: remoteWords };
  } catch (error) {
    return { source: "local", words: readStoredWordCards(), error: getErrorMessage(error) };
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
