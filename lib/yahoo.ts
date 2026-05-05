import type { ChartPoint, TimeRange } from "@/components/StockChart";

const YAHOO_BASE = "https://query1.finance.yahoo.com/v8/finance/chart/";

type RangeConfig = { range: string; interval: string };

const RANGE_CONFIG: Record<TimeRange, RangeConfig> = {
  "1D":  { range: "1d",  interval: "5m" },
  "5D":  { range: "5d",  interval: "30m" },
  "1M":  { range: "1mo", interval: "1d" },
  "6M":  { range: "6mo", interval: "1d" },
  "1Y":  { range: "1y",  interval: "1d" },
  "5Y":  { range: "5y",  interval: "1wk" },
  "MAX": { range: "max", interval: "1mo" },
};

type YahooChartResponse = {
  chart: {
    result: Array<{
      meta: { symbol: string; regularMarketPrice: number };
      timestamp: number[];
      indicators: { quote: Array<{ close: (number | null)[] }> };
    }> | null;
    error: { code: string; description: string } | null;
  };
};

type CacheEntry = { data: ChartPoint[]; fetchedAt: number };
const cache: Map<string, CacheEntry> = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000;

function cacheKey(ticker: string, range: TimeRange) {
  return `${ticker.toUpperCase()}::${range}`;
}

async function fetchYahooRange(ticker: string, range: TimeRange): Promise<ChartPoint[]> {
  const cfg = RANGE_CONFIG[range];
  const url = `${YAHOO_BASE}${encodeURIComponent(ticker)}?range=${cfg.range}&interval=${cfg.interval}&includePrePost=false`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; StockGPT/1.0)",
        "Accept": "application/json",
      },
      next: { revalidate: 600 },
    });

    if (!res.ok) {
      console.warn(`Yahoo returned ${res.status} for ${ticker} ${range}`);
      return [];
    }

    const json = (await res.json()) as YahooChartResponse;
    if (json.chart.error || !json.chart.result || json.chart.result.length === 0) return [];

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
  ranges: TimeRange[] = ["1D", "5D", "1M", "6M", "1Y", "5Y", "MAX"]
): Promise<Partial<Record<TimeRange, ChartPoint[]>>> {
  const result: Partial<Record<TimeRange, ChartPoint[]>> = {};
  const now = Date.now();

  const ranges_to_fetch: TimeRange[] = [];
  for (const range of ranges) {
    const key = cacheKey(ticker, range);
    const cached = cache.get(key);
    if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
      result[range] = cached.data;
    } else {
      ranges_to_fetch.push(range);
    }
  }

  if (ranges_to_fetch.length > 0) {
    const fetched = await Promise.all(
      ranges_to_fetch.map(async (range) => {
        const points = await fetchYahooRange(ticker, range);
        return { range, points };
      })
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
  ranges: TimeRange[] = ["1M", "6M", "1Y", "5Y"]
): Promise<Partial<Record<TimeRange, ChartPoint[]>>> {
  return getStockChart("^GSPC", ranges);
}

/**
 * ✦ Single source of truth for "current price" — extracts from chart data.
 * Tries shortest ranges first since they're most recent.
 * Returns null if no data available.
 */
export function getLatestPriceFromChart(
  data: Partial<Record<TimeRange, ChartPoint[]>>
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
  limit = 5
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
      const changePct = ((last - first) / first) * 100;
      return { ticker, currentPrice: last, changePct };
    })
  );

  const valid = results.filter((r): r is Mover => r !== null);
  const gainers = [...valid].sort((a, b) => b.changePct - a.changePct).slice(0, limit);
  const losers = [...valid].sort((a, b) => a.changePct - b.changePct).slice(0, limit);
  return { gainers, losers };
}
