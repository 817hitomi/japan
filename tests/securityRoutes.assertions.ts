import {
  createSecurityFirstFetchHandler,
  isBlockedScannerPath,
  isBlockedSensitivePath,
  isDisallowedProductionHost
} from "../lib/securityFirstRequest.ts";
import { readFileSync } from "node:fs";

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

const blockedScannerPaths = [
  "/wp-login.php",
  "/WP-LOGIN.PHP",
  "/index.php",
  "/nested/file.php",
  "/nested/file.php/",
  "/wp-admin",
  "/wp-admin/",
  "/nested/wp-admin",
  "/wp-content/plugins/example.js",
  "/wp-includes/js/example.js",
  "/xmlrpc.php"
];

const allowedScannerPaths = [
  "/notes/php-basics",
  "/images/php-logo.png",
  "/wp-administrator",
  "/wp-contents",
  "/articles/xmlrpc"
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

const disallowedHostUrls = [
  "https://japan-note.com:2083/",
  "https://japan-note.com:8443/login_up.php",
  "https://www.japan-note.com:2083/",
  "https://example.com/",
  "https://japannote.workers.dev/"
];

const allowedHostUrls = [
  "https://japan-note.com/",
  "https://www.japan-note.com/",
  "http://localhost:3000/",
  "http://127.0.0.1:3000/",
  "http://[::1]:3000/"
];

for (const requestUrl of disallowedHostUrls) {
  const request = new Request(requestUrl);
  assert(isDisallowedProductionHost(request), `${requestUrl} must be rejected before routing`);
  const callsBefore = downstreamCalls;
  const response = await fetchHandler(request, {}, {});
  const body = await response.text();

  assert(response.status === 404, `${requestUrl} must return 404`);
  assert(response.headers.get("content-type") === "text/plain; charset=utf-8", `${requestUrl} must return text/plain`);
  assert(response.headers.get("cache-control") === "public, max-age=86400", `${requestUrl} must use fast-404 caching`);
  assert(response.headers.get("content-length") === "9", `${requestUrl} must declare 9 bytes`);
  assert(body === "Not Found", `${requestUrl} must return the fixed body`);
  assert(downstreamCalls === callsBefore, `${requestUrl} must not invoke OpenNext or any downstream work`);
}

for (const requestUrl of allowedHostUrls) {
  const request = new Request(requestUrl);
  assert(!isDisallowedProductionHost(request), `${requestUrl} must preserve normal routing`);
  const callsBefore = downstreamCalls;
  const response = await fetchHandler(request, {}, {});
  assert(response.status === 200, `${requestUrl} must reach the existing handler`);
  assert(downstreamCalls === callsBefore + 1, `${requestUrl} must invoke the existing handler exactly once`);
}

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

for (const path of blockedScannerPaths) {
  assert(isBlockedScannerPath(path), `${path} must be classified as a scanner path`);
  const callsBefore = downstreamCalls;
  const response = await fetchHandler(new Request(`https://japan-note.com${path}`), {}, {});
  const body = await response.text();

  assert(response.status === 404, `${path} must return 404`);
  assert(response.headers.get("content-type") === "text/plain; charset=utf-8", `${path} must return text/plain`);
  assert(response.headers.get("cache-control") === "public, max-age=86400", `${path} must use one-day caching`);
  assert(response.headers.get("content-length") === "9", `${path} must declare 9 bytes`);
  assert(body === "Not Found", `${path} must return the fixed body`);
  assert(!body.includes("__next_f"), `${path} must not contain Next.js or RSC output`);
  assert(downstreamCalls === callsBefore, `${path} must not invoke OpenNext, middleware, auth, Supabase, SSR, or RSC`);
}

for (const path of allowedScannerPaths) {
  assert(!isBlockedScannerPath(path), `${path} must not be classified as a scanner path`);
}

for (const path of allowedPaths) {
  assert(!isBlockedSensitivePath(path), `${path} must not be classified as sensitive`);
  const callsBefore = downstreamCalls;
  const response = await fetchHandler(new Request(`https://japan-note.com${path}`), {}, {});
  assert(response.status === 200, `${path} must reach the existing handler`);
  assert(downstreamCalls === callsBefore + 1, `${path} must preserve existing routing`);
}

assert(
  logEntries.length === blockedPaths.length + blockedScannerPaths.length + disallowedHostUrls.length,
  "each blocked request must emit exactly one security log"
);
for (const entry of logEntries.filter((candidate) => candidate.reason === "blocked-sensitive-path")) {
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

for (const entry of logEntries.filter((candidate) => candidate.reason === "blocked-scanner-path")) {
  assert(entry.source === "japannote", "scanner log source must be japannote");
  assert(entry.stage === "worker-route", "scanner rejection must happen at the outer Worker stage");
  assert(entry.branch === "fast-404", "scanner log branch must be fast-404");
  assert(entry.status === 404, "scanner log status must be 404");
  assert(typeof entry.elapsedMs === "number" && entry.elapsedMs >= 0, "scanner log must include elapsedMs");
}

for (const entry of logEntries.filter((candidate) => candidate.reason === "disallowed-production-host")) {
  assert(entry.source === "japannote", "host log source must be japannote");
  assert(entry.stage === "worker-route", "host log must identify the worker stage");
  assert(entry.branch === "fast-404", "host log branch must be fast-404");
  assert(entry.status === 404, "host log status must be 404");
  assert(typeof entry.elapsedMs === "number" && entry.elapsedMs >= 0, "host log must include elapsedMs");
  assert(!("pathname" in entry), "host log must not inspect or record the route before rejecting the host");
}

const middlewareSource = readFileSync(new URL("../middleware.ts", import.meta.url), "utf8");
assert(
  middlewareSource.indexOf("isDisallowedProductionHost(request)") < middlewareSource.indexOf("request.headers.set"),
  "middleware host rejection must run before request mutation, routing, auth, or Supabase"
);

const customWorkerSource = readFileSync(new URL("../custom-worker.ts", import.meta.url), "utf8");
assert(
  !/^import\s+openNextWorker\s+from\s+["']\.\/\.open-next\/worker\.js["'];/m.test(customWorkerSource),
  "the outer Worker must not load OpenNext before scanner classification"
);
assert(
  customWorkerSource.includes('import("./.open-next/worker.js")'),
  "OpenNext must be loaded lazily only after the outer security handler allows the request"
);

const wranglerConfig = JSON.parse(readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8")) as {
  routes?: Array<{ pattern?: string; custom_domain?: boolean }>;
};
assert(
  JSON.stringify(wranglerConfig.routes) === JSON.stringify([
    { pattern: "japan-note.com", custom_domain: true },
    { pattern: "www.japan-note.com", custom_domain: true }
  ]),
  "Cloudflare routes must contain only the apex and www production custom domains"
);

console.table(results);
console.log(
  `security route assertions passed; blockedPaths=${blockedPaths.length}; blockedScanners=${blockedScannerPaths.length}; blockedHosts=${disallowedHostUrls.length}; allowed=${allowedPaths.length + allowedScannerPaths.length + allowedHostUrls.length}`
);
