import { createHash } from "node:crypto";
import type { ChartPoint, TimeRange } from "@/components/StockChart";
import { getJsonCache, setJsonCache } from "@/lib/redis-cache";
import { isPortfolioChartLatestPointFresh } from "@/lib/portfolio-snapshots";
import {
  filterDisplayablePortfolioChartData,
  isPortfolioChartRangeDisplayable,
} from "@/lib/portfolio-chart-health";

const PORTFOLIO_CHART_CACHE_TTL_SECONDS = Math.max(
  60,
  Number(process.env.PORTFOLIO_CHART_CACHE_TTL_SECONDS ?? 15 * 60),
);
export const PORTFOLIO_CHART_CACHE_VERSION = "v11";
const CHART_RANGES: TimeRange[] = ["1D", "1M", "6M", "1Y", "MAX"];

export type PortfolioChartData = Partial<Record<TimeRange, ChartPoint[]>>;

export type PortfolioChartFingerprintInput = {
  ownerId: string;
  portfolioId: string;
  accountingBasis: "canonical_usd";
  portfolioCreatedAt: string | null;
  cashBalance: unknown;
  netContributedCapital: unknown;
  holdings: Array<{
    ticker: string;
    shares: unknown;
    entryPrice: unknown;
    purchaseDate: string | null;
    addedAt: string | null;
    currentPrice: unknown;
    currentPriceUpdatedAt: string | null;
  }>;
  transactions: Array<{
    id: string | null;
    createdAt: string | null;
    ticker: string | null;
    type: string | null;
    shares: unknown;
    price: unknown;
    amount: unknown;
    realisedPnl: unknown;
    currency: string | null;
  }>;
};

type PortfolioChartCachePayload = {
  version: typeof PORTFOLIO_CHART_CACHE_VERSION;
  ownerId: string;
  portfolioId: string;
  inputFingerprint: string;
  chartData: PortfolioChartData;
  generatedAt: string;
};

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;

  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
    .join(",")}}`;
}

function cleanTicker(value: string | null | undefined) {
  return String(value ?? "").trim().toUpperCase();
}

export function buildPortfolioChartInputFingerprint(
  input: PortfolioChartFingerprintInput,
) {
  const canonicalInput = {
    version: PORTFOLIO_CHART_CACHE_VERSION,
    ownerId: input.ownerId,
    portfolioId: input.portfolioId,
    accountingBasis: input.accountingBasis,
    portfolioCreatedAt: input.portfolioCreatedAt,
    cashBalance: input.cashBalance,
    netContributedCapital: input.netContributedCapital,
    holdings: input.holdings
      .map((holding) => ({ ...holding, ticker: cleanTicker(holding.ticker) }))
      .sort((a, b) => a.ticker.localeCompare(b.ticker)),
    transactions: input.transactions
      .map((transaction) => ({
        ...transaction,
        ticker: cleanTicker(transaction.ticker) || null,
      }))
      .sort((a, b) =>
        String(a.createdAt ?? "").localeCompare(String(b.createdAt ?? "")) ||
        String(a.id ?? "").localeCompare(String(b.id ?? "")),
      ),
  };

  return createHash("sha256").update(stableJson(canonicalInput)).digest("hex");
}

function portfolioChartKey({
  ownerId,
  portfolioId,
  inputFingerprint,
}: {
  ownerId: string;
  portfolioId: string;
  inputFingerprint: string;
}) {
  return `portfolio:chart:${PORTFOLIO_CHART_CACHE_VERSION}:${ownerId}:${portfolioId}:${inputFingerprint}`;
}

function isValidChartPoint(value: unknown): value is ChartPoint {
  if (!value || typeof value !== "object") return false;
  const point = value as Record<string, unknown>;
  const timestamp = typeof point.date === "string" ? new Date(point.date).getTime() : Number.NaN;
  if (!Number.isFinite(timestamp)) return false;
  if (!Number.isFinite(point.close) || Number(point.close) < 0) return false;
  for (const field of ["cash", "basis", "pnl", "pnlPct"] as const) {
    if (point[field] != null && !Number.isFinite(point[field])) return false;
  }
  if (point.cash != null && Number(point.cash) < 0) return false;
  return true;
}

export function isPortfolioChartCachePayload(
  value: unknown,
  expected: { ownerId: string; portfolioId: string; inputFingerprint: string },
): value is PortfolioChartCachePayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Partial<PortfolioChartCachePayload>;
  if (
    payload.version !== PORTFOLIO_CHART_CACHE_VERSION ||
    payload.ownerId !== expected.ownerId ||
    payload.portfolioId !== expected.portfolioId ||
    payload.inputFingerprint !== expected.inputFingerprint ||
    typeof payload.generatedAt !== "string" ||
    !Number.isFinite(new Date(payload.generatedAt).getTime()) ||
    !payload.chartData ||
    typeof payload.chartData !== "object"
  ) {
    return false;
  }

  return Object.entries(payload.chartData).every(
    ([range, points]) =>
      CHART_RANGES.includes(range as TimeRange) &&
      Array.isArray(points) &&
      points.every(isValidChartPoint),
  );
}

function hasUsableOneDayChart(chartData: PortfolioChartData) {
  const oneDayPoints = chartData["1D"] ?? [];
  if (oneDayPoints.length === 0) return true;
  return isPortfolioChartRangeDisplayable("1D", oneDayPoints);
}

export function hasUsablePortfolioChart(chartData: PortfolioChartData | null | undefined) {
  if (!chartData) return false;
  const displayable = filterDisplayablePortfolioChartData(chartData);
  const hasAnyUsableRange = Object.values(displayable).some(
    (points) => (points?.length ?? 0) > 1,
  );
  return hasAnyUsableRange && hasUsableOneDayChart(displayable);
}

export async function getLatestPortfolioChart({
  ownerId,
  portfolioId,
  inputFingerprint,
  nowMs,
}: {
  ownerId: string;
  portfolioId: string;
  inputFingerprint: string;
  nowMs?: number;
}): Promise<PortfolioChartData | null> {
  const expected = { ownerId, portfolioId, inputFingerprint };
  const payload = await getJsonCache<unknown>(portfolioChartKey(expected));

  if (!isPortfolioChartCachePayload(payload, expected)) return null;
  if (!hasUsablePortfolioChart(payload.chartData)) return null;
  if (!isPortfolioChartLatestPointFresh({ chartData: payload.chartData, nowMs })) return null;

  return filterDisplayablePortfolioChartData(payload.chartData);
}

export async function saveLatestPortfolioChart({
  ownerId,
  portfolioId,
  inputFingerprint,
  chartData,
  generatedAt = new Date().toISOString(),
}: {
  ownerId: string;
  portfolioId: string;
  inputFingerprint: string;
  chartData: PortfolioChartData;
  generatedAt?: string;
}) {
  const displayableChartData = filterDisplayablePortfolioChartData(chartData);
  if (!hasUsablePortfolioChart(displayableChartData)) return;

  const payload: PortfolioChartCachePayload = {
    version: PORTFOLIO_CHART_CACHE_VERSION,
    ownerId,
    portfolioId,
    inputFingerprint,
    chartData: displayableChartData,
    generatedAt,
  };
  await setJsonCache(
    portfolioChartKey({ ownerId, portfolioId, inputFingerprint }),
    payload,
    PORTFOLIO_CHART_CACHE_TTL_SECONDS,
  );
}
