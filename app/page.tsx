import type { Metadata } from "next";
import { createRequestTimer } from "../lib/requestDiagnostics";
import HomeClient from "./HomeClient";
import { getTaipeiDailySelectionKey } from "./dailySelection";
import { readPublishedNoteCardsForHomePage, readQuotesForPublicPage, readWordsForHomePage } from "./publicData";

export const revalidate = 300;
const publicSiteUrl = "https://japan-note.com";

export const metadata: Metadata = {
  title: "日文學習筆記 | JapanNote",
  description: "自學日文筆記",
  alternates: { canonical: publicSiteUrl },
  openGraph: {
    title: "日文學習筆記 | JapanNote",
    description: "自學日文筆記",
    url: publicSiteUrl,
    siteName: "JapanNote",
    type: "website",
    images: [{ url: `${publicSiteUrl}/brand/logo_b.png`, width: 1200, height: 630, alt: "JapanNote" }]
  },
  twitter: {
    card: "summary_large_image",
    title: "日文學習筆記 | JapanNote",
    description: "自學日文筆記",
    images: [`${publicSiteUrl}/brand/logo_b.png`]
  }
};

export default async function HomePage() {
  const timer = createRequestTimer("page render", { route: "/" });
  const dailySelectionKey = getTaipeiDailySelectionKey();
  timer.mark("database query start", { groups: "notes,words,quotes" });
  const [notes, wordsResult, quotes] = await Promise.all([
    readPublishedNoteCardsForHomePage(),
    readWordsForHomePage(dailySelectionKey),
    readQuotesForPublicPage(true)
  ]);
  timer.mark("database query end", { notes: notes.length, words: wordsResult.words.length, quotes: quotes.length });
  timer.end({ status: 200 });

  return (
    <HomeClient
      disableNotesAndWordsRefresh
      initialNotes={notes}
      initialQuotes={quotes}
      initialDailySelectionKey={dailySelectionKey}
      initialWordTotal={wordsResult.total}
      initialWords={wordsResult.words}
    />
  );
}
