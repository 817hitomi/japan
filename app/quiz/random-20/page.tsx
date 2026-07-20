import RandomQuizClient from "../RandomQuizClient";
import { readWordsForPublicPage } from "../../publicData";
import { seedQuizQuestions } from "../quizTypes";

export const revalidate = 300;

export default async function RandomTwentyQuizPage() {
  const wordsResult = await readWordsForPublicPage(1);

  return (
    <RandomQuizClient
      questionCount={20}
      initialCategory="文字．語彙"
      initialLevel="N5"
      initialQuestions={seedQuizQuestions}
      initialWordTotal={wordsResult.total}
      initialWords={wordsResult.words}
    />
  );
}
