import { NextRequest, NextResponse } from "next/server";
import { getApiErrorMessage } from "../../../lib/apiErrors";
import { createSupabaseAdminClient, createSupabaseReadClient } from "../../../lib/supabase/server";
import { requireAdminRoute } from "../../../lib/adminRouteAuth";
import { generateQuizDistractors } from "../../quiz/quizDistractors";
import { isWordOrderQuestionType, QuizQuestionRecord, quizQuestionTypes } from "../../quiz/quizTypes";
import {
  quizDistractorCandidateSelect,
  quizQuestionSelect,
  quizQuestionToPayload,
  QuizDistractorCandidateRow,
  QuizQuestionRow,
  rowToQuizDistractorCandidate,
  rowToQuizQuestion
} from "./quizMapper";

export const dynamic = "force-dynamic";

function getPositiveInteger(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function escapeLikePattern(value: string) {
  return value.replace(/[%_]/g, (match) => `\\${match}`);
}

export async function GET(request: NextRequest) {
  try {
    const level = request.nextUrl.searchParams.get("level")?.trim();
    const categories = Array.from(
      new Set(request.nextUrl.searchParams.getAll("category").map((category) => category.trim()).filter(Boolean))
    );
    const requestedQuestionType = request.nextUrl.searchParams.get("type")?.trim();
    const questionType = quizQuestionTypes.find((type) => type === requestedQuestionType);
    const requestedExcludedQuestionType = request.nextUrl.searchParams.get("excludeType")?.trim();
    const excludedQuestionType = quizQuestionTypes.find((type) => type === requestedExcludedQuestionType);
    const searchText = request.nextUrl.searchParams.get("q")?.trim() ?? "";
    const page = getPositiveInteger(request.nextUrl.searchParams.get("page"), 1);
    const pageSize = Math.min(getPositiveInteger(request.nextUrl.searchParams.get("pageSize"), 200), 500);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const supabase = createSupabaseReadClient();
    let query = supabase
      .from("quiz_questions")
      .select(quizQuestionSelect, { count: "exact" })
      .order("level", { ascending: true })
      .order("category", { ascending: true })
      .order("id", { ascending: false });

    if (level) {
      query = query.eq("level", level);
    }

    if (categories.length === 1) {
      query = query.eq("category", categories[0]);
    } else if (categories.length > 1) {
      query = query.in("category", categories);
    }

    if (questionType) {
      query = query.eq("question_type", questionType);
    }

    if (excludedQuestionType) {
      query = query.neq("question_type", excludedQuestionType);
    }

    if (searchText) {
      const pattern = `%${escapeLikePattern(searchText)}%`;
      query = query.or(`category.ilike.${pattern},theme.ilike.${pattern},prompt.ilike.${pattern},note.ilike.${pattern},answer.ilike.${pattern}`);
    }

    const { data, error, count } = await query.range(from, to);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      page,
      pageSize,
      total: count ?? 0,
      questions: ((data ?? []) as QuizQuestionRow[]).map(rowToQuizQuestion)
    });
  } catch (error) {
    return NextResponse.json({ error: getApiErrorMessage(error, "Unable to load quiz questions") }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authError = await requireAdminRoute();
  if (authError) return authError;

  try {
    const question = (await request.json()) as QuizQuestionRecord;
    const payload = quizQuestionToPayload(question);

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
        .limit(500);
      const relatedQuestions = ((relatedRows ?? []) as QuizDistractorCandidateRow[]).map(rowToQuizDistractorCandidate);
      options = generateQuizDistractors(payload.answer, relatedQuestions, payload.options);
    }
    const { data, error } = await supabase
      .from("quiz_questions")
      .insert({ ...payload, options })
      .select(quizQuestionSelect)
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ question: rowToQuizQuestion(data) }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: getApiErrorMessage(error, "Unable to create quiz question") }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const authError = await requireAdminRoute();
  if (authError) return authError;

  try {
    const body = (await request.json()) as { ids?: number[] };
    const ids = Array.isArray(body.ids) ? body.ids.filter(Number.isFinite) : [];

    if (ids.length === 0) {
      return NextResponse.json({ error: "Missing quiz question ids" }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.from("quiz_questions").delete().in("id", ids);

    if (error) {
      throw error;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: getApiErrorMessage(error, "Unable to delete quiz questions") }, { status: 500 });
  }
}
