export type AffiliateStatus = "published" | "draft";

export type AffiliateRecord = {
  id: number;
  category: string;
  title: string;
  summary: string;
  status: AffiliateStatus;
  date: string;
  slug: string;
  tags: string;
  imageUrl: string;
  linkUrl: string;
  html: string;
};

export const affiliateStatusLabels: Record<AffiliateStatus, string> = {
  published: "已發布",
  draft: "草稿"
};

export const defaultAffiliateCategories = ["家電", "學習工具", "旅遊", "生活"];

export const seedAffiliates: AffiliateRecord[] = [
  {
    id: 1,
    category: "家電",
    title: "聯盟行銷範例 LP",
    summary: "可放置商品介紹、優惠資訊與導購連結。",
    status: "draft",
    date: new Date().toISOString().slice(0, 10),
    slug: "sample-affiliate-lp",
    tags: "JapanNote,聯盟行銷",
    imageUrl: "",
    linkUrl: "",
    html: "<p>這裡可以編輯聯盟行銷 LP 內容。</p>"
  }
];

export function normalizeAffiliate(source: Partial<AffiliateRecord>): AffiliateRecord {
  return {
    id: Number.isFinite(Number(source.id)) ? Number(source.id) : Date.now(),
    category: source.category?.trim() || defaultAffiliateCategories[0],
    title: source.title?.trim() || "未命名聯盟頁",
    summary: source.summary ?? "",
    status: source.status === "published" ? "published" : "draft",
    date: source.date || new Date().toISOString().slice(0, 10),
    slug: source.slug?.trim() ?? "",
    tags: source.tags ?? "",
    imageUrl: source.imageUrl ?? "",
    linkUrl: source.linkUrl ?? "",
    html: source.html ?? ""
  };
}

export function normalizeAffiliates(source: unknown, includeDrafts = true): AffiliateRecord[] {
  const records = Array.isArray(source) ? source.map((item) => normalizeAffiliate(item as Partial<AffiliateRecord>)) : seedAffiliates;
  return records
    .filter((item) => includeDrafts || item.status === "published")
    .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
}

export function getAffiliateTags(tags: string) {
  return tags
    .split(/[,，、\s]+/)
    .map((tag) => tag.trim().replace(/^#/, ""))
    .filter(Boolean)
    .slice(0, 4);
}
