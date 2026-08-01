import type { SongLyricLine } from "../../songs/songTypes";

export type LyricImportResult = {
  lines: SongLyricLine[];
  errors: string[];
  format: "LRC" | "SRT／VTT" | "TSV" | "未辨識";
};

function parseClock(value: string) {
  const normalized = value.trim().replace(",", ".");
  const parts = normalized.split(":").map(Number);
  if (parts.some((part) => !Number.isFinite(part))) return null;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
}

function splitContent(value: string) {
  const [japanese = "", ...translationParts] = value.split("\t");
  return { japanese: japanese.trim(), translation: translationParts.join("\t").trim() };
}

function fillEndTimes(lines: SongLyricLine[], durationSeconds: number) {
  return lines.map((line, index) => ({
    ...line,
    end: line.end > line.start
      ? line.end
      : lines[index + 1]?.start > line.start
        ? lines[index + 1].start
        : Math.max(line.start, durationSeconds)
  }));
}

function parseLrc(source: string, durationSeconds: number): LyricImportResult {
  const lines: SongLyricLine[] = [];
  const errors: string[] = [];
  let section = "Verse";

  source.split(/\r?\n/).forEach((rawLine, index) => {
    const value = rawLine.trim();
    if (!value) return;
    if (/^\[(ar|ti|al|by|offset):/i.test(value)) return;
    const sectionMatch = value.match(/^\[([^\d][^\]]*)\]$/);
    if (sectionMatch) {
      section = sectionMatch[1].trim() || section;
      return;
    }
    const timed = value.match(/^\[(\d{1,2}:\d{2}(?:[.,]\d{1,3})?)\](.*)$/);
    if (!timed) {
      errors.push(`第 ${index + 1} 行缺少有效時間碼。`);
      return;
    }
    const start = parseClock(timed[1]);
    const content = splitContent(timed[2]);
    if (start == null || !content.japanese) {
      errors.push(`第 ${index + 1} 行的時間或日文歌詞無效。`);
      return;
    }
    lines.push({ section, start, end: 0, ...content });
  });

  return { lines: fillEndTimes(lines, durationSeconds), errors, format: "LRC" };
}

function parseSubtitle(source: string, durationSeconds: number): LyricImportResult {
  const lines: SongLyricLine[] = [];
  const errors: string[] = [];
  const blocks = source.replace(/^WEBVTT[^\n]*\n?/i, "").trim().split(/\r?\n\s*\r?\n/);
  let section = "Verse";

  blocks.forEach((block, index) => {
    const rows = block.split(/\r?\n/).map((row) => row.trim()).filter(Boolean);
    const timeIndex = rows.findIndex((row) => row.includes("-->"));
    if (timeIndex < 0) return;
    const [startText, endText] = rows[timeIndex].split("-->").map((value) => value.trim().split(/\s+/)[0]);
    const start = parseClock(startText);
    const end = parseClock(endText);
    const contentRows = rows.slice(timeIndex + 1);
    if (contentRows[0]?.match(/^\[[^\]]+\]$/)) section = contentRows.shift()!.slice(1, -1).trim() || section;
    if (start == null || end == null || !contentRows[0]) {
      errors.push(`第 ${index + 1} 個字幕區塊不完整。`);
      return;
    }
    const tabContent = splitContent(contentRows.join("\t"));
    lines.push({ section, start, end, japanese: tabContent.japanese, translation: tabContent.translation });
  });

  return { lines: fillEndTimes(lines, durationSeconds), errors, format: "SRT／VTT" };
}

function parseTsv(source: string, durationSeconds: number): LyricImportResult {
  const lines: SongLyricLine[] = [];
  const errors: string[] = [];

  source.split(/\r?\n/).forEach((rawLine, index) => {
    if (!rawLine.trim()) return;
    const columns = rawLine.split("\t").map((value) => value.trim());
    if (index === 0 && /段落|section/i.test(columns[0])) return;
    if (columns.length < 4) {
      errors.push(`第 ${index + 1} 行至少需要「段落、開始、日文、中文」四欄。`);
      return;
    }
    const hasEndColumn = columns.length >= 5;
    const start = parseClock(columns[1]) ?? Number(columns[1]);
    const end = hasEndColumn ? parseClock(columns[2]) ?? Number(columns[2]) : 0;
    const japanese = columns[hasEndColumn ? 3 : 2];
    const translation = columns[hasEndColumn ? 4 : 3] ?? "";
    if (!Number.isFinite(start) || !Number.isFinite(end) || !japanese) {
      errors.push(`第 ${index + 1} 行的時間或日文歌詞無效。`);
      return;
    }
    lines.push({ section: columns[0] || "Verse", start, end, japanese, translation });
  });

  return { lines: fillEndTimes(lines, durationSeconds), errors, format: "TSV" };
}

export function parseLyricImport(source: string, durationSeconds: number): LyricImportResult {
  const value = source.trim();
  if (!value) return { lines: [], errors: [], format: "未辨識" };
  if (/-->/.test(value)) return parseSubtitle(value, durationSeconds);
  if (/^\[\d{1,2}:\d{2}/m.test(value)) return parseLrc(value, durationSeconds);
  if (/\t/.test(value)) return parseTsv(value, durationSeconds);
  return { lines: [], errors: ["無法辨識格式。請貼上 LRC、SRT、VTT，或從試算表複製的多欄資料。"], format: "未辨識" };
}
