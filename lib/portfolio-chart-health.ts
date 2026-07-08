import type { ChartPoint, TimeRange } from "@/components/StockChart";

export const PORTFOLIO_CHART_RANGES: TimeRange[] = ["1D", "1M", "6M", "1Y", "MAX"];

export type PortfolioChartHealthStatus =
  | "healthy"
  | "stale"
  | "sparse"
  | "flat"
  | "missing"
  | "rebuild_needed"
  | "building"
  | "broken";

export type PortfolioChartSource =
  | "snapshots"
  | "cached-good"
  | "timeline-rebuild"
  | "minimal-current"
  | "building"
  | "empty";

export type PortfolioChartHealth = {
  status: PortfolioChartHealthStatus;
  reason: string;
  snapshotCount: number;
  liveCount: number;
  historicalCount: number;
  rangesAvailable: TimeRange[];
  rangeCounts: Partial<Record<TimeRange, number>>;
  latestSnapshotAt: string | null;
  firstSnapshotAt: string | null;
  latestInputCovered: boolean;
  isFlat: boolean;
  repairNeeded: boolean;
  displayable: boolean;
};

export type PortfolioChartMeta = {
  source: PortfolioChartSource;
  health: PortfolioChartHealth;
  repairScheduled?: boolean;
};

export type PortfolioChartData = Partial<Record<TimeRange, ChartPoint[]>>;

export type PortfolioChartSnapshotHealthRow = {
  snapshot_at?: string | null;
  source?: string | null;
  value?: unknown;
  cash?: unknown;
  basis?: unknown;
};

type SummaryLike = {
  holdingsCount?: unknown;
  totalValue?: unknown;
};

const LIVE_SNAPSHOT_SOURCES = new Set([
  "cron_refresh",
  "page_current_value",
  "page",
  "health_repair_live",
  "system",
]);
const HISTORICAL_SNAPSHOT_SOURCES = new Set(["backfill", "chart_rebuild"]);
const DEFAULT_STALE_LIVE_MS = 30 * 60 * 1000;
const MIN_NON_MINIMAL_POINTS = 3;

function toNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function safeDateMs(value: string | null | undefined) {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function cleanSource(source?: string | null) {
  return String(source ?? "").trim().toLowerCase();
}

function isLiveSource(source?: string | null) {
  return LIVE_SNAPSHOT_SOURCES.has(cleanSource(source));
}

function isHistoricalSource(source?: string | null) {
  return HISTORICAL_SNAPSHOT_SOURCES.has(cleanSource(source));
}

function pointMs(point: ChartPoint) {
  return safeDateMs(point.date);
}

function chartPoints(chartData: PortfolioChartData | null | undefined) {
  return PORTFOLIO_CHART_RANGES.flatMap((range) => chartData?.[range] ?? []);
}

function latestPointMs(chartData: PortfolioChartData | null | undefined) {
  return chartPoints(chartData).reduce<number | null>((latest, point) => {
    const ms = pointMs(point);
    if (ms == null) return latest;
    return latest == null || ms > latest ? ms : latest;
  }, null);
}

function dateBoundsFromRows(rows: PortfolioChartSnapshotHealthRow[]) {
  return rows.reduce<{
    firstMs: number | null;
    latestMs: number | null;
    latestLiveMs: number | null;
  }>(
    (acc, row) => {
      const ms = safeDateMs(row.snapshot_at ?? null);
      if (ms == null) return acc;
      if (acc.firstMs == null || ms < acc.firstMs) acc.firstMs = ms;
      if (acc.latestMs == null || ms > acc.latestMs) acc.latestMs = ms;
      if (isLiveSource(row.source) && (acc.latestLiveMs == null || ms > acc.latestLiveMs)) {
        acc.latestLiveMs = ms;
      }
      return acc;
    },
    { firstMs: null, latestMs: null, latestLiveMs: null },
  );
}

function isoOrNull(ms: number | null) {
  return ms == null ? null : new Date(ms).toISOString();
}

export function isMinimalCurrentChartData(chartData: PortfolioChartData | null | undefined) {
  const rangesWithPoints = PORTFOLIO_CHART_RANGES.filter((range) => (chartData?.[range]?.length ?? 0) > 0);
  if (rangesWithPoints.length !== 1 || rangesWithPoints[0] !== "1D") return false;

  const points = chartData?.["1D"] ?? [];
  if (points.length !== 2) return false;

  const firstMs = pointMs(points[0]);
  const secondMs = pointMs(points[1]);
  if (firstMs == null || secondMs == null) return false;

  const closeDelta = Math.abs(toNumber(points[0].close, Number.NaN) - toNumber(points[1].close, Number.NaN));
  return Math.abs(secondMs - firstMs) <= 5 * 60 * 1000 && closeDelta <= 0.01;
}

function getRangeCounts(chartData: PortfolioChartData | null | undefined) {
  return PORTFOLIO_CHART_RANGES.reduce<Partial<Record<TimeRange, number>>>((acc, range) => {
    const count = chartData?.[range]?.length ?? 0;
    if (count > 0) acc[range] = count;
    return acc;
  }, {});
}

function getRangesAvailable(chartData: PortfolioChartData | null | undefined) {
  return PORTFOLIO_CHART_RANGES.filter((range) => (chartData?.[range]?.length ?? 0) > 1);
}

function isFlatChart(chartData: PortfolioChartData | null | undefined) {
  const points = chartPoints(chartData);
  if (points.length < MIN_NON_MINIMAL_POINTS) return isMinimalCurrentChartData(chartData);
  const distinct = new Set(points.map((point) => toNumber(point.close, Number.NaN).toFixed(2)));
  distinct.delete("NaN");
  return distinct.size <= 1;
}

function hasInvalidRows(rows: PortfolioChartSnapshotHealthRow[]) {
  return rows.some((row) => {
    const value = toNumber(row.value, Number.NaN);
    const cash = toNumber(row.cash, Number.NaN);
    const basis = toNumber(row.basis, Number.NaN);
    return (
      !Number.isFinite(value) ||
      value < 0 ||
      !Number.isFinite(cash) ||
      cash < 0 ||
      !Number.isFinite(basis) ||
      basis < 0
    );
  });
}

function expectedRangeMissing({
  rangesAvailable,
  portfolioCreatedAt,
  nowMs,
}: {
  rangesAvailable: TimeRange[];
  portfolioCreatedAt?: string | null;
  nowMs: number;
}) {
  const createdMs = safeDateMs(portfolioCreatedAt ?? null);
  if (createdMs == null) return false;

  const ageMs = Math.max(0, nowMs - createdMs);
  const has = (range: TimeRange) => rangesAvailable.includes(range);

  if (ageMs >= 2 * 86_400_000 && !has("MAX")) return true;
  if (ageMs >= 7 * 86_400_000 && !has("1M")) return true;
  if (ageMs >= 190 * 86_400_000 && !has("6M")) return true;
  if (ageMs >= 370 * 86_400_000 && !has("1Y")) return true;

  return false;
}

export function assessPortfolioChartHealth({
  portfolioCreatedAt,
  latestInputMs = 0,
  snapshotRows = [],
  chartData = {},
  summary,
  nowMs = Date.now(),
  staleLiveMs = DEFAULT_STALE_LIVE_MS,
}: {
  portfolioId?: string;
  portfolioCreatedAt?: string | null;
  latestInputMs?: number;
  snapshotRows?: PortfolioChartSnapshotHealthRow[];
  chartData?: PortfolioChartData | null;
  summary?: SummaryLike | null;
  nowMs?: number;
  staleLiveMs?: number;
}): PortfolioChartHealth {
  const snapshotCount = snapshotRows.length;
  const liveCount = snapshotRows.filter((row) => isLiveSource(row.source)).length;
  const historicalCount = snapshotRows.filter((row) => isHistoricalSource(row.source)).length;
  const { firstMs, latestMs, latestLiveMs } = dateBoundsFromRows(snapshotRows);
  const latestChartMs = latestPointMs(chartData);
  const latestKnownMs = latestMs ?? latestChartMs;
  const firstKnownMs = firstMs ?? chartPoints(chartData).reduce<number | null>((first, point) => {
    const ms = pointMs(point);
    if (ms == null) return first;
    return first == null || ms < first ? ms : first;
  }, null);
  const rangesAvailable = getRangesAvailable(chartData);
  const rangeCounts = getRangeCounts(chartData);
  const holdingsCount = Math.round(toNumber(summary?.holdingsCount, 0));
  const totalValue = toNumber(summary?.totalValue, 0);
  const hasMeaningfulPortfolio = holdingsCount > 0 || totalValue > 0.01;
  const latestInputCovered =
    latestInputMs <= 0 || (latestKnownMs != null && latestKnownMs + 1000 >= latestInputMs);
  const minimalCurrent = isMinimalCurrentChartData(chartData);
  const isFlat = isFlatChart(chartData);
  const invalid = hasInvalidRows(snapshotRows);
  const hasDisplayPoints = rangesAvailable.length > 0 && !minimalCurrent;
  let status: PortfolioChartHealthStatus = "healthy";
  let reason = "chart_healthy";

  if (!hasMeaningfulPortfolio) {
    status = "healthy";
    reason = "empty_or_cash_only_portfolio";
  } else if (invalid) {
    status = "broken";
    reason = "invalid_snapshot_rows";
  } else if (minimalCurrent) {
    status = "building";
    reason = "minimal_current_placeholder";
  } else if (snapshotCount === 0 && !hasDisplayPoints) {
    status = "missing";
    reason = "no_snapshot_history";
  } else if (!hasDisplayPoints) {
    status = "missing";
    reason = "no_displayable_ranges";
  } else if (!latestInputCovered) {
    status = "rebuild_needed";
    reason = "latest_portfolio_input_not_covered";
  } else if (latestLiveMs != null && nowMs - latestLiveMs > staleLiveMs) {
    status = "stale";
    reason = "latest_live_snapshot_stale";
  } else if (isFlat && holdingsCount > 0) {
    status = "flat";
    reason = "flat_chart_with_holdings";
  } else if (snapshotCount > 0 && snapshotCount < MIN_NON_MINIMAL_POINTS) {
    status = "sparse";
    reason = "too_few_snapshot_rows";
  } else if (expectedRangeMissing({ rangesAvailable, portfolioCreatedAt, nowMs })) {
    status = "sparse";
    reason = "missing_expected_range_coverage";
  }

  const displayable =
    hasDisplayPoints &&
    !minimalCurrent &&
    status !== "missing" &&
    status !== "building" &&
    status !== "broken" &&
    status !== "flat";

  return {
    status,
    reason,
    snapshotCount,
    liveCount,
    historicalCount,
    rangesAvailable,
    rangeCounts,
    latestSnapshotAt: isoOrNull(latestKnownMs),
    firstSnapshotAt: isoOrNull(firstKnownMs),
    latestInputCovered,
    isFlat,
    repairNeeded: status !== "healthy",
    displayable,
  };
}

export function emptyPortfolioChartHealth(reason = "empty_or_cash_only_portfolio"): PortfolioChartHealth {
  return {
    status: "healthy",
    reason,
    snapshotCount: 0,
    liveCount: 0,
    historicalCount: 0,
    rangesAvailable: [],
    rangeCounts: {},
    latestSnapshotAt: null,
    firstSnapshotAt: null,
    latestInputCovered: true,
    isFlat: false,
    repairNeeded: false,
    displayable: false,
  };
}
