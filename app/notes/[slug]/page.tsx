import type { Metadata } from "next";
import { notFound } from "next/navigation";
import HomeClient from "../../HomeClient";
import { getNotePath, getNoteRouteKey, PublicNoteRecord } from "../noteTypes";
import { readPublishedNoteByRouteKey, readPublishedNotesForPublicPage, readQuotesForPublicPage, readWordsForPublicPage } from "../../publicData";

export const dynamic = "force-dynamic";

const publicSiteUrl = "https://japan-note.com";

type NotePageProps = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ share?: string }>;
};

function toAbsoluteUrl(url: string) {
  const value = url.trim();

  if (!value || value.startsWith("data:") || value.startsWith("blob:")) {
    return `${publicSiteUrl}/brand/logo_b.png`;
  }

  try {
    const parsed = new URL(value, publicSiteUrl);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : `${publicSiteUrl}/brand/logo_b.png`;
  } catch {
    return `${publicSiteUrl}/brand/logo_b.png`;
  }
}

export async function generateMetadata({ params, searchParams }: NotePageProps): Promise<Metadata> {
  const { slug } = await params;
  const { share } = (await searchParams) ?? {};
  const note = await readPublishedNoteByRouteKey(slug);

  if (!note) {
    return {
      title: "文章不存在 | JapanNote"
    };
  }

  const pageUrl = new URL(getNotePath(note), publicSiteUrl);
  const imagePath = new URL("/api/notes/og", publicSiteUrl);
  imagePath.searchParams.set("slug", getNoteRouteKey(note));

  if (share?.trim()) {
    pageUrl.searchParams.set("share", share.trim());
    imagePath.searchParams.set("v", share.trim());
  }

  const url = pageUrl.toString();
  const imageUrl = toAbsoluteUrl(imagePath.toString());
  const description = note.summary || "日文學習筆記";

  return {
    title: `${note.title} | JapanNote`,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: note.title,
      description,
      url,
      siteName: "JapanNote",
      type: "article",
      publishedTime: note.date || undefined,
      images: [{ url: imageUrl, width: 1200, height: 630, alt: note.title }]
    },
    twitter: {
      card: "summary_large_image",
      title: note.title,
      description,
      images: [imageUrl]
    }
  };
}

export default async function NotePage({ params }: NotePageProps) {
  const { slug } = await params;
  const [notes, note, wordsResult, quotes] = await Promise.all([
    readPublishedNotesForPublicPage(),
    readPublishedNoteByRouteKey(slug),
    readWordsForPublicPage(),
    readQuotesForPublicPage()
  ]);

  if (!note) {
    notFound();
  }

  const initialNotes = notes.some((item) => item.id === note.id)
    ? notes.map((item) => (item.id === note.id ? note : item))
    : [note, ...notes];

  return (
    <HomeClient
      initialNotes={initialNotes}
      initialQuotes={quotes}
      initialSelectedNoteSlug={note.slug || String(note.id)}
      initialWordTotal={wordsResult.total}
      initialWords={wordsResult.words}
    />
  );
}
