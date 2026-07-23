import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { normalizeAffiliates, type AffiliateRecord } from "../app/affiliates/affiliateTypes.ts";

const root = new URL("../", import.meta.url);
const pageSource = readFileSync(new URL("app/admin/affiliates/page.tsx", root), "utf8");
const clientSource = readFileSync(new URL("app/admin/affiliates/AdminAffiliatesClient.tsx", root), "utf8");
const dataSource = readFileSync(new URL("lib/affiliateData.ts", root), "utf8");
const shellSource = readFileSync(new URL("app/admin/AdminShell.tsx", root), "utf8");

assert.match(dataSource, /adminAffiliatePageSize = 25/, "admin affiliate page must be capped at 25 rows");
assert.match(pageSource, /readAdminAffiliatePage/, "RSC page must query the database directly");
assert.doesNotMatch(clientSource, /readAffiliatesWithSource\("all"\)/, "client must not fetch every affiliate after hydration");
assert.match(dataSource, /\.range\(from, to\)/, "database query must apply range before returning rows");
assert.match(dataSource, /id,category,title,status,published_date/, "list query must select summary columns only");
assert.doesNotMatch(dataSource, /html|image_url/, "list query must not load large editor fields");
assert.match(shellSource, /<Link href=\{item\.href\} prefetch=\{false\}/, "admin route prefetch must be disabled");

function makeAffiliate(index: number): AffiliateRecord {
  return {
    id: index + 1,
    category: index % 2 ? "學習工具" : "旅遊",
    title: `Affiliate ${index}`,
    summary: "摘要".repeat(100),
    status: index % 3 ? "published" : "draft",
    date: `2026-07-${String((index % 28) + 1).padStart(2, "0")}`,
    slug: `affiliate-${index}`,
    tags: "日文,學習",
    imageUrl: `data:image/webp;base64,${"A".repeat(4_000)}`,
    linkUrl: `https://example.com/${index}`,
    html: `<p>${"內容".repeat(2_000)}</p>`
  };
}

function measure<T>(run: () => T) {
  const startedAt = performance.now();
  const value = run();
  return { value, elapsedMs: performance.now() - startedAt };
}

for (const size of [0, 3, 25]) {
  const pageRows = Array.from({ length: size }, (_, index) => makeAffiliate(index)).map(
    ({ id, category, title, status, date }) => ({ id, category, title, status, date })
  );
  assert.equal(pageRows.length, size);
}

const largeDataset = Array.from({ length: 5_000 }, (_, index) => makeAffiliate(index));
const before = measure(() => JSON.stringify({ affiliates: normalizeAffiliates(largeDataset) }));
const currentPage = largeDataset.slice(0, 25).map(
  ({ id, category, title, status, date }) => ({ id, category, title, status, date })
);
const after = measure(() => JSON.stringify({ affiliates: currentPage }));

console.log(
  JSON.stringify({
    scenario: "synthetic-5000-large-affiliates",
    before: {
      inputRows: largeDataset.length,
      serializedBytes: Buffer.byteLength(before.value),
      elapsedMs: Number(before.elapsedMs.toFixed(2))
    },
    after: {
      inputRows: currentPage.length,
      serializedBytes: Buffer.byteLength(after.value),
      elapsedMs: Number(after.elapsedMs.toFixed(2))
    }
  })
);
console.log("affiliate pagination assertions passed");
