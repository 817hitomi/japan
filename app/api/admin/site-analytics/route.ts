import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../../../lib/supabase/server";
import { requireAdminRoute } from "../../../../lib/adminRouteAuth";
import { logRequestDiagnostic } from "../../../../lib/requestDiagnostics";

export const dynamic = "force-dynamic";

type SiteAnalytics = {
  totalVisitors: number;
  trackedVisitors: number;
  totalViews: number;
  processedRows: number;
  hourly: Array<{ label: string; visitors: number; views: number }>;
  pages: Array<{ path: string; title: string; visitors: number; views: number; lastSeenAt: string }>;
  sources: Array<{ source: string; visitors: number; views: number }>;
};

type SiteVisitEventRow = {
  visitor_id: string | null;
  page_path: string | null;
  page_title: string | null;
  referrer: string | null;
  visited_at: string | null;
};

type AnalyticsLoad = {
  value: SiteAnalytics;
  degraded: boolean;
  databaseQueryCount: number;
};

const analyticsRoute = "/api/admin/site-analytics";
const analyticsCacheTtlMs = 45_000;
const analyticsTimeZone = "Asia/Taipei";
let analyticsCache: { expiresAt: number; result: AnalyticsLoad } | null = null;
let analyticsInFlight: Promise<AnalyticsLoad> | null = null;

const taipeiHourFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: analyticsTimeZone,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  hourCycle: "h23"
});

function emptyAnalytics(): SiteAnalytics {
  return {
    totalVisitors: 0,
    trackedVisitors: 0,
    totalViews: 0,
    processedRows: 0,
    hourly: [],
    pages: [],
    sources: []
  };
}

function toError(error: unknown) {
  if (error instanceof Error) {
    return error;
  }

  if (typeof error === "object" && error !== null) {
    const value = error as Record<string, unknown>;
    const normalized = new Error(typeof value.message === "string" ? value.message : String(error), {
      cause: value.cause
    });

    if (typeof value.name === "string") normalized.name = value.name;
    if (typeof value.stack === "string") normalized.stack = value.stack;
    return normalized;
  }

  return new Error(String(error));
}

function getCauseMessage(error: Error) {
  if (error.cause instanceof Error) {
    return error.cause.message;
  }

  return error.cause === undefined || error.cause === null ? null : String(error.cause);
}

function logAnalyticsError(stage: string, error: unknown, query?: string) {
  const err = toError(error);

  console.error(
    JSON.stringify({
      source: "site-analytics",
      stage,
      route: analyticsRoute,
      query: query ?? null,
      errorName: err.name,
      errorMessage: err.message,
      errorStack: err.stack ?? null,
      errorCause: getCauseMessage(err)
    })
  );
}

function toNonNegativeNumber(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function asRecord(value: unknown): Record<string, unknown> {
  const candidate = Array.isArray(value) ? value[0] : value;
  return typeof candidate === "object" && candidate !== null ? (candidate as Record<string, unknown>) : {};
}

function normalizeAnalytics(value: unknown): SiteAnalytics {
  const record = asRecord(value);
  const hourly = Array.isArray(record.hourly) ? record.hourly : [];
  const pages = Array.isArray(record.pages) ? record.pages : [];
  const sources = Array.isArray(record.sources) ? record.sources : [];

  return {
    totalVisitors: toNonNegativeNumber(record.totalVisitors),
    trackedVisitors: toNonNegativeNumber(record.trackedVisitors),
    totalViews: toNonNegativeNumber(record.totalViews),
    processedRows: toNonNegativeNumber(record.processedRows),
    hourly: hourly.map(asRecord).map((item) => ({
      label: typeof item.label === "string" ? item.label : "",
      visitors: toNonNegativeNumber(item.visitors),
      views: toNonNegativeNumber(item.views)
    })),
    pages: pages.map(asRecord).map((item) => ({
      path: typeof item.path === "string" ? item.path : "",
      title: typeof item.title === "string" ? item.title : typeof item.path === "string" ? item.path : "",
      visitors: toNonNegativeNumber(item.visitors),
      views: toNonNegativeNumber(item.views),
      lastSeenAt: typeof item.lastSeenAt === "string" ? item.lastSeenAt : ""
    })),
    sources: sources.map(asRecord).map((item) => ({
      source: typeof item.source === "string" ? item.source : "直接／未知",
      visitors: toNonNegativeNumber(item.visitors),
      views: toNonNegativeNumber(item.views)
    }))
  };
}

function getTaipeiHourParts(date: Date) {
  const parts = taipeiHourFormatter.formatToParts(date);
  const valueByType = new Map(parts.map((part) => [part.type, part.value]));

  return {
    year: valueByType.get("year") ?? "0000",
    month: valueByType.get("month") ?? "00",
    day: valueByType.get("day") ?? "00",
    hour: valueByType.get("hour") ?? "00"
  };
}

function getHourKey(date: Date) {
  const { year, month, day, hour } = getTaipeiHourParts(date);
  return `${year}-${month}-${day}T${hour}`;
}

function getSourceLabel(referrer: string | null) {
  if (!referrer) return "直接／未知";

  try {
    const host = new URL(referrer).hostname.replace(/^www\./, "").toLowerCase();

    if (host === "japan-note.com" || host === "localhost") return "站內連結";
    if (host.includes("google.")) return "Google 搜尋";
    if (host.includes("yahoo.")) return "Yahoo 搜尋";
    if (host.includes("bing.")) return "Bing 搜尋";
    if (host.includes("facebook.") || host.includes("fb.")) return "Facebook";
    if (host.includes("instagram.")) return "Instagram";
    if (host.includes("line.")) return "LINE";
    if (host.includes("youtube.") || host.includes("youtu.be")) return "YouTube";
    return host;
  } catch {
    return "直接／未知";
  }
}

function aggregateEventRows(now: Date, totalVisitors: number, events: SiteVisitEventRow[]): SiteAnalytics {
  const rows = events.filter((row) => row.visitor_id && row.page_path && row.visited_at);
  const hourly = new Map<string, { label: string; visitors: Set<string>; views: number }>();
  const pages = new Map<string, { title: string; visitors: Set<string>; views: number; lastSeenAt: string }>();
  const sources = new Map<string, { visitors: Set<string>; views: number }>();

  for (let index = 23; index >= 0; index -= 1) {
    const hour = new Date(now.getTime() - index * 60 * 60 * 1000);
    const { month, day, hour: hourPart } = getTaipeiHourParts(hour);
    hourly.set(getHourKey(hour), { label: `${month}/${day} ${hourPart}:00`, visitors: new Set(), views: 0 });
  }

  for (const row of rows) {
    const visitorId = row.visitor_id as string;
    const path = row.page_path as string;
    const visitedAt = row.visited_at as string;
    const hour = hourly.get(getHourKey(new Date(visitedAt)));

    if (hour) {
      hour.views += 1;
      hour.visitors.add(visitorId);
    }

    const page = pages.get(path) ?? {
      title: row.page_title || path,
      visitors: new Set<string>(),
      views: 0,
      lastSeenAt: visitedAt
    };
    page.views += 1;
    page.title = row.page_title || page.title || path;
    page.lastSeenAt = page.lastSeenAt > visitedAt ? page.lastSeenAt : visitedAt;
    page.visitors.add(visitorId);
    pages.set(path, page);

    const sourceLabel = getSourceLabel(row.referrer);
    const source = sources.get(sourceLabel) ?? { visitors: new Set<string>(), views: 0 };
    source.views += 1;
    source.visitors.add(visitorId);
    sources.set(sourceLabel, source);
  }

  return {
    totalVisitors,
    trackedVisitors: new Set(rows.map((row) => row.visitor_id)).size,
    totalViews: rows.length,
    processedRows: rows.length,
    hourly: Array.from(hourly.values()).map((item) => ({
      label: item.label,
      visitors: item.visitors.size,
      views: item.views
    })),
    pages: Array.from(pages.entries())
      .map(([path, item]) => ({
        path,
        title: item.title,
        visitors: item.visitors.size,
        views: item.views,
        lastSeenAt: item.lastSeenAt
      }))
      .sort((first, second) => second.views - first.views)
      .slice(0, 12),
    sources: Array.from(sources.entries())
      .map(([source, item]) => ({
        source,
        visitors: item.visitors.size,
        views: item.views
      }))
      .sort((first, second) => second.views - first.views)
      .slice(0, 12)
  };
}

async function readFallbackAnalytics(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  now: Date
): Promise<SiteAnalytics> {
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const results = await Promise.allSettled([
    (async () => {
      const { count, error } = await supabase.from("site_visitors").select("visitor_id", { count: "exact", head: true });
      if (error) throw error;
      return count ?? 0;
    })(),
    (async () => {
      const { data, error } = await supabase
        .from("site_visit_events")
        .select("visitor_id,page_path,page_title,referrer,visited_at")
        .gte("visited_at", since)
        .order("visited_at", { ascending: false })
        .limit(5000);
      if (error) throw error;
      return (data ?? []) as SiteVisitEventRow[];
    })()
  ]);
  const visitorsResult = results[0];
  const eventsResult = results[1];

  if (visitorsResult.status === "rejected") {
    logAnalyticsError("query-error", visitorsResult.reason, "total-visitors");
  }

  if (eventsResult.status === "rejected") {
    logAnalyticsError("query-error", eventsResult.reason, "visit-events");
  }

  return aggregateEventRows(
    now,
    visitorsResult.status === "fulfilled" ? toNonNegativeNumber(visitorsResult.value) : 0,
    eventsResult.status === "fulfilled" ? eventsResult.value : []
  );
}

async function loadAnalytics(now: Date): Promise<AnalyticsLoad> {
  const supabase = createSupabaseAdminClient();

  try {
    const { data, error } = await supabase.rpc("get_admin_site_analytics", {
      p_since: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
      p_until: now.toISOString(),
      p_page_limit: 12,
      p_source_limit: 12
    });

    if (error) throw error;
    return { value: normalizeAnalytics(data ?? emptyAnalytics()), degraded: false, databaseQueryCount: 1 };
  } catch (error) {
    logAnalyticsError("rpc-error", error, "get_admin_site_analytics");
    return {
      value: await readFallbackAnalytics(supabase, now),
      degraded: true,
      databaseQueryCount: 3
    };
  }
}

async function readAnalytics(now: Date) {
  if (analyticsCache && analyticsCache.expiresAt > now.getTime()) {
    return { ...analyticsCache.result, cacheStatus: "HIT" as const, queryCount: 0, queryMs: 0 };
  }

  if (!analyticsInFlight) {
    const queryStartedAt = performance.now();
    analyticsInFlight = loadAnalytics(now)
      .then((result) => {
        analyticsCache = { result, expiresAt: Date.now() + analyticsCacheTtlMs };
        return result;
      })
      .finally(() => {
        analyticsInFlight = null;
      });

    const result = await analyticsInFlight;
    return {
      ...result,
      cacheStatus: "MISS" as const,
      queryCount: result.databaseQueryCount,
      queryMs: performance.now() - queryStartedAt
    };
  }

  const queryStartedAt = performance.now();
  const result = await analyticsInFlight;
  return {
    ...result,
    cacheStatus: "COALESCED" as const,
    queryCount: 0,
    queryMs: performance.now() - queryStartedAt
  };
}

export async function GET() {
  const requestStartedAt = performance.now();
  let authMs = 0;

  try {
    const authStartedAt = performance.now();
    const authError = await requireAdminRoute();
    authMs = performance.now() - authStartedAt;

    if (authError) {
      authError.headers.set(
        "Server-Timing",
        `auth;dur=${authMs.toFixed(1)}, total;dur=${(performance.now() - requestStartedAt).toFixed(1)}`
      );
      authError.headers.set("X-Analytics-Query-Count", "0");
      authError.headers.set("X-Analytics-Processed-Rows", "0");
      return authError;
    }

    const { value, degraded, cacheStatus, queryCount, queryMs } = await readAnalytics(new Date());
    const serializeStartedAt = performance.now();
    const response = NextResponse.json(value, {
      headers: {
        "Cache-Control": "private, max-age=30, stale-while-revalidate=30",
        "X-Analytics-Cache": cacheStatus,
        "X-Analytics-Degraded": String(degraded),
        "X-Analytics-Query-Count": String(queryCount),
        "X-Analytics-Processed-Rows": String(value.processedRows)
      }
    });
    const serializeMs = performance.now() - serializeStartedAt;
    const totalMs = performance.now() - requestStartedAt;
    response.headers.set(
      "Server-Timing",
      `auth;dur=${authMs.toFixed(1)}, analytics;dur=${queryMs.toFixed(1)}, serialize;dur=${serializeMs.toFixed(1)}, total;dur=${totalMs.toFixed(1)}`
    );
    logRequestDiagnostic("admin site analytics", "complete", {
      authMs: Math.round(authMs),
      cacheStatus,
      degraded,
      queryCount,
      queryMs: Math.round(queryMs),
      processedRows: value.processedRows,
      totalMs: Math.round(totalMs)
    });

    return response;
  } catch (error) {
    const totalMs = performance.now() - requestStartedAt;
    logAnalyticsError("api-error", error);

    return NextResponse.json(
      { error: "Failed to load site analytics" },
      {
        status: 500,
        headers: {
          "Cache-Control": "private, no-store",
          "Server-Timing": `auth;dur=${authMs.toFixed(1)}, total;dur=${totalMs.toFixed(1)}`,
          "X-Analytics-Query-Count": "0",
          "X-Analytics-Processed-Rows": "0"
        }
      }
    );
  }
}
