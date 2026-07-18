import WordsClient from "../WordsClient";
import { normalizePublicPage, readWordsForPublicPage } from "../../publicData";

export const dynamic = "force-dynamic";

type WordsPagedRouteProps = {
  params: Promise<{
    page?: string;
  }>;
};

export default async function WordsPagedRoute({ params }: WordsPagedRouteProps) {
  const { page } = await params;
  const result = await readWordsForPublicPage(normalizePublicPage(page));

  return (
    <WordsClient
      initialPage={result.page}
      initialPageSize={result.pageSize}
      initialTotal={result.total}
      initialWords={result.words}
    />
  );
}
