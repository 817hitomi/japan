import assert from "node:assert/strict";
import fs from "node:fs";

const route = fs.readFileSync(new URL("../app/api/admin/site-analytics/route.ts", import.meta.url), "utf8");
const client = fs.readFileSync(new URL("../app/admin/AdminDashboardClient.tsx", import.meta.url), "utf8");
const middleware = fs.readFileSync(new URL("../middleware.ts", import.meta.url), "utf8");
const migration = fs.readFileSync(
  new URL("../supabase/migrations/202607260001_admin_site_analytics_rpc.sql", import.meta.url),
  "utf8"
);

assert.match(route, /\.rpc\("get_admin_site_analytics"/);
assert.doesNotMatch(route, /\.limit\(5000\)/);
assert.doesNotMatch(route, /new Map|new Set|\.sort\(/);
assert.match(route, /analyticsCacheTtlMs = 45_000/);
assert.match(route, /const authError = await requireAdminRoute\(\)[\s\S]*?readAnalytics\(new Date\(\)\)/);
assert.match(route, /X-Analytics-Query-Count/);
assert.match(route, /X-Analytics-Processed-Rows/);

assert.match(client, /analyticsRequest: Promise<SiteAnalytics> \| null/);
assert.match(client, /if \(!response\.ok\)/);
assert.doesNotMatch(client, /setInterval|cache: "no-store"|retry/i);

assert.match(middleware, /pathname === "\/api\/admin\/site-analytics"\) return false/);
assert.match(migration, /count\(distinct visitor_id\)/i);
assert.match(migration, /group by hours\.taipei_hour/i);
assert.match(migration, /group by valid_events\.page_path/i);
assert.match(migration, /group by source_label/i);
assert.match(migration, /security invoker/i);
assert.match(migration, /grant execute[\s\S]*service_role/i);

console.log("Admin analytics performance assertions passed.");
