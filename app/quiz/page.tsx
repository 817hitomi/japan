import QuizClient from "./QuizClient";
import { readWordsForPublicPage } from "../publicData";
import { seedQuizQuestions, QuizLevel } from "./quizTypes";

export const revalidate = 300;
const defaultQuizCategory = "文字．語彙";
const defaultQuizLevel: QuizLevel = "N5";

export default async function QuizPage() {
  const wordsResult = await readWordsForPublicPage(1);

  return (
    <QuizClient
      initialCategory={defaultQuizCategory}
      initialLevel={defaultQuizLevel}
      initialQuestions={seedQuizQuestions}
      initialWordTotal={wordsResult.total}
      initialWords={wordsResult.words}
    />
  );
}
