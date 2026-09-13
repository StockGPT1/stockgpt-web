import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildMarketSnapshotRows } from "../lib/market-snapshot-persistence";

const observedAt = "2026-01-20T12:00:00Z";
assert.deepEqual(
  buildMarketSnapshotRows([
    { ticker: "AAPL", currentPrice: 123.45, changePct: 1.25 },
  ], observedAt),
  [{
    ticker: "AAPL",
    current_price: 123.45,
    change_pct_1d: 1.25,
    source: "yahoo",
    updated_at: observedAt,
  }],
);

for (const path of [
  "app/api/market-snapshots/refresh/route.ts",
  "app/api/market-snapshots/refresh-priority/route.ts",
]) {
  const source = readFileSync(path, "utf8");
  assert(source.includes("createAdminClient"), `${path} does not use its trusted cron boundary`);
  assert(source.includes("persistMarketSnapshots"), `${path} does not persist refreshed market snapshots`);
  assert(!source.includes("@/utils/supabase/server"), `${path} still depends on a cookie/session client`);
}

const yahoo = readFileSync("lib/yahoo.ts", "utf8");
assert(yahoo.includes("start += batchSize"), "Market refresh does not honor bounded batches");

console.log("Market snapshot trusted persistence and bounded-refresh contracts passed.");
