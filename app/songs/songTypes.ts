import type { NoteContentBlock } from "../notes/noteTypes";

export type SongStatus = "published" | "draft";

export type SongLyricLine = {
  section: string;
  start: number;
  end: number;
  japanese: string;
  translation: string;
};

function formatLrcTime(seconds: number) {
  const safeSeconds = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds - minutes * 60;
  return `${String(minutes).padStart(2, "0")}:${remainingSeconds.toFixed(2).padStart(5, "0")}`;
}

export function songLyricsToLrc(lines: SongLyricLine[]) {
  let previousSection = "";
  const output: string[] = [];

  lines.forEach((line) => {
    const section = line.section.trim() || "Verse";
    if (section !== previousSection) {
      if (output.length > 0) output.push("");
      output.push(`[${section}]`);
      previousSection = section;
    }

    const translation = line.translation.trim() ? `\t${line.translation.trim()}` : "";
    output.push(`[${formatLrcTime(line.start)}]${line.japanese.trim()}${translation}`);
  });

  return output.join("\n");
}

type LegacySongStudyBlock = {
  title: string;
  japanese: string;
  explanation: string;
  translation: string;
};

export type SongVocabulary = {
  partOfSpeech: string;
  japanese: string;
  translation: string;
};

export type SongRecord = {
  id: number;
  title: string;
  slug: string;
  artist: string;
  description: string;
  tags: string;
  coverUrl: string;
  eyebrow: string;
  status: SongStatus;
  level: string;
  videoId: string;
  durationSeconds: number;
  publishedDate: string;
  lyricsLrc: string;
  lyrics: SongLyricLine[];
  noteBlocks: NoteContentBlock[];
  vocabulary: SongVocabulary[];
};

export type SongListItem = Pick<SongRecord, "id" | "title" | "slug" | "artist" | "status" | "publishedDate">;

export type SongRelatedItem = Pick<
  SongRecord,
  "id" | "title" | "slug" | "artist" | "description" | "tags" | "coverUrl" | "level" | "videoId" | "durationSeconds" | "publishedDate"
>;

export function parseSongTags(tags: string) {
  return Array.from(
    new Set(
      tags
        .split(/[,，、\r\n]+/)
        .map((tag) => tag.trim().replace(/^#+/, ""))
        .filter(Boolean)
    )
  );
}

export function toSongRelatedItem(song: SongRecord): SongRelatedItem {
  return {
    id: song.id,
    title: song.title,
    slug: song.slug,
    artist: song.artist,
    description: song.description,
    tags: song.tags,
    coverUrl: song.coverUrl,
    level: song.level,
    videoId: song.videoId,
    durationSeconds: song.durationSeconds,
    publishedDate: song.publishedDate
  };
}

export function normalizeYouTubeVideoId(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";

  try {
    const url = new URL(trimmed);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (host === "youtu.be") return url.pathname.split("/").filter(Boolean)[0] ?? "";
    if (host === "youtube.com" || host === "m.youtube.com") {
      const watchId = url.searchParams.get("v")?.trim();
      if (watchId) return watchId;
      const [type, id] = url.pathname.split("/").filter(Boolean);
      if ((type === "embed" || type === "shorts" || type === "live") && id) return id;
    }
  } catch {
    // A plain YouTube video ID is already the storage format we need.
  }

  return trimmed;
}

export function getYouTubeVideoUrl(videoId: string) {
  const normalizedId = normalizeYouTubeVideoId(videoId);
  return normalizedId ? `https://www.youtube.com/watch?v=${normalizedId}` : "";
}

export const songStatusLabels: Record<SongStatus, string> = {
  published: "已發布",
  draft: "草稿"
};

const seedLyrics: SongLyricLine[] = [
  { section: "Verse", start: 5, end: 14, japanese: "朝(あさ)の光(ひかり)　窓(まど)を開(あ)けて", translation: "在晨光中，打開窗戶" },
  { section: "Verse", start: 14, end: 23, japanese: "小(ちい)さな夢(ゆめ)を　胸(むね)に抱(だ)いて", translation: "將小小的夢想抱在心中" },
  { section: "Verse", start: 23, end: 32, japanese: "今日(きょう)も一歩(いっぽ)　前(まえ)へ進(すす)む", translation: "今天也向前跨出一步" },
  { section: "Verse", start: 32, end: 41, japanese: "言葉(ことば)の種(たね)　未来(みらい)に咲(さ)く", translation: "言語的種子在未來綻放" },
  { section: "Chorus", start: 41, end: 50, japanese: "学(まな)ぶ心(こころ)　強(つよ)くなる", translation: "求知的心會變得更加堅強" },
  { section: "Chorus", start: 50, end: 59, japanese: "空(そら)の青(あお)に　願(ねが)いを乗(の)せ", translation: "把願望寄託在蔚藍天空" },
  { section: "Chorus", start: 59, end: 68, japanese: "一緒(いっしょ)ならば　道(みち)は見(み)える", translation: "只要在一起，就能看見前路" },
  { section: "Chorus", start: 68, end: 78, japanese: "希望(きぼう)の歌(うた)　響(ひび)けるよ", translation: "讓希望之歌響起吧" },
  { section: "Verse 2", start: 81, end: 90, japanese: "昼(ひる)の風(かぜ)に　ページめくれば", translation: "在午後的風中翻開書頁" },
  { section: "Verse 2", start: 90, end: 99, japanese: "新(あたら)しい音(おと)　心(こころ)を呼(よ)ぶ", translation: "嶄新的聲音呼喚著心靈" },
  { section: "Verse 2", start: 99, end: 108, japanese: "少(すこ)しずつでも　分(わ)かっていく", translation: "即使一點一點，也會逐漸明白" },
  { section: "Verse 2", start: 108, end: 118, japanese: "日々(ひび)の努力(どりょく)　光(ひかり)に変(か)わる", translation: "每一天的努力都將化為光芒" },
  { section: "Prechorus", start: 118, end: 127, japanese: "迷(まよ)う時(とき)も　立(た)ち止(ど)まって", translation: "迷惘的時候，也停下腳步" },
  { section: "Prechorus", start: 127, end: 137, japanese: "見上(みあ)げる空(そら)に　答(こた)えがある", translation: "仰望的天空中藏著答案" },
  { section: "Bridge", start: 140, end: 149, japanese: "夜(よる)の静(しず)けさ　夢(ゆめ)を描(えが)き", translation: "在夜晚的寧靜中描繪夢想" },
  { section: "Bridge", start: 149, end: 158, japanese: "明日(あした)の僕(ぼく)に　笑顔(えがお)をくれる", translation: "為明天的我帶來笑容" },
  { section: "Bridge", start: 158, end: 167, japanese: "どんな壁(かべ)も　越(こ)えて行(い)ける", translation: "無論什麼高牆都能跨越" },
  { section: "Bridge", start: 167, end: 180, japanese: "小(ちい)さな勇気(ゆうき)　道(みち)を照(て)らす", translation: "小小的勇氣照亮前路" }
];

export const seedSong: SongRecord = {
  id: 1,
  title: "小さな夢",
  slug: "chiisana-yume",
  artist: "自學日文筆記・日文留音室",
  description: "跟著影片逐句閱讀日文歌詞、假名與繁體中文翻譯。",
  tags: "日文歌曲, 日文學習, 日語歌詞",
  coverUrl: "",
  eyebrow: "同步歌詞試作",
  status: "published",
  level: "N4",
  videoId: "PRMMBraH_k4",
  durationSeconds: 185,
  publishedDate: "2026-08-01",
  lyricsLrc: "",
  lyrics: seedLyrics,
  noteBlocks: [
    { id: "song-note-summary", type: "text", title: "文章內容", html: "<p>整理歌曲中的文法、重要表現、單字與延伸例句。</p>", collapsed: false },
    { id: "song-note-naraba", type: "text", title: "文章內容", heading: "文法解析：～ならば", html: "<p>一緒(いっしょ)ならば　道(みち)は見(み)える</p><p>～ならば表示假設條件，相當於中文的「如果……的話」。比口語常見的「～なら」稍正式。</p><p>只要在一起，就能看見前路。</p>", collapsed: false },
    { id: "song-note-teiku", type: "text", title: "文章內容", heading: "文法解析：～ていく", html: "<p>少(すこ)しずつでも　分(わ)かっていく</p><p>～ていく可以表示某個動作或變化從現在開始，繼續朝未來發展。</p><p>即使一點一點，也會逐漸明白。</p>", collapsed: false }
  ],
  vocabulary: [
    { partOfSpeech: "動詞", japanese: "抱(だ)く", translation: "懷抱、抱持" },
    { partOfSpeech: "動詞", japanese: "響(ひび)く", translation: "響起、迴盪" },
    { partOfSpeech: "名詞", japanese: "努力(どりょく)", translation: "努力" },
    { partOfSpeech: "動詞", japanese: "照(て)らす", translation: "照亮" }
  ]
};

export function normalizeSong(source: Partial<SongRecord>): SongRecord {
  return {
    id: Number.isSafeInteger(Number(source.id)) ? Number(source.id) : Date.now(),
    title: source.title?.trim() || "未命名歌曲",
    slug: source.slug?.trim().toLowerCase() || "",
    artist: source.artist?.trim() || "",
    description: source.description ?? "",
    tags: source.tags ?? "",
    coverUrl: source.coverUrl ?? "",
    eyebrow: source.eyebrow?.trim() || "同步歌詞",
    status: source.status === "published" ? "published" : "draft",
    level: source.level?.trim() || "N5",
    videoId: normalizeYouTubeVideoId(source.videoId ?? ""),
    durationSeconds: Math.max(0, Number(source.durationSeconds) || 0),
    publishedDate: source.publishedDate || new Date().toISOString().slice(0, 10),
    lyricsLrc: source.lyricsLrc ?? "",
    lyrics: Array.isArray(source.lyrics) ? source.lyrics.map((line) => ({ section: line.section || "Verse", start: Math.max(0, Number(line.start) || 0), end: Math.max(0, Number(line.end) || 0), japanese: line.japanese || "", translation: line.translation || "" })) : [],
    noteBlocks: normalizeNoteBlocks(source.noteBlocks),
    vocabulary: Array.isArray(source.vocabulary) ? source.vocabulary.map((item) => ({ partOfSpeech: item.partOfSpeech || "", japanese: item.japanese || "", translation: item.translation || "" })) : []
  };
}

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function normalizeNoteBlocks(source: unknown): NoteContentBlock[] {
  if (!Array.isArray(source)) return [];
  return source.map((item, index) => {
    const block = item as Partial<NoteContentBlock>;
    const type = block.type === "image" || block.type === "video" || block.type === "note" || block.type === "ad" ? block.type : "text";
    return {
      id: String(block.id ?? `song-note-${index}`),
      type,
      title: String(block.title ?? (type === "note" ? "NOTE" : "文章內容")),
      heading: typeof block.heading === "string" ? block.heading : "",
      html: String(block.html ?? ""),
      collapsed: block.collapsed === true,
      imageUrl: typeof block.imageUrl === "string" ? block.imageUrl : "",
      linkUrl: typeof block.linkUrl === "string" ? block.linkUrl : "",
      videoUrl: typeof block.videoUrl === "string" ? block.videoUrl : "",
      caption: typeof block.caption === "string" ? block.caption : "",
      adSlot: typeof block.adSlot === "string" ? block.adSlot : ""
    };
  });
}

export function normalizeStoredSongNoteBlocks(summary: string, source: unknown): NoteContentBlock[] {
  const rawBlocks = Array.isArray(source) ? source : [];
  const usesArticleBlocks = rawBlocks.some((item) => item && typeof item === "object" && "type" in item);
  if (usesArticleBlocks) return normalizeNoteBlocks(rawBlocks);

  const converted: NoteContentBlock[] = [];
  if (summary.trim()) converted.push({ id: "song-note-summary", type: "text", title: "文章內容", html: `<p>${escapeHtml(summary.trim())}</p>`, collapsed: false });
  rawBlocks.forEach((item, index) => {
    const block = item as Partial<LegacySongStudyBlock>;
    const paragraphs = [block.japanese, block.explanation, block.translation]
      .filter((value): value is string => Boolean(value?.trim()))
      .map((value) => `<p>${escapeHtml(value.trim())}</p>`)
      .join("");
    converted.push({ id: `song-note-legacy-${index}`, type: "text", title: "文章內容", heading: block.title?.trim() ?? "", html: paragraphs, collapsed: false });
  });
  return converted;
}
