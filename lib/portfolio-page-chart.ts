import type { ChartPoint, TimeRange } from "@/components/StockChart";
import type { PortfolioHealthSummary } from "@/lib/portfolio-health";
import type { EnrichedHolding } from "@/lib/portfolio-alerts";
import {
  getLatestPortfolioChart,
  saveLatestPortfolioChart,
} from "@/lib/portfolio-chart-cache";
import {
  buildCurrentPortfolioSnapshotPoint,
  buildMinimalCurrentChartData,
  getPortfolioSnapshotChartData,
  latestPortfolioInputChangeMs,
  saveLatestPortfolioSnapshotFromChartData,
} from "@/lib/portfolio-snapshots";
import { createAdminClient } from "@/utils/supabase/admin";

const PORTFOLIO_PAGE_CHART_CACHE_ENABLED =
  process.env.PORTFOLIO_PAGE_CHART_CACHE_ENABLED === "1";

type PortfolioLike = {
  id: string;
  name: string | null;
  risk_tolerance: string | null;
  time_horizon: string | null;
  investment_amount: number | null;
  cash_balance: number | null;
  cash_deposited_total?: number | null;
  currency: string | null;
  created_at?: string | null;
  user_id?: string | null;
};

type TransactionLike = {
  id?: string | null;
  portfolio_id?: string | null;
  ticker?: string | null;
  type?: string | null;
  shares?: number | null;
  price?: number | null;
  amount?: number | null;
  realised_pnl?: number | null;
  currency?: string | null;
  notes?: string | null;
  created_at?: string | null;
};

function toNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function holdingsForSnapshots(enriched: EnrichedHolding[]) {
  return enriched.map((holding) => ({
    ticker: holding.ticker,
    shares: holding.shares,
    entryPrice: holding.entryPrice,
    currentPrice: holding.currentPrice,
    currentValue: holding.currentValue,
    purchaseDate: holding.purchaseDate,
    addedAt: holding.addedAt,
  }));
}

async function resolvePortfolioOwnerId({
  supabase,
  portfolio,
  ownerId,
}: {
  supabase: ReturnType<typeof createAdminClient>;
  portfolio: PortfolioLike;
  ownerId?: string | null;
}) {
  if (ownerId) return ownerId;
  if (portfolio.user_id) return portfolio.user_id;

  const { data, error } = await supabase
    .from("user_portfolios")
    .select("user_id")
    .eq("id", portfolio.id)
    .maybeSingle();

  if (error) {
    console.warn("Could not resolve portfolio owner for chart snapshots", error.message ?? error);
    return null;
  }

  return typeof data?.user_id === "string" ? data.user_id : null;
}

export async function buildPortfolioPageChart({
  portfolio,
  enriched,
  transactions,
  summary,
  ownerId,
}: {
  portfolio: PortfolioLike;
  enriched: EnrichedHolding[];
  transactions: TransactionLike[];
  summary: PortfolioHealthSummary;
  ownerId?: string | null;
}): Promise<Partial<Record<TimeRange, ChartPoint[]>>> {
  if (PORTFOLIO_PAGE_CHART_CACHE_ENABLED) {
    const cachedChart = await getLatestPortfolioChart({ portfolioId: portfolio.id, summary });
    if (cachedChart) return cachedChart;
  }

  const supabase = createAdminClient();
  const resolvedOwnerId = await resolvePortfolioOwnerId({ supabase, portfolio, ownerId });
  const snapshotHoldings = holdingsForSnapshots(enriched);
  const latestInputMs = latestPortfolioInputChangeMs({
    portfolioCreatedAt: portfolio.created_at ?? null,
    holdings: snapshotHoldings,
    transactions,
  });

  if (resolvedOwnerId) {
    const snapshotChartData = await getPortfolioSnapshotChartData({
      supabase,
      portfolioId: portfolio.id,
      userId: resolvedOwnerId,
      portfolioCreatedAt: portfolio.created_at ?? null,
      latestInputMs,
    });

    if (snapshotChartData) {
      if (PORTFOLIO_PAGE_CHART_CACHE_ENABLED) {
        await saveLatestPortfolioChart({
          portfolioId: portfolio.id,
          summary,
          chartData: snapshotChartData,
        });
      }

      return snapshotChartData;
    }
  }

  const currentPoint = buildCurrentPortfolioSnapshotPoint({
    portfolio: {
      id: portfolio.id,
      cash_balance: portfolio.cash_balance,
      created_at: portfolio.created_at,
    },
    holdings: snapshotHoldings,
    currentPrices: Object.fromEntries(
      enriched.map((holding) => [holding.ticker, toNumber(holding.currentPrice, 0)]),
    ),
  });
  const chartData = buildMinimalCurrentChartData(currentPoint);

  if (resolvedOwnerId) {
    void saveLatestPortfolioSnapshotFromChartData({
      supabase,
      portfolioId: portfolio.id,
      userId: resolvedOwnerId,
      chartData,
      source: "page_current_value",
    });
  }

  return chartData;
}
