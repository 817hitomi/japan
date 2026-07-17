import { getRuntimeEnv } from "../lib/runtimeEnv";
import { rowToNote } from "./api/notes/noteMapper";
import { rowToWord } from "./api/words/wordMapper";
import { PublicNoteRecord } from "./notes/noteTypes";
import { defaultQuotes, normalizeQuotes, QuoteRecord } from "./quotes/quoteTypes";
import { normalizeWordCards, WordCardRecord } from "./words/wordTypes";

const quoteCategory = "首頁白版";
const publishedStatus = "已發布";

const publicCacheSeconds = 300;
const publicNotesLimit = 120;
const publicWordsLimit = 600;
const publicQuotesLimit = 40;
const noteSummarySelect = "id,category,title,summary,status,published_date,slug,tags,cover_url";
const noteFullSelect = `${noteSummarySelect},blocks`;

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
  const anonKey = getRuntimeEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  if (!anonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  const response = await fetch(getSupabaseRestUrl(path, params), {
    next: { revalidate: publicCacheSeconds },
    headers: {
      apikey: anonKey,
      authorization: `Bearer ${anonKey}`
    }
  });

  if (!response.ok) {
    throw new Error(`Supabase public read failed: ${response.status}`);
  }

  return (await response.json()) as Row[];
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

export async function readWordsForPublicPage(): Promise<WordCardRecord[]> {
  try {
    const rows = await fetchSupabaseRows<Parameters<typeof rowToWord>[0]>("word_cards", {
      select: "*",
      category: `neq.${quoteCategory}`,
      order: "category.asc,id.desc",
      limit: String(publicWordsLimit)
    });

    return normalizeWordCards(rows.map(rowToWord), true);
  } catch {
    return [];
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
