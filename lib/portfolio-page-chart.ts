import type { ChartPoint, TimeRange } from "@/components/StockChart";
import {
  assessPortfolioChartHealth,
  emptyPortfolioChartHealth,
  type PortfolioChartMeta,
} from "@/lib/portfolio-chart-health";
import type { PortfolioHealthSummary } from "@/lib/portfolio-health";
import type { EnrichedHolding } from "@/lib/portfolio-alerts";
import {
  getLatestPortfolioChart,
  saveLatestPortfolioChart,
} from "@/lib/portfolio-chart-cache";
import {
  buildCurrentPortfolioSnapshotPoint,
  buildMinimalCurrentChartData,
  getPortfolioSnapshotChartDataWithHealth,
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

export type PortfolioPageChartResult = {
  chartData: Partial<Record<TimeRange, ChartPoint[]>>;
  meta: PortfolioChartMeta;
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
  return (
    await buildPortfolioPageChartResult({
      portfolio,
      enriched,
      transactions,
      summary,
      ownerId,
    })
  ).chartData;
}

export async function buildPortfolioPageChartResult({
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
}): Promise<PortfolioPageChartResult> {
  if (PORTFOLIO_PAGE_CHART_CACHE_ENABLED) {
    const cachedChart = await getLatestPortfolioChart({ portfolioId: portfolio.id, summary });
    if (cachedChart) {
      const health = assessPortfolioChartHealth({
        portfolioCreatedAt: portfolio.created_at ?? null,
        chartData: cachedChart,
        summary,
      });
      if (health.displayable) {
        return { chartData: cachedChart, meta: { source: "cached-good", health } };
      }
    }
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
    const snapshotChart = await getPortfolioSnapshotChartDataWithHealth({
      supabase,
      portfolioId: portfolio.id,
      userId: resolvedOwnerId,
      portfolioCreatedAt: portfolio.created_at ?? null,
      latestInputMs,
      summary,
    });

    if (snapshotChart?.health.displayable) {
      if (PORTFOLIO_PAGE_CHART_CACHE_ENABLED) {
        await saveLatestPortfolioChart({
          portfolioId: portfolio.id,
          summary,
          chartData: snapshotChart.chartData,
        });
      }

      return {
        chartData: snapshotChart.chartData,
        meta: {
          source: "snapshots",
          health: snapshotChart.health,
        },
      };
    }

    if (snapshotChart) {
      void writeCurrentSnapshotSeed({
        supabase,
        portfolio,
        enriched,
        resolvedOwnerId,
      });
      return { chartData: {}, meta: { source: "building", health: snapshotChart.health } };
    }
  }

  if ((summary.holdingsCount ?? 0) <= 0 && summary.totalValue <= 0.01) {
    return {
      chartData: {},
      meta: { source: "empty", health: emptyPortfolioChartHealth() },
    };
  }

  const currentChart = await writeCurrentSnapshotSeed({
    supabase,
    portfolio,
    enriched,
    resolvedOwnerId,
  });
  const health = assessPortfolioChartHealth({
    portfolioCreatedAt: portfolio.created_at ?? null,
    latestInputMs,
    chartData: currentChart,
    summary,
  });

  return {
    chartData: {},
    meta: { source: "building", health },
  };
}

async function writeCurrentSnapshotSeed({
  supabase,
  portfolio,
  enriched,
  resolvedOwnerId,
}: {
  supabase: ReturnType<typeof createAdminClient>;
  portfolio: PortfolioLike;
  enriched: EnrichedHolding[];
  resolvedOwnerId: string | null;
}) {
  const currentPoint = buildCurrentPortfolioSnapshotPoint({
    portfolio: {
      cash_balance: portfolio.cash_balance,
      cash_deposited_total: portfolio.cash_deposited_total,
      investment_amount: portfolio.investment_amount,
    },
    holdings: holdingsForSnapshots(enriched),
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
