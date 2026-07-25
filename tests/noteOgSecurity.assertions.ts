import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  handleNoteOgRequest,
  isValidNoteOgSlug,
  noteOgMaxSlugLength,
  noteOgNegativeCacheControl,
  noteOgPositiveCacheControl
} from "../lib/noteOgRequest.ts";

type Note = { slug: string };

let databaseCalls = 0;
let renderCalls = 0;

const dependencies = {
  async findNote(slug: string): Promise<Note | null> {
    databaseCalls += 1;
    return slug === "daily-words-2026-07-25" ? { slug } : null;
  },
  renderNote(note: Note) {
    renderCalls += 1;
    return new Response(`og:${note.slug}`, {
      status: 200,
      headers: { "Content-Type": "image/png" }
    });
  }
};

async function request(query = "") {
  return handleNoteOgRequest(
    new Request(`https://japan-note.com/api/notes/og${query}`),
    dependencies
  );
}

const validResponse = await request("?slug=daily-words-2026-07-25");
assert.equal(validResponse.status, 200, "an existing valid slug must return the rendered OG response");
assert.equal(await validResponse.text(), "og:daily-words-2026-07-25");
assert.equal(validResponse.headers.get("cache-control"), noteOgPositiveCacheControl);
assert.equal(databaseCalls, 1, "a valid slug must execute one database lookup");
assert.equal(renderCalls, 1, "an existing note must execute one OG render");

const missingResponse = await request("?slug=valid-but-missing");
assert.equal(missingResponse.status, 404, "a missing valid slug must return 404");
assert.equal(missingResponse.headers.get("cache-control"), noteOgNegativeCacheControl);
assert.equal(databaseCalls, 2, "a missing valid slug must execute one database lookup");
assert.equal(renderCalls, 1, "a missing note must not render a fallback OG image");

const invalidQueries = [
  ["empty slug", ""],
  ["explicit empty slug", "?slug="],
  ["overlong slug", `?slug=${"a".repeat(noteOgMaxSlugLength + 1)}`],
  ["single quote", "?slug=daily-words-2026-07-25'"],
  ["URL encoded single quote", "?slug=daily-words-2026-07-25%27"],
  [
    "reported injection scan",
    "?slug=daily-words-2026-07-25%27%29%20as%20tempxtestxtable%20where%201%3D1--%20-"
  ],
  ["where 1=1", "?slug=where%201%3D1"],
  ["SQL comment", "?slug=daily-words--2026"],
  ["Unicode", "?slug=%E6%97%A5%E6%9C%AC%E8%AA%9E"],
  ["space", "?slug=daily%20words"]
] as const;

for (const [label, query] of invalidQueries) {
  const callsBefore: number = databaseCalls;
  const rendersBefore: number = renderCalls;
  const response = await request(query);

  assert.equal(response.status, 400, `${label} must return 400`);
  assert.equal(response.headers.get("cache-control"), noteOgNegativeCacheControl);
  assert.equal(databaseCalls, callsBefore, `${label} must not query the database`);
  assert.equal(renderCalls, rendersBefore, `${label} must not render or fetch an image`);
}

for (const slug of ["a", "1", "daily-words-2026-07-25", "a".repeat(noteOgMaxSlugLength)]) {
  assert.equal(isValidNoteOgSlug(slug), true, `${slug} must be valid`);
}

for (const slug of ["A", "-a", "a-", "a--b", "a_b", "a b", "日本語"]) {
  assert.equal(isValidNoteOgSlug(slug), false, `${slug} must be invalid`);
}

const publicDataSource = readFileSync(new URL("../app/publicData.ts", import.meta.url), "utf8");
assert.match(
  publicDataSource,
  /\.eq\("slug", key\)/,
  "slug lookups must use the Supabase ORM parameterized equality condition"
);
assert.doesNotMatch(
  publicDataSource,
  /slug:\s*`eq\.\$\{key\}`/,
  "slug lookups must not assemble PostgREST filter strings"
);
assert.doesNotMatch(publicDataSource, /sql\.raw|\.raw\(/, "slug lookup code must not use raw SQL");

console.log(
  `note OG security assertions passed; invalid=${invalidQueries.length}; databaseCalls=${databaseCalls}; renderCalls=${renderCalls}`
);
