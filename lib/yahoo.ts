import type { ChartPoint, TimeRange } from "@/components/StockChart";

// ── Yahoo Finance chart endpoint ──
// Free, no key. Returns OHLC data via ?range=...&interval=...
// Docs (unofficial): https://github.com/ranaroussi/yfinance/blob/main/yfinance/scrapers/history.py

const YAHOO_BASE = "https://query1.finance.yahoo.com/v8/finance/chart/";

type RangeConfig = {
  range: string;     // Yahoo's "range" param
  interval: string;  // Yahoo's "interval" param
};

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
      indicators: {
        quote: Array<{ close: (number | null)[] }>;
      };
    }> | null;
    error: { code: string; description: string } | null;
  };
};

// In-memory cache — refresh every 10 minutes
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
        // Yahoo blocks bare server-side requests without a UA
        "User-Agent": "Mozilla/5.0 (compatible; StockGPT/1.0)",
        "Accept": "application/json",
      },
      // Next.js fetch cache — refresh every 10 minutes server-side
      next: { revalidate: 600 },
    });

    if (!res.ok) {
      console.warn(`Yahoo returned ${res.status} for ${ticker} ${range}`);
      return [];
    }

    const json = (await res.json()) as YahooChartResponse;

    if (json.chart.error || !json.chart.result || json.chart.result.length === 0) {
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

/**
 * Fetch chart data for one ticker across multiple ranges.
 * Returns a partial map — ranges that failed will be missing.
 */
export async function getStockChart(
  ticker: string,
  ranges: TimeRange[] = ["1D", "5D", "1M", "6M", "1Y", "5Y", "MAX"]
): Promise<Partial<Record<TimeRange, ChartPoint[]>>> {
  const result: Partial<Record<TimeRange, ChartPoint[]>> = {};
  const now = Date.now();

  // Check cache first
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

  // Fetch the rest in parallel
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

/**
 * Fetch the S&P 500 index chart (^GSPC). Used on dashboard.
 */
export async function getSP500Chart(
  ranges: TimeRange[] = ["1D", "5D", "1M", "6M", "1Y", "5Y"]
): Promise<Partial<Record<TimeRange, ChartPoint[]>>> {
  return getStockChart("^GSPC", ranges);
}

/**
 * Fetch top movers — top gainers and losers from current rankings vs 5d ago.
 * Uses 5D chart data to compute simple % change.
 */
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

  // Limit to top 30 tickers to avoid spamming Yahoo
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
