import { getRuntimeEnv } from "../lib/runtimeEnv";
import { rowToNote } from "./api/notes/noteMapper";
import { rowToWord } from "./api/words/wordMapper";
import { PublicNoteRecord } from "./notes/noteTypes";
import { defaultQuotes, normalizeQuotes, QuoteRecord } from "./quotes/quoteTypes";
import { normalizeWordCards, WordCardRecord } from "./words/wordTypes";

const quoteCategory = "首頁白版";
const publishedStatus = "已發布";

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
    cache: "no-store",
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
      select: "*",
      status: `eq.${publishedStatus}`,
      order: "published_date.desc,id.desc"
    });

    return rows.map(rowToNote);
  } catch {
    return [];
  }
}

export async function readWordsForPublicPage(): Promise<WordCardRecord[]> {
  try {
    const rows = await fetchSupabaseRows<Parameters<typeof rowToWord>[0]>("word_cards", {
      select: "*",
      category: `neq.${quoteCategory}`,
      order: "category.asc,id.desc"
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
      order: "id.desc"
    });

    return normalizeQuotes(rows.map(rowToQuote), true);
  } catch {
    return defaultQuotes;
  }
}
