import type { ChartPoint, TimeRange } from "@/components/StockChart";

const OUTPUT_RANGES: TimeRange[] = ["1D", "1M", "6M", "1Y", "MAX"];
const ONE_HOUR_MS = 3_600_000;
const ONE_DAY_MS = 86_400_000;
const MAX_POINTS = 260;
const WRITE_BATCH_SIZE = 400;
const RANGE_DAYS: Partial<Record<TimeRange, number>> = {
  "1M": 30,
  "6M": 182,
  "1Y": 365,
};

const SNAPSHOT_READ_LIMIT = Number(
  process.env.PORTFOLIO_SNAPSHOT_READ_LIMIT ?? 10_000,
);
const SNAPSHOT_STALE_MS = Number(
  process.env.PORTFOLIO_SNAPSHOT_STALE_MS ?? 20 * 60 * 1000,
);

type SnapshotChartPoint = ChartPoint & { cash?: number };

export type PortfolioSnapshotChartData = Partial<Record<TimeRange, SnapshotChartPoint[]>>;

type SupabaseLike = {
  from: (table: string) => any;
};

type PortfolioSnapshotRow = {
  snapshot_at: string | null;
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

type NormalisedSnapshotPoint = SnapshotChartPoint & { ms: number };

type DatedInput = {
  created_at?: string | null;
  createdAt?: string | null;
  added_at?: string | null;
  addedAt?: string | null;
  purchase_date?: string | null;
  purchaseDate?: string | null;
};

function toNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
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

function normaliseRows(rows: PortfolioSnapshotRow[], portfolioStartMs: number) {
  const byDate = new Map<string, NormalisedSnapshotPoint>();

  rows.forEach((row) => {
    const ms = safeDateMs(row.snapshot_at);
    const value = toNumber(row.value, Number.NaN);
    if (ms == null || ms < portfolioStartMs || !Number.isFinite(value) || value < 0) return;

    const date = new Date(ms).toISOString();
    const cash = roundMoney(toNumber(row.cash, 0));
    const basis = roundMoney(toNumber(row.basis, 0));
    const pnl = roundMoney(toNumber(row.pnl, value - basis));
    const pnlPct = toNumber(row.pnl_pct, basis > 0 ? (pnl / basis) * 100 : 0);

    byDate.set(date, {
      ms,
      date,
      close: roundMoney(value),
      cash,
      basis,
      pnl,
      pnlPct,
    });
  });

  return Array.from(byDate.values()).sort((a, b) => a.ms - b.ms);
}

function samplePoints(points: NormalisedSnapshotPoint[]) {
  if (points.length <= MAX_POINTS) return points;
  const step = Math.ceil(points.length / MAX_POINTS);
  const sampled = points.filter((_, index) => index % step === 0);
  const last = points.at(-1);
  if (last && sampled.at(-1)?.date !== last.date) sampled.push(last);
  return sampled;
}

function rangeStartFor(range: TimeRange, portfolioStartMs: number, nowMs: number) {
  if (range === "1D") return Math.max(portfolioStartMs, nowMs - 24 * ONE_HOUR_MS);
  if (range === "MAX") return portfolioStartMs;
  const days = RANGE_DAYS[range];
  return days ? Math.max(portfolioStartMs, nowMs - days * ONE_DAY_MS) : portfolioStartMs;
}

function coverageToleranceMs(range: TimeRange) {
  return range === "1D" ? ONE_HOUR_MS : ONE_DAY_MS;
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
  if (range === "MAX") return first.ms <= portfolioStartMs + ONE_DAY_MS;
  return first.ms <= rangeStartMs + coverageToleranceMs(range);
}

function snapshotsToChartData(points: NormalisedSnapshotPoint[], portfolioStartMs: number): PortfolioSnapshotChartData {
  const nowMs = Date.now();

  return OUTPUT_RANGES.reduce<PortfolioSnapshotChartData>((acc, range) => {
    const rangeStartMs = rangeStartFor(range, portfolioStartMs, nowMs);
    const coveredPoints = points.filter((point) => point.ms >= rangeStartMs && point.ms <= nowMs);
    if (coveredPoints.length <= 1) return acc;
    if (!hasRangeCoverage({ range, points: coveredPoints, rangeStartMs, portfolioStartMs })) return acc;

    const rangePoints = samplePoints(coveredPoints).map(({ ms: _ms, ...point }) => point);
    if (rangePoints.length > 1) acc[range] = rangePoints;
    return acc;
  }, {});
}

function hasCompleteSnapshotChartData(chartData: PortfolioSnapshotChartData) {
  return OUTPUT_RANGES.every((range) => (chartData[range]?.length ?? 0) > 1);
}

function latestSnapshotIsUsable(points: NormalisedSnapshotPoint[], latestInputMs: number) {
  const latest = points.at(-1);
  if (!latest) return false;
  if (latest.ms + 1_000 < latestInputMs) return false;

  if (SNAPSHOT_STALE_MS > 0 && Date.now() - latest.ms > SNAPSHOT_STALE_MS) {
    return false;
  }

  return true;
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
  const portfolioStartMs = safeDateMs(portfolioCreatedAt) ?? 0;

  try {
    const { data, error } = await supabase
      .from("portfolio_snapshots")
      .select("snapshot_at,value,cash,basis,pnl,pnl_pct")
      .eq("portfolio_id", portfolioId)
      .eq("user_id", userId)
      .gte("snapshot_at", new Date(portfolioStartMs).toISOString())
      .order("snapshot_at", { ascending: true })
      .limit(SNAPSHOT_READ_LIMIT);

    if (error) {
      console.warn("Portfolio snapshot read failed", error.message ?? error);
      return null;
    }

    const points = normaliseRows((data ?? []) as PortfolioSnapshotRow[], portfolioStartMs);
    if (!latestSnapshotIsUsable(points, latestInputMs)) return null;

    const chartData = snapshotsToChartData(points, portfolioStartMs);
    return hasCompleteSnapshotChartData(chartData) ? chartData : null;
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

  if (snapshotMs == null || !Number.isFinite(point.close) || point.close < 0) {
    return null;
  }

  const basis = roundMoney(toNumber(point.basis, 0));
  const pnl = roundMoney(toNumber(point.pnl, point.close - basis));

  return {
    portfolio_id: portfolioId,
    user_id: userId,
    snapshot_at: new Date(snapshotMs).toISOString(),
    value: roundMoney(point.close),
    cash: roundMoney(toNumber(point.cash, 0)),
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
}: {
  portfolioId: string;
  userId: string;
  chartData: PortfolioSnapshotChartData;
  source: string;
}) {
  const byTimestamp = new Map<string, SnapshotUpsertRow>();

  OUTPUT_RANGES.flatMap((range) => chartData[range] ?? []).forEach((point) => {
    const row = pointToSnapshotRow({ portfolioId, userId, point, source });
    if (row) byTimestamp.set(row.snapshot_at, row);
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

export async function savePortfolioSnapshotsFromChartData({
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
  try {
    return await upsertSnapshotRows(
      supabase,
      getSnapshotRowsFromChartData({ portfolioId, userId, chartData, source }),
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
