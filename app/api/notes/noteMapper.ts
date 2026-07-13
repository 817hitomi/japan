import { NoteContentBlock, PublicNoteRecord, normalizeNote } from "../../notes/noteTypes";

type LearningNoteRow = {
  id: number;
  category: string | null;
  title: string | null;
  summary: string | null;
  status: string | null;
  published_date: string | null;
  slug: string | null;
  tags: string | null;
  cover_url: string | null;
  blocks: unknown;
};

function normalizeBlocks(blocks: unknown): NoteContentBlock[] {
  if (!Array.isArray(blocks)) {
    return [];
  }

  return blocks.map((block, index) => {
    const source = block as Partial<NoteContentBlock> & {
      body?: unknown;
      content?: unknown;
      text?: unknown;
    };
    const htmlSource = source.html ?? source.content ?? source.body ?? source.text ?? "";

    return {
      ...source,
      id: String(source.id ?? `block-${index}`),
      type: source.type ?? "text",
      title: source.title ?? "",
      html: typeof htmlSource === "string" ? htmlSource : "",
      collapsed: Boolean(source.collapsed)
    } as NoteContentBlock;
  });
}

export function rowToNote(row: LearningNoteRow): PublicNoteRecord {
  return normalizeNote({
    id: Number(row.id),
    category: row.category ?? "未分類",
    title: row.title ?? "未命名文章",
    summary: row.summary ?? "",
    status: row.status === "草稿" ? "草稿" : "已發布",
    date: row.published_date ?? new Date().toISOString().slice(0, 10),
    slug: row.slug ?? "",
    tags: row.tags ?? "",
    coverUrl: row.cover_url ?? "",
    blocks: normalizeBlocks(row.blocks)
  });
}

export function noteToPayload(note: PublicNoteRecord) {
  const normalized = normalizeNote(note);

  return {
    category: normalized.category || "未分類",
    title: normalized.title || "未命名文章",
    summary: normalized.summary ?? "",
    status: normalized.status,
    published_date: normalized.date || new Date().toISOString().slice(0, 10),
    slug: normalized.slug ?? "",
    tags: normalized.tags ?? "",
    cover_url: normalized.coverUrl ?? "",
    blocks: normalized.blocks
  };
}
