export type WordKanaRowKey = "a" | "ka" | "sa" | "ta" | "na" | "ha" | "ma" | "ya" | "ra" | "wa";

export function normalizeWordKanaRowKey(value: unknown): WordKanaRowKey | "" {
  return value === "a" ||
    value === "ka" ||
    value === "sa" ||
    value === "ta" ||
    value === "na" ||
    value === "ha" ||
    value === "ma" ||
    value === "ya" ||
    value === "ra" ||
    value === "wa"
    ? value
    : "";
}

export type WordCardRecord = {
  id: number;
  category: string;
  kanaRow: WordKanaRowKey | "";
  kana: string;
  japanese: string;
  chinese: string;
  exampleJapanese: string;
  exampleChinese: string;
  audioUrl: string;
  frontAudioUrl: string;
  backAudioUrl: string;
};

export const seedWordCards: WordCardRecord[] = [
  {
    id: 1,
    category: "N5",
    kanaRow: "ma",
    kana: "みず",
    japanese: "水",
    chinese: "水",
    exampleJapanese: "水(みず)を飲(の)みます。",
    exampleChinese: "我喝水。",
    audioUrl: "",
    frontAudioUrl: "",
    backAudioUrl: ""
  }
];

export function normalizeWordCards(words: unknown, allowEmpty = false): WordCardRecord[] {
  if (!Array.isArray(words)) {
    return seedWordCards;
  }

  const normalized = words
    .map((word, index) => {
      const source = word as Partial<WordCardRecord>;

      return {
        id: Number(source.id) || -(index + 1),
        category: source.category || "N5",
        kanaRow: normalizeWordKanaRowKey(source.kanaRow),
        kana: source.kana || "",
        japanese: source.japanese || "",
        chinese: source.chinese || "",
        exampleJapanese: source.exampleJapanese || "",
        exampleChinese: source.exampleChinese || "",
        audioUrl: source.audioUrl || "",
        frontAudioUrl: source.frontAudioUrl || source.audioUrl || "",
        backAudioUrl: source.backAudioUrl || ""
      };
    })
    .filter((word) => word.japanese || word.chinese);

  if (normalized.length > 0) {
    return normalized;
  }

  return allowEmpty ? [] : seedWordCards;
}
