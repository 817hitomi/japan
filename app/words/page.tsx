import WordsClient from "./WordsClient";
import { readWordsForPublicPage } from "../publicData";

export const dynamic = "force-dynamic";

export default async function WordsPage() {
  const words = await readWordsForPublicPage();
  return <WordsClient initialWords={words} />;
}
