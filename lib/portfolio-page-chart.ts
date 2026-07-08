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
  appendCurrentPointToPortfolioChartData,
  buildCurrentPortfolioSnapshotPoint,
  buildMinimalCurrentChartData,
  getPortfolioSnapshotChartDataWithHealth,
  isPortfolioChartLatestPointFresh,
  latestPortfolioInputChangeMs,
  saveLatestPortfolioSnapshotFromChartData,
} from "@/lib/portfolio-snapshots";
import { createAdminClient } from "@/utils/supabase/admin";

const PORTFOLIO_PAGE_CHART_CACHE_ENABLED =
  process.env.PORTFOLIO_PAGE_CHART_CACHE_ENABLED !== "0";

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
  const nowMs = Date.now();

  if (PORTFOLIO_PAGE_CHART_CACHE_ENABLED) {
    const cachedChart = await getLatestPortfolioChart({ portfolioId: portfolio.id, summary });
    if (cachedChart) {
      const health = assessPortfolioChartHealth({
        portfolioCreatedAt: portfolio.created_at ?? null,
        nowMs,
        chartData: cachedChart,
        summary,
      });
      if (health.displayable && isPortfolioChartLatestPointFresh({ chartData: cachedChart, nowMs })) {
        return { chartData: cachedChart, meta: { source: "cached-good", health } };
      }
    }
  }

  const supabase = createAdminClient();
  const resolvedOwnerId = await resolvePortfolioOwnerId({ supabase, portfolio, ownerId });
  const snapshotHoldings = holdingsForSnapshots(enriched);
  const currentPoint = buildCurrentPortfolioSnapshotPoint({
    portfolio: {
      cash_balance: portfolio.cash_balance,
      cash_deposited_total: portfolio.cash_deposited_total,
      investment_amount: portfolio.investment_amount,
    },
    holdings: snapshotHoldings,
    currentPrices: Object.fromEntries(
      enriched.map((holding) => [holding.ticker, toNumber(holding.currentPrice, 0)]),
    ),
    snapshotAt: new Date(nowMs),
  });
  const currentChart = buildMinimalCurrentChartData(currentPoint);
  const saveCurrentSnapshot = () => {
    if (!resolvedOwnerId) return;
    void saveLatestPortfolioSnapshotFromChartData({
      supabase,
      portfolioId: portfolio.id,
      userId: resolvedOwnerId,
      chartData: currentChart,
      source: "page_current_value",
    });
  };
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
      const needsCurrentPoint =
        snapshotChart.health.status === "stale" ||
        !isPortfolioChartLatestPointFresh({
          chartData: snapshotChart.chartData,
          nowMs,
        });
      const chartData = needsCurrentPoint
        ? appendCurrentPointToPortfolioChartData({
            chartData: snapshotChart.chartData,
            currentPoint,
            portfolioCreatedAt: portfolio.created_at ?? null,
            nowMs,
          })
        : snapshotChart.chartData;
      const health = needsCurrentPoint
        ? assessPortfolioChartHealth({
            portfolioCreatedAt: portfolio.created_at ?? null,
            latestInputMs,
            chartData,
            summary,
            nowMs,
          })
        : snapshotChart.health;

      if (needsCurrentPoint) saveCurrentSnapshot();

      if (PORTFOLIO_PAGE_CHART_CACHE_ENABLED) {
        await saveLatestPortfolioChart({
          portfolioId: portfolio.id,
          summary,
          chartData,
        });
      }

      return {
        chartData,
        meta: {
          source: "snapshots",
          health,
        },
      };
    }

    if (snapshotChart) {
      const chartData = appendCurrentPointToPortfolioChartData({
        chartData: snapshotChart.chartData,
        currentPoint,
        portfolioCreatedAt: portfolio.created_at ?? null,
        nowMs,
      });
      const health = assessPortfolioChartHealth({
        portfolioCreatedAt: portfolio.created_at ?? null,
        latestInputMs,
        chartData,
        summary,
        nowMs,
      });
      const hasDisplayPoints = Object.values(chartData).some((points) => (points?.length ?? 0) > 1);

      saveCurrentSnapshot();

      return {
        chartData,
        meta: {
          source: hasDisplayPoints ? "minimal-current" : "building",
          health: hasDisplayPoints ? health : snapshotChart.health,
        },
      };
    }
  }

  if ((summary.holdingsCount ?? 0) <= 0 && summary.totalValue <= 0.01) {
    return {
      chartData: {},
      meta: { source: "empty", health: emptyPortfolioChartHealth() },
    };
  }

  saveCurrentSnapshot();
  const health = assessPortfolioChartHealth({
    portfolioCreatedAt: portfolio.created_at ?? null,
    latestInputMs,
    chartData: currentChart,
    summary,
    nowMs,
  });

  return {
    chartData: currentChart,
    meta: { source: "minimal-current", health },
  };
}
