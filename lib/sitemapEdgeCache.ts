import { canonicalSiteOrigin } from "./canonicalRequest.ts";
import type { WorkerCacheLike } from "./articleEdgeCache.ts";

export const sitemapBrowserCacheSeconds = 3_600;
export const sitemapEdgeCacheSeconds = 86_400;
export const sitemapStaleWhileRevalidateSeconds = 604_800;
const fallbackSitemapCacheVersion = "v1";
const inFlightRenders = new Map<string, Promise<RenderedSitemap>>();

type SitemapCacheStatus = "HIT" | "MISS" | "BYPASS";

type SitemapEdgeCacheOptions = {
  cache?: WorkerCacheLike;
  cacheVersion?: string;
  logger?: (message: string) => void;
  render(request: Request): Promise<Response>;
};

type RenderedSitemap = {
  body: ArrayBuffer;
  cacheable: boolean;
  cacheWriteMs: number;
  headers: Headers;
  renderWallMs: number;
  status: number;
  statusText: string;
};

function elapsed(startedAt: number) {
  return Math.max(0, Math.round((performance.now() - startedAt) * 100) / 100);
}

function normalizeVersion(version?: string) {
  const normalized = version?.trim().replace(/[^a-zA-Z0-9._-]/g, "").slice(0, 100);
  return normalized || fallbackSitemapCacheVersion;
}

function getCanonicalRenderRequest() {
  return new Request(`${canonicalSiteOrigin}/sitemap.xml`, {
    method: "GET",
    headers: { Accept: "application/xml, text/xml;q=0.9, */*;q=0.8" }
  });
}

function cacheControlValue() {
  return [
    "public",
    `max-age=${sitemapBrowserCacheSeconds}`,
    `s-maxage=${sitemapEdgeCacheSeconds}`,
    `stale-while-revalidate=${sitemapStaleWhileRevalidateSeconds}`
  ].join(", ");
}

export function getSitemapEdgeCacheKey(version?: string) {
  const url = new URL("/sitemap.xml", canonicalSiteOrigin);
  url.searchParams.set("__japannote_sitemap", normalizeVersion(version));
  return new Request(url, { method: "GET" });
}

export function isSitemapRequest(request: Request) {
  const pathname = new URL(request.url).pathname.replace(/\/+$/, "");
  return (request.method === "GET" || request.method === "HEAD") && pathname === "/sitemap.xml";
}

function withDiagnostics(
  response: Response,
  status: SitemapCacheStatus,
  details: { cacheLookupMs?: number; cacheWriteMs?: number; renderWallMs?: number } = {}
) {
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", cacheControlValue());
  headers.set("Content-Type", "application/xml; charset=utf-8");
  headers.set("X-JapanNote-Sitemap-Cache", status);
  headers.set(
    "Server-Timing",
    [
      `sitemap-cache;desc="${status}"`,
      details.cacheLookupMs === undefined ? "" : `cache-lookup;dur=${details.cacheLookupMs}`,
      details.renderWallMs === undefined ? "" : `sitemap-render;dur=${details.renderWallMs}`,
      details.cacheWriteMs === undefined ? "" : `cache-write;dur=${details.cacheWriteMs}`
    ].filter(Boolean).join(", ")
  );
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

function responseFromRendered(sitemap: RenderedSitemap, method: string) {
  return new Response(method === "HEAD" ? null : sitemap.body.slice(0), {
    status: sitemap.status,
    statusText: sitemap.statusText,
    headers: new Headers(sitemap.headers)
  });
}

async function renderAndStore(
  cache: WorkerCacheLike,
  cacheKey: Request,
  render: SitemapEdgeCacheOptions["render"]
): Promise<RenderedSitemap> {
  const renderStartedAt = performance.now();
  const response = await render(getCanonicalRenderRequest());
  const renderWallMs = elapsed(renderStartedAt);
  const body = await response.arrayBuffer();
  const headers = new Headers(response.headers);
  const contentType = headers.get("content-type") ?? "";
  const cacheable =
    response.status === 200 &&
    (contentType.includes("application/xml") || contentType.includes("text/xml"));

  if (!cacheable) {
    return {
      body,
      cacheable: false,
      cacheWriteMs: 0,
      headers,
      renderWallMs,
      status: response.status,
      statusText: response.statusText
    };
  }

  headers.delete("set-cookie");
  headers.delete("vary");
  headers.set("Cache-Control", cacheControlValue());
  headers.set("Content-Type", "application/xml; charset=utf-8");
  headers.set("X-JapanNote-Sitemap-Cache", "HIT");
  const cacheWriteStartedAt = performance.now();

  try {
    await cache.put(cacheKey, new Response(body.slice(0), {
      status: response.status,
      statusText: response.statusText,
      headers
    }));
  } catch {
    return {
      body,
      cacheable: false,
      cacheWriteMs: elapsed(cacheWriteStartedAt),
      headers,
      renderWallMs,
      status: response.status,
      statusText: response.statusText
    };
  }

  return {
    body,
    cacheable: true,
    cacheWriteMs: elapsed(cacheWriteStartedAt),
    headers,
    renderWallMs,
    status: response.status,
    statusText: response.statusText
  };
}

function logResult(
  logger: (message: string) => void,
  request: Request,
  cacheStatus: SitemapCacheStatus,
  details: { cacheLookupMs: number; cacheWriteMs: number; renderWallMs: number }
) {
  logger(JSON.stringify({
    source: "japannote",
    stage: "sitemap-edge-cache",
    pathname: new URL(request.url).pathname,
    method: request.method,
    cacheStatus,
    ...details
  }));
}

export async function handleSitemapEdgeCache(request: Request, options: SitemapEdgeCacheOptions) {
  const logger = options.logger ?? console.log;

  if (!isSitemapRequest(request)) {
    return options.render(request);
  }

  if (!options.cache) {
    const renderStartedAt = performance.now();
    const response = await options.render(getCanonicalRenderRequest());
    const renderWallMs = elapsed(renderStartedAt);
    logResult(logger, request, "BYPASS", { cacheLookupMs: 0, cacheWriteMs: 0, renderWallMs });
    return withDiagnostics(response, "BYPASS", { renderWallMs });
  }

  const cacheKey = getSitemapEdgeCacheKey(options.cacheVersion);
  const cacheLookupStartedAt = performance.now();
  const cached = await options.cache.match(cacheKey);
  const cacheLookupMs = elapsed(cacheLookupStartedAt);

  if (cached) {
    const response = request.method === "HEAD"
      ? new Response(null, cached)
      : new Response(cached.body, cached);
    logResult(logger, request, "HIT", { cacheLookupMs, cacheWriteMs: 0, renderWallMs: 0 });
    return withDiagnostics(response, "HIT", { cacheLookupMs, renderWallMs: 0 });
  }

  const inFlightKey = cacheKey.url;
  let renderPromise = inFlightRenders.get(inFlightKey);
  if (!renderPromise) {
    renderPromise = renderAndStore(options.cache, cacheKey, options.render)
      .finally(() => inFlightRenders.delete(inFlightKey));
    inFlightRenders.set(inFlightKey, renderPromise);
  }

  const sitemap = await renderPromise;
  const cacheStatus: SitemapCacheStatus = sitemap.cacheable ? "MISS" : "BYPASS";
  logResult(logger, request, cacheStatus, {
    cacheLookupMs,
    cacheWriteMs: sitemap.cacheWriteMs,
    renderWallMs: sitemap.renderWallMs
  });
  return withDiagnostics(responseFromRendered(sitemap, request.method), cacheStatus, {
    cacheLookupMs,
    cacheWriteMs: sitemap.cacheWriteMs,
    renderWallMs: sitemap.renderWallMs
  });
}

export function purgeSitemapEdgeCache(cache: WorkerCacheLike, version?: string) {
  return cache.delete(getSitemapEdgeCacheKey(version));
}
