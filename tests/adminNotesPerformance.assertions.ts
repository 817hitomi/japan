import assert from "node:assert/strict";
import fs from "node:fs";

const notesRoute = fs.readFileSync(new URL("../app/api/notes/route.ts", import.meta.url), "utf8");
const noteRoute = fs.readFileSync(new URL("../app/api/notes/[id]/route.ts", import.meta.url), "utf8");
const noteMapper = fs.readFileSync(new URL("../app/api/notes/noteMapper.ts", import.meta.url), "utf8");
const adminNotesClient = fs.readFileSync(new URL("../app/admin/notes/AdminNotesClient.tsx", import.meta.url), "utf8");
const adminNotesPage = fs.readFileSync(new URL("../app/admin/notes/page.tsx", import.meta.url), "utf8");

assert.match(
  noteMapper,
  /adminNoteListSelect = "id,category,title,status,published_date,slug,tags"/,
  "The admin list projection should exclude large article blocks."
);
assert.match(notesRoute, /status === "published" \? publicNoteSummarySelect : adminNoteListSelect/);
assert.match(notesRoute, /\.select\(selectColumns,[\s\S]*?\{ count: "exact" \}/);
assert.match(notesRoute, /\.range\(from, from \+ pageSize - 1\)/);
assert.match(notesRoute, /\.insert\(noteToPayload\(note\)\)[\s\S]*?\.select\(adminNoteListSelect\)/);
assert.match(noteRoute, /\.update\(noteToPayload\([\s\S]*?\.select\(adminNoteListSelect\)/);
assert.match(
  adminNotesClient,
  /Promise\.all\(\[[\s\S]*?readNotesWithSource\("all", \{ page: 1, pageSize: 1, includeCategories: true \}\)[\s\S]*?readNoteWithSource\(noteId\)/,
  "The editor should load one full article separately from lightweight list metadata."
);
assert.doesNotMatch(adminNotesClient, /\.slice\(\(page - 1\) \* perPage/);
assert.match(adminNotesClient, /href=\{getAdminNotesPageHref\(item\)\}/);
assert.match(adminNotesClient, /prefetch=\{false\}/);
assert.match(adminNotesClient, /aria-label="上一頁"[\s\S]*?visiblePages\.map[\s\S]*?aria-label="下一頁"/);
assert.doesNotMatch(adminNotesClient, /onClick=\{\(\) => setPage\(item\)\}/);
assert.match(adminNotesPage, /initialPage=\{normalizePage\(page\)\}/);

console.log("Admin notes performance assertions passed.");
