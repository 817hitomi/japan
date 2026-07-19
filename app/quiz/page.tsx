import QuizClient from "./QuizClient";
import { readWordsForPublicPage } from "../publicData";
import { seedQuizQuestions, QuizLevel } from "./quizTypes";

export const dynamic = "force-dynamic";

type QuizPageProps = {
  searchParams?: Promise<{ category?: string; level?: string }>;
};

export default async function QuizPage({ searchParams }: QuizPageProps) {
  const resolvedSearchParams = await searchParams;
  const wordsResult = await readWordsForPublicPage(1);
  const initialLevel = resolvedSearchParams?.level === "N5" ? (resolvedSearchParams.level as QuizLevel) : "N5";
  const initialCategory = resolvedSearchParams?.category?.trim() || "文字．語彙";

  return (
    <QuizClient
      initialCategory={initialCategory}
      initialLevel={initialLevel}
      initialQuestions={seedQuizQuestions}
      initialWordTotal={wordsResult.total}
      initialWords={wordsResult.words}
    />
  );
}
