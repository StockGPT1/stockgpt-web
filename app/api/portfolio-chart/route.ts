import { NextResponse, type NextRequest } from "next/server";
import type { ChartPoint, TimeRange } from "@/components/StockChart";
import { getJsonCache, setJsonCache } from "@/lib/redis-cache";
import { hashPortfolioInputs } from "@/lib/portfolio-speed-cache";
import {
  assessPortfolioChartHealth,
  filterDisplayablePortfolioChartData,
} from "@/lib/portfolio-chart-health";
import {
  appendCurrentPointToPortfolioChartData,
  buildCurrentPortfolioSnapshotPoint,
  getPortfolioSnapshotChartDataWithHealth,
  isPortfolioChartLatestPointFresh,
  latestPortfolioInputChangeMs,
  saveLatestPortfolioSnapshotFromChartData,
} from "@/lib/portfolio-snapshots";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 20;

const PORTFOLIO_CHART_CACHE_TTL_SECONDS = Number(
  process.env.PORTFOLIO_CHART_CACHE_TTL_SECONDS ?? 60,
);

type HoldingRow = {
  ticker: string | null;
  shares: number | null;
  entry_price: number | null;
  purchase_date?: string | null;
  added_at?: string | null;
};

type TransactionRow = {
  ticker: string | null;
  type: string | null;
  shares: number | null;
  price: number | null;
  amount: number | null;
  realised_pnl: number | null;
  created_at: string | null;
};

type PortfolioRow = {
  id: string;
  user_id: string;
  cash_balance: number | null;
  cash_deposited_total?: number | null;
  investment_amount?: number | null;
  created_at?: string | null;
};

function toNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function portfolioChartCacheKey({
  userId,
  portfolioId,
  inputHash,
}: {
  userId: string;
  portfolioId: string;
  inputHash: string;
}) {
  return `portfolio:chart:v9:${userId}:${portfolioId}:${inputHash}`;
}

export async function GET(req: NextRequest) {
  const portfolioId = req.nextUrl.searchParams.get("portfolioId");
  if (!portfolioId) return NextResponse.json({ error: "Missing portfolioId" }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: portfolio, error: portfolioError } = await supabase
    .from("user_portfolios")
    .select("id,user_id,cash_balance,cash_deposited_total,investment_amount,created_at")
    .eq("id", portfolioId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (portfolioError || !portfolio) {
    return NextResponse.json({ error: "Portfolio not found" }, { status: 404 });
  }

  const [{ data: holdingRows, error: holdingsError }, { data: transactionRows, error: transactionError }] =
    await Promise.all([
      supabase
        .from("portfolio_holdings")
        .select("ticker,shares,entry_price,purchase_date,added_at")
        .eq("portfolio_id", portfolioId)
        .not("ticker", "is", null),
      supabase
        .from("portfolio_transactions")
        .select("ticker,type,shares,price,amount,realised_pnl,created_at")
        .eq("portfolio_id", portfolioId)
        .order("created_at", { ascending: true })
        .limit(2000),
    ]);

  if (holdingsError || transactionError) {
    return NextResponse.json({ error: "Could not load portfolio history" }, { status: 500 });
  }

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

  const portfolioRow = portfolio as PortfolioRow;
  const holdings = (holdingRows ?? []) as HoldingRow[];
  const transactions = (transactionRows ?? []) as TransactionRow[];
  const prices = ((currentRows ?? []) as Array<{ ticker: string | null; price: number | null }>)
    .map((row) => ({
      ticker: String(row.ticker ?? "").toUpperCase(),
      price: toNumber(row.price, 0),
    }))
    .sort((a, b) => a.ticker.localeCompare(b.ticker));
  const nowMs = Date.now();
  const currentPoint = buildCurrentPortfolioSnapshotPoint({
    portfolio: portfolioRow,
    holdings,
    currentPrices: Object.fromEntries(prices.map((row) => [row.ticker, row.price])),
    snapshotAt: new Date(nowMs),
  });
  const currentSnapshotChart = { "1D": [currentPoint] } satisfies Partial<
    Record<TimeRange, ChartPoint[]>
  >;
  const saveCurrentSnapshot = () => {
    void saveLatestPortfolioSnapshotFromChartData({
      supabase,
      portfolioId,
      userId: user.id,
      chartData: currentSnapshotChart,
      source: "page",
    });
  };

  const latestInputMs = latestPortfolioInputChangeMs({
    portfolioCreatedAt: portfolioRow.created_at ?? null,
    holdings,
    transactions,
  });

  const chartInputHash = hashPortfolioInputs({
    version: "portfolio-chart-v9",
    portfolio: portfolioRow,
    holdings,
    transactions,
    prices,
  });
  const cacheKey = portfolioChartCacheKey({
    userId: user.id,
    portfolioId,
    inputHash: chartInputHash,
  });
  const cachedChartData =
    await getJsonCache<Partial<Record<TimeRange, ChartPoint[]>>>(cacheKey);
  if (cachedChartData) {
    const health = assessPortfolioChartHealth({
      portfolioCreatedAt: portfolioRow.created_at ?? null,
      latestInputMs,
      nowMs,
      chartData: cachedChartData,
      summary: { holdingsCount: holdings.length },
    });
    const displayableCached = filterDisplayablePortfolioChartData(cachedChartData);
    if (health.displayable && isPortfolioChartLatestPointFresh({ chartData: displayableCached, nowMs })) {
      return NextResponse.json({ chartData: displayableCached, meta: { source: "cached-good", health } });
    }
  }

  const snapshotChart = await getPortfolioSnapshotChartDataWithHealth({
    supabase,
    portfolioId,
    userId: user.id,
    portfolioCreatedAt: portfolioRow.created_at ?? null,
    latestInputMs,
    summary: { holdingsCount: holdings.length },
  });

  if (snapshotChart?.health.displayable) {
    const needsCurrentPoint =
      snapshotChart.health.status === "stale" ||
      !isPortfolioChartLatestPointFresh({
        chartData: snapshotChart.chartData,
        nowMs,
      });
    const chartData = filterDisplayablePortfolioChartData(
      needsCurrentPoint
        ? appendCurrentPointToPortfolioChartData({
            chartData: snapshotChart.chartData,
            currentPoint,
            portfolioCreatedAt: portfolioRow.created_at ?? null,
            nowMs,
          })
        : snapshotChart.chartData,
    );
    const health = needsCurrentPoint
      ? assessPortfolioChartHealth({
          portfolioCreatedAt: portfolioRow.created_at ?? null,
          latestInputMs,
          chartData,
          summary: { holdingsCount: holdings.length },
          nowMs,
        })
      : snapshotChart.health;

    if (needsCurrentPoint) saveCurrentSnapshot();
    void setJsonCache(cacheKey, chartData, PORTFOLIO_CHART_CACHE_TTL_SECONDS);
    return NextResponse.json({ chartData, meta: { source: "snapshots", health } });
  }

  const chartData = snapshotChart
    ? filterDisplayablePortfolioChartData(appendCurrentPointToPortfolioChartData({
        chartData: snapshotChart.chartData,
        currentPoint,
        portfolioCreatedAt: portfolioRow.created_at ?? null,
        nowMs,
      }))
    : {};

  saveCurrentSnapshot();
  const health = assessPortfolioChartHealth({
    portfolioCreatedAt: portfolioRow.created_at ?? null,
    latestInputMs,
    chartData,
    summary: { holdingsCount: holdings.length },
    nowMs,
  });

  return NextResponse.json({
    chartData,
    meta: { source: health.displayable ? "snapshots" : "building", health },
  });
}
