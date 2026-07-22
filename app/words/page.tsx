import { createRequestTimer } from "../../lib/requestDiagnostics";
import WordsClient from "./WordsClient";
import { readWordsListingForPublicPage } from "../publicData";
import { normalizeKanaRowKey } from "./kanaRows";

export const revalidate = 300;

type WordsPageProps = {
  searchParams: Promise<{ category?: string; kana?: string }>;
};

export default async function WordsPage({ searchParams }: WordsPageProps) {
  const resolvedSearchParams = await searchParams;
  const category = resolvedSearchParams.category?.trim() ?? "";
  const kanaRow = normalizeKanaRowKey(resolvedSearchParams.kana);
  const timer = createRequestTimer("page render", { route: "/words" });
  timer.mark("database query start", { groups: "words" });
  const { page: result, facets } = await readWordsListingForPublicPage({ page: 1, category, kanaRow });
  timer.mark("database query end", { words: result.words.length, total: result.total });
  timer.end({ status: 200 });

  return (
    <WordsClient
      initialPage={result.page}
      initialPageSize={result.pageSize}
      initialTotal={result.total}
      initialWords={result.words}
      initialCategories={facets.categories}
      initialCategory={category}
      initialFilteredTotal={facets.filteredTotal}
      initialKanaCounts={facets.kanaCounts}
      initialKanaRow={kanaRow}
      initialSiteTotal={facets.total}
    />
  );
}
