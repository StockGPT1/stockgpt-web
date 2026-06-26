import { NextResponse, type NextRequest } from "next/server";
import {
  buildCurrentPortfolioSnapshotPoint,
  buildMinimalCurrentChartData,
  saveLatestPortfolioSnapshotFromChartData,
} from "@/lib/portfolio-snapshots";
import { createAdminClient } from "@/utils/supabase/admin";
import { isAuthorizedCron, unauthorizedCron } from "@/lib/security/cron";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

type PortfolioRow = {
  id: string;
  user_id: string;
  cash_balance: number | null;
  cash_deposited_total?: number | null;
  investment_amount?: number | null;
  created_at?: string | null;
};

type HoldingRow = {
  portfolio_id: string;
  ticker: string | null;
  shares: number | null;
  entry_price: number | null;
  purchase_date?: string | null;
  added_at?: string | null;
};

function toNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function groupByPortfolio<T extends { portfolio_id: string }>(rows: T[]) {
  return rows.reduce((map, row) => {
    const list = map.get(row.portfolio_id) ?? [];
    list.push(row);
    map.set(row.portfolio_id, list);
    return map;
  }, new Map<string, T[]>());
}

async function runInBatches<T>(
  items: T[],
  batchSize: number,
  fn: (item: T) => Promise<boolean>,
) {
  let saved = 0;
  let failed = 0;

  for (let i = 0; i < items.length; i += batchSize) {
    const results = await Promise.allSettled(items.slice(i, i + batchSize).map(fn));
    results.forEach((result) => {
      if (result.status === "fulfilled" && result.value) saved += 1;
      else failed += 1;
    });
  }

  return { saved, failed };
}

export async function GET(req: NextRequest) {
  const startedAt = performance.now();
  if (!isAuthorizedCron(req)) return unauthorizedCron();

  const supabase = createAdminClient();
  const portfolioLimit = Number(process.env.PORTFOLIO_SNAPSHOT_REFRESH_LIMIT ?? 250);
  const batchSize = Number(process.env.PORTFOLIO_SNAPSHOT_REFRESH_BATCH_SIZE ?? 25);

  const { data: portfolioRows, error: portfolioError } = await supabase
    .from("user_portfolios")
    .select("id,user_id,cash_balance,cash_deposited_total,investment_amount,created_at")
    .is("archived_at", null)
    .limit(portfolioLimit);

  if (portfolioError) {
    return NextResponse.json({ error: "Could not load portfolios" }, { status: 500 });
  }

  const portfolios = (portfolioRows ?? []) as PortfolioRow[];
  const portfolioIds = portfolios.map((portfolio) => portfolio.id);

  if (portfolioIds.length === 0) {
    console.info("[portfolio-refresh] portfoliosScanned=0 snapshotsWritten=0 failed=0 elapsedMs=0");
    return NextResponse.json({ ok: true, portfolios: 0, saved: 0, failed: 0 });
  }

  const { data: holdingRows, error: holdingsError } = await supabase
    .from("portfolio_holdings")
    .select("portfolio_id,ticker,shares,entry_price,purchase_date,added_at")
    .in("portfolio_id", portfolioIds)
    .not("ticker", "is", null);

  if (holdingsError) {
    return NextResponse.json({ error: "Could not load portfolio holdings" }, { status: 500 });
  }

  const holdingsByPortfolio = groupByPortfolio((holdingRows ?? []) as HoldingRow[]);
  const tickers = Array.from(
    new Set(
      ((holdingRows ?? []) as HoldingRow[])
        .map((holding) => String(holding.ticker ?? "").trim().toUpperCase())
        .filter(Boolean),
    ),
  );

  const { data: currentRows } =
    tickers.length > 0
      ? await supabase.from("stock_rankings").select("ticker,price").in("ticker", tickers)
      : { data: [] };

  const priceMap = new Map(
    ((currentRows ?? []) as Array<{ ticker: string | null; price: number | null }>)
      .map((row) => [String(row.ticker ?? "").toUpperCase(), toNumber(row.price, 0)] as const)
      .filter(([ticker, price]) => Boolean(ticker) && price > 0),
  );

  const result = await runInBatches(portfolios, Math.max(1, batchSize), async (portfolio) => {
    const holdings = holdingsByPortfolio.get(portfolio.id) ?? [];
    const portfolioPrices = Object.fromEntries(
      Array.from(new Set(holdings.map((holding) => String(holding.ticker ?? "").trim().toUpperCase()).filter(Boolean)))
        .map((ticker) => [ticker, priceMap.get(ticker) ?? 0]),
    );

    const currentPoint = buildCurrentPortfolioSnapshotPoint({
      portfolio,
      holdings,
      currentPrices: portfolioPrices,
    });

    return saveLatestPortfolioSnapshotFromChartData({
      supabase,
      portfolioId: portfolio.id,
      userId: portfolio.user_id,
      chartData: buildMinimalCurrentChartData(currentPoint),
      source: "cron_refresh",
    });
  });

  const elapsedMs = Math.round(performance.now() - startedAt);
  console.info(
    `[portfolio-refresh] portfoliosScanned=${portfolios.length} snapshotsWritten=${result.saved} failed=${result.failed} elapsedMs=${elapsedMs}`,
  );

  return NextResponse.json({
    ok: true,
    mode: "current-value-only",
    portfolios: portfolios.length,
    saved: result.saved,
    failed: result.failed,
  });
}
