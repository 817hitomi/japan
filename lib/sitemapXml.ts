import { canonicalSiteOrigin } from "./canonicalRequest.ts";

export type PublishedSitemapNote = {
  id: number;
  slug: string;
  updatedAt: string;
};

export type SitemapEntry = {
  url: string;
  lastModified?: Date;
  changeFrequency: "daily" | "monthly";
  priority: number;
};

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function normalizeLastModified(value: string | undefined) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function getNotePath(note: Pick<PublishedSitemapNote, "id" | "slug">) {
  return `/notes/${encodeURIComponent(note.slug.trim() || String(note.id))}`;
}

export function buildSitemapEntries(notes: PublishedSitemapNote[]): SitemapEntry[] {
  const newestUpdate = notes
    .map((note) => normalizeLastModified(note.updatedAt))
    .filter((value): value is Date => Boolean(value))
    .sort((left, right) => left.getTime() - right.getTime())
    .at(-1);

  return [
    {
      url: canonicalSiteOrigin,
      lastModified: newestUpdate,
      changeFrequency: "daily",
      priority: 1
    },
    {
      url: `${canonicalSiteOrigin}/notes`,
      lastModified: newestUpdate,
      changeFrequency: "daily",
      priority: 0.9
    },
    {
      url: `${canonicalSiteOrigin}/words`,
      changeFrequency: "daily",
      priority: 0.9
    },
    ...notes.map((note) => ({
      url: `${canonicalSiteOrigin}${getNotePath(note)}`,
      lastModified: normalizeLastModified(note.updatedAt),
      changeFrequency: "monthly" as const,
      priority: 0.8
    }))
  ];
}

export function createSitemapXml(notes: PublishedSitemapNote[]) {
  const urls = buildSitemapEntries(notes).map((entry) => {
    const lastModified = entry.lastModified
      ? `\n    <lastmod>${escapeXml(entry.lastModified.toISOString())}</lastmod>`
      : "";

    return [
      "  <url>",
      `    <loc>${escapeXml(entry.url)}</loc>${lastModified}`,
      `    <changefreq>${entry.changeFrequency}</changefreq>`,
      `    <priority>${entry.priority.toFixed(1)}</priority>`,
      "  </url>"
    ].join("\n");
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    "</urlset>",
    ""
  ].join("\n");
}
