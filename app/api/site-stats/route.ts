import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../../lib/supabase/server";

export const dynamic = "force-dynamic";

type SiteVisitStats = {
  visitor_count?: number;
  visit_count?: number;
};

type RecentVisit = {
  first_seen_at: string | null;
  last_path: string | null;
  last_seen_at: string | null;
  visit_count: number | null;
};

function toStatsResponse(stats?: SiteVisitStats | null) {
  return NextResponse.json({
    visitorCount: Number(stats?.visitor_count ?? 0),
    visitCount: Number(stats?.visit_count ?? 0)
  });
}

export async function GET() {
  try {
    const supabase = createSupabaseAdminClient();
    const [{ count, error: visitorError }, { data: visitCount, error: visitError }, { data: recentVisits, error: recentVisitsError }] = await Promise.all([
      supabase.from("site_visitors").select("visitor_id", { count: "exact", head: true }),
      supabase.from("site_visitors").select("visit_count").then(({ data, error }) => ({
        data: data?.reduce((sum, row) => sum + Number(row.visit_count ?? 0), 0) ?? 0,
        error
      })),
      supabase
        .from("site_visitors")
        .select("first_seen_at,last_path,last_seen_at,visit_count")
        .order("last_seen_at", { ascending: false })
        .limit(10)
    ]);

    if (visitorError || visitError || recentVisitsError) {
      throw visitorError ?? visitError ?? recentVisitsError;
    }

    return NextResponse.json({
      visitorCount: count ?? 0,
      visitCount,
      latestVisitAt: (recentVisits?.[0] as RecentVisit | undefined)?.last_seen_at ?? null,
      recentVisits:
        recentVisits?.map((visit) => ({
          firstSeenAt: (visit as RecentVisit).first_seen_at,
          lastPath: (visit as RecentVisit).last_path ?? "/",
          lastSeenAt: (visit as RecentVisit).last_seen_at,
          visitCount: Number((visit as RecentVisit).visit_count ?? 0)
        })) ?? []
    });
  } catch {
    return NextResponse.json({ latestVisitAt: null, recentVisits: [], visitorCount: 0, visitCount: 0 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { path?: string; visitorId?: string };
    const visitorId = body.visitorId?.trim();
    const path = body.path?.trim() || "/";

    if (!visitorId) {
      return NextResponse.json({ visitorCount: 0, visitCount: 0 }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.rpc("record_site_visit", { p_path: path, p_visitor_id: visitorId }).single<SiteVisitStats>();

    if (error) {
      throw error;
    }

    return toStatsResponse(data);
  } catch {
    return NextResponse.json({ visitorCount: 0, visitCount: 0 });
  }
}
