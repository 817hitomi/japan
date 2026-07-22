import { splitStandaloneReading } from "../../lib/japaneseText";
import { WordCardRecord } from "./wordTypes";

export const kanaRows = [
  { key: "a", label: "あ", kana: ["あ", "い", "う", "え", "お"] },
  { key: "ka", label: "か", kana: ["か", "き", "く", "け", "こ", "が", "ぎ", "ぐ", "げ", "ご"] },
  { key: "sa", label: "さ", kana: ["さ", "し", "す", "せ", "そ", "ざ", "じ", "ず", "ぜ", "ぞ"] },
  { key: "ta", label: "た", kana: ["た", "ち", "つ", "て", "と", "だ", "ぢ", "づ", "で", "ど"] },
  { key: "na", label: "な", kana: ["な", "に", "ぬ", "ね", "の"] },
  { key: "ha", label: "は", kana: ["は", "ひ", "ふ", "へ", "ほ", "ば", "び", "ぶ", "べ", "ぼ", "ぱ", "ぴ", "ぷ", "ぺ", "ぽ"] },
  { key: "ma", label: "ま", kana: ["ま", "み", "む", "め", "も"] },
  { key: "ya", label: "や", kana: ["や", "ゆ", "よ", "ゃ", "ゅ", "ょ"] },
  { key: "ra", label: "ら", kana: ["ら", "り", "る", "れ", "ろ"] },
  { key: "wa", label: "わ", kana: ["わ", "を", "ん"] }
] as const;

export type KanaRowKey = (typeof kanaRows)[number]["key"];

export function normalizeKanaRowKey(value?: string): KanaRowKey | "" {
  return kanaRows.some((row) => row.key === value) ? (value as KanaRowKey) : "";
}

function toHiragana(text: string) {
  return text.replace(/[\u30a1-\u30f6]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0x60));
}

function getFirstKana(text: string) {
  return toHiragana(text).match(/[ぁ-ん]/)?.[0] ?? "";
}

export function getKanaRowKey(word: Pick<WordCardRecord, "japanese" | "kana">): KanaRowKey | "" {
  const kana = getFirstKana(word.kana.trim());
  if (kana) {
    return kanaRows.find((row) => (row.kana as readonly string[]).includes(kana))?.key ?? "";
  }

  const standaloneReading = splitStandaloneReading(word.japanese);
  const standaloneKana = getFirstKana(standaloneReading?.kana ?? "");
  if (standaloneKana) {
    return kanaRows.find((row) => (row.kana as readonly string[]).includes(standaloneKana))?.key ?? "";
  }

  const japaneseKana = getFirstKana(word.japanese);
  return kanaRows.find((row) => (row.kana as readonly string[]).includes(japaneseKana))?.key ?? "";
}
