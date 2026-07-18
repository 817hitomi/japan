import WordsClient from "./WordsClient";
import { readWordsForPublicPage } from "../publicData";

export const dynamic = "force-dynamic";

export default async function WordsPage() {
  const result = await readWordsForPublicPage(1);

  return (
    <WordsClient
      initialPage={result.page}
      initialPageSize={result.pageSize}
      initialTotal={result.total}
      initialWords={result.words}
    />
  );
}
