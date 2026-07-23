import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { performance } from "node:perf_hooks";

nextEnv.loadEnvConfig(process.cwd());

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Missing Supabase benchmark configuration");

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function timedQuery(buildQuery) {
  const startedAt = performance.now();
  const result = await buildQuery();
  if (result.error) throw result.error;
  return { ...result, elapsedMs: performance.now() - startedAt };
}

let before;
try {
  before = await timedQuery(() =>
    supabase
      .from("affiliates")
      .select("id,category,title,summary,status,published_date,slug,tags,image_url,link_url,html", { count: "exact" })
      .order("published_date", { ascending: false })
      .order("id", { ascending: false })
  );
} catch (error) {
  console.log(
    JSON.stringify({
      available: false,
      errorCode: error && typeof error === "object" && "code" in error ? error.code : "unknown",
      note: "Configured Supabase project does not expose the affiliates table; production timing was not measured."
    })
  );
  process.exit(0);
}
const beforeStarted = performance.now();
const beforePayloadBytes = Buffer.byteLength(JSON.stringify({ affiliates: before.data ?? [] }));
const beforeTransformMs = performance.now() - beforeStarted;

const after = await timedQuery(() =>
  supabase
    .from("affiliates")
    .select("id,category,title,status,published_date", { count: "exact" })
    .order("published_date", { ascending: false })
    .order("id", { ascending: false })
    .range(0, 24)
);
const afterStarted = performance.now();
const afterPayloadBytes = Buffer.byteLength(JSON.stringify({ affiliates: after.data ?? [] }));
const afterTransformMs = performance.now() - afterStarted;

console.log(
  JSON.stringify({
    before: {
      rows: before.data?.length ?? 0,
      totalRows: before.count ?? 0,
      queryElapsedMs: Number(before.elapsedMs.toFixed(2)),
      transformElapsedMs: Number(beforeTransformMs.toFixed(2)),
      serializedBytes: beforePayloadBytes
    },
    after: {
      rows: after.data?.length ?? 0,
      totalRows: after.count ?? 0,
      queryElapsedMs: Number(after.elapsedMs.toFixed(2)),
      transformElapsedMs: Number(afterTransformMs.toFixed(2)),
      serializedBytes: afterPayloadBytes
    }
  })
);
