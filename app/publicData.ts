import { getRuntimeEnv } from "../lib/runtimeEnv";
import { createRequestTimer } from "../lib/requestDiagnostics";
import { rowToNote } from "./api/notes/noteMapper";
import { rowToWord } from "./api/words/wordMapper";
import { getDailySelectionIndex } from "./dailySelection";
import { getNoteRouteKey, PublicNoteRecord } from "./notes/noteTypes";
import { defaultQuotes, normalizeQuotes, QuoteRecord } from "./quotes/quoteTypes";
import { getKanaRowKey, kanaRows, KanaRowKey, normalizeKanaRowKey } from "./words/kanaRows";
import { normalizeWordCards, WordCardRecord } from "./words/wordTypes";

const quoteCategory = "首頁白版";
const publishedStatus = "已發布";

const publicCacheSeconds = 300;
const publicNotesLimit = 120;
const publicArticleSidebarLimit = 12;
export const publicNotesPageSize = 10;
export const publicWordsPageSize = 12;
const publicQuotesLimit = 40;
const noteSummarySelect = "id,category,title,status,published_date,slug,tags";
const noteListSelect = `${noteSummarySelect},summary`;
const notePreviewSelect = `${noteListSelect},cover_url`;
const noteFullSelect = `${noteListSelect},cover_url,blocks`;
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

async function fetchSupabaseRows<Row>(
  path: string,
  params: Record<string, string>,
  options: { useNextCache?: boolean } = {}
): Promise<Row[]> {
  const { rows } = await fetchSupabaseRowsWithCount<Row>(path, params, undefined, options);
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
  range?: { from: number; to: number },
  options: { useNextCache?: boolean } = {}
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
    ...(options.useNextCache ? { next: { revalidate: publicCacheSeconds } } : { cache: "no-store" as const }),
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

async function fetchLimitedPublicNoteSummaries(params: Record<string, string>, limit: number) {
  const rows = await fetchSupabaseRows<Parameters<typeof rowToNote>[0]>("learning_notes", {
    select: noteSummarySelect,
    status: `eq.${publishedStatus}`,
    limit: String(limit),
    ...params
  });

  return rows.map(rowToNote);
}

async function fetchLimitedPublicNoteSummariesWithCount(params: Record<string, string>, limit: number) {
  const { rows, total } = await fetchSupabaseRowsWithCount<Parameters<typeof rowToNote>[0]>(
    "learning_notes",
    {
      select: noteSummarySelect,
      status: `eq.${publishedStatus}`,
      limit: String(limit),
      ...params
    },
    { from: 0, to: limit - 1 }
  );

  return { notes: rows.map(rowToNote), total };
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

export function withPublicNoteImageUrl(note: PublicNoteRecord): PublicNoteRecord {
  return {
    ...note,
    coverUrl: `/api/notes/og?slug=${encodeURIComponent(getNoteRouteKey(note))}`
  };
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

export async function readPublishedNoteCardsForHomePage(): Promise<PublicNoteRecord[]> {
  try {
    const rows = await fetchSupabaseRows<Parameters<typeof rowToNote>[0]>(
      "learning_notes",
      {
        select: noteListSelect,
        status: `eq.${publishedStatus}`,
        order: "published_date.desc,id.desc",
        limit: String(publicNotesLimit)
      },
      { useNextCache: true }
    );

    return rows.map(rowToNote).map(withPublicNoteImageUrl);
  } catch {
    return [];
  }
}

export type PublicNotesPageResult = {
  notes: PublicNoteRecord[];
  page: number;
  pageSize: number;
  total: number;
};

export function normalizePublicNotesPage(value?: string | number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function normalizePublicNotesSearch(value?: string) {
  return value?.trim().replace(/[,%*()]/g, " ").replace(/\s+/g, " ").slice(0, 80) ?? "";
}

export async function readPublishedNotesPage(options: {
  category?: string;
  page?: string | number;
  query?: string;
} = {}): Promise<PublicNotesPageResult> {
  const page = normalizePublicNotesPage(options.page);
  const category = options.category?.trim() ?? "";
  const query = normalizePublicNotesSearch(options.query);
  const from = (page - 1) * publicNotesPageSize;

  try {
    const result = await fetchSupabaseRowsWithCount<Parameters<typeof rowToNote>[0]>(
      "learning_notes",
      {
        select: noteListSelect,
        status: `eq.${publishedStatus}`,
        order: "published_date.desc,id.desc",
        ...(category ? { category: `eq.${category}` } : {}),
        ...(query
          ? {
              or: `(title.ilike.*${query}*,summary.ilike.*${query}*,category.ilike.*${query}*,tags.ilike.*${query}*)`
            }
          : {})
      },
      { from, to: from + publicNotesPageSize - 1 }
    );

    return {
      notes: result.rows.map(rowToNote).map(withPublicNoteImageUrl),
      page,
      pageSize: publicNotesPageSize,
      total: result.total
    };
  } catch {
    return { notes: [], page, pageSize: publicNotesPageSize, total: 0 };
  }
}

export async function readPublishedNoteCategories() {
  try {
    const rows = await fetchSupabaseRows<{ category: string | null }>("learning_notes", {
      select: "category",
      status: `eq.${publishedStatus}`,
      order: "category.asc",
      limit: String(publicNotesLimit)
    });

    return Array.from(new Set(rows.map((row) => row.category?.trim() ?? "").filter(Boolean)));
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

export async function readPublishedNotePreviewByRouteKey(routeKey?: string): Promise<PublicNoteRecord | null> {
  const key = routeKey?.trim();

  if (!key) {
    return null;
  }

  try {
    const numericId = Number(key);
    const rows = await fetchSupabaseRows<Parameters<typeof rowToNote>[0]>("learning_notes", {
      select: notePreviewSelect,
      status: `eq.${publishedStatus}`,
      ...(Number.isFinite(numericId) && String(numericId) === key ? { id: `eq.${numericId}` } : { slug: `eq.${key}` }),
      limit: "1"
    });

    if (!rows[0]) {
      return null;
    }

    const note = rowToNote(rows[0]);
    return note.coverUrl.trim() ? note : readPublishedNoteByRouteKey(key);
  } catch {
    return null;
  }
}

export type PublicArticleContext = {
  notes: PublicNoteRecord[];
  previousNote: PublicNoteRecord | null;
  nextNote: PublicNoteRecord | null;
  total: number;
};

function mergeUniqueNotes(notes: PublicNoteRecord[], limit = publicArticleSidebarLimit) {
  const seen = new Set<number>();
  const merged: PublicNoteRecord[] = [];

  for (const note of notes) {
    if (seen.has(note.id)) {
      continue;
    }

    seen.add(note.id);
    merged.push(note);

    if (merged.length >= limit) {
      break;
    }
  }

  return merged;
}

export async function readPublicArticleContext(note: PublicNoteRecord): Promise<PublicArticleContext> {
  const timer = createRequestTimer("related articles", { route: "/notes/[slug]", noteId: note.id });

  try {
    const category = note.category?.trim();
    const [newerRows, olderRows, relatedRows, latestResult] = await Promise.all([
      fetchLimitedPublicNoteSummaries(
        {
          published_date: `gt.${note.date}`,
          order: "published_date.asc,id.asc"
        },
        1
      ),
      fetchLimitedPublicNoteSummaries(
        {
          published_date: `lt.${note.date}`,
          order: "published_date.desc,id.desc"
        },
        1
      ),
      category
        ? fetchLimitedPublicNoteSummaries(
            {
              category: `eq.${category}`,
              id: `neq.${note.id}`,
              order: "published_date.desc,id.desc"
            },
            6
          )
        : Promise.resolve([]),
      fetchLimitedPublicNoteSummariesWithCount(
        {
          id: `neq.${note.id}`,
          order: "published_date.desc,id.desc"
        },
        8
      )
    ]);
    const latestRows = latestResult.notes;
    const notes = mergeUniqueNotes([note, ...newerRows, ...olderRows, ...relatedRows, ...latestRows]);

    timer.end({
      status: "ok",
      previous: Boolean(newerRows[0]),
      next: Boolean(olderRows[0]),
      related: notes.length
    });

    return {
      notes,
      previousNote: newerRows[0] ?? null,
      nextNote: olderRows[0] ?? null,
      total: Math.max(latestResult.total + 1, notes.length)
    };
  } catch {
    timer.end({ status: "fallback" });
    return {
      notes: [note],
      previousNote: null,
      nextNote: null,
      total: 1
    };
  }
}

export type PublicWordsPageResult = {
  page: number;
  pageSize: number;
  total: number;
  words: WordCardRecord[];
};

export type PublicWordsFacets = {
  categories: string[];
  filteredTotal: number;
  kanaCounts: Record<KanaRowKey, number>;
  total: number;
};

export type PublicWordsPageOptions = {
  category?: string;
  kanaRow?: string;
  page?: number;
  pageSize?: number;
};

export function normalizePublicPage(value?: string | number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

async function readWordFacetData(category = "", kanaRow = "") {
  const batchSize = 1000;
  const emptyCounts = Object.fromEntries(kanaRows.map((row) => [row.key, 0])) as Record<KanaRowKey, number>;

  try {
    const timer = createRequestTimer("database query", {
      table: "word_cards",
      operation: "public-words-filter-source"
    });
    const rows: Array<{ id: number; category: string | null; japanese: string | null; kana: string | null }> = [];
    let total = 0;

    for (let from = 0; ; from += batchSize) {
      const to = from + batchSize - 1;
      const result = await fetchSupabaseRowsWithCount<{ id: number; category: string | null; japanese: string | null; kana: string | null }>(
        "word_cards",
        {
          select: "id,category,kana,japanese",
          category: `neq.${quoteCategory}`,
          order: "id.desc"
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

    const categories = Array.from(new Set(rows.map((row) => row.category?.trim() ?? "").filter(Boolean))).sort((a, b) =>
      a.localeCompare(b, "zh-Hant")
    );
    const filteredRows = category ? rows.filter((row) => row.category === category) : rows;
    const kanaCounts = { ...emptyCounts };
    const normalizedKanaRow = normalizeKanaRowKey(kanaRow);

    filteredRows.forEach((row) => {
      const key = getKanaRowKey({ japanese: row.japanese ?? "", kana: row.kana ?? "" });
      if (key) {
        kanaCounts[key] += 1;
      }
    });

    const matchingIds = filteredRows
      .filter((row) => !normalizedKanaRow || getKanaRowKey({ japanese: row.japanese ?? "", kana: row.kana ?? "" }) === normalizedKanaRow)
      .map((row) => row.id);

    timer.end({ status: "ok", rows: rows.length, total });
    return {
      facets: { categories, filteredTotal: filteredRows.length, kanaCounts, total: total || rows.length } satisfies PublicWordsFacets,
      matchingIds
    };
  } catch {
    return {
      facets: { categories: [], filteredTotal: 0, kanaCounts: emptyCounts, total: 0 } satisfies PublicWordsFacets,
      matchingIds: [] as number[]
    };
  }
}

export async function readWordsListingForPublicPage(options: PublicWordsPageOptions = {}) {
  const page = normalizePublicPage(options.page);
  const pageSize = options.pageSize ?? publicWordsPageSize;
  const { facets, matchingIds } = await readWordFacetData(options.category?.trim() ?? "", options.kanaRow ?? "");
  const pageIds = matchingIds.slice((page - 1) * pageSize, page * pageSize);

  if (pageIds.length === 0) {
    return { facets, page: { page, pageSize, total: matchingIds.length, words: [] } satisfies PublicWordsPageResult };
  }

  try {
    const rows = await fetchSupabaseRows<Parameters<typeof rowToWord>[0]>("word_cards", {
      select: wordSelect,
      id: `in.(${pageIds.join(",")})`
    });
    const wordsById = new Map(normalizeWordCards(rows.map(rowToWord), true).map((word) => [word.id, word]));
    const words = pageIds.map((id) => wordsById.get(id)).filter((word): word is WordCardRecord => Boolean(word));
    return { facets, page: { page, pageSize, total: matchingIds.length, words } satisfies PublicWordsPageResult };
  } catch {
    return { facets, page: { page, pageSize, total: matchingIds.length, words: [] } satisfies PublicWordsPageResult };
  }
}

export async function readWordsForPublicPage(
  pageOrOptions: number | PublicWordsPageOptions = 1,
  legacyPageSize = publicWordsPageSize,
  useNextCache = false
): Promise<PublicWordsPageResult> {
  const options = typeof pageOrOptions === "number" ? { page: pageOrOptions, pageSize: legacyPageSize } : pageOrOptions;
  const currentPage = normalizePublicPage(options.page);
  const pageSize = options.pageSize ?? publicWordsPageSize;
  const from = (currentPage - 1) * pageSize;
  const to = from + pageSize - 1;

  try {
    const timer = createRequestTimer("database query", {
      table: "word_cards",
      operation: "public-words-page",
      page: currentPage,
      pageSize
    });
    const queryParams: Record<string, string> = {
      select: wordSelect,
      category: `neq.${quoteCategory}`,
      order: "category.asc,id.desc"
    };

    const result = await fetchSupabaseRowsWithCount<Parameters<typeof rowToWord>[0]>(
      "word_cards",
      queryParams,
      { from, to },
      { useNextCache }
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

export async function readWordsForHomePage(dailyKey: string): Promise<PublicWordsPageResult> {
  const dailyPoolSize = 100;
  const countResult = await readWordsForPublicPage(1, 1, true);

  if (countResult.total <= 1) {
    return countResult;
  }

  const pageCount = Math.ceil(countResult.total / dailyPoolSize);
  const dailyPage = getDailySelectionIndex(pageCount, dailyKey, "word-pool") + 1;

  return readWordsForPublicPage(dailyPage, dailyPoolSize, true);
}

export async function readQuotesForPublicPage(useNextCache = false): Promise<QuoteRecord[]> {
  try {
    const rows = await fetchSupabaseRows<QuoteRow>(
      "word_cards",
      {
        select: "id,category,kana,japanese,chinese,audio_url,front_audio_url",
        category: `eq.${quoteCategory}`,
        order: "id.desc",
        limit: String(publicQuotesLimit)
      },
      { useNextCache }
    );

    return normalizeQuotes(rows.map(rowToQuote), true);
  } catch {
    return defaultQuotes;
  }
}
