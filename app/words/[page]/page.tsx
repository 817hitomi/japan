import { createRequestTimer } from "../../../lib/requestDiagnostics";
import WordsClient from "../WordsClient";
import { normalizePublicPage, readWordsForPublicFilters, readWordsForPublicPage } from "../../publicData";

export const dynamic = "force-dynamic";

type WordsPagedRouteProps = {
  params: Promise<{
    page?: string;
  }>;
};

export default async function WordsPagedRoute({ params }: WordsPagedRouteProps) {
  const { page } = await params;
  const currentPage = normalizePublicPage(page);
  const timer = createRequestTimer("page render", { route: "/words/[page]", page: currentPage });
  timer.mark("database query start", { groups: "words" });
  const [result, filterWords] = await Promise.all([readWordsForPublicPage(currentPage), readWordsForPublicFilters()]);
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
