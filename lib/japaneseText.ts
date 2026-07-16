const inlineReadingPattern = /([一-龯々〆ヵヶ]+)[(（]([ぁ-ゖァ-ヺー]+)[)）]/g;
const standaloneReadingPattern = /^([ぁ-ゖァ-ヺー一-龯々〆ヵヶ]+)[(（]([ぁ-ゖァ-ヺー]+)[)）]$/;
const kanjiPattern = /[一-龯々〆ヵヶ]/;

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderInlineRuby(text: string) {
  if (!text || text.includes("<ruby")) {
    return text;
  }

  return text
    .split(/(<[^>]+>)/g)
    .map((part) => {
      if (part.startsWith("<") && part.endsWith(">")) {
        return part;
      }

      return part.replace(inlineReadingPattern, "<ruby>$1<rt>$2</rt></ruby>");
    })
    .join("");
}

export function hasInlineReading(text: string) {
  inlineReadingPattern.lastIndex = 0;
  return inlineReadingPattern.test(text);
}

export function stripInlineReadings(text: string) {
  return text.replace(inlineReadingPattern, "$1");
}

export function readingsToSpeechText(text: string) {
  inlineReadingPattern.lastIndex = 0;
  return text.replace(inlineReadingPattern, "$2");
}

export function splitStandaloneReading(text: string) {
  const matched = text.trim().match(standaloneReadingPattern);

  if (!matched) {
    return null;
  }

  return {
    japanese: matched[1],
    kana: matched[2]
  };
}

export function renderWordRuby(japanese: string, kana: string) {
  const trimmedJapanese = japanese.trim();
  const trimmedKana = kana.trim();

  if (!trimmedJapanese) {
    return "";
  }

  if (hasInlineReading(trimmedJapanese)) {
    return renderInlineRuby(trimmedJapanese);
  }

  if (trimmedKana && kanjiPattern.test(trimmedJapanese) && trimmedKana !== trimmedJapanese) {
    return `<ruby>${escapeHtml(trimmedJapanese)}<rt>${escapeHtml(trimmedKana)}</rt></ruby>`;
  }

  return escapeHtml(trimmedJapanese);
}

export function shouldShowStandaloneKana(japanese: string, kana: string) {
  const trimmedJapanese = japanese.trim();
  const trimmedKana = kana.trim();

  return Boolean(trimmedKana && trimmedKana !== trimmedJapanese && !hasInlineReading(trimmedJapanese) && !kanjiPattern.test(trimmedJapanese));
}
