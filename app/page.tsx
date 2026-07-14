import type { Metadata } from "next";
import { headers } from "next/headers";
import HomeClient from "./HomeClient";
import { getRuntimeEnv } from "../lib/runtimeEnv";

export const dynamic = "force-dynamic";
const publicSiteUrl = "https://japan-note.com";

type HomePageProps = {
  searchParams: Promise<{ image?: string; note?: string; summary?: string; title?: string }>;
};

type NoteMeta = {
  blocks: unknown;
  cover_url: string | null;
  published_date: string | null;
  summary: string | null;
  title: string | null;
};

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

  if (searchParams.image) {
    params.set("image", searchParams.image);
  }

  const query = params.toString();
  return {
    baseUrl,
    url: query ? `${baseUrl}/?${query}` : baseUrl
  };
}

function toAbsoluteUrl(url: string, baseUrl: string) {
  try {
    return new URL(url, baseUrl).toString();
  } catch {
    return `${baseUrl}/brand/logo_b.png`;
  }
}

function getBlockImageUrl(blocks: unknown) {
  if (!Array.isArray(blocks)) {
    return "";
  }

  const imageBlock = blocks.find((block) => {
    if (!block || typeof block !== "object") {
      return false;
    }

    const candidate = block as { imageUrl?: unknown; type?: unknown };
    return candidate.type === "image" && typeof candidate.imageUrl === "string" && candidate.imageUrl.length > 0;
  }) as { imageUrl?: string } | undefined;

  return imageBlock?.imageUrl ?? "";
}

function getNoteImageUrl(noteMeta: NoteMeta | null, noteId?: string) {
  const storedImage = noteMeta?.cover_url || getBlockImageUrl(noteMeta?.blocks);

  if (storedImage?.startsWith("data:image/") && noteId) {
    return `/api/notes/${encodeURIComponent(noteId)}/og-image`;
  }

  return storedImage || "";
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
      `${supabaseUrl.replace(/\/$/, "")}/rest/v1/learning_notes?id=eq.${encodeURIComponent(String(numericId))}&select=title,summary,cover_url,published_date,blocks&limit=1`,
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
  const imageUrl = toAbsoluteUrl(image || getNoteImageUrl(noteMeta, noteId) || "/brand/logo_b.png", baseUrl);

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

export default function HomePage() {
  return <HomeClient />;
}
