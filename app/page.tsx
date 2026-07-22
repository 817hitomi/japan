import type { Metadata } from "next";
import { headers } from "next/headers";
import { createRequestTimer } from "../lib/requestDiagnostics";
import HomeClient from "./HomeClient";
import { getTaipeiDailySelectionKey } from "./dailySelection";
import { getNoteRouteKey, PublicNoteRecord } from "./notes/noteTypes";
import { readPublishedNoteByRouteKey, readPublishedNotesForPublicPage, readQuotesForPublicPage, readWordsForHomePage } from "./publicData";

export const dynamic = "force-dynamic";
const publicSiteUrl = "https://japan-note.com";

type HomePageProps = {
  searchParams: Promise<{ image?: string; note?: string; summary?: string; title?: string }>;
};

function isPublicImageUrl(url?: string): url is string {
  const value = url?.trim();

  if (!value || value.startsWith("data:") || value.startsWith("blob:")) {
    return false;
  }

  try {
    const parsed = new URL(value, publicSiteUrl);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

async function getRequestUrl(searchParams: Awaited<HomePageProps["searchParams"]>) {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") || "https";
  const baseUrl = host?.includes("workers.dev") ? publicSiteUrl : host ? `${protocol}://${host}` : publicSiteUrl;
  const params = new URLSearchParams();

  if (searchParams.note) {
    params.set("note", searchParams.note);
  }

  if (searchParams.title) {
    params.set("title", searchParams.title);
  }

  if (searchParams.summary) {
    params.set("summary", searchParams.summary);
  }

  if (isPublicImageUrl(searchParams.image)) {
    params.set("image", searchParams.image);
  }

  const query = params.toString();
  return {
    baseUrl,
    url: query ? `${baseUrl}/?${query}` : baseUrl
  };
}

function toAbsoluteUrl(url: string, baseUrl: string) {
  const value = url.trim();

  if (!value || value.startsWith("data:") || value.startsWith("blob:")) {
    return `${baseUrl}/brand/logo_b.png`;
  }

  try {
    const parsed = new URL(value, baseUrl);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : `${baseUrl}/brand/logo_b.png`;
  } catch {
    return `${baseUrl}/brand/logo_b.png`;
  }
}

async function readNoteMeta(routeKey?: string): Promise<PublicNoteRecord | null> {
  const key = routeKey?.trim();

  if (!key) {
    return null;
  }

  try {
    return readPublishedNoteByRouteKey(key);
  } catch {
    return null;
  }
}

export async function generateMetadata({ searchParams }: HomePageProps): Promise<Metadata> {
  const timer = createRequestTimer("page render", { route: "/", phase: "metadata" });
  const resolvedSearchParams = await searchParams;
  const { image, note: noteId, summary, title } = resolvedSearchParams;
  const { baseUrl, url } = await getRequestUrl(resolvedSearchParams);
  const noteMeta = title && summary && image ? null : await readNoteMeta(noteId);
  const pageTitle = title || noteMeta?.title || "日文學習筆記 | JapanNote";
  const description = summary || noteMeta?.summary || "自學日文筆記";
  const imageUrl =
    image && isPublicImageUrl(image)
      ? toAbsoluteUrl(image, baseUrl)
      : toAbsoluteUrl(noteMeta ? `/api/notes/og?slug=${encodeURIComponent(getNoteRouteKey(noteMeta))}` : "/brand/logo_b.png", baseUrl);
  timer.end({ noteMeta: Boolean(noteMeta) });

  return {
    title: pageTitle,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: pageTitle,
      description,
      url,
      siteName: "JapanNote",
      type: noteId ? "article" : "website",
      publishedTime: noteMeta?.date || undefined,
      images: [{ url: imageUrl, width: 1200, height: 630, alt: pageTitle }]
    },
    twitter: {
      card: "summary_large_image",
      title: pageTitle,
      description,
      images: [imageUrl]
    }
  };
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const timer = createRequestTimer("page render", { route: "/" });
  const resolvedSearchParams = await searchParams;
  const dailySelectionKey = getTaipeiDailySelectionKey();
  timer.mark("database query start", { groups: "notes,words,quotes" });
  const [notes, wordsResult, quotes] = await Promise.all([
    readPublishedNotesForPublicPage(),
    readWordsForHomePage(dailySelectionKey),
    readQuotesForPublicPage()
  ]);
  timer.mark("database query end", { notes: notes.length, words: wordsResult.words.length, quotes: quotes.length });
  timer.end({ status: 200 });

  return (
    <HomeClient
      initialNotes={notes}
      initialQuotes={quotes}
      initialSelectedNoteId={resolvedSearchParams.note}
      initialDailySelectionKey={dailySelectionKey}
      initialWordTotal={wordsResult.total}
      initialWords={wordsResult.words}
    />
  );
}
