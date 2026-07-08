import { unstable_cache } from "next/cache";
import type { ChartPoint, TimeRange } from "@/components/StockChart";

const YAHOO_BASE = "https://query1.finance.yahoo.com/v8/finance/chart/";
const YAHOO_FETCH_TIMEOUT_MS = Number(process.env.YAHOO_FETCH_TIMEOUT_MS ?? 1_800);
const CACHE_REVALIDATE_SECONDS = 5 * 60;
const ONE_DAY_MOVE_TIMEOUT_MS = Number(process.env.ONE_DAY_MOVE_TIMEOUT_MS ?? 1_800);
const LIVE_MOVE_FALLBACK_LIMIT = Number(process.env.LIVE_MOVE_FALLBACK_LIMIT ?? 8);

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
  return `v4:${normalizeTicker(ticker)}:${range}`;
}

function finitePositiveNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function fetchYahooRangeUncached(ticker: string, range: TimeRange): Promise<ChartPoint[]> {
  const cfg = RANGE_CONFIG[range];
  const normalizedTicker = normalizeTicker(ticker);
  const url = `${YAHOO_BASE}${encodeURIComponent(normalizedTicker)}?range=${cfg.range}&interval=${cfg.interval}&includePrePost=false`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), YAHOO_FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; StockGPT/1.0)",
        Accept: "application/json",
      },
      next: { revalidate: CACHE_REVALIDATE_SECONDS },
      signal: controller.signal,
    });

    if (!res.ok) return [];
    const json = (await res.json()) as YahooChartResponse;
    if (json.chart.error || !json.chart.result?.length) return [];

    const result = json.chart.result[0];
    const timestamps = result.timestamp ?? [];
    const closes = result.indicators?.quote?.[0]?.close ?? [];
    const points: ChartPoint[] = [];

    for (let i = 0; i < timestamps.length; i += 1) {
      const close = finitePositiveNumber(closes[i]);
      if (close == null) continue;
      points.push({ date: new Date(timestamps[i] * 1000).toISOString(), close: Math.round(close * 100) / 100 });
    }

    return points;
  } catch (err) {
    const isAbort = err instanceof Error && err.name === "AbortError";
    if (!isAbort) console.error(`Yahoo fetch failed for ${normalizedTicker} ${range}:`, err);
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

const fetchYahooRange = unstable_cache(fetchYahooRangeUncached, ["stockgpt-yahoo-chart-v4"], {
  revalidate: CACHE_REVALIDATE_SECONDS,
});

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

      const points = await fetchYahooRange(normalizedTicker, range);
      if (points.length > 0) {
        result[range] = points;
        memoryChartCache.set(key, { data: points, fetchedAt: now });
      }
    }),
  );

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
  const data = await getStockChart(normalizedTicker, ["1D", "5D"]);
  const points = (data["1D"]?.length ?? 0) >= 2 ? data["1D"]! : data["5D"] ?? [];
  const first = firstValidClose(points);
  const last = lastValidClose(points);
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
  const tickersToCheck = cleanTickerUniverse(tickers, 500).slice(0, Math.max(0, LIVE_MOVE_FALLBACK_LIMIT));
  const movers = await withTimeout(
    Promise.all(tickersToCheck.map(getOneDayMover)),
    ONE_DAY_MOVE_TIMEOUT_MS,
    [],
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
