import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { WorkerCacheLike } from "../lib/articleEdgeCache.ts";
import { canonicalSiteOrigin } from "../lib/canonicalRequest.ts";
import {
  getSitemapEdgeCacheKey,
  handleSitemapEdgeCache,
  purgeSitemapEdgeCache
} from "../lib/sitemapEdgeCache.ts";
import { createSitemapXml } from "../lib/sitemapXml.ts";

class MemoryCache implements WorkerCacheLike {
  objects = new Map<string, { body: ArrayBuffer; headers: Headers; status: number; statusText: string }>();
  writes = 0;

  async match(request: Request) {
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
    return this.objects.delete(request.url);
  }
}

function sitemapRequest(userAgent: string, init: RequestInit = {}) {
  return new Request(`${canonicalSiteOrigin}/sitemap.xml?ignored=1`, {
    ...init,
    headers: {
      Accept: "application/xml",
      Cookie: "session=must-not-vary",
      "User-Agent": userAgent,
      ...Object.fromEntries(new Headers(init.headers))
    }
  });
}

function assertValidSitemapXml(xml: string) {
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(xml, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
  assert.equal((xml.match(/<url>/g) ?? []).length, (xml.match(/<\/url>/g) ?? []).length);
  assert.match(xml, /<\/urlset>\s*$/);
}

const publishedNotes = [
  { id: 1, slug: "n5-public", updatedAt: "2026-07-26T08:30:00.000Z" },
  { id: 2, slug: "", updatedAt: "2026-07-27T09:45:00.000Z" }
];
const xml = createSitemapXml(publishedNotes);
assertValidSitemapXml(xml);
assert.match(xml, new RegExp(`<loc>${canonicalSiteOrigin}</loc>`));
assert.match(xml, new RegExp(`<loc>${canonicalSiteOrigin}/notes</loc>`));
assert.match(xml, new RegExp(`<loc>${canonicalSiteOrigin}/words</loc>`));
assert.match(xml, new RegExp(`<loc>${canonicalSiteOrigin}/notes/n5-public</loc>`));
assert.match(xml, new RegExp(`<loc>${canonicalSiteOrigin}/notes/2</loc>`));
assert.match(xml, /<lastmod>2026-07-26T08:30:00\.000Z<\/lastmod>/);
assert.doesNotMatch(xml, /\/admin|\/api|draft|草稿|category=/i);

const cache = new MemoryCache();
const logs: Record<string, unknown>[] = [];
let renderCalls = 0;
let databaseQueries = 0;
let renderedRequest: Request | undefined;
const render = async (request: Request) => {
  renderCalls += 1;
  databaseQueries += 1;
  renderedRequest = request;
  return new Response(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Set-Cookie": "must-not-cache=1",
      Vary: "User-Agent"
    }
  });
};
const options = {
  cache,
  cacheVersion: "deploy-test",
  render,
  logger: (message: string) => logs.push(JSON.parse(message))
};

const firstStartedAt = performance.now();
const first = await handleSitemapEdgeCache(sitemapRequest("Claude-SearchBot/1.0"), options);
const firstWallMs = performance.now() - firstStartedAt;
assert.equal(first.status, 200);
assert.equal(first.headers.get("content-type"), "application/xml; charset=utf-8");
assert.equal(first.headers.get("x-japannote-sitemap-cache"), "MISS");
assert.equal(
  first.headers.get("cache-control"),
  "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800"
);
assertValidSitemapXml(await first.text());
assert.equal(renderCalls, 1);
assert.equal(databaseQueries, 1);
assert.equal(renderedRequest?.url, `${canonicalSiteOrigin}/sitemap.xml`);
assert.equal(renderedRequest?.headers.get("user-agent"), null);
assert.equal(renderedRequest?.headers.get("cookie"), null);
assert.equal(cache.writes, 1);
assert.equal(cache.objects.size, 1);
assert.equal(cache.objects.values().next().value?.headers.get("set-cookie"), null);
assert.equal(cache.objects.values().next().value?.headers.get("vary"), null);

const hitStartedAt = performance.now();
const second = await handleSitemapEdgeCache(sitemapRequest("Googlebot/2.1"), options);
const hitWallMs = performance.now() - hitStartedAt;
assert.equal(second.status, 200);
assert.equal(second.headers.get("x-japannote-sitemap-cache"), "HIT");
assertValidSitemapXml(await second.text());
assert.equal(renderCalls, 1, "cache hit must not invoke OpenNext");
assert.equal(databaseQueries, 1, "cache hit must execute zero database queries");
assert.equal(cache.objects.size, 1, "user-agent must not split the cache");

const bing = await handleSitemapEdgeCache(sitemapRequest("bingbot/2.0", {
  headers: { Authorization: "Bearer ignored" }
}), options);
assert.equal(bing.headers.get("x-japannote-sitemap-cache"), "HIT");
assert.equal(renderCalls, 1, "authorization and cookies must not create personalized sitemap variants");
assert.equal(cache.objects.size, 1);

const head = await handleSitemapEdgeCache(sitemapRequest("ClaudeBot/1.0", { method: "HEAD" }), options);
assert.equal(head.status, 200);
assert.equal(head.headers.get("x-japannote-sitemap-cache"), "HIT");
assert.equal(await head.text(), "");
assert.equal(renderCalls, 1);

let bypassRequest: Request | undefined;
const bypass = await handleSitemapEdgeCache(sitemapRequest("crawler-without-cache"), {
  logger: () => undefined,
  render: async (request) => {
    bypassRequest = request;
    return new Response(xml, { headers: { "Content-Type": "application/xml" } });
  }
});
assert.equal(bypass.headers.get("x-japannote-sitemap-cache"), "BYPASS");
assert.equal(bypassRequest?.url, `${canonicalSiteOrigin}/sitemap.xml`);
assert.equal(bypassRequest?.headers.get("user-agent"), null);
assert.equal(bypassRequest?.headers.get("cookie"), null);

assert.equal(
  getSitemapEdgeCacheKey("deploy-test").url,
  `${canonicalSiteOrigin}/sitemap.xml?__japannote_sitemap=deploy-test`
);
assert.equal(await purgeSitemapEdgeCache(cache, "deploy-test"), true);
assert.equal(cache.objects.size, 0);
assert(logs.some((entry) => entry.cacheStatus === "MISS"));
assert(logs.some((entry) => entry.cacheStatus === "HIT" && entry.renderWallMs === 0));

const publicDataSource = readFileSync(new URL("../app/publicData.ts", import.meta.url), "utf8");
const sitemapSource = readFileSync(new URL("../app/sitemap.ts", import.meta.url), "utf8");
const workerSource = readFileSync(new URL("../custom-worker.ts", import.meta.url), "utf8");
const migrationSource = readFileSync(
  new URL("../supabase/migrations/202607270001_learning_notes_sitemap_index.sql", import.meta.url),
  "utf8"
);

assert.match(publicDataSource, /const sitemapNoteSelect = "id,slug,updated_at"/);
assert.match(publicDataSource, /status: `eq\.\$\{publishedStatus\}`/);
assert.match(publicDataSource, /order: "updated_at\.desc,id\.desc"/);
assert.doesNotMatch(
  publicDataSource.match(/export async function readPublishedNotesForSitemap\(\)[\s\S]*?\n}\n/)?.[0] ?? "",
  /blocks|summary|seo|category|title/
);
assert.match(sitemapSource, /readPublishedNotesForSitemap/);
assert.doesNotMatch(sitemapSource, /auth|session|analytics|page.?view|category=/i);
assert.match(workerSource, /url\.pathname === "\/sitemap\.xml"/);
assert.match(workerSource, /handleSitemapEdgeCache/);
assert.match(migrationSource, /updated_at desc, id/);
assert.match(migrationSource, /include \(slug\)/);
assert.match(migrationSource, /where status = '已發布'/);

console.log(JSON.stringify({
  message: "sitemap edge cache assertions passed",
  firstWallMs: Math.round(firstWallMs * 100) / 100,
  hitWallMs: Math.round(hitWallMs * 100) / 100,
  renderCalls,
  databaseQueries
}));
