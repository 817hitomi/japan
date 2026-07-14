import type { Metadata } from "next";
import { headers } from "next/headers";
import { createSupabaseReadClient } from "../../lib/supabase/server";
import { getRuntimeEnv } from "../../lib/runtimeEnv";
import type { PublicNoteRecord } from "../notes/noteTypes";
import { rowToNote } from "../api/notes/noteMapper";

export const dynamic = "force-dynamic";

type SharePageProps = {
  searchParams: Promise<{ id?: string }>;
};

async function getBaseUrl() {
  const configuredUrl = getRuntimeEnv("NEXT_PUBLIC_SITE_URL");

  if (configuredUrl) {
    return configuredUrl.replace(/\/$/, "");
  }

  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") || "https";

  return host ? `${protocol}://${host}` : "http://localhost:3000";
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

export async function generateMetadata({ searchParams }: SharePageProps): Promise<Metadata> {
  const { id } = await searchParams;
  const note = await getSharedNote(id);
  const baseUrl = await getBaseUrl();
  const articleUrl = `${baseUrl}/?note=${encodeURIComponent(id ?? "")}`;
  const shareUrl = `${baseUrl}/share?id=${encodeURIComponent(id ?? "")}`;

  if (!note) {
    return {
      title: "JapanNote",
      description: "日文學習筆記",
      alternates: { canonical: articleUrl },
      openGraph: {
        title: "JapanNote",
        description: "日文學習筆記",
        url: shareUrl,
        siteName: "JapanNote",
        type: "article",
        images: [{ url: `${baseUrl}/brand/logo_b.png` }]
      }
    };
  }

  const title = note.title || "JapanNote";
  const description = note.summary || "日文學習筆記";
  const imageUrl = toAbsoluteUrl(getNoteImage(note), baseUrl);

  return {
    title: `${title} | JapanNote`,
    description,
    alternates: { canonical: articleUrl },
    openGraph: {
      title,
      description,
      url: shareUrl,
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

export default async function SharePage({ searchParams }: SharePageProps) {
  const { id } = await searchParams;
  const note = await getSharedNote(id);
  const articlePath = `/?note=${encodeURIComponent(id ?? "")}`;
  const articleUrl = `${await getBaseUrl()}${articlePath}`;

  return (
    <main style={{ display: "grid", minHeight: "100vh", placeItems: "center", padding: 24, textAlign: "center" }}>
      <script dangerouslySetInnerHTML={{ __html: `window.location.replace(${JSON.stringify(articlePath)});` }} />
      <div>
        <h1>{note?.title || "JapanNote"}</h1>
        <p>{note?.summary || "正在前往文章..."}</p>
        <a href={articleUrl}>前往文章</a>
      </div>
    </main>
  );
}
