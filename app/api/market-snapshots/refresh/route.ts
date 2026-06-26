import { NextResponse, type NextRequest } from "next/server";
import { refreshMarketSnapshots } from "@/lib/yahoo";
import { createClient } from "@/utils/supabase/server";
import { isAuthorizedCron, unauthorizedCron } from "@/lib/security/cron";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) return unauthorizedCron();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stock_rankings")
    .select("ticker")
    .not("ticker", "is", null)
    .order("rank", { ascending: true })
    .limit(520);

  if (error) {
    return NextResponse.json(
      { error: "Could not load ticker universe" },
      { status: 500 },
    );
  }

  const tickers = [
    "^GSPC",
    "^IXIC",
    "^DJI",
    "^VIX",
    ...((data ?? []) as Array<{ ticker: string | null }>).map((row) => row.ticker ?? ""),
  ];

  const result = await refreshMarketSnapshots(tickers, {
    batchSize: Number(process.env.MARKET_SNAPSHOT_BATCH_SIZE ?? 10),
    maxTickers: Number(process.env.MARKET_SNAPSHOT_MAX_TICKERS ?? 520),
  });

  return NextResponse.json({ ok: true, ...result });
}
