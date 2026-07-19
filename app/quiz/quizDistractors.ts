import { QuizQuestionRecord } from "./quizTypes";

type KanaMora = {
  text: string;
  base: string;
  row: string;
  vowel: string;
  variants: string[];
};

const smallKana = new Set(["ゃ", "ゅ", "ょ", "ぁ", "ぃ", "ぅ", "ぇ", "ぉ"]);
const longVowels: Record<string, string> = {
  あ: "あ",
  い: "い",
  う: "う",
  え: "い",
  お: "う"
};
const smallKanaVowels: Record<string, string> = {
  ゃ: "あ",
  ゅ: "う",
  ょ: "お",
  ぁ: "あ",
  ぃ: "い",
  ぅ: "う",
  ぇ: "え",
  ぉ: "お"
};

const kanaRows = [
  { row: "vowel", kana: ["あ", "い", "う", "え", "お"] },
  { row: "k", kana: ["か", "き", "く", "け", "こ"] },
  { row: "s", kana: ["さ", "し", "す", "せ", "そ"] },
  { row: "t", kana: ["た", "ち", "つ", "て", "と"] },
  { row: "n", kana: ["な", "に", "ぬ", "ね", "の"] },
  { row: "h", kana: ["は", "ひ", "ふ", "へ", "ほ"] },
  { row: "m", kana: ["ま", "み", "む", "め", "も"] },
  { row: "y", kana: ["や", "", "ゆ", "", "よ"] },
  { row: "r", kana: ["ら", "り", "る", "れ", "ろ"] },
  { row: "w", kana: ["わ", "", "", "", "を"] },
  { row: "g", kana: ["が", "ぎ", "ぐ", "げ", "ご"] },
  { row: "z", kana: ["ざ", "じ", "ず", "ぜ", "ぞ"] },
  { row: "d", kana: ["だ", "ぢ", "づ", "で", "ど"] },
  { row: "b", kana: ["ば", "び", "ぶ", "べ", "ぼ"] },
  { row: "p", kana: ["ぱ", "ぴ", "ぷ", "ぺ", "ぽ"] }
];
const vowels = ["あ", "い", "う", "え", "お"];
const kanaByText = new Map<string, KanaMora>();
const kanaByRow = new Map<string, KanaMora[]>();
const dakutenPairs: Record<string, string[]> = {
  か: ["が"],
  き: ["ぎ"],
  く: ["ぐ"],
  け: ["げ"],
  こ: ["ご"],
  さ: ["ざ"],
  し: ["じ"],
  す: ["ず"],
  せ: ["ぜ"],
  そ: ["ぞ"],
  た: ["だ"],
  ち: ["ぢ"],
  つ: ["づ"],
  て: ["で"],
  と: ["ど"],
  は: ["ば", "ぱ"],
  ひ: ["び", "ぴ"],
  ふ: ["ぶ", "ぷ"],
  へ: ["べ", "ぺ"],
  ほ: ["ぼ", "ぽ"],
  が: ["か"],
  ぎ: ["き"],
  ぐ: ["く"],
  げ: ["け"],
  ご: ["こ"],
  ざ: ["さ"],
  じ: ["し", "ぢ"],
  ず: ["す", "づ"],
  ぜ: ["せ"],
  ぞ: ["そ"],
  だ: ["た"],
  ぢ: ["ち", "じ"],
  づ: ["つ", "ず"],
  で: ["て"],
  ど: ["と"],
  ば: ["は", "ぱ"],
  び: ["ひ", "ぴ"],
  ぶ: ["ふ", "ぷ"],
  べ: ["へ", "ぺ"],
  ぼ: ["ほ", "ぽ"],
  ぱ: ["は", "ば"],
  ぴ: ["ひ", "び"],
  ぷ: ["ふ", "ぶ"],
  ぺ: ["へ", "べ"],
  ぽ: ["ほ", "ぼ"]
};
const yoonPairs: Record<string, string[]> = {
  きゃ: ["ぎゃ", "しゃ", "ちゃ"],
  きゅ: ["ぎゅ", "しゅ", "ちゅ"],
  きょ: ["ぎょ", "しょ", "ちょ"],
  ぎゃ: ["きゃ", "じゃ"],
  ぎゅ: ["きゅ", "じゅ"],
  ぎょ: ["きょ", "じょ"],
  しゃ: ["じゃ", "きゃ", "ちゃ"],
  しゅ: ["じゅ", "きゅ", "ちゅ"],
  しょ: ["じょ", "きょ", "ちょ"],
  じゃ: ["しゃ", "ぎゃ"],
  じゅ: ["しゅ", "ぎゅ"],
  じょ: ["しょ", "ぎょ"],
  ちゃ: ["じゃ", "しゃ"],
  ちゅ: ["じゅ", "しゅ"],
  ちょ: ["じょ", "しょ"],
  にゃ: ["みゃ", "りゃ"],
  にゅ: ["みゅ", "りゅ"],
  にょ: ["みょ", "りょ"],
  ひゃ: ["びゃ", "ぴゃ"],
  ひゅ: ["びゅ", "ぴゅ"],
  ひょ: ["びょ", "ぴょ"],
  びゃ: ["ひゃ", "ぴゃ"],
  びゅ: ["ひゅ", "ぴゅ"],
  びょ: ["ひょ", "ぴょ"],
  ぴゃ: ["ひゃ", "びゃ"],
  ぴゅ: ["ひゅ", "びゅ"],
  ぴょ: ["ひょ", "びょ"],
  みゃ: ["にゃ", "りゃ"],
  みゅ: ["にゅ", "りゅ"],
  みょ: ["にょ", "りょ"],
  りゃ: ["にゃ", "みゃ"],
  りゅ: ["にゅ", "みゅ"],
  りょ: ["にょ", "みょ"]
};

kanaRows.forEach(({ row, kana }) => {
  kana.forEach((text, index) => {
    if (!text) {
      return;
    }

    const mora = { text, base: text, row, vowel: vowels[index], variants: [] };
    kanaByText.set(text, mora);
    kanaByRow.set(row, [...(kanaByRow.get(row) ?? []), mora]);
  });
});

function uniqueOptions(options: string[]) {
  return Array.from(new Set(options.map((option) => option.trim()).filter(Boolean)));
}

function isKanaText(value: string) {
  return /^[ぁ-んー]+$/.test(value);
}

function toHiragana(value: string) {
  return value.replace(/[ァ-ン]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0x60));
}

function splitMora(value: string) {
  const chars = Array.from(toHiragana(value));
  const moras: string[] = [];

  chars.forEach((char) => {
    if (smallKana.has(char) && moras.length > 0) {
      moras[moras.length - 1] += char;
      return;
    }

    moras.push(char);
  });

  return moras;
}

function replaceMora(moras: string[], index: number, replacement: string) {
  return moras.map((mora, moraIndex) => (moraIndex === index ? replacement : mora)).join("");
}

function getMoraCandidates(mora: string) {
  const candidates = new Set<string>();
  const baseMora = kanaByText.get(mora);

  dakutenPairs[mora]?.forEach((candidate) => candidates.add(candidate));
  yoonPairs[mora]?.forEach((candidate) => candidates.add(candidate));

  if (baseMora) {
    const sameRow = kanaByRow.get(baseMora.row) ?? [];
    const rowIndex = sameRow.findIndex((candidate) => candidate.text === mora);
    [rowIndex - 1, rowIndex + 1]
      .map((candidateIndex) => sameRow[candidateIndex]?.text)
      .filter(Boolean)
      .forEach((candidate) => candidates.add(candidate));
  }

  if (mora.length === 2) {
    const head = mora[0];
    const tail = mora[1];
    candidates.add(`${head}${tail === "ょ" ? "ゃ" : "ょ"}`);
    candidates.add(head);

    const yoonVowel = smallKanaVowels[tail];
    if (yoonVowel) {
      candidates.add(`${mora}${longVowels[yoonVowel]}`);
    }
  }

  return Array.from(candidates).filter((candidate) => candidate && candidate !== mora);
}

function isUsableReadingDistractor(answer: string, option: string) {
  if (!option || option === answer) {
    return false;
  }

  const answerMoraCount = splitMora(answer).length;
  const optionMoraCount = splitMora(option).length;

  if (Math.abs(answerMoraCount - optionMoraCount) > 1) {
    return false;
  }

  return isKanaText(option);
}

function scoreReadingDistractor(answer: string, option: string) {
  if (!isUsableReadingDistractor(answer, option)) {
    return -Infinity;
  }

  const answerChars = Array.from(answer);
  const optionChars = Array.from(option);
  const sharedChars = Array.from(new Set(answerChars)).filter((char) => option.includes(char)).length;
  const sameHead = answerChars[0] === optionChars[0] ? 3 : 0;
  const sameTail = answerChars.at(-1) === optionChars.at(-1) ? 2 : 0;
  const lengthDistance = Math.abs(answerChars.length - optionChars.length);

  return sharedChars * 2 + sameHead + sameTail - lengthDistance * 2;
}

function isLikelyReadingDistractor(answer: string, option: string) {
  return scoreReadingDistractor(answer, option) >= 2;
}

function createReadingVariants(answer: string) {
  const moras = splitMora(answer);
  const variants = new Set<string>();

  moras.forEach((mora, index) => {
    const isLastMora = index === moras.length - 1;

    if (mora === "ん") {
      return;
    }

    if (isLastMora && kanaByText.get(mora)?.row === "vowel") {
      return;
    }

    getMoraCandidates(mora).forEach((candidate) => variants.add(replaceMora(moras, index, candidate)));
  });

  if (moras.length >= 2) {
    const lastMora = moras.at(-1) ?? "";
    const lastVowel = kanaByText.get(lastMora)?.vowel;

    if (lastVowel) {
      variants.add(`${answer}${longVowels[lastVowel]}`);
    }
  }

  return uniqueOptions(Array.from(variants)).filter((option) => isUsableReadingDistractor(answer, option));
}

function shuffle<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5);
}

export function generateQuizDistractors(answer: string, questions: QuizQuestionRecord[], manualOptions: string[] = []) {
  const normalizedAnswer = toHiragana(answer.trim());
  const manualDistractors = uniqueOptions(manualOptions).filter((option) => isLikelyReadingDistractor(normalizedAnswer, option));
  const questionCandidates = questions.flatMap((question) => [question.answer, ...question.options]);
  const generatedVariants = createReadingVariants(normalizedAnswer);
  const scoredCandidates = uniqueOptions([...generatedVariants, ...questionCandidates])
    .filter((option) => !manualDistractors.includes(option))
    .map((option) => ({ option, score: scoreReadingDistractor(normalizedAnswer, option) }))
    .filter((candidate) => Number.isFinite(candidate.score))
    .sort((a, b) => b.score - a.score)
    .map((candidate) => candidate.option);
  const autoDistractors = uniqueOptions(scoredCandidates).filter((option) => option !== normalizedAnswer);
  const distractors = uniqueOptions([...manualDistractors, ...shuffle(autoDistractors)]).filter((option) =>
    isLikelyReadingDistractor(normalizedAnswer, option)
  );

  return distractors.slice(0, 3);
}
