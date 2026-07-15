import { NextRequest, NextResponse } from "next/server";
import { getApiErrorMessage } from "../../../lib/apiErrors";
import { createSupabaseAdminClient, createSupabaseReadClient } from "../../../lib/supabase/server";
import { WordCardRecord } from "../../words/wordTypes";
import { rowToWord, wordToPayload } from "./wordMapper";

export const dynamic = "force-dynamic";

function isUniqueViolation(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}

export async function GET() {
  try {
    const supabase = createSupabaseReadClient();
    const { data, error } = await supabase
      .from("word_cards")
      .select("*")
      .neq("category", "首頁白版")
      .order("category", { ascending: true })
      .order("id", { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json({ words: (data ?? []).map(rowToWord) });
  } catch (error) {
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
