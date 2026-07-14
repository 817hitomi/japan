import { NextRequest, NextResponse } from "next/server";
import { getApiErrorMessage } from "../../../lib/apiErrors";
import { createSupabaseAdminClient, createSupabaseReadClient } from "../../../lib/supabase/server";
import { normalizeQuotes, QuoteRecord } from "../../quotes/quoteTypes";

export const dynamic = "force-dynamic";

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

export async function GET() {
  try {
    const supabase = createSupabaseReadClient();
    const { data, error } = await supabase.from("site_quotes").select("*").order("id", { ascending: false });

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
    const { data, error } = await supabase.from("site_quotes").insert(payload).select("*").single();

    if (error) {
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
    const { error } = await supabase.from("site_quotes").delete().in("id", ids);

    if (error) {
      throw error;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: getApiErrorMessage(error, "Unable to delete homepage board items") }, { status: 500 });
  }
}
