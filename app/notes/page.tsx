import NotesListClient from "./NotesListClient";
import { readPublishedNotesForPublicPage, readQuotesForPublicPage } from "../publicData";

export const dynamic = "force-dynamic";

type NotesPageProps = {
  searchParams: Promise<{ category?: string }>;
};

export default async function NotesPage({ searchParams }: NotesPageProps) {
  const [{ category }, notes, quotes] = await Promise.all([
    searchParams,
    readPublishedNotesForPublicPage(),
    readQuotesForPublicPage()
  ]);

  return <NotesListClient initialCategory={category ?? ""} initialNotes={notes} initialBoardItems={quotes} />;
}
