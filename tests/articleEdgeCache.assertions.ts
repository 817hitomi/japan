import assert from "node:assert/strict";
import {
  articleCacheInvalidationHeader,
  getArticleCacheInvalidationKeys,
  getArticleEdgeCacheKey,
  getInvalidArticleSlugResponse,
  handleArticleEdgeCache,
  isArticleHtmlRequest,
  purgeArticleEdgeCache,
  type WorkerCacheLike
} from "../lib/articleEdgeCache.ts";
import { canonicalSiteOrigin, getCanonicalRedirect } from "../lib/canonicalRequest.ts";

class MemoryCache implements WorkerCacheLike {
  objects = new Map<string, { body: ArrayBuffer; headers: Headers; status: number; statusText: string }>();
  reads = 0;
  writes = 0;
  deletes = 0;

  async match(request: Request) {
    this.reads += 1;
    const value = this.objects.get(request.url);
    if (!value) return undefined;
    return new Response(value.body.slice(0), {
      status: value.status,
      statusText: value.statusText,
      headers: new Headers(value.headers)
    });
  }

  async put(request: Request, response: Response) {
    this.writes += 1;
    this.objects.set(request.url, {
      body: await response.arrayBuffer(),
      headers: new Headers(response.headers),
      status: response.status,
      statusText: response.statusText
    });
  }

  async delete(request: Request) {
    this.deletes += 1;
    return this.objects.delete(request.url);
  }
}

function articleRequest(path = "/notes/n5-test", init: RequestInit = {}) {
  return new Request(`${canonicalSiteOrigin}${path}`, {
    ...init,
    headers: { Accept: "text/html", ...Object.fromEntries(new Headers(init.headers)) }
  });
}

for (const source of [
  "http://japan-note.com/notes/a?x=1",
  "http://www.japan-note.com/notes/a?x=1",
  "https://japan-note.com/notes/a?x=1"
]) {
  const redirect = getCanonicalRedirect(new Request(source));
  assert(redirect);
  assert.equal(redirect.status, 308);
  assert.equal(redirect.headers.get("location"), `${canonicalSiteOrigin}/notes/a?x=1`);
}

const cache = new MemoryCache();
const logs: Record<string, unknown>[] = [];
let renderCalls = 0;
let databaseQueries = 0;
let renderedUrl = "";
const render = async (request: Request) => {
  renderCalls += 1;
  databaseQueries += 5;
  renderedUrl = request.url;
  return new Response(`<html>render-${renderCalls}</html>`, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Set-Cookie": "must-not-cache=1" }
  });
};
const options = { cache, render, logger: (message: string) => logs.push(JSON.parse(message)) };

const first = await handleArticleEdgeCache(articleRequest(), options);
assert.equal(first.headers.get("x-japannote-cache"), "MISS");
assert.match(await first.text(), /render-1/);
assert.equal(renderCalls, 1);
assert.equal(databaseQueries, 5);
assert.equal(renderedUrl, `${canonicalSiteOrigin}/notes/n5-test`);
assert.equal(cache.writes, 1);
assert.equal(cache.objects.values().next().value?.headers.get("set-cookie"), null);

const second = await handleArticleEdgeCache(articleRequest(), options);
assert.equal(second.headers.get("x-japannote-cache"), "HIT");
assert.match(await second.text(), /render-1/);
assert.equal(renderCalls, 1, "a cache hit must not run SSR");
assert.equal(databaseQueries, 5, "a cache hit must execute zero database queries");

for (const query of [
  "?share=anything",
  "?utm_source=youtube&utm_campaign=test",
  "?fbclid=abc&utm_medium=social",
  "?share=x&utm_content=y&gclid=z"
]) {
  const response = await handleArticleEdgeCache(articleRequest(`/notes/n5-test${query}`), options);
  assert.equal(response.headers.get("x-japannote-cache"), "HIT", `${query} must reuse canonical HTML`);
  assert.equal(await response.text(), "<html>render-1</html>");
}
assert.equal(renderCalls, 1);
assert.equal(databaseQueries, 5);

const head = await handleArticleEdgeCache(articleRequest("/notes/n5-test", { method: "HEAD" }), options);
assert.equal(head.headers.get("x-japannote-cache"), "HIT");
assert.equal(await head.text(), "");
assert.equal(renderCalls, 1);

const preview = await handleArticleEdgeCache(articleRequest("/notes/n5-test?preview=1"), options);
assert.equal(preview.headers.get("x-japannote-cache"), "BYPASS");
assert.equal(renderCalls, 2, "unknown content query must bypass, not create another cache entry");
assert.equal(cache.objects.size, 1);

assert.equal(isArticleHtmlRequest(articleRequest("/notes/n5-test", { method: "POST" })), false);
assert.equal(isArticleHtmlRequest(new Request(`${canonicalSiteOrigin}/admin`, { headers: { Accept: "text/html" } })), false);
assert.equal(isArticleHtmlRequest(new Request(`${canonicalSiteOrigin}/api/notes`, { headers: { Accept: "text/html" } })), false);
assert.equal(isArticleHtmlRequest(articleRequest("/notes/n5-test?_rsc=abc")), false);

for (const path of [
  "/notes/'-or-1=1",
  "/notes/%27%20or%201%3D1--",
  "/notes/n5-test;drop-table",
  "/notes/too/many",
  `/notes/${"a".repeat(101)}`
]) {
  const response = getInvalidArticleSlugResponse(articleRequest(path));
  assert(response, `${path} must be rejected before SSR`);
  assert.equal(response.status, 400);
}
assert.equal(getInvalidArticleSlugResponse(articleRequest("/notes/n5-valid-slug")), null);
assert.equal(getInvalidArticleSlugResponse(articleRequest("/notes/123")), null);

const concurrentCache = new MemoryCache();
let concurrentRenders = 0;
const concurrentOptions = {
  cache: concurrentCache,
  logger: () => undefined,
  render: async () => {
    concurrentRenders += 1;
    await new Promise((resolve) => setTimeout(resolve, 20));
    return new Response("<html>coalesced</html>", { headers: { "Content-Type": "text/html" } });
  }
};
const concurrent = await Promise.all(
  Array.from({ length: 12 }, () => handleArticleEdgeCache(articleRequest("/notes/coalesced"), concurrentOptions))
);
await Promise.all(concurrent.map((response) => response.text()));
assert.equal(concurrentRenders, 1, "same-isolate cold requests must share one SSR");
assert.equal(concurrentCache.writes, 1);

const failingCache = new MemoryCache();
failingCache.put = async () => { throw new Error("Cache unavailable"); };
const fallback = await handleArticleEdgeCache(articleRequest("/notes/cache-failure"), {
  cache: failingCache,
  logger: () => undefined,
  render: async () => new Response("<html>fallback</html>", { headers: { "Content-Type": "text/html" } })
});
assert.equal(fallback.headers.get("x-japannote-cache"), "BYPASS");
assert.equal(await fallback.text(), "<html>fallback</html>");

const purged = await purgeArticleEdgeCache(cache, ["n5-test", "n5-test"]);
assert.equal(purged, 1);
assert.equal(cache.objects.size, 0);
const afterPurge = await handleArticleEdgeCache(articleRequest(), options);
assert.equal(afterPurge.headers.get("x-japannote-cache"), "MISS");
assert.equal(renderCalls, 3);

const invalidationResponse = new Response(null, {
  headers: { [articleCacheInvalidationHeader]: "n5-test,123,n5-test,not_valid" }
});
assert.deepEqual(getArticleCacheInvalidationKeys(invalidationResponse), ["n5-test", "123"]);
assert.equal(
  getArticleEdgeCacheKey("/notes/n5-test").url,
  `${canonicalSiteOrigin}/notes/n5-test?__japannote_article_html=v2`
);
assert(logs.some((entry) => entry.cacheStatus === "MISS"));
assert(logs.some((entry) => entry.cacheStatus === "HIT" && entry.ssrWallMs === 0));

console.log("article edge cache assertions passed");