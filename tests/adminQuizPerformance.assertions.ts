import assert from "node:assert/strict";
import fs from "node:fs";

const quizRoute = fs.readFileSync(new URL("../app/api/quiz/route.ts", import.meta.url), "utf8");
const quizItemRoute = fs.readFileSync(new URL("../app/api/quiz/[id]/route.ts", import.meta.url), "utf8");
const quizCategoriesRoute = fs.readFileSync(new URL("../app/api/quiz/categories/route.ts", import.meta.url), "utf8");
const quizMapper = fs.readFileSync(new URL("../app/api/quiz/quizMapper.ts", import.meta.url), "utf8");
const quizStorage = fs.readFileSync(new URL("../app/quiz/quizStorage.ts", import.meta.url), "utf8");
const adminQuizClient = fs.readFileSync(new URL("../app/admin/quiz/AdminQuizClient.tsx", import.meta.url), "utf8");

assert.match(quizMapper, /quizDistractorCandidateSelect = "answer,options"/);
assert.match(quizRoute, /\.select\(quizDistractorCandidateSelect\)/);
assert.match(quizItemRoute, /\.select\(quizDistractorCandidateSelect\)/);
assert.doesNotMatch(quizRoute, /\.select\("\*"/);
assert.doesNotMatch(quizItemRoute, /\.select\("\*"/);
assert.doesNotMatch(quizCategoriesRoute, /\.select\("\*"/);
assert.match(quizStorage, /quizCategoriesRequest \?\?=/);
assert.match(adminQuizClient, /quizSearchDebounceMs = 250/);
assert.match(adminQuizClient, /setSearchQuery\(searchText\.trim\(\)\)/);
assert.match(adminQuizClient, /\[page, searchQuery, selectedCategory, selectedLevel\]/);

console.log("Admin quiz performance assertions passed.");
