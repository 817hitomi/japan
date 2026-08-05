import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  selectBalancedQuizQuestions,
  getQuestionTypesForCategory,
  grammarChoiceQuestionType,
  wordOrderQuestionType
} from "../app/quiz/quizTypes.ts";
import type { QuizQuestionRecord } from "../app/quiz/quizTypes.ts";

function createQuestion(id: number, category: string, questionType: QuizQuestionRecord["questionType"] = "漢字讀法") {
  return {
    id,
    level: "N5",
    category,
    questionType,
    theme: `題目 ${id}`,
    prompt: `題目 ${id}`,
    note: "",
    answer: `答案 ${id}`,
    options: ["選項一", "選項二", "選項三"]
  } satisfies QuizQuestionRecord;
}

const questionPool = [
  ...Array.from({ length: 12 }, (_, index) => createQuestion(100 + index, "文字．語彙")),
  ...Array.from({ length: 12 }, (_, index) => createQuestion(200 + index, "文法", grammarChoiceQuestionType)),
  createQuestion(300, "文法", wordOrderQuestionType),
  createQuestion(400, "讀解")
];
const balancedTen = selectBalancedQuizQuestions(questionPool, 10, () => 0.25);
const balancedTwenty = selectBalancedQuizQuestions(questionPool, 20, () => 0.75);

assert.equal(balancedTen.length, 10);
assert.equal(balancedTen.filter((question) => question.category === "文字．語彙").length, 5);
assert.equal(balancedTen.filter((question) => question.category === "文法").length, 5);
assert.equal(balancedTen.slice(0, 5).every((question) => question.category === "文字．語彙"), true);
assert.equal(balancedTen.slice(5).every((question) => question.category === "文法"), true);
assert.equal(balancedTwenty.length, 20);
assert.equal(balancedTwenty.filter((question) => question.category === "文字．語彙").length, 10);
assert.equal(balancedTwenty.filter((question) => question.category === "文法").length, 10);
assert.equal(balancedTwenty.slice(0, 10).every((question) => question.category === "文字．語彙"), true);
assert.equal(balancedTwenty.slice(10).every((question) => question.category === "文法"), true);
assert.equal([...balancedTen, ...balancedTwenty].some((question) => question.questionType === wordOrderQuestionType), false);
assert.deepEqual(selectBalancedQuizQuestions(questionPool.filter((question) => question.category !== "文法"), 10), []);
assert.deepEqual(getQuestionTypesForCategory("文法"), [grammarChoiceQuestionType, wordOrderQuestionType]);
assert.equal(getQuestionTypesForCategory("文字．語彙").includes(grammarChoiceQuestionType), false);

const randomQuizClient = readFileSync(new URL("../app/quiz/RandomQuizClient.tsx", import.meta.url), "utf8");
const adminQuizClient = readFileSync(new URL("../app/admin/quiz/AdminQuizClient.tsx", import.meta.url), "utf8");
const grammarPracticeClient = readFileSync(new URL("../app/quiz/grammar-practice/GrammarPracticeClient.tsx", import.meta.url), "utf8");

assert.match(randomQuizClient, /categories: \[\.\.\.balancedQuizCategories\]/);
assert.match(randomQuizClient, /excludeQuestionType: wordOrderQuestionType/);
assert.match(randomQuizClient, /selectBalancedQuizQuestions\(filteredQuestions, questionCount\)/);
assert.match(adminQuizClient, /category === grammarQuizCategory \? grammarChoiceQuestionType/);
assert.match(adminQuizClient, /getQuestionTypesForCategory\(selectedCategory\)/);
assert.match(grammarPracticeClient, /questionType: wordOrderQuestionType/);

console.log("Random quiz balance assertions passed.");
