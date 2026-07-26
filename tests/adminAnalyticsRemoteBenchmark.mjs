import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

for (const line of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const separator = line.indexOf("=");
  if (separator > 0) {
    process.env[line.slice(0, separator)] = line.slice(separator + 1);
  }
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);
const until = new Date();
const since = new Date(until.getTime() - 24 * 60 * 60 * 1000);

async function timed(label, task) {
  const startedAt = performance.now();
  const result = await task();
  return {
    label,
    elapsedMs: Math.round((performance.now() - startedAt) * 100) / 100,
    ...result
  };
}

const legacyRoute = await timed("legacy-route-data-queries", async () => {
  const [visitors, events] = await Promise.all([
    supabase.from("site_visitors").select("visitor_id", { count: "exact", head: true }),
    supabase
      .from("site_visit_events")
      .select("visitor_id,page_path,page_title,referrer,visited_at")
      .gte("visited_at", since.toISOString())
      .order("visited_at", { ascending: false })
      .limit(5000)
  ]);

  return {
    queryCount: 2,
    totalVisitors: visitors.count,
    processedRows: events.data?.length ?? null,
    transferredBytes: events.data ? Buffer.byteLength(JSON.stringify(events.data)) : null,
    errors: [visitors.error?.code, events.error?.code].filter(Boolean)
  };
});

const rpc = await timed("database-aggregation-rpc", async () => {
  const { data, error } = await supabase.rpc("get_admin_site_analytics", {
    p_since: since.toISOString(),
    p_until: until.toISOString(),
    p_page_limit: 12,
    p_source_limit: 12
  });

  return {
    queryCount: 1,
    processedRows: data?.processedRows ?? null,
    returnedHours: data?.hourly?.length ?? null,
    returnedPages: data?.pages?.length ?? null,
    returnedSources: data?.sources?.length ?? null,
    error: error?.code ?? null
  };
});

console.log(JSON.stringify({ measuredAt: until.toISOString(), legacyRoute, rpc }, null, 2));
