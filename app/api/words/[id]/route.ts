import { NextRequest, NextResponse } from "next/server";
import { getApiErrorMessage } from "../../../../lib/apiErrors";
import { createSupabaseAdminClient } from "../../../../lib/supabase/server";
import { WordCardRecord } from "../../../words/wordTypes";
import { rowToWord, wordToPayload } from "../wordMapper";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function isUniqueViolation(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const word = (await request.json()) as WordCardRecord;
    const payload = wordToPayload({ ...word, id: Number(id) });

    if (!payload.japanese || !payload.chinese) {
      return NextResponse.json({ error: "Missing word payload" }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("word_cards")
      .update(payload)
      .eq("id", Number(id))
      .select("*")
      .single();

    if (error) {
      if (isUniqueViolation(error)) {
        return NextResponse.json({ error: "Duplicated Japanese word" }, { status: 409 });
      }

      throw error;
    }

    return NextResponse.json({ word: rowToWord(data) });
  } catch (error) {
    return NextResponse.json({ error: getApiErrorMessage(error, "Unable to update word") }, { status: 500 });
  }
}
