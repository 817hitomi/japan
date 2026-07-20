import { getRuntimeEnv } from "../lib/runtimeEnv";
import { createRequestTimer } from "../lib/requestDiagnostics";
import { rowToNote } from "./api/notes/noteMapper";
import { rowToWord } from "./api/words/wordMapper";
import { PublicNoteRecord } from "./notes/noteTypes";
import { defaultQuotes, normalizeQuotes, QuoteRecord } from "./quotes/quoteTypes";
import { normalizeWordCards, WordCardRecord } from "./words/wordTypes";

const quoteCategory = "首頁白版";
const publishedStatus = "已發布";

const publicCacheSeconds = 300;
const publicNotesLimit = 120;
export const publicWordsPageSize = 12;
const publicQuotesLimit = 40;
const noteSummarySelect = "id,category,title,summary,status,published_date,slug,tags,cover_url";
const noteFullSelect = `${noteSummarySelect},blocks`;
const wordSelect = "id,category,kana,japanese,chinese,example_japanese,example_chinese,audio_url,front_audio_url,back_audio_url";

function getWorkerDefaultCache() {
  return (caches as CacheStorage & { default?: Cache }).default;
}

function getSupabaseRestUrl(path: string, params: Record<string, string>) {
  const supabaseUrl = getRuntimeEnv("NEXT_PUBLIC_SUPABASE_URL");

  if (!supabaseUrl) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  }

  const url = new URL(`/rest/v1/${path}`, supabaseUrl.replace(/\/$/, ""));
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return url;
}

async function fetchSupabaseRows<Row>(path: string, params: Record<string, string>): Promise<Row[]> {
  const { rows } = await fetchSupabaseRowsWithCount<Row>(path, params);
  return rows;
}

function getContentRangeTotal(contentRange: string | null) {
  const total = contentRange?.split("/")[1];
  const parsed = total && total !== "*" ? Number(total) : NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

async function readWorkerCachedResponse(cacheKey: Request) {
  if (typeof caches === "undefined") {
    return null;
  }

  try {
    return getWorkerDefaultCache()?.match(cacheKey) ?? null;
  } catch {
    return null;
  }
}

async function writeWorkerCachedResponse(cacheKey: Request, response: Response) {
  if (typeof caches === "undefined") {
    return;
  }

  try {
    await getWorkerDefaultCache()?.put(cacheKey, response);
  } catch {
    // Cache API is best-effort and should never block rendering.
  }
}

async function fetchSupabaseRowsWithCount<Row>(
  path: string,
  params: Record<string, string>,
  range?: { from: number; to: number }
): Promise<{ rows: Row[]; total: number }> {
  const anonKey = getRuntimeEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  if (!anonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  const timer = createRequestTimer("database query", { table: path, operation: "public-rest-read" });
  const url = getSupabaseRestUrl(path, params);
  const cacheKey = new Request(url.toString(), {
    headers: range ? { range: `${range.from}-${range.to}`, "range-unit": "items" } : undefined
  });
  const cachedResponse = await readWorkerCachedResponse(cacheKey);
  const response = cachedResponse ?? await fetch(url, {
    next: { revalidate: publicCacheSeconds },
    headers: {
      apikey: anonKey,
      authorization: `Bearer ${anonKey}`,
      ...(range
        ? {
            prefer: "count=exact",
            range: `${range.from}-${range.to}`,
            "range-unit": "items"
          }
        : {})
    }
  });

  if (!response.ok) {
    timer.end({ status: response.status });
    throw new Error(`Supabase public read failed: ${response.status}`);
  }

  if (!cachedResponse) {
    const cacheableResponse = new Response(response.clone().body, response);
    cacheableResponse.headers.set("Cache-Control", `public, max-age=${publicCacheSeconds}, stale-while-revalidate=86400`);
    await writeWorkerCachedResponse(cacheKey, cacheableResponse);
  }

  const rows = (await response.json()) as Row[];
  const total = getContentRangeTotal(response.headers.get("content-range"));
  timer.end({ status: response.status, rows: rows.length, total, cache: cachedResponse ? "hit" : "miss" });
  return { rows, total };
}

type QuoteRow = {
  id: number;
  category: string | null;
  kana: string | null;
  japanese: string | null;
  chinese: string | null;
  audio_url: string | null;
  front_audio_url: string | null;
};

function rowToQuote(row: QuoteRow): QuoteRecord {
  return normalizeQuotes([
    {
      id: Number(row.id),
      category: row.category ?? quoteCategory,
      japanese: row.japanese ?? "",
      kana: row.kana ?? "",
      chinese: row.chinese ?? "",
      frontAudioUrl: row.front_audio_url ?? row.audio_url ?? ""
    }
  ])[0];
}

export async function readPublishedNotesForPublicPage(): Promise<PublicNoteRecord[]> {
  try {
    const rows = await fetchSupabaseRows<Parameters<typeof rowToNote>[0]>("learning_notes", {
      select: noteSummarySelect,
      status: `eq.${publishedStatus}`,
      order: "published_date.desc,id.desc",
      limit: String(publicNotesLimit)
    });

    return rows.map(rowToNote);
  } catch {
    return [];
  }
}

export async function readPublishedNoteByRouteKey(routeKey?: string): Promise<PublicNoteRecord | null> {
  const key = routeKey?.trim();

  if (!key) {
    return null;
  }

  try {
    const numericId = Number(key);
    const rows = await fetchSupabaseRows<Parameters<typeof rowToNote>[0]>("learning_notes", {
      select: noteFullSelect,
      status: `eq.${publishedStatus}`,
      ...(Number.isFinite(numericId) && String(numericId) === key ? { id: `eq.${numericId}` } : { slug: `eq.${key}` }),
      limit: "1"
    });

    return rows[0] ? rowToNote(rows[0]) : null;
  } catch {
    return null;
  }
}

export type PublicWordsPageResult = {
  page: number;
  pageSize: number;
  total: number;
  words: WordCardRecord[];
};

export function normalizePublicPage(value?: string | number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export async function readWordsForPublicFilters(): Promise<WordCardRecord[]> {
  const batchSize = 1000;

  try {
    const timer = createRequestTimer("database query", {
      table: "word_cards",
      operation: "public-words-filter-source"
    });
    const rows: Parameters<typeof rowToWord>[0][] = [];
    let total = 0;

    for (let from = 0; ; from += batchSize) {
      const to = from + batchSize - 1;
      const result = await fetchSupabaseRowsWithCount<Parameters<typeof rowToWord>[0]>(
        "word_cards",
        {
          select: wordSelect,
          category: `neq.${quoteCategory}`,
          order: "category.asc,id.desc"
        },
        { from, to }
      );

      if (from === 0) {
        total = result.total;
      }

      rows.push(...result.rows);

      if (result.rows.length < batchSize || (total > 0 && rows.length >= total)) {
        break;
      }
    }

    timer.end({ status: "ok", rows: rows.length, total });
    return normalizeWordCards(rows.map(rowToWord), true);
  } catch {
    return [];
  }
}

export async function readWordsForPublicPage(page = 1, pageSize = publicWordsPageSize): Promise<PublicWordsPageResult> {
  const currentPage = normalizePublicPage(page);
  const from = (currentPage - 1) * pageSize;
  const to = from + pageSize - 1;

  try {
    const timer = createRequestTimer("database query", {
      table: "word_cards",
      operation: "public-words-page",
      page: currentPage,
      pageSize
    });
    const result = await fetchSupabaseRowsWithCount<Parameters<typeof rowToWord>[0]>(
      "word_cards",
      {
        select: wordSelect,
        category: `neq.${quoteCategory}`,
        order: "category.asc,id.desc"
      },
      { from, to }
    );

    const rows = result.rows;
    timer.end({ status: "ok", rows: rows.length, total: result.total });
    const words = normalizeWordCards(rows.map(rowToWord), true);
    return {
      page: currentPage,
      pageSize,
      total: result.total || words.length,
      words
    };
  } catch {
    return {
      page: currentPage,
      pageSize,
      total: 0,
      words: []
    };
  }
}

export async function readQuotesForPublicPage(): Promise<QuoteRecord[]> {
  try {
    const rows = await fetchSupabaseRows<QuoteRow>("word_cards", {
      select: "id,category,kana,japanese,chinese,audio_url,front_audio_url",
      category: `eq.${quoteCategory}`,
      order: "id.desc",
      limit: String(publicQuotesLimit)
    });

    return normalizeQuotes(rows.map(rowToQuote), true);
  } catch {
    return defaultQuotes;
  }
}
