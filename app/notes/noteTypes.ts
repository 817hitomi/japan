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
  const source = (note ?? {}) as Partial<PublicNoteRecord>;
  const rawStatus = String(source.status ?? "");
  const status = rawStatus === "草稿" || rawStatus.includes("阮") ? "草稿" : "已發布";
  const blocks = Array.isArray(source.blocks)
    ? source.blocks.map((block, index) => ({
        ...block,
        id: String(block?.id ?? `block-${index}`),
        type: block?.type ?? "text",
        title: String(block?.title ?? ""),
        heading: typeof block?.heading === "string" ? block.heading : "",
        html: String(block?.html ?? ""),
        collapsed: block?.collapsed === true,
        imageUrl: typeof block?.imageUrl === "string" ? block.imageUrl : "",
        linkUrl: typeof block?.linkUrl === "string" ? block.linkUrl : "",
        videoUrl: typeof block?.videoUrl === "string" ? block.videoUrl : "",
        caption: typeof block?.caption === "string" ? block.caption : "",
        adSlot: typeof block?.adSlot === "string" ? block.adSlot : ""
      }))
    : [];

  return {
    id: Number(source.id) || 0,
    category: String(source.category ?? ""),
    title: String(source.title ?? ""),
    summary: String(source.summary ?? ""),
    status,
    date: String(source.date ?? ""),
    slug: source.slug?.startsWith("note-") || source.slug?.startsWith("category-") ? "" : String(source.slug ?? ""),
    tags: String(source.tags ?? ""),
    coverUrl: String(source.coverUrl ?? ""),
    blocks
  };
}

export function getDisplayTags(tags: string | null | undefined, limit = 3) {
  return String(tags ?? "")
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

export function preparePublicNoteCards(notes: PublicNoteRecord[]) {
  const slugCounts = new Map<string, number>();

  notes.forEach((note) => {
    const slug = note.slug?.trim();
    if (slug) slugCounts.set(slug, (slugCounts.get(slug) ?? 0) + 1);
  });

  return notes.map((note) => {
    const slug = note.slug?.trim();
    const routeNote = slug && (slugCounts.get(slug) ?? 0) > 1 ? { ...note, slug: "" } : note;

    return {
      ...routeNote,
      coverUrl: `/api/notes/og?slug=${encodeURIComponent(getNoteRouteKey(routeNote))}`
    };
  });
}

export function findNoteByRouteKey(notes: PublicNoteRecord[], routeKey: string) {
  const key = decodeURIComponent(routeKey).trim();
  const numericId = Number(key);

  return (
    notes.find((note) => note.slug?.trim() === key) ??
    notes.find((note) => Number.isFinite(numericId) && note.id === numericId) ??
    null
  );
}

export function getNotePreviewImage(note: Pick<PublicNoteRecord, "blocks" | "coverUrl">, fallback = "") {
  const blocks = Array.isArray(note?.blocks) ? note.blocks : [];
  const imageBlock = blocks.find((block) => block?.type === "image" && block.imageUrl?.trim());
  return note?.coverUrl?.trim() || imageBlock?.imageUrl?.trim() || fallback;
}
