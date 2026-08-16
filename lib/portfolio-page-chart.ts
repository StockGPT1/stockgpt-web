import type { ChartPoint, TimeRange } from "@/components/StockChart";
import {
  assessPortfolioChartHealth,
  emptyPortfolioChartHealth,
  filterDisplayablePortfolioChartData,
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
  getPortfolioSnapshotChartDataWithHealth,
  isPortfolioChartLatestPointFresh,
  latestPortfolioInputChangeMs,
  saveLatestPortfolioSnapshotFromChartData,
  savePortfolioSnapshotsFromChartData,
} from "@/lib/portfolio-snapshots";
import { buildPortfolioValueTimeline } from "@/lib/portfolio-value-timeline";
import { createAdminClient } from "@/utils/supabase/admin";

const PORTFOLIO_PAGE_CHART_CACHE_ENABLED =
  process.env.PORTFOLIO_PAGE_CHART_CACHE_ENABLED !== "0";

type PortfolioLike = {
  id: string;
  name: string | null;
  objective?: string | null;
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

function pointMs(point: ChartPoint) {
  const ms = new Date(point.date).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function isWeekendUtc(ms: number) {
  const day = new Date(ms).getUTCDay();
  return day === 0 || day === 6;
}

function keepWeekdayPortfolioPoints(
  chartData: Partial<Record<TimeRange, ChartPoint[]>>,
): Partial<Record<TimeRange, ChartPoint[]>> {
  return Object.fromEntries(
    Object.entries(chartData).map(([range, points]) => {
      if (range === "1D") return [range, points ?? []];

      const sorted = [...(points ?? [])].sort((a, b) => (pointMs(a) ?? 0) - (pointMs(b) ?? 0));
      const first = sorted[0] ?? null;
      const last = sorted.at(-1) ?? null;
      const filtered = sorted.filter((point) => {
        const ms = pointMs(point);
        if (ms == null) return false;
        if (point === first || point === last) return true;
        return !isWeekendUtc(ms);
      });

      return [range, filtered];
    }),
  ) as Partial<Record<TimeRange, ChartPoint[]>>;
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

function currentPricesForHoldings(enriched: EnrichedHolding[]) {
  return Object.fromEntries(
    enriched
      .map((holding) => [holding.ticker, toNumber(holding.currentPrice, 0)] as const)
      .filter(([, price]) => price > 0),
  );
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
  allowCurrentSnapshot,
}: {
  portfolio: PortfolioLike;
  enriched: EnrichedHolding[];
  transactions: TransactionLike[];
  summary: PortfolioHealthSummary;
  ownerId?: string | null;
  allowCurrentSnapshot?: boolean;
}): Promise<Partial<Record<TimeRange, ChartPoint[]>>> {
  return (
    await buildPortfolioPageChartResult({
      portfolio,
      enriched,
      transactions,
      summary,
      ownerId,
      allowCurrentSnapshot,
    })
  ).chartData;
}

export async function buildPortfolioPageChartResult({
  portfolio,
  enriched,
  transactions,
  summary,
  ownerId,
  allowCurrentSnapshot = true,
}: {
  portfolio: PortfolioLike;
  enriched: EnrichedHolding[];
  transactions: TransactionLike[];
  summary: PortfolioHealthSummary;
  ownerId?: string | null;
  allowCurrentSnapshot?: boolean;
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
  const currentPrices = currentPricesForHoldings(enriched);
  const currentPoint = buildCurrentPortfolioSnapshotPoint({
    portfolio: {
      cash_balance: portfolio.cash_balance,
      cash_deposited_total: portfolio.cash_deposited_total,
      investment_amount: portfolio.investment_amount,
    },
    holdings: snapshotHoldings,
    currentPrices,
    snapshotAt: new Date(nowMs),
  });
  const currentSnapshotChart = { "1D": [currentPoint] } satisfies Partial<
    Record<TimeRange, ChartPoint[]>
  >;
  const saveCurrentSnapshot = () => {
    if (!resolvedOwnerId || !allowCurrentSnapshot) return;
    void saveLatestPortfolioSnapshotFromChartData({
      supabase,
      portfolioId: portfolio.id,
      userId: resolvedOwnerId,
      chartData: currentSnapshotChart,
      source: "page_current_value",
    });
  };
  const latestInputMs = latestPortfolioInputChangeMs({
    portfolioCreatedAt: portfolio.created_at ?? null,
    holdings: snapshotHoldings,
    transactions,
  });
  const rebuildTimelineChart = async (): Promise<PortfolioPageChartResult | null> => {
    if ((summary.holdingsCount ?? 0) <= 0 && summary.totalValue <= 0.01) return null;

    const timelineChart = await buildPortfolioValueTimeline({
      portfolio,
      holdings: snapshotHoldings,
      transactions,
      currentPrices,
    });
    const chartData = filterDisplayablePortfolioChartData(
      keepWeekdayPortfolioPoints(timelineChart),
    );
    const health = assessPortfolioChartHealth({
      portfolioCreatedAt: portfolio.created_at ?? null,
      latestInputMs,
      chartData,
      summary,
      nowMs,
    });

    if (!health.displayable) return null;

    saveCurrentSnapshot();

    if (resolvedOwnerId) {
      void savePortfolioSnapshotsFromChartData({
        supabase,
        portfolioId: portfolio.id,
        userId: resolvedOwnerId,
        chartData,
        source: "chart_rebuild",
      }).catch((error) => {
        console.warn("[portfolio-page-chart] timeline snapshot write failed", error);
      });
    }

    if (PORTFOLIO_PAGE_CHART_CACHE_ENABLED) {
      void saveLatestPortfolioChart({
        portfolioId: portfolio.id,
        summary,
        chartData,
      }).catch((error) => {
        console.warn("[portfolio-page-chart] timeline cache write failed", error);
      });
    }

    return {
      chartData,
      meta: {
        source: "timeline-rebuild",
        health,
      },
    };
  };

  if (resolvedOwnerId) {
    const snapshotChart = await getPortfolioSnapshotChartDataWithHealth({
      supabase,
      portfolioId: portfolio.id,
      userId: resolvedOwnerId,
      portfolioCreatedAt: portfolio.created_at ?? null,
      latestInputMs,
      summary,
    });

    if (snapshotChart?.health.displayable && snapshotChart.health.status !== "sparse") {
      const needsCurrentPoint =
        allowCurrentSnapshot &&
        (snapshotChart.health.status === "stale" ||
          !isPortfolioChartLatestPointFresh({
            chartData: snapshotChart.chartData,
            nowMs,
          }));
      const chartData = filterDisplayablePortfolioChartData(
        needsCurrentPoint
          ? appendCurrentPointToPortfolioChartData({
              chartData: snapshotChart.chartData,
              currentPoint,
              portfolioCreatedAt: portfolio.created_at ?? null,
              nowMs,
            })
          : snapshotChart.chartData,
      );
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
        /* cache write must not sit on the render path — the reader
           tolerates a missing/stale cache and rebuilds from snapshots */
        void saveLatestPortfolioChart({
          portfolioId: portfolio.id,
          summary,
          chartData,
        }).catch((error) => {
          console.warn("[portfolio-page-chart] chart cache write failed", error);
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

    const rebuilt = await rebuildTimelineChart();
    if (rebuilt) return rebuilt;

    if (snapshotChart) {
      const chartData = filterDisplayablePortfolioChartData(
        allowCurrentSnapshot
          ? appendCurrentPointToPortfolioChartData({
              chartData: snapshotChart.chartData,
              currentPoint,
              portfolioCreatedAt: portfolio.created_at ?? null,
              nowMs,
            })
          : snapshotChart.chartData,
      );
      const health = assessPortfolioChartHealth({
        portfolioCreatedAt: portfolio.created_at ?? null,
        latestInputMs,
        chartData,
        summary,
        nowMs,
      });

      saveCurrentSnapshot();

      return {
        chartData,
        meta: {
          source: health.displayable ? "snapshots" : "building",
          health: health.displayable ? health : snapshotChart.health,
        },
      };
    }
  }

  const rebuilt = await rebuildTimelineChart();
  if (rebuilt) return rebuilt;

  if ((summary.holdingsCount ?? 0) <= 0 && summary.totalValue <= 0.01) {
    return {
      chartData: {},
      meta: { source: "empty", health: emptyPortfolioChartHealth() },
    };
  }

  if (allowCurrentSnapshot) saveCurrentSnapshot();
  const health = assessPortfolioChartHealth({
    portfolioCreatedAt: portfolio.created_at ?? null,
    latestInputMs,
    chartData: {},
    summary,
    nowMs,
  });

  return {
    chartData: {},
    meta: { source: "building", health },
  };
}
