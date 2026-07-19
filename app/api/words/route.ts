import { NextRequest, NextResponse } from "next/server";
import { getApiErrorMessage } from "../../../lib/apiErrors";
import { createRequestTimer } from "../../../lib/requestDiagnostics";
import { createSupabaseAdminClient, createSupabaseReadClient } from "../../../lib/supabase/server";
import { WordCardRecord } from "../../words/wordTypes";
import { rowToWord, wordToPayload } from "./wordMapper";

export const dynamic = "force-dynamic";
const defaultWordsPage = 1;
const defaultWordsPageSize = 100;
const maxWordsPageSize = 200;
const quoteCategory = "擐??賜?";

function getPositiveInteger(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function escapeLikePattern(value: string) {
  return value.replace(/[%_]/g, (match) => `\\${match}`);
}

function isUniqueViolation(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}

export async function GET(request: NextRequest) {
  const timer = createRequestTimer("route handler", { route: "/api/words", method: "GET" });
  try {
    const page = getPositiveInteger(request.nextUrl.searchParams.get("page"), defaultWordsPage);
    const requestedPageSize = getPositiveInteger(request.nextUrl.searchParams.get("pageSize"), defaultWordsPageSize);
    const pageSize = Math.min(requestedPageSize, maxWordsPageSize);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
    const supabase = createSupabaseReadClient();
    timer.mark("database query start", { table: "word_cards", page, pageSize });
    let requestBuilder = supabase
      .from("word_cards")
      .select("*", { count: "exact" })
      .neq("category", "首頁白版");

    if (query) {
      const pattern = `%${escapeLikePattern(query)}%`;
      requestBuilder = requestBuilder.or(
        `category.ilike.${pattern},japanese.ilike.${pattern},kana.ilike.${pattern},chinese.ilike.${pattern},example_japanese.ilike.${pattern},example_chinese.ilike.${pattern}`
      );
    }

    const { data, error, count } = await requestBuilder
      .order("category", { ascending: true })
      .order("id", { ascending: false })
      .range(from, to);

    if (error) {
      timer.end({ status: 500 });
      throw error;
    }

    const words = (data ?? []).map(rowToWord);
    timer.mark("database query end", { rows: words.length, total: count ?? 0 });
    timer.end({ status: 200 });
    return NextResponse.json({ page, pageSize, total: count ?? 0, words });
  } catch (error) {
    timer.end({ status: 500 });
    return NextResponse.json({ error: getApiErrorMessage(error, "Unable to load words") }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const word = (await request.json()) as WordCardRecord;
    const payload = wordToPayload(word);

    if (!payload.japanese || !payload.chinese) {
      return NextResponse.json({ error: "Missing word payload" }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const { data: duplicatedWord, error: duplicateError } = await supabase
      .from("word_cards")
      .select("id")
      .eq("japanese", payload.japanese)
      .limit(1)
      .maybeSingle();

    if (duplicateError) {
      throw duplicateError;
    }

    if (duplicatedWord) {
      return NextResponse.json({ error: "Duplicated Japanese word" }, { status: 409 });
    }

    const { data, error } = await supabase
      .from("word_cards")
      .insert(payload)
      .select("*")
      .single();

    if (error) {
      if (isUniqueViolation(error)) {
        return NextResponse.json({ error: "Duplicated Japanese word and kana" }, { status: 409 });
      }

      throw error;
    }

    return NextResponse.json({ word: rowToWord(data) }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: getApiErrorMessage(error, "Unable to create word") }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = (await request.json()) as { ids?: number[] };
    const ids = Array.isArray(body.ids) ? body.ids.filter(Number.isFinite) : [];

    if (ids.length === 0) {
      return NextResponse.json({ error: "Missing word ids" }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.from("word_cards").delete().in("id", ids);

    if (error) {
      throw error;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: getApiErrorMessage(error, "Unable to delete words") }, { status: 500 });
  }
}
