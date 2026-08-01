import type { Metadata } from "next";
import { canonicalSiteOrigin } from "../../lib/canonicalRequest";
import type { SongRecord } from "./songTypes";

function getSongKeywords(tags: string) {
  return tags
    .split(/[,，、\s]+/)
    .map((tag) => tag.trim().replace(/^#+/, ""))
    .filter(Boolean);
}

export function createSongMetadata(song: SongRecord): Metadata {
  const title = `${song.title}｜歌曲學習｜JapanNote`;
  const description = song.description || "跟著歌曲學習日文歌詞、文法與重要單字。";
  const url = new URL(`/songs/${song.slug}`, canonicalSiteOrigin).toString();
  const imageUrl = new URL(`/api/songs/og?slug=${encodeURIComponent(song.slug)}`, canonicalSiteOrigin).toString();

  return {
    title,
    description,
    keywords: getSongKeywords(song.tags),
    alternates: { canonical: url },
    openGraph: {
      title: song.title,
      description,
      url,
      siteName: "JapanNote",
      type: "article",
      publishedTime: song.publishedDate || undefined,
      images: [{ url: imageUrl, width: 1200, height: 630, alt: song.title }]
    },
    twitter: {
      card: "summary_large_image",
      title: song.title,
      description,
      images: [imageUrl]
    }
  };
}
