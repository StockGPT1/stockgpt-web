import { NextResponse, type NextRequest } from "next/server";
import { refreshMarketSnapshots } from "@/lib/yahoo";
import { persistMarketSnapshots } from "@/lib/market-snapshot-persistence";
import { createAdminClient } from "@/utils/supabase/admin";
import { isAuthorizedCron, unauthorizedCron } from "@/lib/security/cron";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) return unauthorizedCron();

  const supabase = createAdminClient();
  const limit = Number(process.env.PRIORITY_MARKET_SNAPSHOT_LIMIT ?? 180);
  const { data, error } = await supabase
    .from("stock_rankings")
    .select("ticker")
    .not("ticker", "is", null)
    .order("rank", { ascending: true })
    .limit(limit);

  if (error) {
    return NextResponse.json(
      { error: "Could not load priority ticker universe" },
      { status: 500 },
    );
  }

  const stockTickers = ((data ?? []) as Array<{ ticker: string | null }>).map(
    (row) => row.ticker ?? "",
  );
  const tickers = ["^GSPC", "^IXIC", "^DJI", "^VIX", ...stockTickers];

  const result = await refreshMarketSnapshots(tickers, {
    batchSize: Number(process.env.PRIORITY_MARKET_SNAPSHOT_BATCH_SIZE ?? 12),
    maxTickers: limit,
  });
  const updated = await persistMarketSnapshots(
    supabase,
    result.snapshots,
    new Date().toISOString(),
  );

  return NextResponse.json({ ok: true, priority: true, attempted: result.attempted, updated });
}
