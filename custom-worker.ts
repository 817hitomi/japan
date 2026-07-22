import { createSecurityFirstFetchHandler } from "./lib/securityFirstRequest";
import { bridgedRuntimeEnvNames, getRuntimeEnvHeaderName } from "./lib/runtimeEnv";

// The OpenNext worker is generated after the Next.js build.
// @ts-expect-error Generated build artifact is intentionally absent in a fresh checkout.
import openNextWorker from "./.open-next/worker.js";

type WorkerEnvironment = {
  [key: string]: unknown;
  ASSETS?: {
    fetch(request: Request): Promise<Response>;
  };
};

type WorkerExecutionContext = {
  waitUntil(promise: Promise<unknown>): void;
};

const homepageCacheSeconds = 300;
const noteImageCacheSeconds = 3600;

function getWorkerDefaultCache() {
  return typeof caches === "undefined" ? undefined : (caches as CacheStorage & { default?: Cache }).default;
}

function withRuntimeEnvHeaders(request: Request, env: WorkerEnvironment) {
  const headers = new Headers(request.headers);

  for (const name of bridgedRuntimeEnvNames) {
    const headerName = getRuntimeEnvHeaderName(name);
    const value = env[name];

    // Always replace or remove client-supplied internal headers so callers
    // cannot spoof authentication configuration.
    if (typeof value === "string" && value.length > 0) headers.set(headerName, value);
    else headers.delete(headerName);
  }

  return new Request(request, { headers });
}

const fetch = createSecurityFirstFetchHandler(
  async (request, env: WorkerEnvironment, context: WorkerExecutionContext) => {
    const url = new URL(request.url);

    // OpenNext's asset resolver does not consistently apply the middleware rewrite for favicon.ico.
    if (url.pathname === "/favicon.ico" && env.ASSETS) {
      return env.ASSETS.fetch(new Request(new URL("/brand/logo_b.png", request.url), request));
    }

    const shouldCacheHomepage = request.method === "GET" && url.pathname === "/" && !url.searchParams.has("note");
    const shouldCacheNoteImage = request.method === "GET" && url.pathname === "/api/notes/og" && url.searchParams.has("slug");
    const workerCache = shouldCacheHomepage || shouldCacheNoteImage ? getWorkerDefaultCache() : undefined;
    const cacheKey = workerCache
      ? new Request(shouldCacheHomepage ? new URL("/", url.origin) : url, { method: "GET" })
      : undefined;

    if (workerCache && cacheKey) {
      const cachedResponse = await workerCache.match(cacheKey);

      if (cachedResponse) {
        return cachedResponse;
      }
    }

    const response = await openNextWorker.fetch(withRuntimeEnvHeaders(request, env), env, context);

    const contentType = response.headers.get("content-type") ?? "";
    const isCacheableContent = shouldCacheHomepage ? contentType.includes("text/html") : contentType.startsWith("image/");

    if (!workerCache || !cacheKey || !response.ok || !isCacheableContent) {
      return response;
    }

    const cacheableResponse = new Response(response.body, response);
    cacheableResponse.headers.delete("set-cookie");
    cacheableResponse.headers.set(
      "Cache-Control",
      `public, s-maxage=${shouldCacheHomepage ? homepageCacheSeconds : noteImageCacheSeconds}, stale-while-revalidate=86400`
    );
    context.waitUntil(workerCache.put(cacheKey, cacheableResponse.clone()));
    return cacheableResponse;
  }
);

export default { fetch };

// Preserve OpenNext Durable Object exports when cache implementations enable them.
// @ts-expect-error Generated build artifact is intentionally absent in a fresh checkout.
export { BucketCachePurge, DOQueueHandler, DOShardedTagCache } from "./.open-next/worker.js";
