import type { ChartPoint, TimeRange } from "@/components/StockChart";

const YAHOO_BASE = "https://query1.finance.yahoo.com/v8/finance/chart/";

type RangeConfig = { range: string; interval: string };

const RANGE_CONFIG: Record<TimeRange, RangeConfig> = {
  "1D": { range: "1d", interval: "5m" },
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
      meta: {
        symbol: string;
        regularMarketPrice?: number;
        chartPreviousClose?: number;
        previousClose?: number;
        currency?: string;
        shortName?: string;
        longName?: string;
      };
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          close?: (number | null)[];
        }>;
      };
    }> | null;
    error: { code: string; description: string } | null;
  };
};

type CacheEntry = { data: ChartPoint[]; fetchedAt: number };
const cache: Map<string, CacheEntry> = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000;

type TickerTapeCacheEntry = { data: TickerTapeItem[]; fetchedAt: number };
const tickerTapeCache: Map<string, TickerTapeCacheEntry> = new Map();
const TICKER_TAPE_CACHE_TTL_MS = 60 * 1000;

function cacheKey(ticker: string, range: TimeRange) {
  return `${ticker.toUpperCase()}::${range}`;
}

async function fetchYahooRange(
  ticker: string,
  range: TimeRange,
): Promise<ChartPoint[]> {
  const cfg = RANGE_CONFIG[range];
  const url = `${YAHOO_BASE}${encodeURIComponent(
    ticker,
  )}?range=${cfg.range}&interval=${cfg.interval}&includePrePost=false`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; StockGPT/1.0)",
        Accept: "application/json",
      },
      next: { revalidate: 600 },
    });

    if (!res.ok) {
      console.warn(`Yahoo returned ${res.status} for ${ticker} ${range}`);
      return [];
    }

    const json = (await res.json()) as YahooChartResponse;

    if (
      json.chart.error ||
      !json.chart.result ||
      json.chart.result.length === 0
    ) {
      return [];
    }

    const result = json.chart.result[0];
    const timestamps = result.timestamp ?? [];
    const closes = result.indicators?.quote?.[0]?.close ?? [];

    const points: ChartPoint[] = [];

    for (let i = 0; i < timestamps.length; i++) {
      const close = closes[i];

      if (close == null || !Number.isFinite(close)) continue;

      points.push({
        date: new Date(timestamps[i] * 1000).toISOString(),
        close: Math.round(close * 100) / 100,
      });
    }

    return points;
  } catch (err) {
    console.error(`Yahoo fetch failed for ${ticker} ${range}:`, err);
    return [];
  }
}

export async function getStockChart(
  ticker: string,
  ranges: TimeRange[] = ["1D", "5D", "1M", "6M", "1Y", "5Y", "MAX"],
): Promise<Partial<Record<TimeRange, ChartPoint[]>>> {
  const result: Partial<Record<TimeRange, ChartPoint[]>> = {};
  const now = Date.now();

  const rangesToFetch: TimeRange[] = [];

  for (const range of ranges) {
    const key = cacheKey(ticker, range);
    const cached = cache.get(key);

    if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
      result[range] = cached.data;
    } else {
      rangesToFetch.push(range);
    }
  }

  if (rangesToFetch.length > 0) {
    const fetched = await Promise.all(
      rangesToFetch.map(async (range) => {
        const points = await fetchYahooRange(ticker, range);
        return { range, points };
      }),
    );

    for (const { range, points } of fetched) {
      if (points.length > 0) {
        result[range] = points;
        cache.set(cacheKey(ticker, range), { data: points, fetchedAt: now });
      }
    }
  }

  return result;
}

export async function getSP500Chart(
  ranges: TimeRange[] = ["1M", "6M", "1Y", "5Y"],
): Promise<Partial<Record<TimeRange, ChartPoint[]>>> {
  return getStockChart("^GSPC", ranges);
}

export function getLatestPriceFromChart(
  data: Partial<Record<TimeRange, ChartPoint[]>>,
): number | null {
  const rangeOrder: TimeRange[] = ["1D", "5D", "1M", "6M", "1Y", "5Y", "MAX"];

  for (const range of rangeOrder) {
    const points = data[range];

    if (points && points.length > 0) {
      const last = points[points.length - 1].close;

      if (Number.isFinite(last) && last > 0) return last;
    }
  }

  return null;
}

export type Mover = {
  ticker: string;
  currentPrice: number;
  changePct: number;
};

export async function getTopMovers(
  tickers: string[],
  limit = 5,
): Promise<{ gainers: Mover[]; losers: Mover[] }> {
  if (tickers.length === 0) return { gainers: [], losers: [] };

  const tickersToCheck = tickers.slice(0, 30);

  const results = await Promise.all(
    tickersToCheck.map(async (ticker) => {
      const data = await getStockChart(ticker, ["5D"]);
      const points = data["5D"] ?? [];

      if (points.length < 2) return null;

      const first = points[0].close;
      const last = points[points.length - 1].close;

      if (!Number.isFinite(first) || !Number.isFinite(last) || first <= 0) {
        return null;
      }

      const changePct = ((last - first) / first) * 100;

      return { ticker, currentPrice: last, changePct };
    }),
  );

  const valid = results.filter((r): r is Mover => r !== null);

  const gainers = [...valid]
    .sort((a, b) => b.changePct - a.changePct)
    .slice(0, limit);

  const losers = [...valid]
    .sort((a, b) => a.changePct - b.changePct)
    .slice(0, limit);

  return { gainers, losers };
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

function getLastValidClose(points: ChartPoint[]) {
  for (let i = points.length - 1; i >= 0; i--) {
    const close = points[i]?.close;

    if (Number.isFinite(close) && close > 0) {
      return close;
    }
  }

  return null;
}

function getFirstValidClose(points: ChartPoint[]) {
  for (let i = 0; i < points.length; i++) {
    const close = points[i]?.close;

    if (Number.isFinite(close) && close > 0) {
      return close;
    }
  }

  return null;
}

export async function getTickerTape(
  symbols: string[] = [
    "^GSPC",
    "^IXIC",
    "^DJI",
    "^VIX",
    "AAPL",
    "MSFT",
    "NVDA",
    "AMZN",
    "GOOGL",
    "META",
  ],
): Promise<TickerTapeItem[]> {
  const cleanedSymbols = symbols
    .map((symbol) => symbol.trim().toUpperCase())
    .filter(Boolean);

  if (cleanedSymbols.length === 0) return [];

  const cacheKey = cleanedSymbols.join("|");
  const cached = tickerTapeCache.get(cacheKey);
  const now = Date.now();

  if (cached && now - cached.fetchedAt < TICKER_TAPE_CACHE_TTL_MS) {
    return cached.data;
  }

  const results = await Promise.all(
    cleanedSymbols.map(async (symbol) => {
      const data = await getStockChart(symbol, ["1D", "5D"]);
      const oneDayPoints = data["1D"] ?? [];
      const fiveDayPoints = data["5D"] ?? [];

      const activePoints = oneDayPoints.length >= 2 ? oneDayPoints : fiveDayPoints;

      if (activePoints.length < 2) return null;

      const first = getFirstValidClose(activePoints);
      const last = getLastValidClose(activePoints);

      if (
        first == null ||
        last == null ||
        !Number.isFinite(first) ||
        !Number.isFinite(last) ||
        first <= 0
      ) {
        return null;
      }

      const change = last - first;
      const changePct = (change / first) * 100;

      return {
        symbol: displaySymbol(symbol),
        yahooSymbol: symbol,
        price: Math.round(last * 100) / 100,
        change: Math.round(change * 100) / 100,
        changePct: Math.round(changePct * 100) / 100,
      };
    }),
  );

  const valid = results.filter((item): item is TickerTapeItem => item !== null);

  tickerTapeCache.set(cacheKey, {
    data: valid,
    fetchedAt: now,
  });

  return valid;
}
