import { NextRequest, NextResponse } from "next/server";
import { getApiErrorMessage } from "../../../../lib/apiErrors";
import { createSupabaseAdminClient } from "../../../../lib/supabase/server";
import { generateQuizDistractors } from "../../../quiz/quizDistractors";
import { QuizQuestionRecord } from "../../../quiz/quizTypes";
import { quizQuestionToPayload, QuizQuestionRow, rowToQuizQuestion } from "../quizMapper";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const question = (await request.json()) as QuizQuestionRecord;
    const payload = quizQuestionToPayload({ ...question, id: Number(id) });

    if (!payload.prompt || !payload.answer) {
      return NextResponse.json({ error: "Missing quiz question payload" }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const { data: relatedRows } = await supabase
      .from("quiz_questions")
      .select("*")
      .eq("level", payload.level)
      .eq("category", payload.category)
      .neq("id", Number(id))
      .limit(500);
    const relatedQuestions = ((relatedRows ?? []) as QuizQuestionRow[]).map(rowToQuizQuestion);
    const options = generateQuizDistractors(payload.answer, relatedQuestions, payload.options);
    const { data, error } = await supabase
      .from("quiz_questions")
      .update({ ...payload, options })
      .eq("id", Number(id))
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ question: rowToQuizQuestion(data) });
  } catch (error) {
    return NextResponse.json({ error: getApiErrorMessage(error, "Unable to update quiz question") }, { status: 500 });
  }
}
