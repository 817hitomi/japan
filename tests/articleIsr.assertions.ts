import assert from "node:assert/strict";
import {
  articleIsrFreshSeconds,
  articleIsrStaleSeconds,
  getArticleIsrCacheKey,
  handleArticleIsr,
  type R2BucketLike
} from "../lib/articleIsr.ts";
import { canonicalSiteOrigin, getCanonicalRedirect } from "../lib/canonicalRequest.ts";

type StoredObject = {
  body: string;
  customMetadata: Record<string, string>;
  etag: string;
  uploaded: Date;
};

class MemoryR2 implements R2BucketLike {
  objects = new Map<string, StoredObject>();
  reads = 0;
  writes = 0;

  async delete(key: string) {
    this.objects.delete(key);
  }

  async get(key: string) {
    this.reads += 1;
    const object = this.objects.get(key);
    if (!object) return null;
    const { body, ...metadata } = object;

    return {
      ...metadata,
      text: async () => body
    };
  }

  async head(key: string) {
    const object = this.objects.get(key);
    if (!object) return null;
    const { body, ...metadata } = object;

    return {
      ...metadata,
      text: async () => body
    };
  }

  async put(
    key: string,
    value: ArrayBuffer | ArrayBufferView | Blob | ReadableStream | string | null,
    options?: {
      customMetadata?: Record<string, string>;
      onlyIf?: { etagDoesNotMatch?: string };
    }
  ) {
    if (options?.onlyIf?.etagDoesNotMatch === "*" && this.objects.has(key)) {
      return null;
    }

    let body = "";
    if (typeof value === "string") body = value;
    else if (value instanceof ArrayBuffer) body = new TextDecoder().decode(value);
    else if (ArrayBuffer.isView(value)) body = new TextDecoder().decode(value);

    const object = {
      body,
      customMetadata: options?.customMetadata ?? {},
      etag: String(this.writes + 1),
      uploaded: new Date()
    };
    this.writes += 1;
    this.objects.set(key, object);
    const { body: storedBody, ...metadata } = object;
    return {
      ...metadata,
      text: async () => storedBody
    };
  }
}

function createContext() {
  const background: Promise<unknown>[] = [];
  return {
    background,
    context: {
      waitUntil(promise: Promise<unknown>) {
        background.push(promise);
      }
    }
  };
}

function createRequest(headers?: HeadersInit, pathname = "/notes/n5-test") {
  return new Request(`${canonicalSiteOrigin}${pathname}`, {
    headers: { Accept: "text/html", ...Object.fromEntries(new Headers(headers)) }
  });
}

async function readStatus(response: Response, expected: string) {
  assert.equal(response.headers.get("x-isr-cache"), expected);
  assert.equal(response.status, 200);
  return response.text();
}

for (const source of [
  "http://japan-note.com/notes/a?x=1",
  "http://www.japan-note.com/notes/a?x=1",
  "https://japan-note.com/notes/a?x=1"
]) {
  const redirect = getCanonicalRedirect(new Request(source));
  assert(redirect, `${source} must redirect`);
  assert.equal(redirect.status, 308);
  assert.equal(redirect.headers.get("location"), `${canonicalSiteOrigin}/notes/a?x=1`);
}
assert.equal(getCanonicalRedirect(new Request(`${canonicalSiteOrigin}/notes/a`)), null);
assert.equal(getCanonicalRedirect(new Request("http://localhost:3000/notes/a")), null);

let now = 1_800_000_000_000;
let renderCalls = 0;
const bucket = new MemoryR2();
const firstContext = createContext();
const render = async () => {
  renderCalls += 1;
  return new Response(`<html><body>render-${renderCalls}</body></html>`, {
    headers: { "Content-Type": "text/html; charset=utf-8" }
  });
};

const first = await handleArticleIsr(createRequest(), {
  bucket,
  context: firstContext.context,
  now: () => now,
  render
});
assert.match(await readStatus(first, "MISS"), /render-1/);
assert.equal(renderCalls, 1, "first request must SSR once");

const second = await handleArticleIsr(createRequest(), {
  bucket,
  context: createContext().context,
  now: () => now,
  render
});
assert.match(await readStatus(second, "HIT"), /render-1/);
assert.equal(renderCalls, 1, "HIT must not execute SSR");

const noCache = await handleArticleIsr(createRequest({ "Cache-Control": "no-cache" }), {
  bucket,
  context: createContext().context,
  now: () => now,
  render
});
assert.match(await readStatus(noCache, "HIT"), /render-1/);
assert.equal(renderCalls, 1, "visitor no-cache must not bypass ISR");

now += articleIsrFreshSeconds * 1_000 + 1;
const staleContext = createContext();
const stale = await handleArticleIsr(createRequest(), {
  bucket,
  context: staleContext.context,
  now: () => now,
  render
});
assert.match(await readStatus(stale, "STALE"), /render-1/);
await Promise.all(staleContext.background);
assert.equal(renderCalls, 2, "stale response must trigger one background regeneration");

const refreshed = await handleArticleIsr(createRequest(), {
  bucket,
  context: createContext().context,
  now: () => now,
  render
});
assert.match(await readStatus(refreshed, "HIT"), /render-2/);

const unavailable = await handleArticleIsr(createRequest(), {
  context: createContext().context,
  now: () => now,
  render
});
assert.match(await readStatus(unavailable, "BYPASS"), /render-3/);

const failingBucket = new MemoryR2();
failingBucket.get = async () => {
  throw new Error("R2 unavailable");
};
const r2Failure = await handleArticleIsr(createRequest(), {
  bucket: failingBucket,
  context: createContext().context,
  now: () => now,
  render
});
assert.match(await readStatus(r2Failure, "BYPASS"), /render-4/);

const expiredBucket = new MemoryR2();
let expiredRenders = 0;
let expiredNow = 1_900_000_000_000;
const expiredRender = async () => {
  expiredRenders += 1;
  return new Response(`<html>expired-${expiredRenders}</html>`, {
    headers: { "Content-Type": "text/html" }
  });
};
await handleArticleIsr(createRequest(), {
  bucket: expiredBucket,
  context: createContext().context,
  now: () => expiredNow,
  render: expiredRender
});
expiredNow += (articleIsrFreshSeconds + articleIsrStaleSeconds) * 1_000 + 1;
const expired = await handleArticleIsr(createRequest(), {
  bucket: expiredBucket,
  context: createContext().context,
  now: () => expiredNow,
  render: expiredRender
});
assert.match(await readStatus(expired, "MISS"), /expired-2/);
assert.equal(expiredRenders, 2, "fully expired HTML must regenerate");

const concurrentBucket = new MemoryR2();
let concurrentRenders = 0;
const concurrentRender = async () => {
  concurrentRenders += 1;
  await new Promise((resolve) => setTimeout(resolve, 20));
  return new Response(`<html>concurrent-${concurrentRenders}</html>`, {
    headers: { "Content-Type": "text/html" }
  });
};
const concurrentResponses = await Promise.all(
  Array.from({ length: 12 }, () =>
    handleArticleIsr(createRequest(), {
      bucket: concurrentBucket,
      context: createContext().context,
      render: concurrentRender
    })
  )
);
await Promise.all(concurrentResponses.map((response) => response.text()));
assert.equal(concurrentRenders, 1, "coalescing must run only one SSR for concurrent cold requests");
assert.equal(
  concurrentResponses.filter((response) => response.headers.get("x-isr-cache") === "MISS").length,
  12,
  "coalesced callers must receive the generated HTML"
);

const distributedBucket = new MemoryR2();
const distributedPath = "/notes/distributed-lock";
const distributedKey = getArticleIsrCacheKey(distributedPath);
let distributedRenders = 0;
await distributedBucket.put(`${distributedKey}.lock`, "", {
  customMetadata: { expiresAt: String(Date.now() + 10_000) }
});
setTimeout(() => {
  void distributedBucket.put(distributedKey, "<html>generated-by-other-isolate</html>", {
    customMetadata: {
      contentType: "text/html",
      expiresAt: String(Date.now() + articleIsrFreshSeconds * 1_000),
      staleUntil: String(Date.now() + (articleIsrFreshSeconds + articleIsrStaleSeconds) * 1_000)
    }
  });
}, 25);
const distributed = await handleArticleIsr(createRequest(undefined, distributedPath), {
  bucket: distributedBucket,
  context: createContext().context,
  render: async () => {
    distributedRenders += 1;
    return new Response("<html>duplicate</html>", { headers: { "Content-Type": "text/html" } });
  }
});
assert.match(await readStatus(distributed, "HIT"), /generated-by-other-isolate/);
assert.equal(distributedRenders, 0, "R2 lock must prevent duplicate SSR across isolates");

const queryHit = await handleArticleIsr(
  new Request(`${canonicalSiteOrigin}/notes/n5-test?share=1`, { headers: { Accept: "text/html" } }),
  {
    bucket,
    context: createContext().context,
    render
  }
);
assert.equal(queryHit.headers.get("x-isr-cache"), "HIT", "query strings must reuse the pathname cache key");

assert.equal(
  getArticleIsrCacheKey("/notes/n5-test"),
  "isr/html/v1/%2Fnotes%2Fn5-test.html",
  "cache key must be stable and pathname based"
);

console.log("article ISR assertions passed");
