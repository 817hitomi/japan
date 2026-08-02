import { NextRequest, NextResponse } from "next/server";
import { getApiErrorMessage } from "../../../../lib/apiErrors";
import { createSupabaseAdminClient } from "../../../../lib/supabase/server";
import { requireAdminRoute } from "../../../../lib/adminRouteAuth";
import { generateQuizDistractors } from "../../../quiz/quizDistractors";
import { isWordOrderQuestionType, QuizQuestionRecord } from "../../../quiz/quizTypes";
import {
  quizDistractorCandidateSelect,
  quizQuestionSelect,
  quizQuestionToPayload,
  QuizDistractorCandidateRow,
  rowToQuizDistractorCandidate,
  rowToQuizQuestion
} from "../quizMapper";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PUT(request: NextRequest, context: RouteContext) {
  const authError = await requireAdminRoute();
  if (authError) return authError;

  try {
    const { id } = await context.params;
    const question = (await request.json()) as QuizQuestionRecord;
    const payload = quizQuestionToPayload({ ...question, id: Number(id) });

    const isWordOrderQuestion = isWordOrderQuestionType(payload.question_type);

    if (!payload.answer || (!isWordOrderQuestion && !payload.prompt) || (isWordOrderQuestion && payload.options.length < 2)) {
      return NextResponse.json({ error: "Missing quiz question payload" }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    let options = payload.options;

    if (!isWordOrderQuestion) {
      const { data: relatedRows } = await supabase
        .from("quiz_questions")
        .select(quizDistractorCandidateSelect)
        .eq("level", payload.level)
        .eq("category", payload.category)
        .neq("id", Number(id))
        .limit(500);
      const relatedQuestions = ((relatedRows ?? []) as QuizDistractorCandidateRow[]).map(rowToQuizDistractorCandidate);
      options = generateQuizDistractors(payload.answer, relatedQuestions, payload.options);
    }
    const { data, error } = await supabase
      .from("quiz_questions")
      .update({ ...payload, options })
      .eq("id", Number(id))
      .select(quizQuestionSelect)
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ question: rowToQuizQuestion(data) });
  } catch (error) {
    return NextResponse.json({ error: getApiErrorMessage(error, "Unable to update quiz question") }, { status: 500 });
  }
}
