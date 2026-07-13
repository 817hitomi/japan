import { splitStandaloneReading } from "../../../lib/japaneseText";
import { normalizeWordCards, WordCardRecord } from "../../words/wordTypes";

type WordCardRow = {
  id: number;
  category: string | null;
  kana: string | null;
  japanese: string | null;
  chinese: string | null;
  example_japanese: string | null;
  example_chinese: string | null;
  audio_url: string | null;
  front_audio_url: string | null;
  back_audio_url: string | null;
};

export function rowToWord(row: WordCardRow): WordCardRecord {
  return normalizeWordCards([
    {
      id: Number(row.id),
      category: row.category ?? "N5",
      kana: row.kana ?? "",
      japanese: row.japanese ?? "",
      chinese: row.chinese ?? "",
      exampleJapanese: row.example_japanese ?? "",
      exampleChinese: row.example_chinese ?? "",
      audioUrl: row.audio_url ?? "",
      frontAudioUrl: row.front_audio_url ?? row.audio_url ?? "",
      backAudioUrl: row.back_audio_url ?? ""
    }
  ])[0];
}

export function wordToPayload(word: WordCardRecord) {
  const normalized = normalizeWordCards([word])[0];
  const standaloneReading = splitStandaloneReading(normalized.japanese);
  const japanese = standaloneReading?.japanese ?? normalized.japanese;
  const kana = normalized.kana.trim() || standaloneReading?.kana || "";

  return {
    category: normalized.category || "N5",
    kana,
    japanese: japanese.trim(),
    chinese: normalized.chinese.trim(),
    example_japanese: normalized.exampleJapanese.trim(),
    example_chinese: normalized.exampleChinese.trim(),
    audio_url: normalized.audioUrl.trim(),
    front_audio_url: (normalized.frontAudioUrl || normalized.audioUrl).trim(),
    back_audio_url: normalized.backAudioUrl.trim()
  };
}
