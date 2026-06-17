import type { ChartPoint, TimeRange } from "@/components/StockChart";

const OUTPUT_RANGES: TimeRange[] = ["1D", "1M", "6M", "1Y", "MAX"];
const ONE_HOUR_MS = 3_600_000;
const ONE_DAY_MS = 86_400_000;
const MAX_POINTS = 260;
const WRITE_BATCH_SIZE = 400;
const HISTORICAL_SNAPSHOT_SOURCES = new Set(["backfill", "chart_rebuild"]);
const RANGE_DAYS: Partial<Record<TimeRange, number>> = {
  "1M": 30,
  "6M": 182,
  "1Y": 365,
};

const SNAPSHOT_READ_LIMIT = Number(
  process.env.PORTFOLIO_SNAPSHOT_READ_LIMIT ?? 10_000,
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
  source?: string | null;
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

function cleanSource(source?: string | null) {
  return String(source ?? "").trim().toLowerCase();
}

function isHistoricalSnapshotSource(source?: string | null) {
  return HISTORICAL_SNAPSHOT_SOURCES.has(cleanSource(source));
}

function snapshotSourcePriority(source?: string | null) {
  const cleaned = cleanSource(source);
  if (cleaned === "page_current_value" || cleaned === "page") return 4;
  if (cleaned === "cron_refresh") return 3;
  if (!isHistoricalSnapshotSource(cleaned)) return 2;
  return 1;
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

function latestLiveSnapshotMs(rows: PortfolioSnapshotRow[]) {
  return rows.reduce<number | null>((latest, row) => {
    if (isHistoricalSnapshotSource(row.source)) return latest;
    const ms = safeDateMs(row.snapshot_at);
    if (ms == null) return latest;
    return latest == null || ms > latest ? ms : latest;
  }, null);
}

function normaliseRows(rows: PortfolioSnapshotRow[], portfolioStartMs: number) {
  const latestLiveMs = latestLiveSnapshotMs(rows);
  const byDate = new Map<string, { point: NormalisedSnapshotPoint; priority: number }>();

  rows.forEach((row) => {
    const ms = safeDateMs(row.snapshot_at);
    const value = toNumber(row.value, Number.NaN);
    if (ms == null || ms < portfolioStartMs || !Number.isFinite(value) || value < 0) return;

    // Backfill is only historical context. If live/current rows exist, never let a
    // later backfill point become the effective current portfolio value.
    if (latestLiveMs != null && isHistoricalSnapshotSource(row.source) && ms > latestLiveMs) {
      return;
    }

    const date = new Date(ms).toISOString();
    const cash = roundMoney(toNumber(row.cash, 0));
    const basis = roundMoney(toNumber(row.basis, 0));
    const pnl = roundMoney(toNumber(row.pnl, value - basis));
    const pnlPct = toNumber(row.pnl_pct, basis > 0 ? (pnl / basis) * 100 : 0);
    const priority = snapshotSourcePriority(row.source);
    const existing = byDate.get(date);

    if (existing && existing.priority > priority) return;

    byDate.set(date, {
      priority,
      point: {
        ms,
        date,
        close: roundMoney(value),
        cash,
        basis,
        pnl,
        pnlPct,
      },
    });
  });

  return Array.from(byDate.values())
    .map(({ point }) => point)
    .sort((a, b) => a.ms - b.ms);
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
  if (range === "1D") return true;
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

function hasAnySnapshotChartData(chartData: PortfolioSnapshotChartData) {
  return OUTPUT_RANGES.some((range) => (chartData[range]?.length ?? 0) > 1);
}

function latestSnapshotCoversLatestInput(points: NormalisedSnapshotPoint[], latestInputMs: number) {
  const latest = points.at(-1);
  if (!latest) return false;
  return latest.ms + 1_000 >= latestInputMs;
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

    const points = normaliseRows((data ?? []) as PortfolioSnapshotRow[], portfolioStartMs);
    if (!latestSnapshotCoversLatestInput(points, latestInputMs)) return null;

    const chartData = snapshotsToChartData(points, portfolioStartMs);
    return hasAnySnapshotChartData(chartData) ? chartData : null;
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

  const cash = roundMoney(toNumber(portfolio.cash_balance ?? portfolio.cashBalance, 0));
  const cashDepositedTotal = toNumber(
    portfolio.cash_deposited_total ?? portfolio.cashDepositedTotal,
    toNumber(portfolio.investment_amount ?? portfolio.investmentAmount, 0),
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
