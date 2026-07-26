import { createSecurityFirstFetchHandler } from "./lib/securityFirstRequest";
import {
  getArticleCacheInvalidationKeys,
  getInvalidArticleSlugResponse,
  handleArticleEdgeCache,
  purgeArticleEdgeCache,
  type WorkerCacheLike
} from "./lib/articleEdgeCache";
import { getCanonicalRedirect } from "./lib/canonicalRequest";
import { getOAuthCallbackFallbackRedirect } from "./lib/oauthCallbackFallback";
import { bridgedRuntimeEnvNames, getRuntimeEnvHeaderName } from "./lib/runtimeEnv";

type WorkerEnvironment = {
  [key: string]: unknown;
  ASSETS?: { fetch(request: Request): Promise<Response> };
  CF_VERSION_METADATA?: { id?: string; tag?: string; timestamp?: string };
};

type WorkerExecutionContext = { waitUntil(promise: Promise<unknown>): void };
type OpenNextWorker = {
  fetch(request: Request, env: WorkerEnvironment, context: WorkerExecutionContext): Promise<Response>;
};

const homepageCacheSeconds = 300;
const noteImageCacheSeconds = 3600;
let openNextWorkerPromise: Promise<OpenNextWorker> | undefined;

function loadOpenNextWorker() {
  // Keep Next.js, middleware, RSC, SSR, and route modules out of scanner requests.
  // @ts-expect-error OpenNext generates this JavaScript artifact without a declaration file.
  openNextWorkerPromise ??= import("./.open-next/worker.js").then(
    (module) => module.default as OpenNextWorker
  );
  return openNextWorkerPromise;
}

function getWorkerDefaultCache(): WorkerCacheLike | undefined {
  return typeof caches === "undefined"
    ? undefined
    : (caches as CacheStorage & { default?: WorkerCacheLike }).default;
}

function withRuntimeEnvHeaders(request: Request, env: WorkerEnvironment) {
  const headers = new Headers(request.headers);
  for (const name of bridgedRuntimeEnvNames) {
    const headerName = getRuntimeEnvHeaderName(name);
    const value = env[name];
    if (typeof value === "string" && value.length > 0) headers.set(headerName, value);
    else headers.delete(headerName);
  }
  return new Request(request, { headers });
}

const fetch = createSecurityFirstFetchHandler(
  async (request, env: WorkerEnvironment, context: WorkerExecutionContext) => {
    const url = new URL(request.url);
    const canonicalRedirect = getCanonicalRedirect(request);
    if (canonicalRedirect) return canonicalRedirect;

    const oauthCallbackFallback = getOAuthCallbackFallbackRedirect(request);
    if (oauthCallbackFallback) return oauthCallbackFallback;

    if (url.pathname === "/favicon.ico" && env.ASSETS) {
      return env.ASSETS.fetch(new Request(new URL("/brand/logo_b.png", request.url), request));
    }

    // This stays before OpenNext, middleware, metadata, SSR, and Supabase.
    const invalidArticleSlug = getInvalidArticleSlugResponse(request);
    if (invalidArticleSlug) return invalidArticleSlug;

    const workerCache = getWorkerDefaultCache();
    const shouldCacheHomepage = request.method === "GET" && url.pathname === "/" && !url.searchParams.has("note");
    const shouldCacheNoteImage = request.method === "GET" && url.pathname === "/api/notes/og" && url.searchParams.has("slug");
    const homepageVersion = env.CF_VERSION_METADATA?.id ?? "local";
    const homepageCacheUrl = new URL("/", url.origin);
    homepageCacheUrl.searchParams.set("__japannote_worker_version", homepageVersion);
    const sharedCacheKey = workerCache && (shouldCacheHomepage || shouldCacheNoteImage)
      ? new Request(shouldCacheHomepage ? homepageCacheUrl : url, { method: "GET" })
      : undefined;

    if (workerCache && sharedCacheKey) {
      const cachedResponse = await workerCache.match(sharedCacheKey);
      if (cachedResponse) return cachedResponse;
    }

    const renderWithOpenNext = async (nextRequest: Request) => {
      const openNextWorker = await loadOpenNextWorker();
      const response = await openNextWorker.fetch(withRuntimeEnvHeaders(nextRequest, env), env, context);
      const invalidationKeys = getArticleCacheInvalidationKeys(response);

      if (workerCache && invalidationKeys.length > 0) {
        const purged = await purgeArticleEdgeCache(workerCache, invalidationKeys);
        console.log(JSON.stringify({
          source: "japannote",
          stage: "article-edge-cache",
          branch: "purge",
          requested: invalidationKeys.length,
          purged
        }));
        const headers = new Headers(response.headers);
        headers.delete("x-japannote-invalidate-article-cache");
        return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
      }
      return response;
    };

    if (url.pathname.startsWith("/notes/")) {
      return handleArticleEdgeCache(request, { cache: workerCache, render: renderWithOpenNext });
    }

    const response = await renderWithOpenNext(request);
    const contentType = response.headers.get("content-type") ?? "";
    const isCacheableContent = shouldCacheHomepage ? contentType.includes("text/html") : contentType.startsWith("image/");

    if (!workerCache || !sharedCacheKey || !response.ok || !isCacheableContent) return response;

    const cacheableResponse = new Response(response.body, response);
    cacheableResponse.headers.delete("set-cookie");
    cacheableResponse.headers.set(
      "Cache-Control",
      shouldCacheHomepage
        ? `public, max-age=0, must-revalidate, s-maxage=${homepageCacheSeconds}, stale-while-revalidate=60`
        : `public, s-maxage=${noteImageCacheSeconds}, stale-while-revalidate=86400`
    );
    context.waitUntil(workerCache.put(sharedCacheKey, cacheableResponse.clone()));
    return cacheableResponse;
  }
);

export default { fetch };
