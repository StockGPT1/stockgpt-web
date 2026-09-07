import type { ChartPoint, TimeRange } from "@/components/StockChart";
import {
  assessPortfolioChartHealth,
  emptyPortfolioChartHealth,
  filterDisplayablePortfolioChartData,
  type PortfolioChartMeta,
} from "@/lib/portfolio-chart-health";
import {
  buildPortfolioChartInputFingerprint,
  getLatestPortfolioChart,
  saveLatestPortfolioChart,
} from "@/lib/portfolio-chart-cache";
import {
  appendCurrentPointToPortfolioChartData,
  buildCurrentPortfolioSnapshotPoint,
  getPortfolioSnapshotChartDataWithHealth,
  latestPortfolioInputChangeMs,
} from "@/lib/portfolio-snapshots";
import { createAdminClient } from "@/utils/supabase/admin";
import { isCanonicalUsdPortfolio } from "@/lib/portfolio-accounting-basis";
import {
  suppressUnavailablePortfolioPerformance,
  type PortfolioPerformanceAvailability,
} from "@/lib/portfolio-performance-availability";

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

export type PortfolioChartMarketFact = {
  ticker: string | null;
  price: number | null;
  last_price_update?: string | null;
};

export type PortfolioPageChartResult = {
  chartData: Partial<Record<TimeRange, ChartPoint[]>>;
  meta: PortfolioChartMeta;
};

export type PortfolioChartHolding = {
  ticker: string;
  shares: number;
  entryPrice: number;
  currentPrice: number;
  currentValue: number;
  purchaseDate: string | null;
  addedAt: string;
};

type PortfolioChartSummary = {
  holdingsCount: number;
  totalValue: number;
  totalPnl?: number | null;
  totalPnlPct?: number | null;
  performanceAvailability?: PortfolioPerformanceAvailability;
};

export function applyPortfolioPerformanceAvailabilityToChart(
  chartData: Partial<Record<TimeRange, ChartPoint[]>>,
  availability: PortfolioPerformanceAvailability | undefined,
) {
  if (!availability || availability.status === "available") return chartData;
  return Object.fromEntries(
    Object.entries(chartData).map(([range, points]) => [
      range,
      (points ?? []).map((point) =>
        suppressUnavailablePortfolioPerformance(point, availability),
      ),
    ]),
  ) as Partial<Record<TimeRange, ChartPoint[]>>;
}

function holdingsForSnapshots(enriched: PortfolioChartHolding[]) {
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
  const expectedOwnerId = ownerId ?? portfolio.user_id ?? null;
  let query = supabase
    .from("user_portfolios")
    .select("user_id")
    .eq("id", portfolio.id);
  if (expectedOwnerId) query = query.eq("user_id", expectedOwnerId);
  const { data, error } = await query.maybeSingle();

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
  marketFacts,
  allowCurrentPoint,
}: {
  portfolio: PortfolioLike;
  enriched: PortfolioChartHolding[];
  transactions: TransactionLike[];
  summary: PortfolioChartSummary;
  ownerId?: string | null;
  marketFacts?: PortfolioChartMarketFact[];
  allowCurrentPoint?: boolean;
}): Promise<Partial<Record<TimeRange, ChartPoint[]>>> {
  return (
    await buildPortfolioPageChartResult({
      portfolio,
      enriched,
      transactions,
      summary,
      ownerId,
      marketFacts,
      allowCurrentPoint,
    })
  ).chartData;
}

export async function buildPortfolioPageChartResult({
  portfolio,
  enriched,
  transactions,
  summary,
  ownerId,
  marketFacts,
  allowCurrentPoint = true,
}: {
  portfolio: PortfolioLike;
  enriched: PortfolioChartHolding[];
  transactions: TransactionLike[];
  summary: PortfolioChartSummary;
  ownerId?: string | null;
  marketFacts?: PortfolioChartMarketFact[];
  allowCurrentPoint?: boolean;
}): Promise<PortfolioPageChartResult> {
  if (!isCanonicalUsdPortfolio(portfolio.currency)) {
    return {
      chartData: {},
      meta: { source: "empty", health: emptyPortfolioChartHealth() },
    };
  }
  const nowMs = Date.now();
  const supabase = createAdminClient();
  const resolvedOwnerId = await resolvePortfolioOwnerId({ supabase, portfolio, ownerId });
  const marketFactsByTicker = new Map(
    (marketFacts ?? []).map((fact) => [String(fact.ticker ?? "").trim().toUpperCase(), fact]),
  );
  const snapshotHoldings = holdingsForSnapshots(enriched).map((holding) => ({
    ...holding,
    // When factual quotes were supplied, enrichment from a different read must
    // not override their value or turn a missing quote into a current valuation.
    currentPrice: marketFacts === undefined ? holding.currentPrice
      : marketFactsByTicker.get(holding.ticker.trim().toUpperCase())?.price ?? 0,
  }));
  const currentPointRaw = allowCurrentPoint
    ? buildCurrentPortfolioSnapshotPoint({
    portfolio: {
      cash_balance: portfolio.cash_balance,
      cash_deposited_total: portfolio.cash_deposited_total,
    },
    holdings: snapshotHoldings,
    currentPrices: Object.fromEntries(
      snapshotHoldings.map((holding) => [holding.ticker, holding.currentPrice]),
    ),
    snapshotAt: new Date(nowMs),
  })
    : null;
  const currentPoint = currentPointRaw
    ? suppressUnavailablePortfolioPerformance(
        currentPointRaw,
        summary.performanceAvailability ?? { status: "available", limitations: [] },
      )
    : null;
  const latestInputMs = latestPortfolioInputChangeMs({
    portfolioCreatedAt: portfolio.created_at ?? null,
    holdings: snapshotHoldings,
    transactions,
  });
  const inputFingerprint = resolvedOwnerId
    ? buildPortfolioChartInputFingerprint({
        ownerId: resolvedOwnerId,
        portfolioId: portfolio.id,
        accountingBasis: "canonical_usd",
        portfolioCreatedAt: portfolio.created_at ?? null,
        cashBalance: portfolio.cash_balance,
        netContributedCapital: portfolio.cash_deposited_total,
        holdings: snapshotHoldings.map((holding) => {
          const marketFact = marketFactsByTicker.get(
            String(holding.ticker ?? "").trim().toUpperCase(),
          );
          return {
            ticker: holding.ticker,
            shares: holding.shares,
            entryPrice: holding.entryPrice,
            purchaseDate: holding.purchaseDate ?? null,
            addedAt: holding.addedAt ?? null,
            currentPrice: holding.currentPrice,
            currentPriceUpdatedAt: marketFact?.last_price_update ?? null,
          };
        }),
        transactions: transactions.map((transaction) => ({
          id: transaction.id ?? null,
          createdAt: transaction.created_at ?? null,
          ticker: transaction.ticker ?? null,
          type: transaction.type ?? null,
          shares: transaction.shares,
          price: transaction.price,
          amount: transaction.amount,
          realisedPnl: transaction.realised_pnl,
          currency: transaction.currency ?? null,
        })),
      })
    : null;

  if (PORTFOLIO_PAGE_CHART_CACHE_ENABLED && currentPoint && resolvedOwnerId && inputFingerprint) {
    const cachedChart = await getLatestPortfolioChart({
      ownerId: resolvedOwnerId,
      portfolioId: portfolio.id,
      inputFingerprint,
      nowMs,
    });
    if (cachedChart) {
      const health = assessPortfolioChartHealth({
        portfolioCreatedAt: portfolio.created_at ?? null,
        latestInputMs,
        nowMs,
        chartData: cachedChart,
        summary,
      });
      if (health.displayable) {
        return {
          chartData: applyPortfolioPerformanceAvailabilityToChart(cachedChart, summary.performanceAvailability),
          meta: { source: "cached-good", health },
        };
      }
    }
  }

  if (!currentPoint) {
    const health = assessPortfolioChartHealth({
      portfolioCreatedAt: portfolio.created_at ?? null,
      latestInputMs,
      chartData: {},
      summary,
      nowMs,
    });
    return { chartData: {}, meta: { source: "building", health } };
  }

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
      const chartData = applyPortfolioPerformanceAvailabilityToChart(filterDisplayablePortfolioChartData(
        appendCurrentPointToPortfolioChartData({
          chartData: snapshotChart.chartData,
          currentPoint,
          portfolioCreatedAt: portfolio.created_at ?? null,
          nowMs,
        }),
      ), summary.performanceAvailability);
      const health = assessPortfolioChartHealth({
        portfolioCreatedAt: portfolio.created_at ?? null,
        latestInputMs,
        chartData,
        summary,
        nowMs,
      });

      if (
        PORTFOLIO_PAGE_CHART_CACHE_ENABLED &&
        resolvedOwnerId &&
        inputFingerprint
      ) {
        /* cache write must not sit on the render path — the reader
           tolerates a missing/stale cache and rebuilds from snapshots */
        void saveLatestPortfolioChart({
          ownerId: resolvedOwnerId,
          portfolioId: portfolio.id,
          inputFingerprint,
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

    if (snapshotChart) {
      const chartData = applyPortfolioPerformanceAvailabilityToChart(filterDisplayablePortfolioChartData(
        appendCurrentPointToPortfolioChartData({
          chartData: snapshotChart.chartData,
          currentPoint,
          portfolioCreatedAt: portfolio.created_at ?? null,
          nowMs,
        }),
      ), summary.performanceAvailability);
      const health = assessPortfolioChartHealth({
        portfolioCreatedAt: portfolio.created_at ?? null,
        latestInputMs,
        chartData,
        summary,
        nowMs,
      });

      return {
        chartData,
        meta: {
          source: health.displayable ? "snapshots" : "building",
          health: health.displayable ? health : snapshotChart.health,
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
