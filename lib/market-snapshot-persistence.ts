import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { Mover } from "@/lib/yahoo";

export function buildMarketSnapshotRows(
  snapshots: readonly Mover[],
  observedAt: string,
) {
  return snapshots.map((snapshot) => ({
    ticker: snapshot.ticker,
    current_price: snapshot.currentPrice,
    change_pct_1d: snapshot.changePct,
    source: "yahoo",
    updated_at: observedAt,
  }));
}

export async function persistMarketSnapshots(
  supabase: SupabaseClient<Database>,
  snapshots: readonly Mover[],
  observedAt: string,
): Promise<number> {
  if (snapshots.length === 0) return 0;

  const { error } = await supabase
    .from("market_snapshots")
    .upsert(buildMarketSnapshotRows(snapshots, observedAt), { onConflict: "ticker" });

  if (error) throw new Error(`Market snapshot persistence failed: ${error.message}`);
  return snapshots.length;
}
