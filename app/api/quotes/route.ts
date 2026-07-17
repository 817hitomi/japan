import { NextRequest, NextResponse } from "next/server";
import { getApiErrorMessage } from "../../../lib/apiErrors";
import { createSupabaseAdminClient, createSupabaseReadClient } from "../../../lib/supabase/server";
import { normalizeQuotes, QuoteRecord } from "../../quotes/quoteTypes";

export const dynamic = "force-dynamic";
const publicQuotesLimit = 40;

const quoteCategory = "首頁白版";

type WordCardQuoteRow = {
  id: number;
  category: string | null;
  kana: string | null;
  japanese: string | null;
  chinese: string | null;
  audio_url: string | null;
  front_audio_url: string | null;
};

function isUniqueViolation(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}

function rowToQuote(row: WordCardQuoteRow): QuoteRecord {
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

function quoteToPayload(quote: QuoteRecord) {
  const normalized = normalizeQuotes([quote])[0];

  return {
    category: quoteCategory,
    kana: normalized.kana.trim(),
    japanese: normalized.japanese.trim(),
    chinese: normalized.chinese.trim(),
    example_japanese: "",
    example_chinese: "",
    audio_url: "",
    front_audio_url: normalized.frontAudioUrl.trim(),
    back_audio_url: ""
  };
}

export async function GET() {
  try {
    const supabase = createSupabaseReadClient();
    const { data, error } = await supabase
      .from("word_cards")
      .select("id,category,kana,japanese,chinese,audio_url,front_audio_url")
      .eq("category", quoteCategory)
      .order("id", { ascending: false })
      .limit(publicQuotesLimit);

    if (error) {
      throw error;
    }

    return NextResponse.json({ quotes: normalizeQuotes((data ?? []).map(rowToQuote), true) });
  } catch (error) {
    return NextResponse.json({ error: getApiErrorMessage(error, "Unable to load homepage board items") }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const quote = (await request.json()) as QuoteRecord;
    const payload = quoteToPayload(quote);

    if (!payload.japanese || !payload.chinese) {
      return NextResponse.json({ error: "Missing homepage board payload" }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("word_cards")
      .insert(payload)
      .select("id,category,kana,japanese,chinese,audio_url,front_audio_url")
      .single();

    if (error) {
      if (isUniqueViolation(error)) {
        return NextResponse.json({ error: "Duplicated Japanese item" }, { status: 409 });
      }

      throw error;
    }

    return NextResponse.json({ quote: rowToQuote(data) }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: getApiErrorMessage(error, "Unable to create homepage board item") }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = (await request.json()) as { ids?: number[] };
    const ids = Array.isArray(body.ids) ? body.ids.filter(Number.isFinite) : [];

    if (ids.length === 0) {
      return NextResponse.json({ error: "Missing homepage board ids" }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.from("word_cards").delete().eq("category", quoteCategory).in("id", ids);

    if (error) {
      throw error;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: getApiErrorMessage(error, "Unable to delete homepage board items") }, { status: 500 });
  }
}
