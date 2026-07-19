import QuizClient from "../QuizClient";
import { readWordsForPublicPage } from "../../publicData";
import { seedQuizQuestions } from "../quizTypes";

export const dynamic = "force-dynamic";

export default async function VocabularyQuizPage() {
  const wordsResult = await readWordsForPublicPage(1);

  return (
    <QuizClient
      initialCategory="文字．語彙"
      initialLevel="N5"
      initialQuestions={seedQuizQuestions}
      initialWordTotal={wordsResult.total}
      initialWords={wordsResult.words}
    />
  );
}
