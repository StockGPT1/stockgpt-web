import { unstable_cache } from "next/cache";
import type { ChartPoint, TimeRange } from "@/components/StockChart";
import { getJsonCache, getJsonCacheMany, setJsonCache } from "@/lib/redis-cache";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";

const YAHOO_BASE = "https://query1.finance.yahoo.com/v8/finance/chart/";

const YAHOO_FETCH_TIMEOUT_MS = 2_500;
const ONE_DAY_MOVE_TIMEOUT_MS = 4_000;
const CACHE_REVALIDATE_SECONDS = 5 * 60;
const LIVE_MOVE_FALLBACK_LIMIT = Number(process.env.LIVE_MOVE_FALLBACK_LIMIT ?? 12);
const LIVE_MOVE_BATCH_SIZE = Number(process.env.LIVE_MOVE_BATCH_SIZE ?? 8);
const DB_CHART_CACHE_TTL_MS = Number(process.env.DB_CHART_CACHE_TTL_MS ?? 15 * 60 * 1000);
const REDIS_CHART_CACHE_TTL_SECONDS = Number(
  process.env.REDIS_CHART_CACHE_TTL_SECONDS ?? 15 * 60,
);
const REDIS_MARKET_SNAPSHOT_TTL_SECONDS = Number(
  process.env.REDIS_MARKET_SNAPSHOT_TTL_SECONDS ?? 5 * 60,
);
const REDIS_TICKER_TAPE_TTL_SECONDS = Number(
  process.env.REDIS_TICKER_TAPE_TTL_SECONDS ?? 5 * 60,
);

const TICKER_TAPE_CACHE_TTL_MS = 5 * 60 * 1000;
const MEMORY_CACHE_TTL_MS = CACHE_REVALIDATE_SECONDS * 1000;
const CHART_CACHE_VERSION = "v4";

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

type TickerTapeCacheEntry = { data: TickerTapeItem[]; fetchedAt: number };
const tickerTapeCache: Map<string, TickerTapeCacheEntry> = new Map();

type MarketSnapshotRow = {
  ticker: string | null;
  current_price: number | string | null;
  change_pct_1d: number | string | null;
  updated_at: string | null;
};

type ChartCacheRow = {
  ticker: string | null;
  range: string | null;
  points: unknown;
  fetched_at: string | null;
};

function cacheKey(ticker: string, range: TimeRange) {
  return `${CHART_CACHE_VERSION}:${ticker.toUpperCase()}::${range}`;
}

function chartRedisKey(ticker: string, range: TimeRange) {
  return `chart:${CHART_CACHE_VERSION}:${ticker.toUpperCase()}:${range}`;
}

function marketSnapshotRedisKey(ticker: string) {
  return `market:snapshot:${ticker.toUpperCase()}`;
}

function tickerTapeRedisKey(symbols: string[]) {
  return `ticker-tape:${symbols.join("|")}`;
}

function normalizeTicker(ticker: string) {
  return ticker.trim().toUpperCase();
}

function finitePositiveNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function finiteNumberOrNull(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function coerceChartPoints(value: unknown): ChartPoint[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((point) => {
      if (!point || typeof point !== "object") return null;
      const raw = point as { date?: unknown; close?: unknown };
      const date = typeof raw.date === "string" ? raw.date : null;
      const close = finitePositiveNumber(raw.close);
      if (!date || close === null) return null;
      return { date, close };
    })
    .filter((point): point is ChartPoint => point !== null);
}

function coerceMover(value: unknown): Mover | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as { ticker?: unknown; currentPrice?: unknown; changePct?: unknown };
  const ticker = typeof raw.ticker === "string" ? normalizeTicker(raw.ticker) : "";
  const currentPrice = finitePositiveNumber(raw.currentPrice);
  const changePct = finiteNumberOrNull(raw.changePct);

  if (!ticker || currentPrice === null || changePct === null) return null;
  return { ticker, currentPrice, changePct };
}

function isFreshTimestamp(value: string | null, ttlMs: number) {
  if (!value) return false;
  const time = new Date(value).getTime();
  return Number.isFinite(time) && Date.now() - time < ttlMs;
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

function getAdminWriteClient() {
  try {
    return createAdminClient();
  } catch (err) {
    console.warn("Admin Supabase client unavailable for cache write", err);
    return null;
  }
}

async function getCachedChartRowsFromRedis(
  ticker: string,
  ranges: TimeRange[],
): Promise<Partial<Record<TimeRange, ChartPoint[]>>> {
  if (ranges.length === 0) return {};

  const keys = ranges.map((range) => chartRedisKey(ticker, range));
  const cached = await getJsonCacheMany<ChartPoint[]>(keys);
  const result: Partial<Record<TimeRange, ChartPoint[]>> = {};

  ranges.forEach((range) => {
    const points = coerceChartPoints(cached.get(chartRedisKey(ticker, range)));
    if (points.length > 0) result[range] = points;
  });

  return result;
}

async function setChartRowsInRedis(
  ticker: string,
  entries: Array<{ range: TimeRange; points: ChartPoint[] }>,
) {
  const validEntries = entries.filter((entry) => entry.points.length > 0);
  if (validEntries.length === 0) return;

  await Promise.all(
    validEntries.map((entry) =>
      setJsonCache(
        chartRedisKey(ticker, entry.range),
        entry.points,
        REDIS_CHART_CACHE_TTL_SECONDS,
      ),
    ),
  );
}

async function getCachedChartRows(
  ticker: string,
  ranges: TimeRange[],
): Promise<Partial<Record<TimeRange, ChartPoint[]>>> {
  const dbRanges = ranges.filter((range) => range !== "1D");
  if (dbRanges.length === 0) return {};

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("stock_chart_cache")
      .select("ticker,range,points,fetched_at")
      .eq("ticker", ticker)
      .in("range", dbRanges);

    if (error) return {};

    const result: Partial<Record<TimeRange, ChartPoint[]>> = {};
    const redisWrites: Array<{ range: TimeRange; points: ChartPoint[] }> = [];

    ((data ?? []) as ChartCacheRow[]).forEach((row) => {
      const range = row.range as TimeRange | null;
      if (!range || !dbRanges.includes(range)) return;
      if (!isFreshTimestamp(row.fetched_at, DB_CHART_CACHE_TTL_MS)) return;

      const points = coerceChartPoints(row.points);
      if (points.length === 0) return;
      result[range] = points;
      redisWrites.push({ range, points });
    });

    void setChartRowsInRedis(ticker, redisWrites);
    return result;
  } catch {
    return {};
  }
}

async function upsertChartCache(
  ticker: string,
  entries: Array<{ range: TimeRange; points: ChartPoint[] }>,
) {
  const validEntries = entries.filter((entry) => entry.points.length > 0);
  if (validEntries.length === 0) return;

  void setChartRowsInRedis(ticker, validEntries);

  try {
    const supabase = getAdminWriteClient();
    if (!supabase) return;

    await supabase.from("stock_chart_cache").upsert(
      validEntries.map((entry) => ({
        ticker,
        range: entry.range,
        points: entry.points,
        fetched_at: new Date().toISOString(),
        source: "yahoo",
      })),
      { onConflict: "ticker,range" },
    );
  } catch (err) {
    console.warn("Could not persist chart cache", err);
  }
}

async function fetchYahooRangeUncached(
  ticker: string,
  range: TimeRange,
): Promise<ChartPoint[]> {
  const cfg = RANGE_CONFIG[range];
  const normalizedTicker = normalizeTicker(ticker);
  const url = `${YAHOO_BASE}${encodeURIComponent(
    normalizedTicker,
  )}?range=${cfg.range}&interval=${cfg.interval}&includePrePost=false`;

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

    if (!res.ok) {
      console.warn(`Yahoo returned ${res.status} for ${normalizedTicker} ${range}`);
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
    const isAbort = err instanceof Error && err.name === "AbortError";
    if (!isAbort) console.error(`Yahoo fetch failed for ${normalizedTicker} ${range}:`, err);
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

const fetchYahooRange = unstable_cache(
  fetchYahooRangeUncached,
  ["stockgpt-yahoo-chart-v4"],
  { revalidate: CACHE_REVALIDATE_SECONDS },
);

export async function getStockChart(
  ticker: string,
  ranges: TimeRange[] = ["1D", "5D", "1M", "6M", "1Y", "5Y", "MAX"],
): Promise<Partial<Record<TimeRange, ChartPoint[]>>> {
  const result: Partial<Record<TimeRange, ChartPoint[]>> = {};
  const now = Date.now();
  const normalizedTicker = normalizeTicker(ticker);

  let rangesToFetch: TimeRange[] = [];

  for (const range of ranges) {
    const key = cacheKey(normalizedTicker, range);
    const cached = cache.get(key);

    if (cached && now - cached.fetchedAt < MEMORY_CACHE_TTL_MS) {
      result[range] = cached.data;
    } else {
      rangesToFetch.push(range);
    }
  }

  if (rangesToFetch.length > 0) {
    const redisCached = await getCachedChartRowsFromRedis(normalizedTicker, rangesToFetch);
    rangesToFetch = rangesToFetch.filter((range) => {
      const points = redisCached[range];
      if (!points || points.length === 0) return true;
      result[range] = points;
      cache.set(cacheKey(normalizedTicker, range), { data: points, fetchedAt: now });
      return false;
    });
  }

  if (rangesToFetch.length > 0) {
    const dbCached = await getCachedChartRows(normalizedTicker, rangesToFetch);
    rangesToFetch = rangesToFetch.filter((range) => {
      const points = dbCached[range];
      if (!points || points.length === 0) return true;
      result[range] = points;
      cache.set(cacheKey(normalizedTicker, range), { data: points, fetchedAt: now });
      return false;
    });
  }

  if (rangesToFetch.length > 0) {
    const fetched = await Promise.all(
      rangesToFetch.map(async (range) => {
        const points = await fetchYahooRange(normalizedTicker, range);
        return { range, points };
      }),
    );

    const cacheWrites: Array<{ range: TimeRange; points: ChartPoint[] }> = [];

    for (const { range, points } of fetched) {
      if (points.length > 0) {
        result[range] = points;
        cache.set(cacheKey(normalizedTicker, range), { data: points, fetchedAt: now });
        cacheWrites.push({ range, points });
      }
    }

    void upsertChartCache(normalizedTicker, cacheWrites);
  }

  return result;
}

export async function getCachedStockChart(
  ticker: string,
  ranges: TimeRange[] = ["1D", "5D", "1M", "6M", "1Y", "5Y", "MAX"],
): Promise<Partial<Record<TimeRange, ChartPoint[]>>> {
  const result: Partial<Record<TimeRange, ChartPoint[]>> = {};
  const now = Date.now();
  const normalizedTicker = normalizeTicker(ticker);

  let rangesToLoad: TimeRange[] = [];

  for (const range of ranges) {
    const key = cacheKey(normalizedTicker, range);
    const cached = cache.get(key);

    if (cached && now - cached.fetchedAt < MEMORY_CACHE_TTL_MS) {
      result[range] = cached.data;
    } else {
      rangesToLoad.push(range);
    }
  }

  if (rangesToLoad.length > 0) {
    const redisCached = await getCachedChartRowsFromRedis(normalizedTicker, rangesToLoad);
    rangesToLoad = rangesToLoad.filter((range) => {
      const points = redisCached[range];
      if (!points || points.length === 0) return true;
      result[range] = points;
      cache.set(cacheKey(normalizedTicker, range), { data: points, fetchedAt: now });
      return false;
    });
  }

  if (rangesToLoad.length > 0) {
    const dbCached = await getCachedChartRows(normalizedTicker, rangesToLoad);
    rangesToLoad = rangesToLoad.filter((range) => {
      const points = dbCached[range];
      if (!points || points.length === 0) return true;
      result[range] = points;
      cache.set(cacheKey(normalizedTicker, range), { data: points, fetchedAt: now });
      return false;
    });
  }

  return result;
}
