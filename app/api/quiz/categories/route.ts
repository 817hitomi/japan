import { NextResponse } from "next/server";
import { getApiErrorMessage } from "../../../../lib/apiErrors";
import { createSupabaseReadClient } from "../../../../lib/supabase/server";
import { QuizCategoryRow, rowToQuizCategory } from "../quizMapper";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = createSupabaseReadClient();
    const { data, error } = await supabase
      .from("quiz_categories")
      .select("*")
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
