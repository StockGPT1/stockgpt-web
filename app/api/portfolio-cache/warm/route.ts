import { NextResponse, type NextRequest } from "next/server";
import {
  getCachedPortfolioNews,
  getCachedPortfolioStockUniverse,
} from "@/lib/portfolio-speed-cache";
import { redisCommand } from "@/lib/redis";
import { getTickerTape, getStockChart } from "@/lib/yahoo";
import { createAdminClient } from "@/utils/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;
  return (req.headers.get("authorization") ?? "") === `Bearer ${cronSecret}`;
}

async function runInBatches<T>(
  items: T[],
  batchSize: number,
  fn: (item: T) => Promise<void>,
) {
  for (let i = 0; i < items.length; i += batchSize) {
    await Promise.all(items.slice(i, i + batchSize).map(fn));
  }
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const redisPing = await redisCommand<string>(["PING"]);

  await Promise.allSettled([
    getCachedPortfolioStockUniverse(),
    getCachedPortfolioNews(),
    getTickerTape(),
  ]);

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("portfolio_holdings")
    .select("ticker")
    .not("ticker", "is", null)
    .limit(Number(process.env.PORTFOLIO_CACHE_WARM_HOLDING_LIMIT ?? 350));

  if (error) {
    return NextResponse.json({ error: "Could not load portfolio tickers" }, { status: 500 });
  }

  const tickers = Array.from(
    new Set(
      ((data ?? []) as Array<{ ticker: string | null }>)
        .map((row) => String(row.ticker ?? "").trim().toUpperCase())
        .filter(Boolean),
    ),
  ).slice(0, Number(process.env.PORTFOLIO_CACHE_WARM_TICKER_LIMIT ?? 160));

  await runInBatches(
    tickers,
    Number(process.env.PORTFOLIO_CACHE_WARM_BATCH_SIZE ?? 10),
    async (ticker) => {
      await getStockChart(ticker, ["1D", "1M", "6M", "1Y", "5Y", "MAX"]);
    },
  );

  return NextResponse.json({
    ok: true,
    redis: redisPing === "PONG" ? "ok" : "miss",
    tickers: tickers.length,
  });
}
