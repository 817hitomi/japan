import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../../lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = createSupabaseAdminClient();
    const { count, error } = await supabase.from("site_visitors").select("visitor_id", { count: "exact", head: true });

    if (error) {
      throw error;
    }

    return NextResponse.json({ visitorCount: count ?? 0 });
  } catch {
    return NextResponse.json({ visitorCount: 0 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { visitorId?: string };
    const visitorId = body.visitorId?.trim();

    if (!visitorId) {
      return NextResponse.json({ visitorCount: 0 }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.from("site_visitors").upsert(
      {
        visitor_id: visitorId,
        last_seen_at: new Date().toISOString()
      },
      { onConflict: "visitor_id", ignoreDuplicates: false }
    );

    if (error) {
      throw error;
    }

    const { count, error: countError } = await supabase
      .from("site_visitors")
      .select("visitor_id", { count: "exact", head: true });

    if (countError) {
      throw countError;
    }

    return NextResponse.json({ visitorCount: count ?? 0 });
  } catch {
    return NextResponse.json({ visitorCount: 0 });
  }
}
