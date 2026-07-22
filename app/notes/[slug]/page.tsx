import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createRequestTimer } from "../../../lib/requestDiagnostics";
import HomeClient from "../../HomeClient";
import { getNotePath, getNoteRouteKey } from "../noteTypes";
import { readPublicArticleContext, readPublishedNoteByRouteKey, readPublishedNotesForPublicPage } from "../../publicData";

export const revalidate = 300;
export const dynamicParams = true;

const publicSiteUrl = "https://japan-note.com";

type NotePageProps = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ share?: string }>;
};

export async function generateStaticParams() {
  const notes = await readPublishedNotesForPublicPage();

  return notes.map((note) => ({
    slug: getNoteRouteKey(note)
  }));
}

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
  const timer = createRequestTimer("page render", { route: "/notes/[slug]", phase: "metadata" });
  const { share } = (await searchParams) ?? {};
  const note = await readPublishedNoteByRouteKey(slug);

  if (!note) {
    timer.end({ status: 404 });
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

  timer.end({ status: 200 });
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
  const timer = createRequestTimer("page render", { route: "/notes/[slug]" });
  timer.mark("route matching", { slug });
  timer.mark("database query start", { groups: "note" });
  const note = await readPublishedNoteByRouteKey(slug);
  timer.mark("database query end", { note: Boolean(note) });

  if (!note) {
    timer.end({ status: 404 });
    notFound();
  }

  timer.mark("related articles start");
  const articleContext = await readPublicArticleContext(note);
  timer.mark("related articles end", {
    notes: articleContext.notes.length,
    previous: Boolean(articleContext.previousNote),
    next: Boolean(articleContext.nextNote)
  });
  timer.mark("article rendering", { blocks: note.blocks.length });
  timer.mark("waitUntil background tasks", { tasks: 0 });

  timer.end({ status: 200 });
  return (
    <HomeClient
      disableClientDataRefresh
      disableSiteStatsWrite
      initialNextNote={articleContext.nextNote}
      initialNoteTotal={articleContext.total}
      initialNotes={articleContext.notes}
      initialPreviousNote={articleContext.previousNote}
      initialSelectedNoteSlug={note.slug || String(note.id)}
    />
  );
}
