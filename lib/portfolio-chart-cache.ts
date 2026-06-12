import type { ChartPoint, TimeRange } from "@/components/StockChart";
import type { PortfolioHealthSummary } from "@/lib/portfolio-health";
import { getJsonCache, setJsonCache } from "@/lib/redis-cache";
import type { PortfolioSnapshotPayload } from "@/lib/portfolio-speed-cache";

const PORTFOLIO_CHART_CACHE_TTL_SECONDS = Math.max(
  60,
  Number(process.env.PORTFOLIO_CHART_CACHE_TTL_SECONDS ?? 15 * 60),
);
const PORTFOLIO_CHART_CACHE_VERSION = "v4";

export type PortfolioChartData = Partial<Record<TimeRange, ChartPoint[]>>;

type PortfolioChartCachePayload = {
  chartData: PortfolioChartData;
  totalValue: number;
  totalPnl: number;
  totalPnlPct: number;
  holdingsCount: number;
  generatedAt: string;
};

type SummaryLike = {
  totalValue?: unknown;
  totalPnl?: unknown;
  totalPnlPct?: unknown;
  holdingsCount?: unknown;
};

function portfolioChartKey(portfolioId: string) {
  return `portfolio:chart:${PORTFOLIO_CHART_CACHE_VERSION}:latest:${portfolioId}`;
}

function toNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normaliseSummary(summary: SummaryLike) {
  return {
    totalValue: toNumber(summary.totalValue, 0),
    totalPnl: toNumber(summary.totalPnl, 0),
    totalPnlPct: toNumber(summary.totalPnlPct, 0),
    holdingsCount: Math.round(toNumber(summary.holdingsCount, 0)),
  };
}

export function hasUsablePortfolioChart(chartData: PortfolioChartData | null | undefined) {
  if (!chartData) return false;
  return Object.values(chartData).some((points) => (points?.length ?? 0) > 1);
}

function chartMatchesSummary(payload: PortfolioChartCachePayload, summary: SummaryLike) {
  const current = normaliseSummary(summary);

  return (
    Math.abs(payload.totalValue - current.totalValue) <= 0.01 &&
    Math.abs(payload.totalPnl - current.totalPnl) <= 0.01 &&
    Math.abs(payload.totalPnlPct - current.totalPnlPct) <= 0.05 &&
    payload.holdingsCount === current.holdingsCount
  );
}

export async function getLatestPortfolioChart({
  portfolioId,
  summary,
}: {
  portfolioId: string;
  summary: SummaryLike;
}): Promise<PortfolioChartData | null> {
  const payload = await getJsonCache<PortfolioChartCachePayload>(portfolioChartKey(portfolioId));

  if (!payload || !hasUsablePortfolioChart(payload.chartData)) return null;
  if (!chartMatchesSummary(payload, summary)) return null;

  return payload.chartData;
}

export async function saveLatestPortfolioChart({
  portfolioId,
  summary,
  chartData,
}: {
  portfolioId: string;
  summary: PortfolioHealthSummary;
  chartData: PortfolioChartData;
}) {
  if (!hasUsablePortfolioChart(chartData)) return;

  const current = normaliseSummary(summary);
  await setJsonCache<PortfolioChartCachePayload>(
    portfolioChartKey(portfolioId),
    {
      chartData,
      totalValue: current.totalValue,
      totalPnl: current.totalPnl,
      totalPnlPct: current.totalPnlPct,
      holdingsCount: current.holdingsCount,
      generatedAt: new Date().toISOString(),
    },
    PORTFOLIO_CHART_CACHE_TTL_SECONDS,
  );
}

export async function overlayLatestPortfolioChart({
  portfolioId,
  snapshot,
}: {
  portfolioId: string;
  snapshot: PortfolioSnapshotPayload;
}): Promise<PortfolioSnapshotPayload> {
  const summary = snapshot.summary as SummaryLike | null | undefined;
  if (!summary) return snapshot;

  const chartData = await getLatestPortfolioChart({ portfolioId, summary });
  if (!chartData) return snapshot;

  return {
    ...snapshot,
    chartData,
  };
}
