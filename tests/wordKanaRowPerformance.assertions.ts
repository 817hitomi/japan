import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const adminSource = readFileSync("app/admin/words/AdminWordsClient.tsx", "utf8");
const mapperSource = readFileSync("app/api/words/wordMapper.ts", "utf8");
const publicDataSource = readFileSync("app/publicData.ts", "utf8");
const migrationSource = readFileSync("supabase/migrations/202607280001_word_cards_kana_row.sql", "utf8");

assert.match(adminSource, /<span>五十音分類<\/span>/, "admin editor must expose the manual kana-row field");
assert.match(adminSource, /value=\{draft\.kanaRow\}/, "admin editor must bind the selected kana row");
assert.match(mapperSource, /kana_row:\s*normalized\.kanaRow/, "word writes must persist kana_row");
assert.match(mapperSource, /kanaRow:\s*row\.kana_row/, "word reads must restore kana_row");

assert.match(publicDataSource, /table:\s*"public_word_facets"/, "public word facets must use the aggregate view");
assert.match(publicDataSource, /queryParams\.kana_row\s*=\s*`eq\.\$\{kanaRow\}`/, "public kana filtering must happen in Postgres");
assert.doesNotMatch(publicDataSource, /matchingIds/, "public word pages must not build a full matching-id list in the Worker");
assert.doesNotMatch(publicDataSource, /for \(let from = 0; ; from \+= batchSize\)/, "public word pages must not batch-read every word");

assert.match(migrationSource, /add column if not exists kana_row text not null default ''/, "migration must add kana_row");
assert.match(migrationSource, /with \(security_invoker = true\)/, "aggregate view must preserve underlying RLS");
assert.match(migrationSource, /word_cards_category_kana_row_id_idx/, "filtered pagination must have a composite index");

console.log("word kana-row performance assertions passed");
