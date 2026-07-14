import { NextRequest, NextResponse } from "next/server";
import { getApiErrorMessage } from "../../../../lib/apiErrors";
import { createSupabaseAdminClient } from "../../../../lib/supabase/server";
import { normalizeQuotes, QuoteRecord } from "../../../quotes/quoteTypes";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type SiteQuoteRow = {
  id: number;
  text: string | null;
  category: string | null;
  japanese: string | null;
  kana: string | null;
  chinese: string | null;
  front_audio_url: string | null;
};

function rowToQuote(row: SiteQuoteRow): QuoteRecord {
  return normalizeQuotes([
    {
      id: Number(row.id),
      category: row.category ?? "首頁白版",
      japanese: row.japanese ?? row.text ?? "",
      kana: row.kana ?? "",
      chinese: row.chinese ?? "",
      frontAudioUrl: row.front_audio_url ?? ""
    }
  ])[0];
}

function quoteToPayload(quote: QuoteRecord) {
  const normalized = normalizeQuotes([quote])[0];

  return {
    text: normalized.japanese.trim(),
    category: normalized.category.trim() || "首頁白版",
    japanese: normalized.japanese.trim(),
    kana: normalized.kana.trim(),
    chinese: normalized.chinese.trim(),
    front_audio_url: normalized.frontAudioUrl.trim()
  };
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const quote = (await request.json()) as QuoteRecord;
    const payload = quoteToPayload({ ...quote, id: Number(id) });

    if (!payload.japanese || !payload.chinese) {
      return NextResponse.json({ error: "Missing homepage board payload" }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("site_quotes")
      .update(payload)
      .eq("id", Number(id))
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ quote: rowToQuote(data) });
  } catch (error) {
    return NextResponse.json({ error: getApiErrorMessage(error, "Unable to update homepage board item") }, { status: 500 });
  }
}
