import { unstable_cache } from "next/cache";
import type { ChartPoint, TimeRange } from "@/components/StockChart";

const YAHOO_BASES = [
  "https://query1.finance.yahoo.com/v8/finance/chart/",
  "https://query2.finance.yahoo.com/v8/finance/chart/",
] as const;
const YAHOO_FETCH_TIMEOUT_MS = Number(process.env.YAHOO_FETCH_TIMEOUT_MS ?? 3_500);
const CACHE_REVALIDATE_SECONDS = 5 * 60;
const ONE_DAY_MOVE_TIMEOUT_MS = Number(process.env.ONE_DAY_MOVE_TIMEOUT_MS ?? 1_800);
const LIVE_MOVE_FALLBACK_LIMIT = Number(process.env.LIVE_MOVE_FALLBACK_LIMIT ?? 60);

type RangeConfig = { range: string; interval: string };

const RANGE_CONFIG: Record<TimeRange, RangeConfig> = {
  "1D": { range: "1d", interval: "30m" },
  "5D": { range: "5d", interval: "30m" },
  "1M": { range: "1mo", interval: "1d" },
  "6M": { range: "6mo", interval: "1d" },
  "1Y": { range: "1y", interval: "1d" },
  "5Y": { range: "5y", interval: "1wk" },
  MAX: { range: "max", interval: "1mo" },
};

type YahooChartResponse = {
  chart: {
    result: Array<{
      timestamp?: number[];
      indicators?: { quote?: Array<{ close?: (number | null)[] }> };
    }> | null;
    error: { code: string; description: string } | null;
  };
};

type CacheEntry = { data: ChartPoint[]; fetchedAt: number };
const memoryChartCache = new Map<string, CacheEntry>();

function normalizeTicker(ticker: string) {
  return ticker.trim().toUpperCase();
}

function cacheKey(ticker: string, range: TimeRange) {
  return `v6:${normalizeTicker(ticker)}:${range}`;
}

function yahooTicker(ticker: string) {
  // Yahoo uses hyphens for class shares such as BRK.B / BF.B.
  return normalizeTicker(ticker).replace(/\./g, "-");
}

function finitePositiveNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function fetchYahooRangeFromBase(
  base: string,
  ticker: string,
  range: TimeRange,
): Promise<ChartPoint[]> {
  const cfg = RANGE_CONFIG[range];
  const normalizedTicker = normalizeTicker(ticker);
  const providerTicker = yahooTicker(normalizedTicker);
  const url = `${base}${encodeURIComponent(providerTicker)}?range=${cfg.range}&interval=${cfg.interval}&includePrePost=false`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), YAHOO_FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; StockGPT/1.0)",
        Accept: "application/json",
      },
      // Successful responses are cached by unstable_cache below. Keeping this
      // request uncached prevents a transient Yahoo 429/timeout from becoming
      // a five-minute "missing range".
      cache: "no-store",
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`Yahoo returned ${res.status}`);
    }

    const json = (await res.json()) as YahooChartResponse;
    if (json.chart.error || !json.chart.result?.length) {
      throw new Error(json.chart.error?.description || "Yahoo returned no chart result");
    }

    const result = json.chart.result[0];
    const timestamps = result.timestamp ?? [];
    const closes = result.indicators?.quote?.[0]?.close ?? [];
    const points: ChartPoint[] = [];

    for (let i = 0; i < timestamps.length; i += 1) {
      const close = finitePositiveNumber(closes[i]);
      if (close == null) continue;
      points.push({
        date: new Date(timestamps[i] * 1000).toISOString(),
        close: Math.round(close * 100) / 100,
      });
    }

    if (points.length < 2) {
      throw new Error("Yahoo returned fewer than two usable price points");
    }

    return points;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchYahooRangeUncached(
  ticker: string,
  range: TimeRange,
): Promise<ChartPoint[]> {
  const attempts = await Promise.allSettled(
    YAHOO_BASES.map((base) => fetchYahooRangeFromBase(base, ticker, range)),
  );

  const success = attempts.find(
    (attempt): attempt is PromiseFulfilledResult<ChartPoint[]> =>
      attempt.status === "fulfilled" && attempt.value.length > 1,
  );
  if (success) return success.value;

  const lastError = [...attempts]
    .reverse()
    .find((attempt): attempt is PromiseRejectedResult => attempt.status === "rejected")
    ?.reason;

  throw lastError instanceof Error
    ? lastError
    : new Error(`Yahoo chart unavailable for ${normalizeTicker(ticker)} ${range}`);
}

const fetchYahooRangeCached = unstable_cache(
  fetchYahooRangeUncached,
  ["stockgpt-yahoo-chart-v6"],
  { revalidate: CACHE_REVALIDATE_SECONDS },
);

async function fetchYahooRange(ticker: string, range: TimeRange) {
  // Next's development cache revalidator prints a full AbortError dump when an
  // upstream request times out. Bypass that wrapper locally; production keeps
  // the cross-request cache.
  if (process.env.NODE_ENV === "development") {
    return fetchYahooRangeUncached(ticker, range);
  }
  return fetchYahooRangeCached(ticker, range);
}

const DAY_MS = 24 * 60 * 60 * 1000;

function pointsWithinDays(points: ChartPoint[], days: number) {
  if (points.length < 2) return [];
  const latest = new Date(points.at(-1)?.date ?? "").getTime();
  if (!Number.isFinite(latest)) return [];
  const cutoff = latest - days * DAY_MS;
  return points.filter((point) => {
    const time = new Date(point.date).getTime();
    return Number.isFinite(time) && time >= cutoff;
  });
}

function deriveMissingRange(
  data: Partial<Record<TimeRange, ChartPoint[]>>,
  range: TimeRange,
): ChartPoint[] {
  const firstUsable = (candidates: TimeRange[], days?: number) => {
    for (const candidate of candidates) {
      const source = data[candidate] ?? [];
      const derived = days == null ? source : pointsWithinDays(source, days);
      if (derived.length > 1) return derived;
    }
    return [];
  };

  switch (range) {
    case "1D": {
      const source = data["5D"] ?? [];
      const latestDay = source.at(-1)?.date.slice(0, 10);
      if (!latestDay) return [];
      return source.filter((point) => point.date.slice(0, 10) === latestDay);
    }
    case "5D":
      // A daily series is an acceptable fallback when Yahoo's intraday
      // endpoint is temporarily unavailable.
      return firstUsable(["1M", "1Y"], 9);
    case "1M":
      return firstUsable(["1Y", "5Y", "MAX"], 35);
    case "1Y":
      return firstUsable(["5Y", "MAX"], 370);
    case "5Y":
      return firstUsable(["MAX"], 5 * 366);
    default:
      return [];
  }
}

function fillMissingRanges(
  data: Partial<Record<TimeRange, ChartPoint[]>>,
  requestedRanges: TimeRange[],
) {
  // Work from the broadest useful fallback toward the shortest so one
  // successful long series can repair several missing tabs.
  const derivationOrder: TimeRange[] = ["5Y", "1Y", "1M", "5D", "1D"];

  for (const range of derivationOrder) {
    if (!requestedRanges.includes(range) || (data[range]?.length ?? 0) > 1) continue;
    const derived = deriveMissingRange(data, range);
    if (derived.length > 1) data[range] = derived;
  }
}

export async function getStockChart(
  ticker: string,
  ranges: TimeRange[] = ["1D", "5D", "1M", "6M", "1Y", "5Y", "MAX"],
): Promise<Partial<Record<TimeRange, ChartPoint[]>>> {
  const result: Partial<Record<TimeRange, ChartPoint[]>> = {};
  const normalizedTicker = normalizeTicker(ticker);
  const now = Date.now();

  await Promise.all(
    ranges.map(async (range) => {
      const key = cacheKey(normalizedTicker, range);
      const cached = memoryChartCache.get(key);
      if (cached && now - cached.fetchedAt < CACHE_REVALIDATE_SECONDS * 1000) {
        result[range] = cached.data;
        return;
      }

      try {
        const points = await fetchYahooRange(normalizedTicker, range);
        result[range] = points;
        memoryChartCache.set(key, { data: points, fetchedAt: now });
      } catch (error) {
        console.warn("[yahoo-chart] range unavailable", {
          ticker: normalizedTicker,
          range,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }),
  );

  fillMissingRanges(result, ranges);
  return result;
}

export async function getCachedStockChart(
  ticker: string,
  ranges: TimeRange[] = ["1D", "5D", "1M", "6M", "1Y", "5Y", "MAX"],
): Promise<Partial<Record<TimeRange, ChartPoint[]>>> {
  return getStockChart(ticker, ranges);
}

export async function getSP500Chart(
  ranges: TimeRange[] = ["1M", "6M", "1Y", "5Y"],
): Promise<Partial<Record<TimeRange, ChartPoint[]>>> {
  return getStockChart("^GSPC", ranges);
}

export function getLatestPriceFromChart(data: Partial<Record<TimeRange, ChartPoint[]>>): number | null {
  const rangeOrder: TimeRange[] = ["1D", "5D", "1M", "6M", "1Y", "5Y", "MAX"];
  for (const range of rangeOrder) {
    const points = data[range];
    const last = points?.at(-1)?.close;
    if (Number.isFinite(last) && Number(last) > 0) return Number(last);
  }
  return null;
}

export type Mover = {
  ticker: string;
  currentPrice: number;
  changePct: number;
};

function firstValidClose(points: ChartPoint[]) {
  return points.find((point) => Number.isFinite(point.close) && point.close > 0)?.close ?? null;
}

function lastValidClose(points: ChartPoint[]) {
  for (let i = points.length - 1; i >= 0; i -= 1) {
    const close = points[i]?.close;
    if (Number.isFinite(close) && close > 0) return close;
  }
  return null;
}

async function getOneDayMover(ticker: string): Promise<Mover | null> {
  const normalizedTicker = normalizeTicker(ticker);
  const data = await getStockChart(normalizedTicker, ["5D"]);
  const fiveDayPoints = data["5D"] ?? [];
  const latestDay = fiveDayPoints.at(-1)?.date.slice(0, 10);
  const points = latestDay
    ? fiveDayPoints.filter((point) => point.date.slice(0, 10) === latestDay)
    : [];
  const usablePoints = points.length >= 2 ? points : fiveDayPoints;
  const first = firstValidClose(usablePoints);
  const last = lastValidClose(usablePoints);
  if (first == null || last == null || first <= 0) return null;
  return { ticker: normalizedTicker, currentPrice: last, changePct: ((last - first) / first) * 100 };
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timeout = setTimeout(() => resolve(fallback), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function cleanTickerUniverse(tickers: string[], max = 500) {
  return Array.from(new Set(tickers.map(normalizeTicker).filter(Boolean))).slice(0, max);
}

export async function getOneDayMoveMap(tickers: string[]): Promise<Map<string, Mover>> {
  const effectiveLimit =
    process.env.NODE_ENV === "development"
      ? Math.min(LIVE_MOVE_FALLBACK_LIMIT, 12)
      : LIVE_MOVE_FALLBACK_LIMIT;
  const tickersToCheck = cleanTickerUniverse(tickers, 500).slice(0, Math.max(0, effectiveLimit));
  const movers = await Promise.all(
    tickersToCheck.map((ticker) =>
      withTimeout(getOneDayMover(ticker), ONE_DAY_MOVE_TIMEOUT_MS, null),
    ),
  );
  return new Map(movers.filter((mover): mover is Mover => mover !== null).map((mover) => [mover.ticker, mover]));
}

export async function refreshMarketSnapshots(
  tickers: string[],
  options: { batchSize?: number; maxTickers?: number } = {},
): Promise<{ attempted: number; updated: number }> {
  const tickersToRefresh = cleanTickerUniverse(tickers, options.maxTickers ?? 520);
  const movers = (await Promise.all(tickersToRefresh.map(getOneDayMover))).filter((mover): mover is Mover => mover !== null);
  return { attempted: tickersToRefresh.length, updated: movers.length };
}

export async function getTopMovers(
  tickers: string[],
  limit = 5,
): Promise<{ gainers: Mover[]; losers: Mover[] }> {
  const moveMap = await getOneDayMoveMap(tickers);
  const valid = Array.from(moveMap.values());
  return {
    gainers: [...valid].sort((a, b) => b.changePct - a.changePct).slice(0, limit),
    losers: [...valid].sort((a, b) => a.changePct - b.changePct).slice(0, limit),
  };
}

export type TickerTapeItem = {
  symbol: string;
  yahooSymbol: string;
  price: number;
  change: number;
  changePct: number;
};

function displaySymbol(symbol: string) {
  if (symbol === "^GSPC") return "S&P 500";
  if (symbol === "^IXIC") return "NASDAQ";
  if (symbol === "^DJI") return "DOW";
  if (symbol === "^VIX") return "VIX";
  return symbol;
}

export async function getTickerTape(
  symbols: string[] = ["^GSPC", "^IXIC", "^DJI", "^VIX", "AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "META"],
): Promise<TickerTapeItem[]> {
  const cleanedSymbols = symbols.map(normalizeTicker).filter(Boolean);
  const movers = await Promise.all(cleanedSymbols.map(getOneDayMover));
  return movers
    .map((mover, index): TickerTapeItem | null => {
      if (!mover) return null;
      const previous = mover.currentPrice / (1 + mover.changePct / 100);
      const change = Number.isFinite(previous) && previous > 0 ? mover.currentPrice - previous : 0;
      const yahooSymbol = cleanedSymbols[index];
      return {
        symbol: displaySymbol(yahooSymbol),
        yahooSymbol,
        price: Math.round(mover.currentPrice * 100) / 100,
        change: Math.round(change * 100) / 100,
        changePct: Math.round(mover.changePct * 100) / 100,
      };
    })
    .filter((item): item is TickerTapeItem => item !== null);
}
