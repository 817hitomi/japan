import GrammarPracticeClient from "./GrammarPracticeClient";
import { QuizLevel, quizLevels } from "../quizTypes";

export const revalidate = 300;

type GrammarPracticePageProps = {
  searchParams?: Promise<{ level?: string }>;
};

export default async function GrammarPracticePage({ searchParams }: GrammarPracticePageProps) {
  const resolvedSearchParams = await searchParams;
  const requestedLevel = resolvedSearchParams?.level;
  const level = quizLevels.includes(requestedLevel as QuizLevel) ? (requestedLevel as QuizLevel) : "N5";

  return <GrammarPracticeClient level={level} />;
}
