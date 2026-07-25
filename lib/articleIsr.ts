export const articleIsrFreshSeconds = 86_400;
export const articleIsrStaleSeconds = 86_400;

type CacheStatus = "HIT" | "MISS" | "STALE" | "BYPASS";

type R2MetadataLike = {
  customMetadata?: Record<string, string>;
  etag?: string;
  uploaded?: Date;
};

type R2ObjectLike = R2MetadataLike & {
  body?: ReadableStream<Uint8Array>;
  text(): Promise<string>;
};

export type R2BucketLike = {
  delete(key: string): Promise<void>;
  get(key: string): Promise<R2ObjectLike | null>;
  head(key: string): Promise<R2MetadataLike | null>;
  put(
    key: string,
    value: ArrayBuffer | ArrayBufferView | Blob | ReadableStream | string | null,
    options?: {
      customMetadata?: Record<string, string>;
      httpMetadata?: {
        cacheControl?: string;
        contentType?: string;
      };
      onlyIf?: {
        etagDoesNotMatch?: string;
      };
    }
  ): Promise<unknown | null>;
};

type ExecutionContextLike = {
  waitUntil(promise: Promise<unknown>): void;
};

type IsrOptions = {
  bucket?: R2BucketLike;
  context: ExecutionContextLike;
  now?: () => number;
  render(request: Request): Promise<Response>;
  logger?: (message: string) => void;
};

type GeneratedPage = {
  body: ArrayBuffer;
  cacheStatus: CacheStatus;
  contentType: string;
  responseHeaders: Record<string, string>;
  r2WriteMs: number;
  ssrMs: number;
  status: number;
};

type CachedPage = {
  body: string;
  contentType: string;
  expiresAt: number;
  staleUntil: number;
};

const regenerationRequests = new Map<string, Promise<GeneratedPage>>();
const responseCacheControl =
  `public, max-age=0, s-maxage=${articleIsrFreshSeconds}, stale-while-revalidate=${articleIsrStaleSeconds}`;
const lockTtlMs = 15_000;
const lockPollAttempts = 20;
const lockPollDelayMs = 100;

function elapsed(startedAt: number) {
  return Math.max(0, Math.round(performance.now() - startedAt));
}

function sleep(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

function normalizedArticlePathname(request: Request) {
  const url = new URL(request.url);
  return url.pathname.length > 1 ? url.pathname.replace(/\/+$/, "") : url.pathname;
}

export function getArticleIsrCacheKey(pathname: string) {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return `isr/html/v1/${encodeURIComponent(normalized)}.html`;
}

export function isArticleHtmlRequest(request: Request) {
  if (request.method !== "GET") return false;

  const url = new URL(request.url);
  const pathname = normalizedArticlePathname(request);
  const pathSegments = pathname.split("/").filter(Boolean);
  const accept = request.headers.get("accept") ?? "";

  return (
    pathSegments.length === 2 &&
    pathSegments[0] === "notes" &&
    !url.searchParams.has("_rsc") &&
    request.headers.get("rsc") !== "1" &&
    !request.headers.has("next-router-state-tree") &&
    (!accept || accept === "*/*" || accept.includes("text/html"))
  );
}

function addIsrHeaders(response: Response, status: CacheStatus, ageSeconds = 0) {
  const result = new Response(response.body, response);
  result.headers.set("X-ISR-Cache", status);

  if (status !== "BYPASS") {
    result.headers.delete("set-cookie");
    result.headers.set("Age", String(Math.max(0, Math.floor(ageSeconds))));
    result.headers.set("Cache-Control", responseCacheControl);
  }

  return result;
}

function responseFromCachedPage(page: CachedPage, status: "HIT" | "STALE", now: number) {
  const generatedAt = page.expiresAt - articleIsrFreshSeconds * 1_000;
  return addIsrHeaders(
    new Response(page.body, {
      status: 200,
      headers: { "Content-Type": page.contentType }
    }),
    status,
    (now - generatedAt) / 1_000
  );
}

function responseFromGeneratedPage(page: GeneratedPage) {
  const body = page.body.slice(0);
  return addIsrHeaders(
    new Response(body, {
      status: page.status,
      headers: page.responseHeaders
    }),
    page.cacheStatus
  );
}

async function readCachedPage(bucket: R2BucketLike, cacheKey: string): Promise<CachedPage | null> {
  const object = await bucket.get(cacheKey);
  if (!object) return null;

  const metadata = object.customMetadata ?? {};
  const uploadedAt = object.uploaded?.getTime() ?? Date.now();
  const expiresAt = Number(metadata.expiresAt) || uploadedAt + articleIsrFreshSeconds * 1_000;
  const staleUntil = Number(metadata.staleUntil) || expiresAt + articleIsrStaleSeconds * 1_000;

  return {
    body: await object.text(),
    contentType: metadata.contentType || "text/html; charset=utf-8",
    expiresAt,
    staleUntil
  };
}

async function acquireLock(bucket: R2BucketLike, lockKey: string, now: number) {
  const lock = await bucket.put(lockKey, "", {
    customMetadata: { expiresAt: String(now + lockTtlMs) },
    onlyIf: { etagDoesNotMatch: "*" }
  });

  if (lock) return true;

  const existingLock = await bucket.head(lockKey);
  const existingExpiry = Number(existingLock?.customMetadata?.expiresAt);

  if (existingLock && Number.isFinite(existingExpiry) && existingExpiry <= now) {
    await bucket.delete(lockKey);
    return Boolean(
      await bucket.put(lockKey, "", {
        customMetadata: { expiresAt: String(now + lockTtlMs) },
        onlyIf: { etagDoesNotMatch: "*" }
      })
    );
  }

  return false;
}

async function renderAndStore(
  request: Request,
  bucket: R2BucketLike,
  cacheKey: string,
  now: () => number,
  render: IsrOptions["render"]
): Promise<GeneratedPage> {
  const ssrStartedAt = performance.now();
  const rendered = await render(request);
  const contentType = rendered.headers.get("content-type") ?? "";
  const body = await rendered.arrayBuffer();
  const ssrMs = elapsed(ssrStartedAt);
  const responseHeaders = Object.fromEntries(rendered.headers);
  delete responseHeaders["content-encoding"];
  delete responseHeaders["content-length"];
  delete responseHeaders["set-cookie"];

  if (!rendered.ok || !contentType.includes("text/html")) {
    return {
      body,
      cacheStatus: "BYPASS",
      contentType,
      responseHeaders,
      r2WriteMs: 0,
      ssrMs,
      status: rendered.status
    };
  }

  const generatedAt = now();
  const writeStartedAt = performance.now();

  try {
    await bucket.put(cacheKey, body, {
      customMetadata: {
        contentType,
        expiresAt: String(generatedAt + articleIsrFreshSeconds * 1_000),
        generatedAt: String(generatedAt),
        staleUntil: String(generatedAt + (articleIsrFreshSeconds + articleIsrStaleSeconds) * 1_000)
      },
      httpMetadata: {
        cacheControl: responseCacheControl,
        contentType
      }
    });

    return {
      body,
      cacheStatus: "MISS",
      contentType,
      responseHeaders,
      r2WriteMs: elapsed(writeStartedAt),
      ssrMs,
      status: rendered.status
    };
  } catch {
    return {
      body,
      cacheStatus: "BYPASS",
      contentType,
      responseHeaders,
      r2WriteMs: elapsed(writeStartedAt),
      ssrMs,
      status: rendered.status
    };
  }
}

async function regenerate(
  request: Request,
  bucket: R2BucketLike,
  cacheKey: string,
  options: Pick<IsrOptions, "now" | "render">,
  waitForAnotherRequest: boolean
) {
  const existing = regenerationRequests.get(cacheKey);
  if (existing) return existing;

  const now = options.now ?? Date.now;
  const lockKey = `${cacheKey}.lock`;
  const promise = (async () => {
    let ownsLock = false;

    try {
      ownsLock = await acquireLock(bucket, lockKey, now());

      if (!ownsLock && waitForAnotherRequest) {
        for (let attempt = 0; attempt < lockPollAttempts; attempt += 1) {
          await sleep(lockPollDelayMs);
          const cached = await readCachedPage(bucket, cacheKey);

          if (cached && now() < cached.staleUntil) {
            return {
              body: new TextEncoder().encode(cached.body).buffer,
              cacheStatus: "HIT",
              contentType: cached.contentType,
              responseHeaders: { "Content-Type": cached.contentType },
              r2WriteMs: 0,
              ssrMs: 0,
              status: 200
            } satisfies GeneratedPage;
          }
        }
      }

      if (!ownsLock) {
        return {
          body: new ArrayBuffer(0),
          cacheStatus: "BYPASS",
          contentType: "text/html; charset=utf-8",
          responseHeaders: { "Content-Type": "text/html; charset=utf-8" },
          r2WriteMs: 0,
          ssrMs: 0,
          status: 503
        } satisfies GeneratedPage;
      }

      return await renderAndStore(request, bucket, cacheKey, now, options.render);
    } finally {
      if (ownsLock) {
        await bucket.delete(lockKey).catch(() => undefined);
      }
    }
  })().finally(() => regenerationRequests.delete(cacheKey));

  regenerationRequests.set(cacheKey, promise);
  return promise;
}

function logResult(
  logger: NonNullable<IsrOptions["logger"]>,
  pathname: string,
  cacheKey: string,
  cacheStatus: CacheStatus,
  r2ReadMs: number,
  ssrMs: number,
  r2WriteMs: number
) {
  logger(JSON.stringify({
    source: "japannote",
    stage: "article-isr",
    pathname,
    cacheKey,
    cacheStatus,
    r2ReadMs,
    ssrMs,
    r2WriteMs
  }));
}

export async function handleArticleIsr(request: Request, options: IsrOptions) {
  const pathname = normalizedArticlePathname(request);
  const cacheKey = getArticleIsrCacheKey(pathname);
  const logger = options.logger ?? console.log;
  const now = options.now ?? Date.now;

  if (!isArticleHtmlRequest(request)) {
    const response = addIsrHeaders(await options.render(request), "BYPASS");
    logResult(logger, pathname, cacheKey, "BYPASS", 0, 0, 0);
    return response;
  }

  if (!options.bucket) {
    const ssrStartedAt = performance.now();
    const response = addIsrHeaders(await options.render(request), "BYPASS");
    logResult(logger, pathname, cacheKey, "BYPASS", 0, elapsed(ssrStartedAt), 0);
    return response;
  }

  const readStartedAt = performance.now();
  let cached: CachedPage | null;

  try {
    cached = await readCachedPage(options.bucket, cacheKey);
  } catch {
    const r2ReadMs = elapsed(readStartedAt);
    const ssrStartedAt = performance.now();
    const response = addIsrHeaders(await options.render(request), "BYPASS");
    logResult(logger, pathname, cacheKey, "BYPASS", r2ReadMs, elapsed(ssrStartedAt), 0);
    return response;
  }

  const r2ReadMs = elapsed(readStartedAt);

  if (cached && now() < cached.expiresAt) {
    logResult(logger, pathname, cacheKey, "HIT", r2ReadMs, 0, 0);
    return responseFromCachedPage(cached, "HIT", now());
  }

  if (cached && now() < cached.staleUntil) {
    const backgroundRefresh = regenerate(request, options.bucket, cacheKey, options, false)
      .then((result) => {
        if (result.status !== 503) {
          logResult(logger, pathname, cacheKey, result.cacheStatus, 0, result.ssrMs, result.r2WriteMs);
        }
      })
      .catch(() => undefined);
    options.context.waitUntil(backgroundRefresh);
    logResult(logger, pathname, cacheKey, "STALE", r2ReadMs, 0, 0);
    return responseFromCachedPage(cached, "STALE", now());
  }

  try {
    const generated = await regenerate(request, options.bucket, cacheKey, options, true);

    if (generated.status === 503) {
      const ssrStartedAt = performance.now();
      const response = addIsrHeaders(await options.render(request), "BYPASS");
      logResult(logger, pathname, cacheKey, "BYPASS", r2ReadMs, elapsed(ssrStartedAt), 0);
      return response;
    }

    logResult(logger, pathname, cacheKey, generated.cacheStatus, r2ReadMs, generated.ssrMs, generated.r2WriteMs);
    return responseFromGeneratedPage(generated);
  } catch {
    const ssrStartedAt = performance.now();
    const response = addIsrHeaders(await options.render(request), "BYPASS");
    logResult(logger, pathname, cacheKey, "BYPASS", r2ReadMs, elapsed(ssrStartedAt), 0);
    return response;
  }
}
