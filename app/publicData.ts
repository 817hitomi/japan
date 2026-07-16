import { createSupabaseReadClient } from "../lib/supabase/server";
import { rowToNote } from "./api/notes/noteMapper";
import { rowToWord } from "./api/words/wordMapper";
import { PublicNoteRecord } from "./notes/noteTypes";
import { defaultQuotes, normalizeQuotes, QuoteRecord } from "./quotes/quoteTypes";
import { normalizeWordCards, WordCardRecord } from "./words/wordTypes";

const quoteCategory = "首頁白版";
const publishedStatus = "已發布";

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
    const supabase = createSupabaseReadClient();
    const { data, error } = await supabase
      .from("learning_notes")
      .select("*")
      .eq("status", publishedStatus)
      .order("published_date", { ascending: false })
      .order("id", { ascending: false });

    if (error) {
      throw error;
    }

    return (data ?? []).map(rowToNote);
  } catch {
    return [];
  }
}

export async function readWordsForPublicPage(): Promise<WordCardRecord[]> {
  try {
    const supabase = createSupabaseReadClient();
    const { data, error } = await supabase
      .from("word_cards")
      .select("*")
      .neq("category", quoteCategory)
      .order("category", { ascending: true })
      .order("id", { ascending: false });

    if (error) {
      throw error;
    }

    return normalizeWordCards((data ?? []).map(rowToWord), true);
  } catch {
    return [];
  }
}

export async function readQuotesForPublicPage(): Promise<QuoteRecord[]> {
  try {
    const supabase = createSupabaseReadClient();
    const { data, error } = await supabase
      .from("word_cards")
      .select("id,category,kana,japanese,chinese,audio_url,front_audio_url")
      .eq("category", quoteCategory)
      .order("id", { ascending: false });

    if (error) {
      throw error;
    }

    return normalizeQuotes((data ?? []).map(rowToQuote), true);
  } catch {
    return defaultQuotes;
  }
}