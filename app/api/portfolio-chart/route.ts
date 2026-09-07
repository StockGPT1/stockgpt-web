import { NextResponse, type NextRequest } from "next/server";
import {
  buildPortfolioChartInputFingerprint,
  getLatestPortfolioChart,
  saveLatestPortfolioChart,
} from "@/lib/portfolio-chart-cache";
import {
  assessPortfolioChartHealth,
  filterDisplayablePortfolioChartData,
} from "@/lib/portfolio-chart-health";
import {
  appendCurrentPointToPortfolioChartData,
  buildCurrentPortfolioSnapshotPoint,
  getPortfolioSnapshotChartDataWithHealth,
  latestPortfolioInputChangeMs,
} from "@/lib/portfolio-snapshots";
import { createClient } from "@/utils/supabase/server";
import { isCanonicalUsdPortfolio } from "@/lib/portfolio-accounting-basis";
import { readPortfolioLedger } from "@/lib/portfolio-ledger-reader";
import {
  applyPortfolioPerformanceAvailabilityToChart,
} from "@/lib/portfolio-page-chart";
import {
  assessPortfolioPerformanceAvailability,
  suppressUnavailablePortfolioPerformance,
} from "@/lib/portfolio-performance-availability";

export const dynamic = "force-dynamic";
export const maxDuration = 20;

type HoldingRow = {
  ticker: string | null;
  shares: number | null;
  entry_price: number | null;
  purchase_date?: string | null;
  added_at?: string | null;
};

type TransactionRow = {
  id: string;
  ticker: string | null;
  type: string | null;
  shares: number | null;
  price: number | null;
  amount: number | null;
  realised_pnl: number | null;
  currency: string | null;
  created_at: string | null;
  notes: string | null;
};

type PortfolioRow = {
  id: string;
  user_id: string;
  cash_balance: number | null;
  cash_deposited_total?: number | null;
  investment_amount?: number | null;
  created_at?: string | null;
  currency: string | null;
};

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
    .select("id,user_id,cash_balance,cash_deposited_total,investment_amount,created_at,currency")
    .eq("id", portfolioId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (portfolioError || !portfolio) {
    return NextResponse.json({ error: "Portfolio not found" }, { status: 404 });
  }
  if (!isCanonicalUsdPortfolio(portfolio.currency)) {
    return NextResponse.json({
      chartData: {},
      meta: { source: "empty", limitation: "portfolio_currency_basis_unresolved" },
    });
  }

  const [{ data: holdingRows, error: holdingsError }, transactionRows] =
    await Promise.all([
      supabase
        .from("portfolio_holdings")
        .select("ticker,shares,entry_price,purchase_date,added_at")
        .eq("portfolio_id", portfolioId)
        .not("ticker", "is", null),
      readPortfolioLedger(supabase, portfolioId),
    ]);

  if (holdingsError) {
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
      ? await supabase
          .from("stock_rankings")
          .select("ticker,price,last_price_update")
          .in("ticker", tickers)
      : { data: [] };

  const portfolioRow = portfolio as PortfolioRow;
  const holdings = (holdingRows ?? []) as HoldingRow[];
  const transactions = (transactionRows ?? []) as TransactionRow[];
  const performanceAvailability = assessPortfolioPerformanceAvailability(transactions);
  const prices = ((currentRows ?? []) as Array<{
    ticker: string | null;
    price: number | null;
    last_price_update: string | null;
  }>)
    .map((row) => ({
      ticker: String(row.ticker ?? "").toUpperCase(),
      price: row.price,
      lastPriceUpdate: row.last_price_update,
    }))
    .sort((a, b) => a.ticker.localeCompare(b.ticker));
  const nowMs = Date.now();
  const currentPointRaw = buildCurrentPortfolioSnapshotPoint({
    portfolio: portfolioRow,
    holdings,
    currentPrices: Object.fromEntries(prices.map((row) => [row.ticker, row.price])),
    snapshotAt: new Date(nowMs),
  });
  const latestInputMs = latestPortfolioInputChangeMs({
    portfolioCreatedAt: portfolioRow.created_at ?? null,
    holdings,
    transactions,
  });

  const chartInputHash = buildPortfolioChartInputFingerprint({
    ownerId: user.id,
    portfolioId,
    accountingBasis: "canonical_usd",
    portfolioCreatedAt: portfolioRow.created_at ?? null,
    cashBalance: portfolioRow.cash_balance,
    netContributedCapital: portfolioRow.cash_deposited_total,
    holdings: holdings.map((holding) => {
      const ticker = String(holding.ticker ?? "").trim().toUpperCase();
      const price = prices.find((row) => row.ticker === ticker);
      return {
        ticker,
        shares: holding.shares,
        entryPrice: holding.entry_price,
        purchaseDate: holding.purchase_date ?? null,
        addedAt: holding.added_at ?? null,
        currentPrice: price?.price ?? null,
        currentPriceUpdatedAt: price?.lastPriceUpdate ?? null,
      };
    }),
    transactions: transactions.map((transaction) => ({
      id: transaction.id,
      createdAt: transaction.created_at,
      ticker: transaction.ticker,
      type: transaction.type,
      shares: transaction.shares,
      price: transaction.price,
      amount: transaction.amount,
      realisedPnl: transaction.realised_pnl,
      currency: transaction.currency,
    })),
  });
  const currentPoint = currentPointRaw
    ? suppressUnavailablePortfolioPerformance(currentPointRaw, performanceAvailability)
    : null;
  const cachedChartData = currentPoint
    ? await getLatestPortfolioChart({
        ownerId: user.id,
        portfolioId,
        inputFingerprint: chartInputHash,
        nowMs,
      })
    : null;
  if (cachedChartData) {
    const health = assessPortfolioChartHealth({
      portfolioCreatedAt: portfolioRow.created_at ?? null,
      latestInputMs,
      nowMs,
      chartData: cachedChartData,
      summary: { holdingsCount: holdings.length },
    });
    if (health.displayable) {
      return NextResponse.json({
        chartData: applyPortfolioPerformanceAvailabilityToChart(cachedChartData, performanceAvailability),
        meta: { source: "cached-good", health },
      });
    }
  }

  if (!currentPoint) {
    const health = assessPortfolioChartHealth({
      portfolioCreatedAt: portfolioRow.created_at ?? null,
      latestInputMs,
      nowMs,
      chartData: {},
      summary: { holdingsCount: holdings.length },
    });
    return NextResponse.json({ chartData: {}, meta: { source: "building", health } });
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
    const chartData = applyPortfolioPerformanceAvailabilityToChart(filterDisplayablePortfolioChartData(
      appendCurrentPointToPortfolioChartData({
        chartData: snapshotChart.chartData,
        currentPoint,
        portfolioCreatedAt: portfolioRow.created_at ?? null,
        nowMs,
      }),
    ), performanceAvailability);
    const health = assessPortfolioChartHealth({
      portfolioCreatedAt: portfolioRow.created_at ?? null,
      latestInputMs,
      chartData,
      summary: { holdingsCount: holdings.length },
      nowMs,
    });

    void saveLatestPortfolioChart({
      ownerId: user.id,
      portfolioId,
      inputFingerprint: chartInputHash,
      chartData,
    });
    return NextResponse.json({ chartData, meta: { source: "snapshots", health } });
  }

  const chartData = snapshotChart
    ? applyPortfolioPerformanceAvailabilityToChart(filterDisplayablePortfolioChartData(appendCurrentPointToPortfolioChartData({
        chartData: snapshotChart.chartData,
        currentPoint,
        portfolioCreatedAt: portfolioRow.created_at ?? null,
        nowMs,
      })), performanceAvailability)
    : {};

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
