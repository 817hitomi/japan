import { canonicalSiteOrigin } from "./canonicalRequest.ts";

export const articleEdgeCacheSeconds = 3_600;
export const articleCacheInvalidationHeader = "x-japannote-invalidate-article-cache";
const articleCacheVersion = "v2";
const inFlightRenders = new Map<string, Promise<RenderedPage>>();

export type WorkerCacheLike = {
  match(request: Request): Promise<Response | undefined>;
  put(request: Request, response: Response): Promise<void>;
  delete(request: Request): Promise<boolean>;
};

type ArticleEdgeCacheOptions = {
  cache?: WorkerCacheLike;
  logger?: (message: string) => void;
  render(request: Request): Promise<Response>;
};

type RenderedPage = {
  body: ArrayBuffer;
  headers: Headers;
  status: number;
  statusText: string;
  cacheable: boolean;
  ssrWallMs: number;
  cacheWriteMs: number;
};

type CacheStatus = "HIT" | "MISS" | "BYPASS";

function elapsed(startedAt: number) {
  return Math.max(0, Math.round((performance.now() - startedAt) * 100) / 100);
}

function normalizeArticlePathname(pathname: string) {
  const normalized = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return normalized.length > 1 ? normalized.replace(/\/+$/, "") : normalized;
}

function getArticleRouteKey(pathname: string) {
  const segments = normalizeArticlePathname(pathname).split("/").filter(Boolean);
  if (segments.length !== 2 || segments[0] !== "notes") return null;
  try {
    return decodeURIComponent(segments[1]);
  } catch {
    return null;
  }
}

export function isValidPublicArticleRouteKey(routeKey: string | null) {
  return Boolean(
    routeKey &&
      routeKey.length <= 100 &&
      (/^\d+$/.test(routeKey) || /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(routeKey))
  );
}

function isIgnoredArticleQuery(name: string) {
  const normalized = name.toLowerCase();
  return (
    normalized === "share" ||
    normalized === "fbclid" ||
    normalized === "gclid" ||
    normalized === "dclid" ||
    normalized === "msclkid" ||
    normalized.startsWith("utm_")
  );
}

function hasOnlyIgnoredArticleQueries(url: URL) {
  return Array.from(url.searchParams.keys()).every(isIgnoredArticleQuery);
}

function getCanonicalArticleRenderRequest(request: Request) {
  const url = new URL(request.url);
  url.search = "";
  const headers = new Headers(request.headers);
  headers.delete("cookie");
  headers.delete("authorization");
  return new Request(url, { method: "GET", headers, redirect: request.redirect });
}

export function getArticleEdgeCacheKey(pathname: string) {
  const url = new URL(normalizeArticlePathname(pathname), canonicalSiteOrigin);
  url.searchParams.set("__japannote_article_html", articleCacheVersion);
  return new Request(url, { method: "GET" });
}

export function getInvalidArticleSlugResponse(request: Request) {
  const url = new URL(request.url);
  if (!normalizeArticlePathname(url.pathname).startsWith("/notes/")) return null;
  if (isValidPublicArticleRouteKey(getArticleRouteKey(url.pathname))) return null;
  return new Response("Invalid article slug", {
    status: 400,
    headers: {
      "Cache-Control": "public, max-age=300",
      "Content-Length": "20",
      "Content-Type": "text/plain; charset=utf-8"
    }
  });
}

export function isArticleHtmlRequest(request: Request) {
  if (request.method !== "GET" && request.method !== "HEAD") return false;
  const url = new URL(request.url);
  const accept = request.headers.get("accept") ?? "";
  return (
    isValidPublicArticleRouteKey(getArticleRouteKey(url.pathname)) &&
    hasOnlyIgnoredArticleQueries(url) &&
    !url.searchParams.has("_rsc") &&
    request.headers.get("rsc") !== "1" &&
    !request.headers.has("next-router-state-tree") &&
    (request.method === "HEAD" || accept.includes("text/html") || accept.includes("*/*"))
  );
}

function withCacheHeaders(response: Response, status: CacheStatus, details: {
  cacheLookupMs?: number;
  cacheWriteMs?: number;
  ssrWallMs?: number;
} = {}) {
  const headers = new Headers(response.headers);
  headers.set("X-JapanNote-Cache", status);
  const metrics = [
    `edge-cache;desc="${status}"`,
    details.cacheLookupMs === undefined ? "" : `cache-lookup;dur=${details.cacheLookupMs}`,
    details.ssrWallMs === undefined ? "" : `ssr;dur=${details.ssrWallMs}`,
    details.cacheWriteMs === undefined ? "" : `cache-write;dur=${details.cacheWriteMs}`
  ].filter(Boolean);
  headers.set("Server-Timing", metrics.join(", "));
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function responseFromRendered(page: RenderedPage, method: string) {
  return new Response(method === "HEAD" ? null : page.body.slice(0), {
    status: page.status,
    statusText: page.statusText,
    headers: new Headers(page.headers)
  });
}

async function renderAndStore(
  request: Request,
  cache: WorkerCacheLike,
  cacheKey: Request,
  render: ArticleEdgeCacheOptions["render"]
): Promise<RenderedPage> {
  const ssrStartedAt = performance.now();
  const response = await render(getCanonicalArticleRenderRequest(request));
  const ssrWallMs = elapsed(ssrStartedAt);
  const body = await response.arrayBuffer();
  const headers = new Headers(response.headers);
  const cacheable = response.status === 200 && (headers.get("content-type") ?? "").includes("text/html");
  if (!cacheable) {
    return { body, headers, status: response.status, statusText: response.statusText, cacheable: false, ssrWallMs, cacheWriteMs: 0 };
  }
  headers.delete("set-cookie");
  headers.set("Cache-Control", `public, max-age=0, s-maxage=${articleEdgeCacheSeconds}`);
  headers.set("X-JapanNote-Cache", "HIT");
  const cacheWriteStartedAt = performance.now();
  try {
    await cache.put(cacheKey, new Response(body.slice(0), {
      status: response.status,
      statusText: response.statusText,
      headers
    }));
  } catch {
    return {
      body, headers, status: response.status, statusText: response.statusText,
      cacheable: false, ssrWallMs, cacheWriteMs: elapsed(cacheWriteStartedAt)
    };
  }
  return {
    body, headers, status: response.status, statusText: response.statusText,
    cacheable: true, ssrWallMs, cacheWriteMs: elapsed(cacheWriteStartedAt)
  };
}

function logCacheResult(
  logger: (message: string) => void,
  request: Request,
  status: CacheStatus,
  details: { cacheLookupMs: number; cacheWriteMs: number; ssrWallMs: number }
) {
  logger(JSON.stringify({
    source: "japannote",
    stage: "article-edge-cache",
    pathname: normalizeArticlePathname(new URL(request.url).pathname),
    method: request.method,
    cacheStatus: status,
    ...details
  }));
}

export async function handleArticleEdgeCache(request: Request, options: ArticleEdgeCacheOptions) {
  const logger = options.logger ?? console.log;
  if (!isArticleHtmlRequest(request) || !options.cache) {
    const ssrStartedAt = performance.now();
    const response = await options.render(request);
    const ssrWallMs = elapsed(ssrStartedAt);
    logCacheResult(logger, request, "BYPASS", { cacheLookupMs: 0, cacheWriteMs: 0, ssrWallMs });
    return withCacheHeaders(response, "BYPASS", { ssrWallMs });
  }
  const pathname = normalizeArticlePathname(new URL(request.url).pathname);
  const cacheKey = getArticleEdgeCacheKey(pathname);
  const cacheLookupStartedAt = performance.now();
  const cached = await options.cache.match(cacheKey);
  const cacheLookupMs = elapsed(cacheLookupStartedAt);
  if (cached) {
    const response = request.method === "HEAD" ? new Response(null, cached) : new Response(cached.body, cached);
    logCacheResult(logger, request, "HIT", { cacheLookupMs, cacheWriteMs: 0, ssrWallMs: 0 });
    return withCacheHeaders(response, "HIT", { cacheLookupMs, ssrWallMs: 0 });
  }
  const inFlightKey = cacheKey.url;
  let renderPromise = inFlightRenders.get(inFlightKey);
  if (!renderPromise) {
    renderPromise = renderAndStore(request, options.cache, cacheKey, options.render)
      .finally(() => inFlightRenders.delete(inFlightKey));
    inFlightRenders.set(inFlightKey, renderPromise);
  }
  const page = await renderPromise;
  const status: CacheStatus = page.cacheable ? "MISS" : "BYPASS";
  logCacheResult(logger, request, status, {
    cacheLookupMs, cacheWriteMs: page.cacheWriteMs, ssrWallMs: page.ssrWallMs
  });
  return withCacheHeaders(responseFromRendered(page, request.method), status, {
    cacheLookupMs, cacheWriteMs: page.cacheWriteMs, ssrWallMs: page.ssrWallMs
  });
}

export function getArticleCacheInvalidationKeys(response: Response) {
  const value = response.headers.get(articleCacheInvalidationHeader);
  if (!value) return [];
  return Array.from(new Set(value.split(",").map((key) => key.trim()).filter((key) => isValidPublicArticleRouteKey(key))));
}

export async function purgeArticleEdgeCache(cache: WorkerCacheLike, routeKeys: string[]) {
  const keys = Array.from(new Set(routeKeys.filter((key) => isValidPublicArticleRouteKey(key))));
  const results = await Promise.all(keys.map((key) =>
    cache.delete(getArticleEdgeCacheKey(`/notes/${encodeURIComponent(key)}`))
  ));
  return results.filter(Boolean).length;
}
