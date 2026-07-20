import { unstable_cache } from "next/cache";
import { createRequestTimer } from "../../lib/requestDiagnostics";
import { getRuntimeEnv } from "../../lib/runtimeEnv";
import { AdSetting, normalizeAdSettings } from "./adTypes";

type SiteAdRow = {
  slot: string;
  label: string | null;
  enabled: boolean | null;
  channel: string | null;
  link_url: string | null;
  image_url: string | null;
  alt_text: string | null;
  html_code: string | null;
};

function getWorkerDefaultCache() {
  return (caches as CacheStorage & { default?: Cache }).default;
}

function rowToAd(row: SiteAdRow): Partial<AdSetting> {
  return {
    slot: row.slot as AdSetting["slot"],
    label: row.label ?? "",
    enabled: Boolean(row.enabled),
    channel: row.channel === "html" ? "html" : "affiliate",
    linkUrl: row.link_url ?? "",
    imageUrl: row.image_url ?? "",
    altText: row.alt_text ?? "",
    htmlCode: row.html_code ?? ""
  };
}

function getSupabaseRestUrl() {
  const supabaseUrl = getRuntimeEnv("NEXT_PUBLIC_SUPABASE_URL");

  if (!supabaseUrl) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  }

  const url = new URL("/rest/v1/site_ads", supabaseUrl.replace(/\/$/, ""));
  url.searchParams.set("select", "slot,label,enabled,channel,link_url,image_url,alt_text,html_code");
  url.searchParams.set("slot", "eq.global-head");
  url.searchParams.set("limit", "1");
  return url;
}

async function readWorkerCachedResponse(cacheKey: Request) {
  if (typeof caches === "undefined") {
    return null;
  }

  try {
    return getWorkerDefaultCache()?.match(cacheKey) ?? null;
  } catch {
    return null;
  }
}

async function writeWorkerCachedResponse(cacheKey: Request, response: Response) {
  if (typeof caches === "undefined") {
    return;
  }

  try {
    await getWorkerDefaultCache()?.put(cacheKey, response);
  } catch {
    // Cache API availability differs between local Node and Workers.
  }
}

async function readGlobalHeadAdHtml() {
  try {
    const anonKey = getRuntimeEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

    if (!anonKey) {
      throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");
    }

    const timer = createRequestTimer("database query", { table: "site_ads", operation: "global-head-ad" });
    const cacheKey = new Request(getSupabaseRestUrl().toString());
    const cachedResponse = await readWorkerCachedResponse(cacheKey);
    const response = cachedResponse ?? await fetch(cacheKey, {
      next: { revalidate: 300 },
      headers: {
        apikey: anonKey,
        authorization: `Bearer ${anonKey}`
      }
    });

    if (!response.ok) {
      timer.end({ status: response.status });
      throw new Error(`Supabase global head ad read failed: ${response.status}`);
    }

    if (!cachedResponse) {
      const cacheableResponse = new Response(response.clone().body, response);
      cacheableResponse.headers.set("Cache-Control", "public, max-age=300, stale-while-revalidate=86400");
      await writeWorkerCachedResponse(cacheKey, cacheableResponse);
    }

    const rows = (await response.json()) as SiteAdRow[];
    timer.end({ status: response.status, rows: rows.length, cache: cachedResponse ? "hit" : "miss" });
    const [setting] = normalizeAdSettings(rows[0] ? [rowToAd(rows[0])] : []);

    if (setting?.enabled && setting.channel === "html") {
      return setting.htmlCode.trim();
    }
  } catch {
    const [setting] = normalizeAdSettings([]);

    if (setting?.enabled && setting.channel === "html") {
      return setting.htmlCode.trim();
    }
  }

  return "";
}

export const getGlobalHeadAdHtml = unstable_cache(readGlobalHeadAdHtml, ["global-head-ad-html"], {
  revalidate: 300
});
