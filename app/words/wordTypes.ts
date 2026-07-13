export type WordCardRecord = {
  id: number;
  category: string;
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
    kana: "みず",
    japanese: "水(みず)",
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
        id: Number(source.id) || Date.now() + index,
        category: source.category || "N5",
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
