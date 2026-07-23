export type QuoteRecord = {
  id: number;
  category: string;
  japanese: string;
  kana: string;
  chinese: string;
  frontAudioUrl: string;
  isRandomPool: boolean;
};

export const defaultQuotes: QuoteRecord[] = [
  {
    id: 1,
    category: "首頁白版",
    japanese: "今日",
    kana: "きょう",
    chinese: "今天",
    frontAudioUrl: "",
    isRandomPool: true
  },
  {
    id: 2,
    category: "首頁白版",
    japanese: "一つ",
    kana: "ひとつ",
    chinese: "一個",
    frontAudioUrl: "",
    isRandomPool: true
  },
  {
    id: 3,
    category: "首頁白版",
    japanese: "覚える",
    kana: "おぼえる",
    chinese: "記住",
    frontAudioUrl: "",
    isRandomPool: true
  }
];

const defaultQuoteReadings = new Map(
  defaultQuotes.map((quote) => [
    quote.japanese,
    {
      kana: quote.kana,
      chinese: quote.chinese
    }
  ])
);

export function normalizeQuotes(quotes: unknown, allowEmpty = false): QuoteRecord[] {
  if (!Array.isArray(quotes)) {
    return defaultQuotes;
  }

  const normalized = quotes
    .map((quote, index) => {
      const source = quote as Partial<QuoteRecord> & { text?: string; front_audio_url?: string };
      const fallbackText = source.japanese || source.text || "";
      const defaultReading = defaultQuoteReadings.get(fallbackText.trim());

      return {
        id: Number(source.id) || Date.now() + index,
        category: source.category?.trim() || "首頁白版",
        japanese: fallbackText.trim(),
        kana: source.kana?.trim() || defaultReading?.kana || "",
        chinese: source.chinese?.trim() || defaultReading?.chinese || "",
        frontAudioUrl: (source.frontAudioUrl || source.front_audio_url || "").trim(),
        isRandomPool: source.isRandomPool === true
      };
    })
    .filter((quote) => quote.japanese || quote.chinese);

  if (normalized.length > 0) {
    return normalized;
  }

  return allowEmpty ? [] : defaultQuotes;
}
