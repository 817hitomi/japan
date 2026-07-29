import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  handleNoteOgRequest,
  isValidNoteOgSlug,
  noteOgMaxSlugLength,
  noteOgNegativeCacheControl,
  noteOgPositiveCacheControl
} from "../lib/noteOgRequest.ts";
import {
  isTransientCloudflareError,
  withReadRetry
} from "../lib/cloudflareReadRetry.ts";

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
  },
  logger() {}
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

let retryingReadCalls = 0;
let retryingRenderCalls = 0;
let retryingWriteCalls = 0;
const retryLogs: string[] = [];
const retrySuccessResponse = await handleNoteOgRequest(
  new Request("https://japan-note.com/api/notes/og?slug=retry-then-success", {
    headers: { "cf-ray": "test-request-id" }
  }),
  {
    async findNote(slug): Promise<Note> {
      retryingReadCalls += 1;
      if (retryingReadCalls === 1) {
        throw new Error("Network connection lost.");
      }
      return { slug };
    },
    renderNote(note) {
      retryingRenderCalls += 1;
      return new Response(`og:${note.slug}`, {
        headers: { "Content-Type": "image/png" }
      });
    },
    logger(message) {
      retryLogs.push(message);
    },
    retry: {
      random: () => 0,
      sleep: async () => {}
    }
  }
);
assert.equal(retrySuccessResponse.status, 200, "a transient first read failure must recover");
assert.equal(retryingReadCalls, 2, "the transient public read must retry once before succeeding");
assert.equal(retryingRenderCalls, 1, "a recovered database read must render exactly once");
assert.equal(retryingWriteCalls, 0, "read retries must not execute any write operation");
assert.ok(
  retryLogs.some((message) => {
    const log = JSON.parse(message);
    return (
      log.event === "error" &&
      log.route === "/api/notes/og" &&
      log.slug === "retry-then-success" &&
      log.stage === "supabase-public-note-read" &&
      log.attempt === 1 &&
      log.errorName === "Error" &&
      log.errorMessage === "Network connection lost." &&
      log.errorCauseMessage === "" &&
      log.requestId === "test-request-id"
    );
  }),
  "transient failures must emit the required safe diagnostic fields"
);

let exhaustedReadCalls = 0;
const exhaustedResponse = await handleNoteOgRequest(
  new Request("https://japan-note.com/api/notes/og?slug=always-fails"),
  {
    async findNote() {
      exhaustedReadCalls += 1;
      throw new Error("storage caused object to be reset");
    },
    renderNote() {
      throw new Error("render must not run after an exhausted database read");
    },
    logger() {},
    retry: {
      maxAttempts: 3,
      random: () => 0,
      sleep: async () => {}
    }
  }
);
assert.equal(exhaustedReadCalls, 3, "a permanently transient read failure must stop after three attempts");
assert.equal(exhaustedResponse.status, 503, "exhausted transient failures must return a stable 503");
assert.equal(exhaustedResponse.headers.get("cache-control"), "no-store, max-age=0");
assert.equal(exhaustedResponse.headers.get("retry-after"), "5");
assert.equal((await exhaustedResponse.json()).retryable, true);

let nonTransientCalls = 0;
await assert.rejects(
  withReadRetry(
    async () => {
      nonTransientCalls += 1;
      throw new Error("permission denied");
    },
    {
      route: "/api/notes/og",
      slug: "no-retry",
      stage: "test-read",
      requestId: "non-transient",
      logger() {},
      sleep: async () => {}
    }
  ),
  /permission denied/
);
assert.equal(nonTransientCalls, 1, "non-transient errors must not be retried");
assert.equal(
  isTransientCloudflareError(
    new Error("outer", { cause: new Error("Cannot resolve D1 DB due to transient issue") })
  ),
  true,
  "transient detection must inspect Error.cause"
);

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
const previewReadSource =
  publicDataSource.match(
    /export async function readPublishedNotePreviewByRouteKey[\s\S]*?\n}\n/
  )?.[0] ?? "";
assert.doesNotMatch(
  previewReadSource,
  /\.(?:insert|update|upsert|delete)\(/,
  "the retried OG note lookup must remain read-only"
);

const workerSource = readFileSync(new URL("../custom-worker.ts", import.meta.url), "utf8");
const ogCacheLookupIndex = workerSource.indexOf("cloudflare-cache-read");
const openNextRenderIndex = workerSource.indexOf("renderWithOpenNext(routedRequest)");
assert.ok(ogCacheLookupIndex >= 0, "the OG route must perform an explicit Cloudflare Cache API lookup");
assert.ok(
  ogCacheLookupIndex < openNextRenderIndex,
  "an OG cache hit must be checked before database access or image generation"
);
assert.match(
  workerSource,
  /await workerCache\.put\(sharedCacheKey, cacheableResponse\.clone\(\)\)/,
  "a successful OG image must be written to the edge cache"
);
assert.doesNotMatch(
  workerSource.match(/const cacheWrite = async \(\) => \{[\s\S]*?\n      \};/)?.[0] ?? "",
  /withReadRetry/,
  "Cache API writes must not inherit the read retry policy"
);

console.log(
  `note OG security assertions passed; invalid=${invalidQueries.length}; databaseCalls=${databaseCalls}; renderCalls=${renderCalls}`
);
