import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../../lib/supabase/server";

export const dynamic = "force-dynamic";

type SiteVisitStats = {
  visitor_count?: number;
  visit_count?: number;
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
    const [{ count, error: visitorError }, { data: visitCount, error: visitError }] = await Promise.all([
      supabase.from("site_visitors").select("visitor_id", { count: "exact", head: true }),
      supabase.from("site_visitors").select("visit_count").then(({ data, error }) => ({
        data: data?.reduce((sum, row) => sum + Number(row.visit_count ?? 0), 0) ?? 0,
        error
      }))
    ]);

    if (visitorError || visitError) {
      throw visitorError ?? visitError;
    }

    return NextResponse.json({ visitorCount: count ?? 0, visitCount });
  } catch {
    return NextResponse.json({ visitorCount: 0, visitCount: 0 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { visitorId?: string };
    const visitorId = body.visitorId?.trim();

    if (!visitorId) {
      return NextResponse.json({ visitorCount: 0, visitCount: 0 }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.rpc("record_site_visit", { p_visitor_id: visitorId }).single<SiteVisitStats>();

    if (error) {
      throw error;
    }

    return toStatsResponse(data);
  } catch {
    return NextResponse.json({ visitorCount: 0, visitCount: 0 });
  }
}
