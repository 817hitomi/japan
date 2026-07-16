import type { MetadataRoute } from "next";
import { getNotePath } from "./notes/noteTypes";
import { readPublishedNotesForPublicPage } from "./publicData";

const siteUrl = "https://japan-note.com";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const notes = await readPublishedNotesForPublicPage();
  const categories = Array.from(new Set(notes.map((note) => note.category.trim()).filter(Boolean)));
  const now = new Date();

  return [
    {
      url: siteUrl,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1
    },
    {
      url: `${siteUrl}/notes`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9
    },
    {
      url: `${siteUrl}/words`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9
    },
    ...categories.map((category) => ({
      url: `${siteUrl}/notes?category=${encodeURIComponent(category)}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.7
    })),
    ...notes.map((note) => ({
      url: `${siteUrl}${getNotePath(note)}`,
      lastModified: note.date ? new Date(note.date) : now,
      changeFrequency: "monthly" as const,
      priority: 0.8
    }))
  ];
}
