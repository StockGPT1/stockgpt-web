import { NextResponse, type NextRequest } from "next/server";
import { refreshMarketSnapshots } from "@/lib/yahoo";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;
  return (req.headers.get("authorization") ?? "") === `Bearer ${cronSecret}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();
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

  return NextResponse.json({ ok: true, priority: true, ...result });
}
