import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../../../lib/supabase/server";

export const dynamic = "force-dynamic";

type SiteVisitEventRow = {
  visitor_id: string | null;
  page_path: string | null;
  page_title: string | null;
  referrer: string | null;
  visited_at: string | null;
};

function formatHourLabel(date: Date) {
  return `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:00`;
}

function getHourKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}T${String(date.getHours()).padStart(2, "0")}`;
}

function getSourceLabel(referrer: string | null) {
  if (!referrer) {
    return "直接／未知";
  }

  try {
    const url = new URL(referrer);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();

    if (host === "japan-note.com" || host === "localhost") {
      return "站內連結";
    }

    if (host.includes("google.")) {
      return "Google 搜尋";
    }

    if (host.includes("yahoo.")) {
      return "Yahoo 搜尋";
    }

    if (host.includes("bing.")) {
      return "Bing 搜尋";
    }

    if (host.includes("facebook.") || host.includes("fb.")) {
      return "Facebook";
    }

    if (host.includes("instagram.")) {
      return "Instagram";
    }

    if (host.includes("line.")) {
      return "LINE";
    }

    if (host.includes("youtube.") || host.includes("youtu.be")) {
      return "YouTube";
    }

    return host;
  } catch {
    return "直接／未知";
  }
}

export async function GET() {
  try {
    const supabase = createSupabaseAdminClient();
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [{ count: totalVisitors }, { data: events, error: eventsError }] = await Promise.all([
      supabase.from("site_visitors").select("visitor_id", { count: "exact", head: true }),
      supabase
        .from("site_visit_events")
        .select("visitor_id,page_path,page_title,referrer,visited_at")
        .gte("visited_at", since.toISOString())
        .order("visited_at", { ascending: false })
        .limit(5000)
    ]);

    if (eventsError) {
      throw eventsError;
    }

    const rows = ((events ?? []) as SiteVisitEventRow[]).filter((row) => row.visitor_id && row.page_path && row.visited_at);
    const hourly = new Map<string, { label: string; visitors: Set<string>; views: number }>();
    const pages = new Map<string, { title: string; visitors: Set<string>; views: number; lastSeenAt: string }>();
    const sources = new Map<string, { visitors: Set<string>; views: number }>();

    for (let index = 23; index >= 0; index -= 1) {
      const hour = new Date(Date.now() - index * 60 * 60 * 1000);
      hour.setMinutes(0, 0, 0);
      hourly.set(getHourKey(hour), { label: formatHourLabel(hour), visitors: new Set(), views: 0 });
    }

    rows.forEach((row) => {
      const visitedAt = new Date(row.visited_at as string);
      visitedAt.setMinutes(0, 0, 0);
      const hour = hourly.get(getHourKey(visitedAt));

      if (hour && row.visitor_id) {
        hour.views += 1;
        hour.visitors.add(row.visitor_id);
      }

      const path = row.page_path as string;
      const page = pages.get(path) ?? {
        title: row.page_title || path,
        visitors: new Set<string>(),
        views: 0,
        lastSeenAt: row.visited_at as string
      };

      page.views += 1;
      page.title = row.page_title || page.title || path;
      page.lastSeenAt = page.lastSeenAt > (row.visited_at as string) ? page.lastSeenAt : (row.visited_at as string);

      if (row.visitor_id) {
        page.visitors.add(row.visitor_id);
      }

      pages.set(path, page);

      const sourceLabel = getSourceLabel(row.referrer);
      const source = sources.get(sourceLabel) ?? { visitors: new Set<string>(), views: 0 };
      source.views += 1;

      if (row.visitor_id) {
        source.visitors.add(row.visitor_id);
      }

      sources.set(sourceLabel, source);
    });

    return NextResponse.json({
      totalVisitors: totalVisitors ?? 0,
      trackedVisitors: new Set(rows.map((row) => row.visitor_id).filter(Boolean)).size,
      totalViews: rows.length,
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
    });
  } catch {
    return NextResponse.json({
      totalVisitors: 0,
      trackedVisitors: 0,
      totalViews: 0,
      hourly: [],
      pages: [],
      sources: []
    });
  }
}
