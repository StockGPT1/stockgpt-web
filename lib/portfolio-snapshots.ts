import type { ChartPoint, TimeRange } from "@/components/StockChart";
import {
  assessPortfolioChartHealth,
  type PortfolioChartHealth,
  type PortfolioChartSnapshotHealthRow,
} from "@/lib/portfolio-chart-health";
import type { SupabaseClient } from "@supabase/supabase-js";

const OUTPUT_RANGES: TimeRange[] = ["1D", "1M", "6M", "1Y", "MAX"];
const FIVE_MINUTES_MS = 5 * 60_000;
const FIFTEEN_MINUTES_MS = 15 * 60_000;
const ONE_HOUR_MS = 3_600_000;
const SIX_HOURS_MS = 6 * ONE_HOUR_MS;
const ONE_DAY_MS = 86_400_000;
const ONE_WEEK_MS = 7 * ONE_DAY_MS;
const ONE_MONTH_MS = 30 * ONE_DAY_MS;
const MAX_POINTS = 260;
const WRITE_BATCH_SIZE = 400;
const RANGE_DAYS: Partial<Record<TimeRange, number>> = {
  "1M": 30,
  "6M": 182,
  "1Y": 365,
};

export const HISTORICAL_SNAPSHOT_SOURCES = new Set([
  "backfill",
  "chart_rebuild",
]);

export const LIVE_SNAPSHOT_SOURCES = new Set([
  "cron_refresh",
  "page_current_value",
  "page",
  "health_repair_live",
  "system",
]);

const SNAPSHOT_READ_LIMIT = Number(
  process.env.PORTFOLIO_SNAPSHOT_READ_LIMIT ?? 10_000,
);

type SnapshotChartPoint = ChartPoint & { cash?: number };

export type PortfolioSnapshotChartData = Partial<Record<TimeRange, SnapshotChartPoint[]>>;

type SupabaseLike = {
  from: SupabaseClient["from"];
};

export type PortfolioSnapshotSourceRow = {
  snapshot_at: string | null;
  source?: string | null;
};

export type PortfolioSnapshotRow = PortfolioSnapshotSourceRow & {
  value: number | string | null;
  cash: number | string | null;
  basis: number | string | null;
  pnl: number | string | null;
  pnl_pct: number | string | null;
};

type SnapshotUpsertRow = {
  portfolio_id: string;
  user_id: string;
  snapshot_at: string;
  value: number;
  cash: number;
  basis: number;
  pnl: number;
  pnl_pct: number;
  source: string;
};

type SnapshotSourceKind = "live" | "historical" | "unknown";

type NormalisedSnapshotPoint = SnapshotChartPoint & {
  ms: number;
  source: string;
  sourceKind: SnapshotSourceKind;
};

type SnapshotNormaliseStats = {
  inputRows: number;
  liveRows: number;
  historicalRows: number;
  unknownRows: number;
  droppedBeforeStart: number;
  droppedInvalid: number;
  droppedHistoricalOverlap: number;
  droppedUnknownAfterLive: number;
  droppedDuplicate: number;
};

type ChartRangeMeta = {
  range: TimeRange;
  pointCount: number;
  bucketIntervalMs: number;
  firstDate: string | null;
  lastDate: string | null;
};

export type PortfolioSnapshotBuildResult = {
  chartData: PortfolioSnapshotChartData;
  stats: SnapshotNormaliseStats;
  rangeMeta: ChartRangeMeta[];
  firstLiveSnapshotMs: number | null;
  latestLiveSnapshotMs: number | null;
};

export type PortfolioSnapshotChartReadResult = {
  chartData: PortfolioSnapshotChartData;
  health: PortfolioChartHealth;
  rows: PortfolioSnapshotRow[];
  buildResult: PortfolioSnapshotBuildResult | null;
};

type DatedInput = {
  created_at?: string | null;
  createdAt?: string | null;
  added_at?: string | null;
  addedAt?: string | null;
  purchase_date?: string | null;
  purchaseDate?: string | null;
};

type CurrentPortfolioInput = {
  cash_balance?: unknown;
  cashBalance?: unknown;
  cash_deposited_total?: unknown;
  cashDepositedTotal?: unknown;
  investment_amount?: unknown;
  investmentAmount?: unknown;
};

type CurrentHoldingInput = {
  ticker?: string | null;
  shares?: unknown;
  entry_price?: unknown;
  entryPrice?: unknown;
  currentPrice?: unknown;
  current_value?: unknown;
  currentValue?: unknown;
};

function toNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function cleanTicker(ticker?: string | null) {
  return String(ticker ?? "").trim().toUpperCase();
}

export function cleanSnapshotSource(source?: string | null) {
  return String(source ?? "").trim().toLowerCase();
}

export function isHistoricalSnapshotSource(source?: string | null) {
  return HISTORICAL_SNAPSHOT_SOURCES.has(cleanSnapshotSource(source));
}

export function isLiveSnapshotSource(source?: string | null) {
  return LIVE_SNAPSHOT_SOURCES.has(cleanSnapshotSource(source));
}

export function snapshotSourceKind(source?: string | null): SnapshotSourceKind {
  if (isHistoricalSnapshotSource(source)) return "historical";
  if (isLiveSnapshotSource(source)) return "live";
  return "unknown";
}

function safeDateMs(value: string | null | undefined) {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function pointMs(point: SnapshotChartPoint) {
  return safeDateMs(point.date);
}

function latestDateFromRows(rows: DatedInput[], keys: Array<keyof DatedInput>) {
  return rows.reduce<number | null>((latest, row) => {
    for (const key of keys) {
      const ms = safeDateMs(row[key] as string | null | undefined);
      if (ms != null && (latest == null || ms > latest)) latest = ms;
    }

    return latest;
  }, null);
}

export function latestPortfolioInputChangeMs({
  portfolioCreatedAt,
  holdings,
  transactions,
}: {
  portfolioCreatedAt?: string | null;
  holdings: DatedInput[];
  transactions: DatedInput[];
}) {
  return Math.max(
    safeDateMs(portfolioCreatedAt) ?? 0,
    latestDateFromRows(holdings, ["added_at", "addedAt", "purchase_date", "purchaseDate"]) ?? 0,
    latestDateFromRows(transactions, ["created_at", "createdAt"]) ?? 0,
  );
}

export function getFirstLiveSnapshotMs(rows: PortfolioSnapshotSourceRow[]) {
  return rows.reduce<number | null>((first, row) => {
    if (!isLiveSnapshotSource(row.source)) return first;
    const ms = safeDateMs(row.snapshot_at);
    if (ms == null) return first;
    return first == null || ms < first ? ms : first;
  }, null);
}

export function getLatestLiveSnapshotMs(rows: PortfolioSnapshotSourceRow[]) {
  return rows.reduce<number | null>((latest, row) => {
    if (!isLiveSnapshotSource(row.source)) return latest;
    const ms = safeDateMs(row.snapshot_at);
    if (ms == null) return latest;
    return latest == null || ms > latest ? ms : latest;
  }, null);
}

export function filterHistoricalOverlap<T extends PortfolioSnapshotSourceRow>(rows: T[]) {
  const firstLiveMs = getFirstLiveSnapshotMs(rows);
  if (firstLiveMs == null) return rows;

  return rows.filter((row) => {
    if (!isHistoricalSnapshotSource(row.source)) return true;
    const ms = safeDateMs(row.snapshot_at);
    return ms != null && ms < firstLiveMs;
  });
}

function sourcePriority(source?: string | null) {
  const cleaned = cleanSnapshotSource(source);
  if (cleaned === "page_current_value" || cleaned === "page") return 5;
  if (cleaned === "cron_refresh" || cleaned === "health_repair_live") return 4;
  if (isLiveSnapshotSource(cleaned)) return 3;
  if (snapshotSourceKind(cleaned) === "unknown") return 2;
  return 1;
}

function emptyStats(inputRows: number): SnapshotNormaliseStats {
  return {
    inputRows,
    liveRows: 0,
    historicalRows: 0,
    unknownRows: 0,
    droppedBeforeStart: 0,
    droppedInvalid: 0,
    droppedHistoricalOverlap: 0,
    droppedUnknownAfterLive: 0,
    droppedDuplicate: 0,
  };
}

function normaliseRows(rows: PortfolioSnapshotRow[], portfolioStartMs: number) {
  const firstLiveSnapshotMs = getFirstLiveSnapshotMs(rows);
  const latestLiveSnapshotMs = getLatestLiveSnapshotMs(rows);
  const stats = emptyStats(rows.length);
  const byDate = new Map<string, { point: NormalisedSnapshotPoint; priority: number }>();

  rows.forEach((row) => {
    const ms = safeDateMs(row.snapshot_at);
    if (ms == null || ms < portfolioStartMs) {
      stats.droppedBeforeStart += 1;
      return;
    }

    const value = roundMoney(toNumber(row.value, Number.NaN));
    const cash = roundMoney(toNumber(row.cash, Number.NaN));
    const basis = roundMoney(toNumber(row.basis, Number.NaN));
    if (
      !Number.isFinite(value) ||
      value < 0 ||
      !Number.isFinite(cash) ||
      cash < 0 ||
      !Number.isFinite(basis) ||
      basis < 0
    ) {
      stats.droppedInvalid += 1;
      return;
    }

    const source = cleanSnapshotSource(row.source);
    const sourceKind = snapshotSourceKind(source);
    if (sourceKind === "live") stats.liveRows += 1;
    else if (sourceKind === "historical") stats.historicalRows += 1;
    else stats.unknownRows += 1;

    if (firstLiveSnapshotMs != null && sourceKind === "historical" && ms >= firstLiveSnapshotMs) {
      stats.droppedHistoricalOverlap += 1;
      return;
    }

    if (firstLiveSnapshotMs != null && sourceKind === "unknown" && ms >= firstLiveSnapshotMs) {
      stats.droppedUnknownAfterLive += 1;
      return;
    }

    const date = new Date(ms).toISOString();
    const pnl = roundMoney(toNumber(row.pnl, value - basis));
    const pnlPct = toNumber(row.pnl_pct, basis > 0 ? (pnl / basis) * 100 : 0);
    const priority = sourcePriority(source);
    const existing = byDate.get(date);

    if (existing && existing.priority >= priority) {
      stats.droppedDuplicate += 1;
      return;
    }

    if (existing) stats.droppedDuplicate += 1;

    byDate.set(date, {
      priority,
      point: {
        ms,
        source,
        sourceKind,
        date,
        close: value,
        cash,
        basis,
        pnl,
        pnlPct,
      },
    });
  });

  const points = Array.from(byDate.values())
    .map(({ point }) => point)
    .sort((a, b) => a.ms - b.ms);

  return { points, stats, firstLiveSnapshotMs, latestLiveSnapshotMs };
}

function rangeStartFor(range: TimeRange, portfolioStartMs: number, nowMs: number) {
  if (range === "1D") return Math.max(portfolioStartMs, nowMs - 24 * ONE_HOUR_MS);
  if (range === "MAX") return portfolioStartMs;
  const days = RANGE_DAYS[range];
  return days ? Math.max(portfolioStartMs, nowMs - days * ONE_DAY_MS) : portfolioStartMs;
}

function coverageToleranceMs(range: TimeRange) {
  if (range === "1D") return ONE_HOUR_MS;
  if (range === "1M") return ONE_DAY_MS * 2;
  return ONE_DAY_MS * 3;
}

function hasRangeCoverage({
  range,
  points,
  rangeStartMs,
  portfolioStartMs,
}: {
  range: TimeRange;
  points: NormalisedSnapshotPoint[];
  rangeStartMs: number;
  portfolioStartMs: number;
}) {
  const first = points[0];
  if (!first) return false;
  if (range === "1D") return true;
  if (range === "MAX") return first.ms <= portfolioStartMs + ONE_DAY_MS;
  return first.ms <= rangeStartMs + coverageToleranceMs(range);
}

function chooseBucketInterval({
  range,
  points,
  rangeStartMs,
  nowMs,
}: {
  range: TimeRange;
  points: NormalisedSnapshotPoint[];
  rangeStartMs: number;
  nowMs: number;
}) {
  if (range === "1D") return points.length > 240 ? FIFTEEN_MINUTES_MS : FIVE_MINUTES_MS;
  if (range === "1M") return SIX_HOURS_MS;
  if (range === "6M") return ONE_DAY_MS;
  if (range === "1Y") return points.length > MAX_POINTS ? ONE_WEEK_MS : ONE_DAY_MS;

  const spanMs = Math.max(0, nowMs - rangeStartMs);
  return spanMs > 2 * 365 * ONE_DAY_MS ? ONE_MONTH_MS : ONE_WEEK_MS;
}

function dedupeByTimestamp(points: NormalisedSnapshotPoint[]) {
  return Array.from(
    points.reduce((map, point) => map.set(point.ms, point), new Map<number, NormalisedSnapshotPoint>()).values(),
  ).sort((a, b) => a.ms - b.ms);
}

function bucketPoints({
  points,
  intervalMs,
  rangeStartMs,
}: {
  points: NormalisedSnapshotPoint[];
  intervalMs: number;
  rangeStartMs: number;
}) {
  if (points.length <= 2) return points;

  const byBucket = new Map<number, NormalisedSnapshotPoint>();
  points.forEach((point) => {
    const bucket = Math.floor((point.ms - rangeStartMs) / intervalMs);
    byBucket.set(bucket, point);
  });

  const first = points[0];
  const latest = points.at(-1);
  const latestLive = [...points].reverse().find((point) => point.sourceKind === "live");

  return dedupeByTimestamp([
    first,
    ...Array.from(byBucket.values()),
    ...(latestLive ? [latestLive] : []),
    ...(latest ? [latest] : []),
  ]);
}

function serialiseChartPoints(points: NormalisedSnapshotPoint[]) {
  return points.map((point) => ({
    date: point.date,
    close: point.close,
    cash: point.cash,
    basis: point.basis,
    pnl: point.pnl,
    pnlPct: point.pnlPct,
  }));
}

function validateRangePoints({
  range,
  points,
  portfolioStartMs,
  firstLiveSnapshotMs,
}: {
  range: TimeRange;
  points: NormalisedSnapshotPoint[];
  portfolioStartMs: number;
  firstLiveSnapshotMs: number | null;
}) {
  const seen = new Set<number>();
  let previousMs: number | null = null;

  for (const point of points) {
    if (point.ms < portfolioStartMs) return false;
    if (previousMs != null && point.ms < previousMs) return false;
    if (seen.has(point.ms)) return false;
    if (range === "1D" && point.sourceKind !== "live") return false;
    if (
      firstLiveSnapshotMs != null &&
      point.sourceKind === "historical" &&
      point.ms >= firstLiveSnapshotMs
    ) {
      return false;
    }
    if (!Number.isFinite(point.close) || point.close < 0) return false;
    if (point.cash != null && (!Number.isFinite(point.cash) || point.cash < 0)) return false;
    if (point.basis != null && (!Number.isFinite(point.basis) || point.basis < 0)) return false;

    seen.add(point.ms);
    previousMs = point.ms;
  }

  return points.length <= MAX_POINTS;
}

function snapshotsToChartData({
  points,
  portfolioStartMs,
  firstLiveSnapshotMs,
  nowMs,
}: {
  points: NormalisedSnapshotPoint[];
  portfolioStartMs: number;
  firstLiveSnapshotMs: number | null;
  nowMs: number;
}) {
  return OUTPUT_RANGES.reduce<{
    chartData: PortfolioSnapshotChartData;
    rangeMeta: ChartRangeMeta[];
  }>(
    (acc, range) => {
      const rangeStartMs = rangeStartFor(range, portfolioStartMs, nowMs);
      const sourcePoints = points.filter((point) => point.ms >= rangeStartMs && point.ms <= nowMs);
      const coveredPoints =
        range === "1D"
          ? sourcePoints.filter((point) => point.sourceKind === "live")
          : sourcePoints;

      if (coveredPoints.length <= 1) return acc;
      if (!hasRangeCoverage({ range, points: coveredPoints, rangeStartMs, portfolioStartMs })) {
        return acc;
      }

      const bucketIntervalMs = chooseBucketInterval({
        range,
        points: coveredPoints,
        rangeStartMs,
        nowMs,
      });
      const bucketed = bucketPoints({
        points: coveredPoints,
        intervalMs: bucketIntervalMs,
        rangeStartMs,
      });

      if (
        bucketed.length > 1 &&
        validateRangePoints({ range, points: bucketed, portfolioStartMs, firstLiveSnapshotMs })
      ) {
        acc.chartData[range] = serialiseChartPoints(bucketed);
        acc.rangeMeta.push({
          range,
          pointCount: bucketed.length,
          bucketIntervalMs,
          firstDate: bucketed[0]?.date ?? null,
          lastDate: bucketed.at(-1)?.date ?? null,
        });
      }

      return acc;
    },
    { chartData: {}, rangeMeta: [] },
  );
}

function hasAnySnapshotChartData(chartData: PortfolioSnapshotChartData) {
  return OUTPUT_RANGES.some((range) => (chartData[range]?.length ?? 0) > 1);
}

function latestSnapshotCoversLatestInput(points: NormalisedSnapshotPoint[], latestInputMs: number) {
  const latest = points.at(-1);
  if (!latest) return false;
  return latest.ms + 1_000 >= latestInputMs;
}

export function buildPortfolioSnapshotChartDataFromRows({
  rows,
  portfolioCreatedAt,
  latestInputMs = 0,
  nowMs = Date.now(),
  requireLatestInputCoverage = true,
}: {
  rows: PortfolioSnapshotRow[];
  portfolioCreatedAt?: string | null;
  latestInputMs?: number;
  nowMs?: number;
  requireLatestInputCoverage?: boolean;
}): PortfolioSnapshotBuildResult | null {
  const portfolioStartMs = safeDateMs(portfolioCreatedAt) ?? 0;
  const { points, stats, firstLiveSnapshotMs, latestLiveSnapshotMs } = normaliseRows(
    rows,
    portfolioStartMs,
  );

  if (requireLatestInputCoverage && !latestSnapshotCoversLatestInput(points, latestInputMs)) {
    return null;
  }

  const { chartData, rangeMeta } = snapshotsToChartData({
    points,
    portfolioStartMs,
    firstLiveSnapshotMs,
    nowMs,
  });

  if (!hasAnySnapshotChartData(chartData)) return null;

  return {
    chartData,
    stats,
    rangeMeta,
    firstLiveSnapshotMs,
    latestLiveSnapshotMs,
  };
}

function formatIso(ms: number | null) {
  return ms == null ? "none" : new Date(ms).toISOString();
}

function intervalLabel(ms: number) {
  if (ms % ONE_MONTH_MS === 0) return `${ms / ONE_MONTH_MS}mo`;
  if (ms % ONE_WEEK_MS === 0) return `${ms / ONE_WEEK_MS}w`;
  if (ms % ONE_DAY_MS === 0) return `${ms / ONE_DAY_MS}d`;
  if (ms % ONE_HOUR_MS === 0) return `${ms / ONE_HOUR_MS}h`;
  return `${Math.round(ms / 60_000)}m`;
}

function logSnapshotChartBuild({
  portfolioId,
  result,
}: {
  portfolioId: string;
  result: PortfolioSnapshotBuildResult;
}) {
  const ranges = result.rangeMeta
    .map(
      (meta) =>
        `${meta.range}:${meta.pointCount}@${intervalLabel(meta.bucketIntervalMs)}:${meta.firstDate ?? "none"}..${meta.lastDate ?? "none"}`,
    )
    .join("|");

  console.info(
    [
      "[portfolio-chart]",
      `portfolioId=${portfolioId}`,
      `ranges=${ranges}`,
      `liveRows=${result.stats.liveRows}`,
      `historicalRows=${result.stats.historicalRows}`,
      `unknownRows=${result.stats.unknownRows}`,
      `droppedHistoricalOverlap=${result.stats.droppedHistoricalOverlap}`,
      `droppedUnknownAfterLive=${result.stats.droppedUnknownAfterLive}`,
      `droppedInvalid=${result.stats.droppedInvalid}`,
      `firstLiveSnapshotAt=${formatIso(result.firstLiveSnapshotMs)}`,
      `latestLiveSnapshotAt=${formatIso(result.latestLiveSnapshotMs)}`,
    ].join(" "),
  );
}

export async function getPortfolioSnapshotChartData({
  supabase,
  portfolioId,
  userId,
  portfolioCreatedAt,
  latestInputMs,
}: {
  supabase: SupabaseLike;
  portfolioId: string;
  userId: string;
  portfolioCreatedAt?: string | null;
  latestInputMs: number;
}): Promise<PortfolioSnapshotChartData | null> {
  const result = await getPortfolioSnapshotChartDataWithHealth({
    supabase,
    portfolioId,
    userId,
    portfolioCreatedAt,
    latestInputMs,
  });

  if (!result?.health.displayable) return null;
  return result.chartData;
}

export async function getPortfolioSnapshotChartDataWithHealth({
  supabase,
  portfolioId,
  userId,
  portfolioCreatedAt,
  latestInputMs,
  summary,
}: {
  supabase: SupabaseLike;
  portfolioId: string;
  userId: string;
  portfolioCreatedAt?: string | null;
  latestInputMs: number;
  summary?: { holdingsCount?: unknown; totalValue?: unknown } | null;
}): Promise<PortfolioSnapshotChartReadResult | null> {
  const portfolioStartMs = safeDateMs(portfolioCreatedAt) ?? 0;

  try {
    const { data, error } = await supabase
      .from("portfolio_snapshots")
      .select("snapshot_at,value,cash,basis,pnl,pnl_pct,source")
      .eq("portfolio_id", portfolioId)
      .eq("user_id", userId)
      .gte("snapshot_at", new Date(portfolioStartMs).toISOString())
      .order("snapshot_at", { ascending: true })
      .limit(SNAPSHOT_READ_LIMIT);

    if (error) {
      console.warn("Portfolio snapshot read failed", error.message ?? error);
      return null;
    }

    const rows = (data ?? []) as PortfolioSnapshotRow[];
    const result = buildPortfolioSnapshotChartDataFromRows({
      rows,
      portfolioCreatedAt,
      latestInputMs,
      requireLatestInputCoverage: false,
    });
    const chartData = result?.chartData ?? {};
    const health = assessPortfolioChartHealth({
      portfolioCreatedAt,
      latestInputMs,
      snapshotRows: rows as PortfolioChartSnapshotHealthRow[],
      chartData,
      summary,
    });

    console.info(
      [
        "[portfolio-chart-health]",
        `portfolioId=${portfolioId}`,
        "source=snapshots",
        `status=${health.status}`,
        `reason=${health.reason}`,
        `ranges=${health.rangesAvailable.join(",") || "none"}`,
        `snapshotCount=${health.snapshotCount}`,
        `liveCount=${health.liveCount}`,
        `historicalCount=${health.historicalCount}`,
        `latestSnapshotAt=${health.latestSnapshotAt ?? "none"}`,
      ].join(" "),
    );

    if (result) logSnapshotChartBuild({ portfolioId, result });
    return { chartData, health, rows, buildResult: result };
  } catch (error) {
    console.warn("Portfolio snapshot read failed", error);
    return null;
  }
}

function getLatestPoint(chartData: PortfolioSnapshotChartData) {
  return OUTPUT_RANGES.flatMap((range) => chartData[range] ?? []).reduce<SnapshotChartPoint | null>(
    (latest, point) => {
      const ms = pointMs(point);
      const latestMs = latest ? pointMs(latest) : null;
      if (ms == null) return latest;
      if (latestMs == null || ms > latestMs) return point;
      return latest;
    },
    null,
  );
}

function pointToSnapshotRow({
  portfolioId,
  userId,
  point,
  source,
}: {
  portfolioId: string;
  userId: string;
  point: SnapshotChartPoint;
  source: string;
}): SnapshotUpsertRow | null {
  const snapshotMs = pointMs(point);
  const close = roundMoney(toNumber(point.close, Number.NaN));
  const cash = roundMoney(toNumber(point.cash, 0));
  const basis = roundMoney(toNumber(point.basis, 0));

  if (
    snapshotMs == null ||
    !Number.isFinite(close) ||
    close < 0 ||
    !Number.isFinite(cash) ||
    cash < 0 ||
    !Number.isFinite(basis) ||
    basis < 0
  ) {
    return null;
  }

  const pnl = roundMoney(toNumber(point.pnl, close - basis));

  return {
    portfolio_id: portfolioId,
    user_id: userId,
    snapshot_at: new Date(snapshotMs).toISOString(),
    value: close,
    cash,
    basis,
    pnl,
    pnl_pct: toNumber(point.pnlPct, basis > 0 ? (pnl / basis) * 100 : 0),
    source,
  };
}

function getSnapshotRowsFromChartData({
  portfolioId,
  userId,
  chartData,
  source,
  maxSnapshotAtBefore,
}: {
  portfolioId: string;
  userId: string;
  chartData: PortfolioSnapshotChartData;
  source: string;
  maxSnapshotAtBefore?: string | Date | null;
}) {
  const byTimestamp = new Map<string, SnapshotUpsertRow>();
  const maxSnapshotMs =
    maxSnapshotAtBefore instanceof Date
      ? maxSnapshotAtBefore.getTime()
      : safeDateMs(maxSnapshotAtBefore ?? null);

  OUTPUT_RANGES.flatMap((range) => chartData[range] ?? []).forEach((point) => {
    const row = pointToSnapshotRow({ portfolioId, userId, point, source });
    if (!row) return;

    const snapshotMs = safeDateMs(row.snapshot_at);
    if (maxSnapshotMs != null && snapshotMs != null && snapshotMs >= maxSnapshotMs) return;

    byTimestamp.set(row.snapshot_at, row);
  });

  return Array.from(byTimestamp.values()).sort((a, b) => a.snapshot_at.localeCompare(b.snapshot_at));
}

async function upsertSnapshotRows(supabase: SupabaseLike, rows: SnapshotUpsertRow[]) {
  if (rows.length === 0) return false;

  let wrote = false;
  for (let i = 0; i < rows.length; i += WRITE_BATCH_SIZE) {
    const { error } = await supabase
      .from("portfolio_snapshots")
      .upsert(rows.slice(i, i + WRITE_BATCH_SIZE), { onConflict: "portfolio_id,snapshot_at" });

    if (error) {
      console.warn("Portfolio snapshot write failed", error.message ?? error);
      return wrote;
    }

    wrote = true;
  }

  return wrote;
}

export function buildCurrentPortfolioSnapshotPoint({
  portfolio,
  holdings,
  currentPrices,
  snapshotAt = new Date(),
}: {
  portfolio: CurrentPortfolioInput;
  holdings: CurrentHoldingInput[];
  currentPrices?: Record<string, unknown> | Map<string, unknown>;
  snapshotAt?: Date;
}): SnapshotChartPoint {
  const priceForTicker = (ticker: string) => {
    if (!currentPrices) return 0;
    if (currentPrices instanceof Map) return toNumber(currentPrices.get(ticker), 0);
    return toNumber(currentPrices[ticker], 0);
  };

  const cash = roundMoney(Math.max(0, toNumber(portfolio.cash_balance ?? portfolio.cashBalance, 0)));
  const cashDepositedTotal = Math.max(
    0,
    toNumber(
      portfolio.cash_deposited_total ?? portfolio.cashDepositedTotal,
      toNumber(portfolio.investment_amount ?? portfolio.investmentAmount, 0),
    ),
  );
  let holdingsValue = 0;
  let holdingsBasis = 0;

  holdings.forEach((holding) => {
    const ticker = cleanTicker(holding.ticker);
    const shares = toNumber(holding.shares, 0);
    if (!ticker || shares <= 0) return;

    const currentValue = toNumber(holding.current_value ?? holding.currentValue, 0);
    const entryPrice = toNumber(holding.entry_price ?? holding.entryPrice, 0);
    const currentPrice = toNumber(
      holding.currentPrice,
      priceForTicker(ticker) || (currentValue > 0 ? currentValue / shares : 0) || entryPrice,
    );

    holdingsValue += shares * Math.max(0, currentPrice);
    holdingsBasis += shares * Math.max(0, entryPrice || currentPrice);
  });

  const close = roundMoney(cash + holdingsValue);
  const returnBasis = Math.max(cashDepositedTotal, holdingsBasis, close > 0 ? 1 : 0);
  const basis = roundMoney(returnBasis);
  const pnl = roundMoney(returnBasis > 0 ? close - returnBasis : 0);

  return {
    date: snapshotAt.toISOString(),
    close,
    cash,
    basis,
    pnl,
    pnlPct: basis > 0 ? (pnl / basis) * 100 : 0,
  };
}

export function buildMinimalCurrentChartData(point: SnapshotChartPoint): PortfolioSnapshotChartData {
  const ms = pointMs(point) ?? Date.now();
  const previousPoint = {
    ...point,
    date: new Date(ms - 60_000).toISOString(),
  };

  return { "1D": [previousPoint, point] };
}

export async function savePortfolioSnapshotsFromChartData({
  supabase,
  portfolioId,
  userId,
  chartData,
  source = "chart_rebuild",
  maxSnapshotAtBefore = null,
}: {
  supabase: SupabaseLike;
  portfolioId: string;
  userId: string;
  chartData: PortfolioSnapshotChartData;
  source?: string;
  maxSnapshotAtBefore?: string | Date | null;
}) {
  try {
    return await upsertSnapshotRows(
      supabase,
      getSnapshotRowsFromChartData({
        portfolioId,
        userId,
        chartData,
        source,
        maxSnapshotAtBefore,
      }),
    );
  } catch (error) {
    console.warn("Portfolio snapshot write failed", error);
    return false;
  }
}

export async function saveLatestPortfolioSnapshotFromChartData({
  supabase,
  portfolioId,
  userId,
  chartData,
  source = "chart_rebuild",
}: {
  supabase: SupabaseLike;
  portfolioId: string;
  userId: string;
  chartData: PortfolioSnapshotChartData;
  source?: string;
}) {
  const point = getLatestPoint(chartData);
  if (!point) return false;

  const row = pointToSnapshotRow({ portfolioId, userId, point, source });
  if (!row) return false;

  try {
    return await upsertSnapshotRows(supabase, [row]);
  } catch (error) {
    console.warn("Portfolio snapshot write failed", error);
    return false;
  }
}
