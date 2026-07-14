"use client";

import { readApiError } from "../../lib/apiErrors";
import { defaultQuotes, normalizeQuotes, QuoteRecord } from "./quoteTypes";

const quoteStorageKey = "japannote-hero-board-cards";

export type QuotesReadResult = {
  source: "database" | "local";
  quotes: QuoteRecord[];
  error?: string;
};

export function readStoredQuotes() {
  if (typeof window === "undefined") {
    return defaultQuotes;
  }

  const raw = window.localStorage.getItem(quoteStorageKey);
  if (!raw) {
    window.localStorage.setItem(quoteStorageKey, JSON.stringify(defaultQuotes));
    return defaultQuotes;
  }

  try {
    return normalizeQuotes(JSON.parse(raw));
  } catch {
    return defaultQuotes;
  }
}

export function writeStoredQuotes(quotes: QuoteRecord[]) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(quoteStorageKey, JSON.stringify(normalizeQuotes(quotes)));
  }
}

async function parseQuotesResponse(response: Response) {
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
  ) as { quotes?: QuoteRecord[]; quote?: QuoteRecord; error?: string };

  if (!response.ok) {
    throw new Error(payload.error || responseText || `Homepage board API failed: ${response.status}`);
  }

  return payload;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown homepage board API error";
}

export async function fetchQuotes() {
  const response = await fetch("/api/quotes", { cache: "no-store" });
  const payload = await parseQuotesResponse(response);
  return normalizeQuotes(payload.quotes, true);
}

export async function readQuotesWithFallback() {
  const result = await readQuotesWithSource();
  return result.quotes;
}

export async function readQuotesWithSource(): Promise<QuotesReadResult> {
  try {
    const remoteQuotes = await fetchQuotes();
    writeStoredQuotes(remoteQuotes);
    return { source: "database", quotes: remoteQuotes };
  } catch (error) {
    return {
      source: "local",
      quotes: readStoredQuotes(),
      error: getErrorMessage(error)
    };
  }
}

export async function saveQuote(quote: QuoteRecord, mode: "create" | "update") {
  const response = await fetch(mode === "update" ? `/api/quotes/${quote.id}` : "/api/quotes", {
    method: mode === "update" ? "PUT" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(quote)
  });
  const payload = await parseQuotesResponse(response);

  if (!payload.quote) {
    throw new Error("Save homepage board response missing item");
  }

  return normalizeQuotes([payload.quote])[0];
}

export async function deleteQuotes(ids: number[]) {
  const response = await fetch("/api/quotes", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids })
  });

  await parseQuotesResponse(response);
}
