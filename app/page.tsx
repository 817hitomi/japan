import type { Metadata } from "next";
import { headers } from "next/headers";
import HomeClient from "./HomeClient";

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

function toAbsoluteUrl(url: string, baseUrl: string) {
  try {
    return new URL(url, baseUrl).toString();
  } catch {
    return `${baseUrl}/brand/logo_b.png`;
  }
}

export async function generateMetadata({ searchParams }: HomePageProps): Promise<Metadata> {
  const { image, note: noteId, summary, title } = await searchParams;
  const baseUrl = await getBaseUrl();
  const articleUrl = noteId ? `${baseUrl}/?note=${encodeURIComponent(noteId)}` : baseUrl;
  const pageTitle = title || "日文學習筆記 | JapanNote";
  const description = summary || "自學日文筆記";
  const imageUrl = toAbsoluteUrl(image || "/brand/logo_b.png", baseUrl);

  return {
    title: pageTitle,
    description,
    alternates: { canonical: articleUrl },
    openGraph: {
      title: pageTitle,
      description,
      url: articleUrl,
      siteName: "JapanNote",
      type: noteId ? "article" : "website",
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
