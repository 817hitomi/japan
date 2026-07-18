import { NextResponse } from "next/server";
import { getApiErrorMessage } from "../../../lib/apiErrors";
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

function getCalendarDayStart(dateText: string) {
  const [year, month, day] = dateText.slice(0, 10).split("-").map(Number);

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }

  return Date.UTC(year, month - 1, day);
}

function getLearningDays(firstPublishedDate?: string | null) {
  if (!firstPublishedDate) {
    return 0;
  }

  const start = getCalendarDayStart(firstPublishedDate);

  if (start === null) {
    return 0;
  }

  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const elapsedDays = Math.floor((today - start) / 86_400_000) + 1;

  return Math.max(elapsedDays, 1);
}

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
      learningDays: getLearningDays(notes[0]?.published_date),
      wordCount: wordsResult.count ?? words.length
    });
  } catch (error) {
    return NextResponse.json({ error: getApiErrorMessage(error, "Unable to load home stats") }, { status: 500 });
  }
}
