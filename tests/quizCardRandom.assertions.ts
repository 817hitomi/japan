import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const quizClient = readFileSync(new URL("../app/quiz/QuizClient.tsx", import.meta.url), "utf8");
const homeQuizCard = readFileSync(new URL("../app/notes/HomeQuizCard.tsx", import.meta.url), "utf8");

assert.match(quizClient, /const allQuizCategory = "全部"/);
assert.match(quizClient, /category: selectedCategory === allQuizCategory \? undefined : selectedCategory/);
assert.match(quizClient, /selectedCategory === allQuizCategory \|\| question\.category === selectedCategory/);
assert.match(quizClient, /setQuestions\(\s*shuffle\(/);
assert.match(quizClient, /getNextRandomIndex\(visibleQuestions\.length, current\)/);
assert.match(quizClient, /onClick=\{\(\) => switchCategory\(allQuizCategory\)\}/);
assert.equal((quizClient.match(/onClick=\{drawRandomQuestion\}/g) ?? []).length, 2);
assert.doesNotMatch(quizClient, /<span>全部<\/span>/);
assert.doesNotMatch(quizClient, /onClick=\{nextQuestion\}/);

assert.match(homeQuizCard, /export default function HomeQuizCard/);
assert.doesNotMatch(homeQuizCard, /allQuizCategory/);

console.log("quiz card random assertions passed");
