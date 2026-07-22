import {
  createSecurityFirstFetchHandler,
  isBlockedSensitivePath
} from "../lib/securityFirstRequest.ts";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const blockedPaths = [
  "/.git/config",
  "/staging/.git/config",
  "/brand/.git/config",
  "/admin/.git/config",
  "/admin/tools/.git/config",
  "/a/b/c/.git/config",
  "/_next/static/.git/config",
  "/_next/image/.git/config",
  "/.env",
  "/a/.env.production",
  "/a/node_modules/pkg/index.js",
  "/wrangler.toml",
  "/a/b/wrangler.toml",
  "/package.json",
  "/a/b/package.json",
  "/package-lock.json",
  "/pnpm-lock.yaml",
  "/yarn.lock",
  "/src",
  "/backup/archive.sql",
  "/staging/index.html",
  "/brand/%2egit/config",
  "/brand/%252egit/config"
];

const allowedPaths = [
  "/",
  "/notes/n5-grammar-wa-desu",
  "/favicon.ico",
  "/robots.txt",
  "/sitemap.xml",
  "/ads.txt",
  "/brand/japannote-badge.png",
  "/_next/static/chunks/main.js",
  "/_next/image?url=%2Fbrand%2Flogo_b.png&w=64&q=75",
  "/admin",
  "/admin/notes",
  "/.github",
  "/articles/git",
  "/images/staging-photo.jpg",
  "/articles/package-json-guide"
];

let downstreamCalls = 0;
const logEntries: Record<string, unknown>[] = [];
const fetchHandler = createSecurityFirstFetchHandler(
  (request: Request) => {
    downstreamCalls += 1;
    return new Response(new URL(request.url).pathname, {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" }
    });
  },
  (message) => logEntries.push(JSON.parse(message) as Record<string, unknown>)
);

const results: Array<{ path: string; status: number; contentType: string; bytes: number }> = [];

for (const path of blockedPaths) {
  assert(isBlockedSensitivePath(path), `${path} must be classified as sensitive`);
  const callsBefore = downstreamCalls;
  const response = await fetchHandler(new Request(`https://japan-note.com${path}`), {}, {});
  const body = await response.text();
  const bytes = new TextEncoder().encode(body).byteLength;

  assert(response.status === 404, `${path} must return 404`);
  assert(response.headers.get("content-type") === "text/plain; charset=utf-8", `${path} must return text/plain`);
  assert(response.headers.get("cache-control") === "public, max-age=86400", `${path} must use fast-404 caching`);
  assert(response.headers.get("content-length") === "9", `${path} must declare 9 bytes`);
  assert(bytes === 9, `${path} must return exactly 9 bytes`);
  assert(body === "Not Found", `${path} must return the fixed body`);
  assert(!body.includes("__next_f"), `${path} must not contain Next.js HTML`);
  assert(downstreamCalls === callsBefore, `${path} must not invoke OpenNext, auth, Supabase, layout, or rendering`);

  results.push({ path, status: response.status, contentType: response.headers.get("content-type") ?? "", bytes });
}

for (const path of allowedPaths) {
  assert(!isBlockedSensitivePath(path), `${path} must not be classified as sensitive`);
  const callsBefore = downstreamCalls;
  const response = await fetchHandler(new Request(`https://japan-note.com${path}`), {}, {});
  assert(response.status === 200, `${path} must reach the existing handler`);
  assert(downstreamCalls === callsBefore + 1, `${path} must preserve existing routing`);
}

assert(logEntries.length === blockedPaths.length, "each blocked request must emit exactly one security log");
for (const entry of logEntries) {
  assert(entry.source === "japannote", "security log source must be japannote");
  assert(entry.stage === "worker-route", "outer security log must identify the worker stage");
  assert(entry.branch === "fast-404", "security log branch must be fast-404");
  assert(entry.reason === "blocked-sensitive-path", "security log reason must be blocked-sensitive-path");
  assert(entry.status === 404, "security log status must be 404");
  assert(typeof entry.elapsedMs === "number" && entry.elapsedMs >= 0, "security log must include elapsedMs");
  assert(Object.keys(entry).sort().join(",") === [
    "branch", "elapsedMs", "method", "pathname", "reason", "source", "stage", "status"
  ].sort().join(","), "security log must not contain cookies, authorization, tokens, or query values");
}

console.table(results);
console.log(`security route assertions passed; blocked=${blockedPaths.length}; allowed=${allowedPaths.length}`);
