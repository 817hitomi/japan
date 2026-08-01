import { NextResponse } from "next/server";
import { getApiErrorMessage } from "../../../lib/apiErrors";
import { getElapsedLearningDays } from "../../../lib/learningDays";
import { createSupabaseReadClient } from "../../../lib/supabase/server";

export const dynamic = "force-dynamic";
const publicStatsNotesLimit = 120;
const publicStatsWordsLevelLimit = 200;

const publishedStatus = "已發布";
const quoteCategory = "首頁白版";

type LearningNoteStatsRow = {
  category: string | null;
  published_date: string | null;
  tags: string | null;
  title: string | null;
};

type WordCardStatsRow = {
  category: string | null;
};

function findLevel(values: string[]) {
  for (const value of values) {
    const level = value.match(/\bN[1-5]\b/i)?.[0];

    if (level) {
      return level.toUpperCase();
    }
  }

  return null;
}

function getCurrentLevel(notes: LearningNoteStatsRow[], words: WordCardStatsRow[]) {
  for (const note of [...notes].reverse()) {
    const level = findLevel([`${note.category ?? ""} ${note.tags ?? ""} ${note.title ?? ""}`]);

    if (level) {
      return level;
    }
  }

  return findLevel(words.map((word) => word.category ?? "")) ?? "-";
}

export async function GET() {
  try {
    const supabase = createSupabaseReadClient();
    const [notesResult, wordsResult] = await Promise.all([
      supabase
        .from("learning_notes")
        .select("published_date,category,tags,title")
        .eq("status", publishedStatus)
        .order("published_date", { ascending: true })
        .order("id", { ascending: true })
        .limit(publicStatsNotesLimit),
      supabase
        .from("word_cards")
        .select("category", { count: "exact" })
        .neq("category", quoteCategory)
        .limit(publicStatsWordsLevelLimit)
    ]);

    if (notesResult.error) {
      throw notesResult.error;
    }

    if (wordsResult.error) {
      throw wordsResult.error;
    }

    const notes = (notesResult.data ?? []) as LearningNoteStatsRow[];
    const words = (wordsResult.data ?? []) as WordCardStatsRow[];

    return NextResponse.json({
      currentLevel: getCurrentLevel(notes, words),
      learningDays: getElapsedLearningDays(notes[0]?.published_date),
      wordCount: wordsResult.count ?? words.length
    });
  } catch (error) {
    return NextResponse.json({ error: getApiErrorMessage(error, "Unable to load home stats") }, { status: 500 });
  }
}
