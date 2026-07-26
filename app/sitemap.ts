import type { MetadataRoute } from "next";
import { buildSitemapEntries } from "../lib/sitemapXml";
import { readPublishedNotesForSitemap } from "./publicData";

export const revalidate = 86_400;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const notes = await readPublishedNotesForSitemap();
  return buildSitemapEntries(notes);
}
