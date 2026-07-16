import type { Metadata } from "next";
import { notFound } from "next/navigation";
import HomeClient from "../../HomeClient";
import { getNotePath, PublicNoteRecord } from "../noteTypes";
import { readPublishedNotesForPublicPage, readQuotesForPublicPage, readWordsForPublicPage } from "../../publicData";

export const dynamic = "force-dynamic";

const publicSiteUrl = "https://japan-note.com";

type NotePageProps = {
  params: Promise<{ slug: string }>;
};

function findNote(notes: PublicNoteRecord[], routeKey: string) {
  const key = decodeURIComponent(routeKey).trim();
  const numericId = Number(key);

  return (
    notes.find((note) => note.slug?.trim() === key) ??
    notes.find((note) => Number.isFinite(numericId) && note.id === numericId) ??
    null
  );
}

function getNoteImage(note: PublicNoteRecord) {
  const imageBlock = note.blocks.find((block) => block.type === "image" && block.imageUrl);
  return note.coverUrl || imageBlock?.imageUrl || "/brand/logo_b.png";
}

function toAbsoluteUrl(url: string) {
  try {
    return new URL(url, publicSiteUrl).toString();
  } catch {
    return `${publicSiteUrl}/brand/logo_b.png`;
  }
}

export async function generateMetadata({ params }: NotePageProps): Promise<Metadata> {
  const { slug } = await params;
  const notes = await readPublishedNotesForPublicPage();
  const note = findNote(notes, slug);

  if (!note) {
    return {
      title: "文章不存在 | JapanNote"
    };
  }

  const url = `${publicSiteUrl}${getNotePath(note)}`;
  const imageUrl = toAbsoluteUrl(getNoteImage(note));
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
      images: [{ url: imageUrl }]
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
  const [notes, words, quotes] = await Promise.all([
    readPublishedNotesForPublicPage(),
    readWordsForPublicPage(),
    readQuotesForPublicPage()
  ]);
  const note = findNote(notes, slug);

  if (!note) {
    notFound();
  }

  return (
    <HomeClient
      initialNotes={notes}
      initialQuotes={quotes}
      initialSelectedNoteSlug={note.slug || String(note.id)}
      initialWords={words}
    />
  );
}
