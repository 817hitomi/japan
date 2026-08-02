import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  normalizeQuizQuestions,
  normalizeWordOrderAnswer,
  parseWordOrderSegments,
  wordOrderQuestionType
} from "../app/quiz/quizTypes.ts";

assert.deepEqual(
  parseWordOrderSegments(" 海賊王に｜俺は|なる\n海賊王は｜｜俺が "),
  ["海賊王に", "俺は", "なる", "海賊王は", "俺が"]
);
assert.deepEqual(parseWordOrderSegments("私、学生｜です"), ["私、学生", "です"]);
assert.deepEqual(parseWordOrderSegments("私｜私｜です"), ["私", "私", "です"]);
assert.equal(normalizeWordOrderAnswer("俺は 海賊王に\nなる"), "俺は海賊王になる");
assert.equal(normalizeWordOrderAnswer("私は毎日六時に起きます。"), "私は毎日六時に起きます");

const normalizedWordOrder = normalizeQuizQuestions(
  [{
    id: 1,
    level: "N5",
    category: "文法",
    questionType: wordOrderQuestionType,
    theme: "",
    prompt: "",
    note: "詳解",
    answer: "私は私です",
    options: ["私", "は", "私", "です", "彼"]
  }],
  true
)[0];
assert.deepEqual(normalizedWordOrder.options, ["私", "は", "私", "です", "彼"]);

const normalizedChoice = normalizeQuizQuestions(
  [{
    id: 2,
    level: "N5",
    category: "文字．語彙",
    questionType: "漢字讀法",
    prompt: "問題",
    answer: "答え",
    options: ["一", "一", "二", "三", "四"]
  }],
  true
)[0];
assert.deepEqual(normalizedChoice.options, ["一", "二"]);

const quizRoute = readFileSync(new URL("../app/api/quiz/route.ts", import.meta.url), "utf8");
const quizItemRoute = readFileSync(new URL("../app/api/quiz/[id]/route.ts", import.meta.url), "utf8");
const quizClient = readFileSync(new URL("../app/quiz/QuizClient.tsx", import.meta.url), "utf8");
const randomQuizClient = readFileSync(new URL("../app/quiz/RandomQuizClient.tsx", import.meta.url), "utf8");
const grammarPracticeClient = readFileSync(new URL("../app/quiz/grammar-practice/GrammarPracticeClient.tsx", import.meta.url), "utf8");
const adminQuizClient = readFileSync(new URL("../app/admin/quiz/AdminQuizClient.tsx", import.meta.url), "utf8");

assert.match(quizRoute, /excludeType/);
assert.match(quizRoute, /if \(!isWordOrderQuestion\)/);
assert.match(quizItemRoute, /if \(!isWordOrderQuestion\)/);
assert.match(quizClient, /excludeQuestionType: wordOrderQuestionType/);
assert.match(randomQuizClient, /excludeQuestionType: wordOrderQuestionType/);
assert.match(quizClient, /\/quiz\/grammar-practice\?level=/);
assert.match(grammarPracticeClient, /pickRandomQuestion\(questions, activeQuestion\?\.id\)/);
assert.match(grammarPracticeClient, /question\.options\.map/);
assert.doesNotMatch(grammarPracticeClient, /getWordOrderAnswerSegments/);
assert.match(grammarPracticeClient, /activeQuestion\.note/);
assert.match(grammarPracticeClient, /styles\.explanationPanel/);
assert.match(grammarPracticeClient, /styles\.explanationContent/);
assert.match(grammarPracticeClient, /<ParallaxBackground/);
assert.match(grammarPracticeClient, /可使用部分語塊，題目可能包含干擾項目/);
assert.match(grammarPracticeClient, /styles\.segmentText/);
assert.match(grammarPracticeClient, /renderInlineRuby\(segment\.text\)/);
assert.match(grammarPracticeClient, /getAnswerSegmentIds\(activeQuestion\)/);
assert.match(grammarPracticeClient, /styles\.incorrectSegment/);
assert.match(grammarPracticeClient, /"答錯了"/);
assert.match(grammarPracticeClient, /readingsToSpeechText\(answer\)/);
assert.match(grammarPracticeClient, /SpeechSynthesisUtterance/);
assert.match(grammarPracticeClient, /styles\.speakAnswerButton/);
assert.match(adminQuizClient, /parseWordOrderSegments\(wordOrderInput\)/);
assert.match(adminQuizClient, /答題後前台顯示/);

console.log("Word-order quiz assertions passed.");
