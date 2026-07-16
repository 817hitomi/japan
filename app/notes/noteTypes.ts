export type NoteBlockType = "text" | "image" | "video" | "note" | "ad";

export type NoteContentBlock = {
  id: string;
  type: NoteBlockType;
  title: string;
  heading?: string;
  html: string;
  collapsed: boolean;
  imageUrl?: string;
  linkUrl?: string;
  videoUrl?: string;
  caption?: string;
  adSlot?: string;
};

export type PublicNoteRecord = {
  id: number;
  category: string;
  title: string;
  summary: string;
  status: "已發布" | "草稿";
  date: string;
  slug: string;
  tags: string;
  coverUrl: string;
  blocks: NoteContentBlock[];
};

const seedBlocks: NoteContentBlock[] = [
  { id: "seed-text", type: "text", title: "文字區塊", html: "", collapsed: false }
];

export const seedNotes: PublicNoteRecord[] = Array.from({ length: 12 }, (_, index) => ({
  id: index + 1,
  category: index % 3 === 0 ? "N4" : "N5",
  title: index === 0 ? "百" : `學習筆記 ${index + 1}`,
  summary: "日文學習筆記範例摘要。",
  status: index % 4 === 0 ? "草稿" : "已發布",
  date: `2026-07-${String((index % 28) + 1).padStart(2, "0")}`,
  slug: "",
  tags: "N5, 日文, 例句",
  coverUrl: "",
  blocks: seedBlocks
}));

export function normalizeNote(note: PublicNoteRecord): PublicNoteRecord {
  const rawStatus = String(note.status);
  const status = rawStatus === "草稿" || rawStatus.includes("阮") ? "草稿" : "已發布";

  return {
    ...note,
    status,
    slug: note.slug?.startsWith("note-") || note.slug?.startsWith("category-") ? "" : note.slug ?? "",
    blocks: Array.isArray(note.blocks) ? note.blocks : []
  };
}

export function getDisplayTags(tags: string, limit = 3) {
  return tags
    .split(/[,，、\s]+/)
    .map((tag) => tag.trim().replace(/^#+/, ""))
    .filter((tag) => tag && !/^\d+$/.test(tag) && !/^\d{4}-\d{1,2}-\d{1,2}$/.test(tag))
    .slice(0, limit);
}

export function getNoteRouteKey(note: Pick<PublicNoteRecord, "id" | "slug">) {
  return note.slug?.trim() || String(note.id);
}

export function getNotePath(note: Pick<PublicNoteRecord, "id" | "slug">) {
  return `/notes/${encodeURIComponent(getNoteRouteKey(note))}`;
}
