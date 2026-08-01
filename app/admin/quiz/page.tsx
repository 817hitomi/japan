import AdminQuizClient from "./AdminQuizClient";
import { QuizLevel, QuizQuestionType, quizLevels, quizQuestionTypes } from "../../quiz/quizTypes";

type AdminQuizPageProps = {
  searchParams?: Promise<{ category?: string; level?: string; page?: string; q?: string; type?: string }>;
};

function normalizePage(value?: string) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export default async function AdminQuizPage({ searchParams }: AdminQuizPageProps) {
  const resolvedSearchParams = await searchParams;
  const requestedLevel = resolvedSearchParams?.level;
  const initialLevel = quizLevels.includes(requestedLevel as QuizLevel) ? (requestedLevel as QuizLevel) : "N5";
  const initialCategory = resolvedSearchParams?.category?.trim() ?? "";
  const initialQuestionType = quizQuestionTypes.find((type) => type === resolvedSearchParams?.type) as QuizQuestionType | undefined;

  return (
    <AdminQuizClient
      initialCategory={initialCategory}
      initialLevel={initialLevel}
      initialPage={normalizePage(resolvedSearchParams?.page)}
      initialQuestionType={initialQuestionType}
      initialSearchText={resolvedSearchParams?.q?.trim() ?? ""}
    />
  );
}
