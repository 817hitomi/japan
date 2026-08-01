import { NextRequest, NextResponse } from "next/server";
import { getApiErrorMessage } from "../../../../lib/apiErrors";
import { requireAdminRoute } from "../../../../lib/adminRouteAuth";
import { createSupabaseAdminClient, createSupabaseReadClient } from "../../../../lib/supabase/server";
import { QuizLevel, quizLevels } from "../../../quiz/quizTypes";
import { quizCategorySelect, QuizCategoryRow, rowToQuizCategory } from "../quizMapper";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = createSupabaseReadClient();
    const { data, error } = await supabase
      .from("quiz_categories")
      .select(quizCategorySelect)
      .order("level", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      throw error;
    }

    return NextResponse.json({ categories: ((data ?? []) as QuizCategoryRow[]).map(rowToQuizCategory) });
  } catch (error) {
    return NextResponse.json({ error: getApiErrorMessage(error, "Unable to load quiz categories") }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authError = await requireAdminRoute();
  if (authError) return authError;

  try {
    const body = (await request.json()) as { level?: string; name?: string };
    const level = body.level?.trim() as QuizLevel;
    const name = body.name?.trim() ?? "";

    if (!quizLevels.includes(level) || !name || name.length > 80) {
      return NextResponse.json({ error: "Invalid quiz category payload" }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("quiz_categories")
      .insert({ id: `${level.toLowerCase()}-${crypto.randomUUID()}`, level, name })
      .select(quizCategorySelect)
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "這個級別已經有相同名稱的分類。" }, { status: 409 });
      }
      throw error;
    }

    return NextResponse.json({ category: rowToQuizCategory(data as QuizCategoryRow) }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: getApiErrorMessage(error, "Unable to create quiz category") }, { status: 500 });
  }
}
