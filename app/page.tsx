import type { Metadata } from "next";
import { headers } from "next/headers";
import HomeClient from "./HomeClient";
import { createSupabaseReadClient } from "../lib/supabase/server";
import type { PublicNoteRecord } from "./notes/noteTypes";
import { rowToNote } from "./api/notes/noteMapper";

export const dynamic = "force-dynamic";
const publicSiteUrl = "https://japan-note.com";

type HomePageProps = {
  searchParams: Promise<{ image?: string; note?: string; summary?: string; title?: string }>;
};

async function getBaseUrl() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") || "https";

  if (host?.includes("workers.dev")) {
    return publicSiteUrl;
  }

  return host ? `${protocol}://${host}` : "https://japan-note.com";
}

function getNoteImage(note: PublicNoteRecord) {
  const imageBlock = note.blocks.find((block) => block.type === "image" && block.imageUrl);
  return note.coverUrl || imageBlock?.imageUrl || "/brand/logo_b.png";
}

function toAbsoluteUrl(url: string, baseUrl: string) {
  try {
    return new URL(url, baseUrl).toString();
  } catch {
    return `${baseUrl}/brand/logo_b.png`;
  }
}

async function getSharedNote(id?: string) {
  const noteId = Number(id);

  if (!Number.isFinite(noteId)) {
    return null;
  }

  const supabase = createSupabaseReadClient();
  const { data, error } = await supabase.from("learning_notes").select("*").eq("id", noteId).maybeSingle();

  if (error || !data) {
    return null;
  }

  return rowToNote(data);
}

export async function generateMetadata({ searchParams }: HomePageProps): Promise<Metadata> {
  const { image, note: noteId, summary, title } = await searchParams;
  const baseUrl = await getBaseUrl();
  const articleUrl = noteId ? `${baseUrl}/?note=${encodeURIComponent(noteId)}` : baseUrl;
  const note = await getSharedNote(noteId);

  if (!note) {
    const fallbackTitle = title || "日文學習筆記 | JapanNote";
    const fallbackDescription = summary || "自學日文筆記";
    const fallbackImage = toAbsoluteUrl(image || "/brand/logo_b.png", baseUrl);

    return {
      title: fallbackTitle,
      description: fallbackDescription,
      openGraph: {
        title: fallbackTitle,
        description: fallbackDescription,
        url: articleUrl,
        siteName: "JapanNote",
        type: "website",
        images: [{ url: fallbackImage }]
      },
      twitter: {
        card: "summary_large_image",
        title: fallbackTitle,
        description: fallbackDescription,
        images: [fallbackImage]
      }
    };
  }

  const title = note.title || "JapanNote";
  const description = note.summary || "自學日文筆記";
  const imageUrl = toAbsoluteUrl(getNoteImage(note), baseUrl);

  return {
    title: `${title} | JapanNote`,
    description,
    alternates: { canonical: articleUrl },
    openGraph: {
      title,
      description,
      url: articleUrl,
      siteName: "JapanNote",
      type: "article",
      publishedTime: note.date,
      images: [{ url: imageUrl }]
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl]
    }
  };
}

export default function HomePage() {
  return <HomeClient />;
}
