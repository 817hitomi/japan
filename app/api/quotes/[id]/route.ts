import { NextRequest, NextResponse } from "next/server";
import { getApiErrorMessage } from "../../../../lib/apiErrors";
import { createSupabaseAdminClient } from "../../../../lib/supabase/server";
import { requireAdminRoute } from "../../../../lib/adminRouteAuth";
import { normalizeQuotes, QuoteRecord } from "../../../quotes/quoteTypes";

export const dynamic = "force-dynamic";

const quoteCategory = "首頁白版";
const randomPoolMarker = "__japannote_homepage_random__";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type WordCardQuoteRow = {
  id: number;
  category: string | null;
  kana: string | null;
  japanese: string | null;
  chinese: string | null;
  audio_url: string | null;
  front_audio_url: string | null;
  example_japanese: string | null;
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
      frontAudioUrl: row.front_audio_url ?? row.audio_url ?? "",
      isRandomPool: row.example_japanese === randomPoolMarker
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
    example_japanese: normalized.isRandomPool ? randomPoolMarker : "",
    example_chinese: "",
    audio_url: "",
    front_audio_url: normalized.frontAudioUrl.trim(),
    back_audio_url: ""
  };
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const authError = await requireAdminRoute();
  if (authError) return authError;

  try {
    const { id } = await context.params;
    const quote = (await request.json()) as QuoteRecord;
    const payload = quoteToPayload({ ...quote, id: Number(id) });

    if (!payload.japanese || !payload.chinese) {
      return NextResponse.json({ error: "Missing homepage board payload" }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("word_cards")
      .update(payload)
      .eq("id", Number(id))
      .eq("category", quoteCategory)
      .select("id,category,kana,japanese,chinese,audio_url,front_audio_url,example_japanese")
      .single();

    if (error) {
      if (isUniqueViolation(error)) {
        return NextResponse.json({ error: "Duplicated Japanese item" }, { status: 409 });
      }

      throw error;
    }

    return NextResponse.json({ quote: rowToQuote(data) });
  } catch (error) {
    return NextResponse.json({ error: getApiErrorMessage(error, "Unable to update homepage board item") }, { status: 500 });
  }
}
