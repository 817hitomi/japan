import { AffiliateRecord, normalizeAffiliate } from "../../affiliates/affiliateTypes";

export type AffiliateRow = {
  id: number;
  category: string | null;
  title: string | null;
  summary: string | null;
  status: string | null;
  published_date: string | null;
  slug: string | null;
  tags: string | null;
  image_url: string | null;
  link_url: string | null;
  html: string | null;
};

export function rowToAffiliate(row: AffiliateRow): AffiliateRecord {
  return normalizeAffiliate({
    id: Number(row.id),
    category: row.category ?? "",
    title: row.title ?? "",
    summary: row.summary ?? "",
    status: row.status === "published" ? "published" : "draft",
    date: row.published_date ?? new Date().toISOString().slice(0, 10),
    slug: row.slug ?? "",
    tags: row.tags ?? "",
    imageUrl: row.image_url ?? "",
    linkUrl: row.link_url ?? "",
    html: row.html ?? ""
  });
}

export function affiliateToPayload(affiliate: AffiliateRecord) {
  const normalized = normalizeAffiliate(affiliate);

  return {
    category: normalized.category,
    title: normalized.title,
    summary: normalized.summary,
    status: normalized.status,
    published_date: normalized.date,
    slug: normalized.slug,
    tags: normalized.tags,
    image_url: normalized.imageUrl,
    link_url: normalized.linkUrl,
    html: normalized.html
  };
}
