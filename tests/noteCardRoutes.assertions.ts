import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { preparePublicNoteCards } from "../app/notes/noteTypes.ts";
import type { PublicNoteRecord } from "../app/notes/noteTypes.ts";

function note(id: number, slug: string): PublicNoteRecord {
  return {
    id,
    category: "N5",
    title: `Note ${id}`,
    summary: "",
    status: "published" as PublicNoteRecord["status"],
    date: "2026-07-26",
    slug,
    tags: "",
    coverUrl: "",
    blocks: []
  };
}

const duplicateCards = preparePublicNoteCards([
  note(26, "daily-words-2026-07-25"),
  note(25, "daily-words-2026-07-25")
]);

assert.deepEqual(
  duplicateCards.map((card) => [card.slug, card.coverUrl]),
  [
    ["", "/api/notes/og?slug=26"],
    ["", "/api/notes/og?slug=25"]
  ],
  "duplicate slugs must fall back to each note id so links and images cannot resolve to another article"
);

const uniqueCards = preparePublicNoteCards([
  note(26, "daily-words-2026-07-26"),
  note(25, "daily-words-2026-07-25")
]);

assert.deepEqual(
  uniqueCards.map((card) => [card.slug, card.coverUrl]),
  [
    ["daily-words-2026-07-26", "/api/notes/og?slug=daily-words-2026-07-26"],
    ["daily-words-2026-07-25", "/api/notes/og?slug=daily-words-2026-07-25"]
  ],
  "unique slugs must keep their readable public route keys"
);

const editorSource = readFileSync(new URL("../app/admin/notes/AdminNotesClient.tsx", import.meta.url), "utf8");
const newModeReset = editorSource.match(/if \(mode === "new"\) \{([\s\S]*?)\n\s+return;/)?.[1] ?? "";

for (const resetCall of [
  'setTitle("")',
  'setSummary("")',
  'setCategory("")',
  'setSlug("")',
  'setTags("")',
  'setCoverUrl("")',
  "setBlocks(cloneBlocks(initialBlocks))"
]) {
  assert.ok(newModeReset.includes(resetCall), `new-note mode must reset stale editor state with ${resetCall}`);
}

console.log("note card route assertions passed");
