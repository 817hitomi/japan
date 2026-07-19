import AdminQuizClient from "./AdminQuizClient";
import { QuizLevel } from "../../quiz/quizTypes";

type AdminQuizPageProps = {
  searchParams?: Promise<{ category?: string; level?: string }>;
};

export default async function AdminQuizPage({ searchParams }: AdminQuizPageProps) {
  const resolvedSearchParams = await searchParams;
  const initialLevel = resolvedSearchParams?.level === "N5" ? (resolvedSearchParams.level as QuizLevel) : "N5";
  const initialCategory = resolvedSearchParams?.category?.trim() || "文字．語彙";

  return <AdminQuizClient initialCategory={initialCategory} initialLevel={initialLevel} />;
}
