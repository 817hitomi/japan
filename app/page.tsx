import type { Metadata } from "next";
import { headers } from "next/headers";
import HomeClient from "./HomeClient";
import { getRuntimeEnv } from "../lib/runtimeEnv";
import { readPublishedNotesForPublicPage, readQuotesForPublicPage, readWordsForPublicPage } from "./publicData";

export const dynamic = "force-dynamic";
const publicSiteUrl = "https://japan-note.com";

type HomePageProps = {
  searchParams: Promise<{ image?: string; note?: string; summary?: string; title?: string }>;
};

type NoteMeta = {
  cover_url: string | null;
  published_date: string | null;
  summary: string | null;
  title: string | null;
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

async function readNoteMeta(noteId?: string): Promise<NoteMeta | null> {
  const numericId = Number(noteId);
  const supabaseUrl = getRuntimeEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = getRuntimeEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  if (!Number.isFinite(numericId) || !supabaseUrl || !anonKey) {
    return null;
  }

  try {
    const response = await fetch(
      `${supabaseUrl.replace(/\/$/, "")}/rest/v1/learning_notes?id=eq.${encodeURIComponent(String(numericId))}&select=title,summary,cover_url,published_date&limit=1`,
      {
        cache: "no-store",
        headers: {
          apikey: anonKey,
          authorization: `Bearer ${anonKey}`
        }
      }
    );

    if (!response.ok) {
      return null;
    }

    const rows = (await response.json()) as NoteMeta[];
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ searchParams }: HomePageProps): Promise<Metadata> {
  const resolvedSearchParams = await searchParams;
  const { image, note: noteId, summary, title } = resolvedSearchParams;
  const { baseUrl, url } = await getRequestUrl(resolvedSearchParams);
  const noteMeta = title && summary && image ? null : await readNoteMeta(noteId);
  const pageTitle = title || noteMeta?.title || "日文學習筆記 | JapanNote";
  const description = summary || noteMeta?.summary || "自學日文筆記";
  const imageUrl = toAbsoluteUrl(image || noteMeta?.cover_url || "/brand/logo_b.png", baseUrl);

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
      publishedTime: noteMeta?.published_date ?? undefined,
      images: [{ url: imageUrl }]
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
  const resolvedSearchParams = await searchParams;
  const [notes, words, quotes] = await Promise.all([
    readPublishedNotesForPublicPage(),
    readWordsForPublicPage(),
    readQuotesForPublicPage()
  ]);

  return (
    <HomeClient
      initialNotes={notes}
      initialQuotes={quotes}
      initialSelectedNoteId={resolvedSearchParams.note}
      initialWords={words}
    />
  );
}
