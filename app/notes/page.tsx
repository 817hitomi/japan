import { redirect } from "next/navigation";
import NotesListClient from "./NotesListClient";
import { normalizePublicNotesPage, readPublishedNoteCategories, readPublishedNotesPage, readQuotesForPublicPage } from "../publicData";

export const revalidate = 300;

type NotesPageProps = {
  searchParams: Promise<{ category?: string; page?: string; q?: string }>;
};

export default async function NotesPage({ searchParams }: NotesPageProps) {
  const { category = "", page: pageParam, q = "" } = await searchParams;
  const requestedPage = normalizePublicNotesPage(pageParam);
  const [notesResult, categories, quotes] = await Promise.all([
    readPublishedNotesPage({ category, page: requestedPage, query: q }),
    readPublishedNoteCategories(),
    readQuotesForPublicPage()
  ]);
  const totalPages = Math.max(1, Math.ceil(notesResult.total / notesResult.pageSize));

  if (notesResult.total > 0 && requestedPage > totalPages) {
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (q) params.set("q", q);
    if (totalPages > 1) params.set("page", String(totalPages));
    redirect(params.size > 0 ? `/notes?${params.toString()}` : "/notes");
  }

  return (
    <NotesListClient
      categories={categories}
      initialBoardItems={quotes}
      initialCategory={category}
      initialNotes={notesResult.notes}
      initialPage={notesResult.page}
      initialQuery={q}
      pageSize={notesResult.pageSize}
      total={notesResult.total}
    />
  );
}
