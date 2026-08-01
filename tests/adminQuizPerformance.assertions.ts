import assert from "node:assert/strict";
import fs from "node:fs";

const quizRoute = fs.readFileSync(new URL("../app/api/quiz/route.ts", import.meta.url), "utf8");
const quizItemRoute = fs.readFileSync(new URL("../app/api/quiz/[id]/route.ts", import.meta.url), "utf8");
const quizCategoriesRoute = fs.readFileSync(new URL("../app/api/quiz/categories/route.ts", import.meta.url), "utf8");
const quizMapper = fs.readFileSync(new URL("../app/api/quiz/quizMapper.ts", import.meta.url), "utf8");
const quizStorage = fs.readFileSync(new URL("../app/quiz/quizStorage.ts", import.meta.url), "utf8");
const adminQuizClient = fs.readFileSync(new URL("../app/admin/quiz/AdminQuizClient.tsx", import.meta.url), "utf8");
const adminQuizPage = fs.readFileSync(new URL("../app/admin/quiz/page.tsx", import.meta.url), "utf8");
const applyTextColor = adminQuizClient.slice(
  adminQuizClient.indexOf("function applyTextColor"),
  adminQuizClient.indexOf("function toggleTextBold")
);
const toggleTextBold = adminQuizClient.slice(
  adminQuizClient.indexOf("function toggleTextBold"),
  adminQuizClient.indexOf("function changeCategory")
);

assert.match(quizMapper, /quizDistractorCandidateSelect = "answer,options"/);
assert.match(quizRoute, /\.select\(quizDistractorCandidateSelect\)/);
assert.match(quizRoute, /\.select\(quizQuestionSelect, \{ count: "exact" \}\)/);
assert.match(quizRoute, /query\.range\(from, to\)/);
assert.match(quizItemRoute, /\.select\(quizDistractorCandidateSelect\)/);
assert.doesNotMatch(quizRoute, /\.select\("\*"/);
assert.doesNotMatch(quizItemRoute, /\.select\("\*"/);
assert.doesNotMatch(quizCategoriesRoute, /\.select\("\*"/);
assert.match(quizStorage, /quizCategoriesRequest \?\?=/);
assert.match(adminQuizClient, /quizSearchDebounceMs = 250/);
assert.match(adminQuizClient, /setSearchQuery\(searchText\.trim\(\)\)/);
assert.match(adminQuizClient, /\[page, searchQuery, selectedCategory, selectedLevel, selectedQuestionType\]/);
assert.match(adminQuizClient, /href=\{getAdminQuizPageHref\(\{/);
assert.match(adminQuizClient, /<td>\{question\.questionType\}<\/td>/);
assert.match(adminQuizClient, /prefetch=\{false\}/);
assert.doesNotMatch(adminQuizClient, /onClick=\{\(\) => changePage\(/);
assert.match(adminQuizPage, /initialPage=\{normalizePage\(resolvedSearchParams\?\.page\)\}/);
assert.match(applyTextColor, /editor\.focus\(\)/);
assert.match(applyTextColor, /document\.execCommand\("foreColor", false, color\)/);
assert.doesNotMatch(applyTextColor, /setDraft|setMessage/);
assert.match(toggleTextBold, /editor\.focus\(\)/);
assert.match(toggleTextBold, /document\.execCommand\("bold"\)/);
assert.doesNotMatch(toggleTextBold, /setDraft|setMessage/);
assert.match(adminQuizClient, /onMouseDown=\{\(event\) => event\.preventDefault\(\)\}/);
assert.doesNotMatch(adminQuizClient, /captureEditorSelection|restoreEditorSelection|QuizTextSelection|syncEditableDraft/);
assert.match(adminQuizClient, /onBlur=\{\(event\) => handleEditableBlur\("prompt", event\.currentTarget\)\}/);
assert.match(adminQuizClient, /onBlur=\{\(event\) => handleEditableBlur\("note", event\.currentTarget\)\}/);

console.log("Admin quiz performance assertions passed.");
