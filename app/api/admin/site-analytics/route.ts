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

const analyticsCacheTtlMs = 45_000;
let analyticsCache: { expiresAt: number; value: SiteAnalytics } | null = null;
let analyticsInFlight: Promise<SiteAnalytics> | null = null;

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

async function readAnalytics(now: Date) {
  if (analyticsCache && analyticsCache.expiresAt > now.getTime()) {
    return { analytics: analyticsCache.value, cacheStatus: "HIT" as const, queryCount: 0, queryMs: 0 };
  }

  if (!analyticsInFlight) {
    const supabase = createSupabaseAdminClient();
    const queryStartedAt = performance.now();

    analyticsInFlight = (async () => {
      const { data, error } = await supabase.rpc("get_admin_site_analytics", {
        p_since: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
        p_until: now.toISOString(),
        p_page_limit: 12,
        p_source_limit: 12
      });

      if (error) throw error;
      const value = (data ?? emptyAnalytics()) as unknown as SiteAnalytics;
      analyticsCache = { value, expiresAt: Date.now() + analyticsCacheTtlMs };
      return value;
    })().finally(() => {
      analyticsInFlight = null;
    });

    const analytics = await analyticsInFlight;
    return {
      analytics,
      cacheStatus: "MISS" as const,
      queryCount: 1,
      queryMs: performance.now() - queryStartedAt
    };
  }

  const queryStartedAt = performance.now();
  const pendingAnalytics = analyticsInFlight;
  const analytics = await pendingAnalytics;
  return {
    analytics,
    cacheStatus: "COALESCED" as const,
    queryCount: 0,
    queryMs: performance.now() - queryStartedAt
  };
}

export async function GET() {
  const requestStartedAt = performance.now();
  const authStartedAt = performance.now();
  const authError = await requireAdminRoute();
  const authMs = performance.now() - authStartedAt;

  if (authError) {
    authError.headers.set("Server-Timing", `auth;dur=${authMs.toFixed(1)}, total;dur=${(performance.now() - requestStartedAt).toFixed(1)}`);
    authError.headers.set("X-Analytics-Query-Count", "0");
    authError.headers.set("X-Analytics-Processed-Rows", "0");
    return authError;
  }

  try {
    const { analytics, cacheStatus, queryCount, queryMs } = await readAnalytics(new Date());
    const serializeStartedAt = performance.now();
    const response = NextResponse.json(analytics, {
      headers: {
        "Cache-Control": "private, max-age=30, stale-while-revalidate=30",
        "X-Analytics-Cache": cacheStatus,
        "X-Analytics-Query-Count": String(queryCount),
        "X-Analytics-Processed-Rows": String(analytics.processedRows)
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
      queryCount,
      queryMs: Math.round(queryMs),
      processedRows: analytics.processedRows,
      totalMs: Math.round(totalMs)
    });

    return response;
  } catch (error) {
    const totalMs = performance.now() - requestStartedAt;
    logRequestDiagnostic("admin site analytics", "error", {
      authMs: Math.round(authMs),
      message: error instanceof Error ? error.message : "unknown error",
      totalMs: Math.round(totalMs)
    });

    return NextResponse.json(
      { error: "Failed to load site analytics" },
      {
        status: 500,
        headers: {
          "Cache-Control": "private, no-store",
          "Server-Timing": `auth;dur=${authMs.toFixed(1)}, total;dur=${totalMs.toFixed(1)}`,
          "X-Analytics-Query-Count": "1",
          "X-Analytics-Processed-Rows": "0"
        }
      }
    );
  }
}
