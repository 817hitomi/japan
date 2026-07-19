import { createRequestTimer } from "../../lib/requestDiagnostics";
import WordsClient from "./WordsClient";
import { readWordsForPublicFilters, readWordsForPublicPage } from "../publicData";

export const dynamic = "force-dynamic";

export default async function WordsPage() {
  const timer = createRequestTimer("page render", { route: "/words" });
  timer.mark("database query start", { groups: "words" });
  const [result, filterWords] = await Promise.all([readWordsForPublicPage(1), readWordsForPublicFilters()]);
  timer.mark("database query end", { words: result.words.length, total: result.total, filterWords: filterWords.length });
  timer.end({ status: 200 });

  return (
    <WordsClient
      initialPage={result.page}
      initialPageSize={result.pageSize}
      initialTotal={result.total}
      initialWords={result.words}
      initialFilterWords={filterWords}
    />
  );
}
