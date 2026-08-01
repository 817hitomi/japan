import { normalizeSong, normalizeStoredSongNoteBlocks, SongRecord, songLyricsToLrc } from "../../songs/songTypes";

export type SongRow = {
  id: number | string;
  title: string | null;
  slug: string | null;
  artist: string | null;
  description: string | null;
  tags: string | null;
  cover_url: string | null;
  eyebrow: string | null;
  status: string | null;
  level: string | null;
  video_id: string | null;
  duration_seconds: number | null;
  published_date: string | null;
  lyrics: unknown;
  study_summary: string | null;
  study_blocks: unknown;
  vocabulary: unknown;
};

export const songListSelect = "id,title,slug,artist,status,published_date";

function readStoredLyrics(source: unknown) {
  if (Array.isArray(source)) return { source: songLyricsToLrc(source as SongRecord["lyrics"]), lines: source as SongRecord["lyrics"] };
  if (source && typeof source === "object") {
    const stored = source as { source?: unknown; lines?: unknown };
    const lines = Array.isArray(stored.lines) ? stored.lines as SongRecord["lyrics"] : [];
    return {
      source: typeof stored.source === "string" ? stored.source : songLyricsToLrc(lines),
      lines
    };
  }
  return { source: "", lines: [] };
}

export function rowToSong(row: Partial<SongRow>): SongRecord {
  const storedLyrics = readStoredLyrics(row.lyrics);
  return normalizeSong({
    id: Number(row.id), title: row.title ?? "", slug: row.slug ?? "", artist: row.artist ?? "",
    description: row.description ?? "", tags: row.tags ?? "", coverUrl: row.cover_url ?? "", eyebrow: row.eyebrow ?? "",
    status: row.status === "published" ? "published" : "draft", level: row.level ?? "",
    videoId: row.video_id ?? "", durationSeconds: row.duration_seconds ?? 0,
    publishedDate: row.published_date ?? "",
    lyricsLrc: storedLyrics.source, lyrics: storedLyrics.lines,
    noteBlocks: normalizeStoredSongNoteBlocks(row.study_summary ?? "", row.study_blocks),
    vocabulary: Array.isArray(row.vocabulary) ? row.vocabulary as SongRecord["vocabulary"] : []
  });
}

export function songToPayload(song: SongRecord) {
  const normalized = normalizeSong(song);
  return {
    title: normalized.title, slug: normalized.slug, artist: normalized.artist,
    description: normalized.description, tags: normalized.tags, cover_url: normalized.coverUrl,
    eyebrow: normalized.eyebrow, status: normalized.status,
    level: normalized.level, video_id: normalized.videoId,
    duration_seconds: Math.round(normalized.durationSeconds), published_date: normalized.publishedDate,
    lyrics: { format: "lrc", source: normalized.lyricsLrc, lines: normalized.lyrics }, study_summary: "",
    study_blocks: normalized.noteBlocks, vocabulary: normalized.vocabulary
  };
}
