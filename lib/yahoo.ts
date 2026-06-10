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
  return `${ticker.toUpperCase()}::${range}`;
}

function chartRedisKey(ticker: string, range: TimeRange) {
  return `chart:${ticker.toUpperCase()}:${range}`;
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
  if (ranges.length === 0) return {};

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("stock_chart_cache")
      .select("ticker,range,points,fetched_at")
      .eq("ticker", ticker)
      .in("range", ranges);

    if (error) return {};

    const result: Partial<Record<TimeRange, ChartPoint[]>> = {};
    const redisWrites: Array<{ range: TimeRange; points: ChartPoint[] }> = [];

    ((data ?? []) as ChartCacheRow[]).forEach((row) => {
      const range = row.range as TimeRange | null;
      if (!range || !ranges.includes(range)) return;
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
  ["stockgpt-yahoo-chart-v3"],
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

async function runInBatches<T, R>(
  items: T[],
  batchSize: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
  }

  return results;
}

function cleanTickerUniverse(tickers: string[], max = 500) {
  return Array.from(
    new Set(tickers.map((ticker) => normalizeTicker(ticker)).filter(Boolean)),
  ).slice(0, max);
}

async function getCachedOneDayMoveMap(tickers: string[]): Promise<Map<string, Mover>> {
  if (tickers.length === 0) return new Map();

  const result = new Map<string, Mover>();
  const redisKeys = tickers.map(marketSnapshotRedisKey);
  const redisCached = await getJsonCacheMany<Mover>(redisKeys);

  tickers.forEach((ticker) => {
    const mover = coerceMover(redisCached.get(marketSnapshotRedisKey(ticker)));
    if (mover) result.set(ticker, mover);
  });

  const dbTickers = tickers.filter((ticker) => !result.has(ticker));
  if (dbTickers.length === 0) return result;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("market_snapshots")
      .select("ticker,current_price,change_pct_1d,updated_at")
      .in("ticker", dbTickers);

    if (error) return result;

    const rows = (data ?? []) as MarketSnapshotRow[];
    const redisWrites: Mover[] = [];

    rows.forEach((row) => {
      const ticker = row.ticker ? normalizeTicker(row.ticker) : "";
      const currentPrice = finitePositiveNumber(row.current_price);
      const changePct = finiteNumberOrNull(row.change_pct_1d);

      if (!ticker || currentPrice === null || changePct === null) return;
      const mover = { ticker, currentPrice, changePct };
      result.set(ticker, mover);
      redisWrites.push(mover);
    });

    void setMarketSnapshotsInRedis(redisWrites);
    return result;
  } catch {
    return result;
  }
}

async function setMarketSnapshotsInRedis(movers: Mover[]) {
  const valid = movers.filter((mover) => coerceMover(mover));
  if (valid.length === 0) return;

  await Promise.all(
    valid.map((mover) =>
      setJsonCache(
        marketSnapshotRedisKey(mover.ticker),
        mover,
        REDIS_MARKET_SNAPSHOT_TTL_SECONDS,
      ),
    ),
  );
}

async function upsertMarketSnapshots(movers: Mover[]) {
  if (movers.length === 0) return;

  void setMarketSnapshotsInRedis(movers);

  try {
    const supabase = getAdminWriteClient();
    if (!supabase) return;

    await supabase.from("market_snapshots").upsert(
      movers.map((mover) => ({
        ticker: mover.ticker,
        current_price: mover.currentPrice,
        change_pct_1d: mover.changePct,
        updated_at: new Date().toISOString(),
        source: "yahoo",
      })),
      { onConflict: "ticker" },
    );
  } catch (err) {
    console.warn("Could not persist market snapshots", err);
  }
}

async function getOneDayMover(ticker: string): Promise<Mover | null> {
  const data = await getStockChart(ticker, ["1D", "5D"]);
  const points = (data["1D"] && data["1D"]!.length >= 2)
    ? data["1D"]!
    : data["5D"] ?? [];

  if (points.length < 2) return null;

  const validCloses = points
    .map((point) => point.close)
    .filter((close) => Number.isFinite(close) && close > 0);

  if (validCloses.length < 2) return null;

  const first = validCloses[0];
  const last = validCloses[validCloses.length - 1];
  const changePct = ((last - first) / first) * 100;

  return { ticker, currentPrice: last, changePct };
}

async function getOneDayMovers(tickers: string[]): Promise<Mover[]> {
  if (tickers.length === 0) return [];

  const results = await runInBatches(tickers, 35, getOneDayMover);
  return results.filter((r): r is Mover => r !== null);
}

const getCachedOneDayMovers = unstable_cache(
  getOneDayMovers,
  ["stockgpt-one-day-movers-v3"],
  { revalidate: CACHE_REVALIDATE_SECONDS },
);

export async function getOneDayMoveMap(tickers: string[]): Promise<Map<string, Mover>> {
  const tickersToCheck = cleanTickerUniverse(tickers, 500);
  if (tickersToCheck.length === 0) return new Map();

  const cached = await getCachedOneDayMoveMap(tickersToCheck);
  const missingTickers = tickersToCheck
    .filter((ticker) => !cached.has(ticker))
    .slice(0, Math.max(0, LIVE_MOVE_FALLBACK_LIMIT));

  if (missingTickers.length === 0) return cached;

  const fresh = await withTimeout(
    getCachedOneDayMovers(missingTickers),
    ONE_DAY_MOVE_TIMEOUT_MS,
    [],
  );

  fresh.forEach((mover) => cached.set(mover.ticker, mover));
  void upsertMarketSnapshots(fresh);

  return cached;
}

export async function refreshMarketSnapshots(
  tickers: string[],
  options: { batchSize?: number; maxTickers?: number } = {},
): Promise<{ attempted: number; updated: number }> {
  const tickersToRefresh = cleanTickerUniverse(tickers, options.maxTickers ?? 520);
  if (tickersToRefresh.length === 0) return { attempted: 0, updated: 0 };

  const batchSize = Math.max(1, options.batchSize ?? LIVE_MOVE_BATCH_SIZE);
  const results = await runInBatches(tickersToRefresh, batchSize, getOneDayMover);
  const movers = results.filter((result): result is Mover => result !== null);

  await upsertMarketSnapshots(movers);

  return { attempted: tickersToRefresh.length, updated: movers.length };
}

export async function getTopMovers(
  tickers: string[],
  limit = 5,
): Promise<{ gainers: Mover[]; losers: Mover[] }> {
  if (tickers.length === 0) return { gainers: [], losers: [] };

  const moveMap = await getOneDayMoveMap(tickers);
  const valid = Array.from(moveMap.values());

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

function tickerTapeItemFromMover(symbol: string, mover: Mover): TickerTapeItem {
  const previous = mover.currentPrice / (1 + mover.changePct / 100);
  const change = Number.isFinite(previous) && previous > 0 ? mover.currentPrice - previous : 0;

  return {
    symbol: displaySymbol(symbol),
    yahooSymbol: symbol,
    price: Math.round(mover.currentPrice * 100) / 100,
    change: Math.round(change * 100) / 100,
    changePct: Math.round(mover.changePct * 100) / 100,
  };
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
  const cleanedSymbols = symbols.map(normalizeTicker).filter(Boolean);

  if (cleanedSymbols.length === 0) return [];

  const cacheKey = cleanedSymbols.join("|");
  const cached = tickerTapeCache.get(cacheKey);
  const now = Date.now();

  if (cached && now - cached.fetchedAt < TICKER_TAPE_CACHE_TTL_MS) {
    return cached.data;
  }

  const redisKey = tickerTapeRedisKey(cleanedSymbols);
  const redisCached = await getJsonCache<TickerTapeItem[]>(redisKey);
  if (redisCached?.length) {
    tickerTapeCache.set(cacheKey, { data: redisCached, fetchedAt: now });
    return redisCached;
  }

  const cachedMoveMap = await getCachedOneDayMoveMap(cleanedSymbols);

  if (cachedMoveMap.size === cleanedSymbols.length) {
    const items = cleanedSymbols.map((symbol) => tickerTapeItemFromMover(symbol, cachedMoveMap.get(symbol)!));
    tickerTapeCache.set(cacheKey, { data: items, fetchedAt: now });
    void setJsonCache(redisKey, items, REDIS_TICKER_TAPE_TTL_SECONDS);
    return items;
  }

  const results = await Promise.all(
    cleanedSymbols.map(async (symbol) => {
      const cachedMover = cachedMoveMap.get(symbol);
      if (cachedMover) return tickerTapeItemFromMover(symbol, cachedMover);

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
  void setJsonCache(redisKey, valid, REDIS_TICKER_TAPE_TTL_SECONDS);

  void upsertMarketSnapshots(
    valid.map((item) => ({
      ticker: item.yahooSymbol,
      currentPrice: item.price,
      changePct: item.changePct,
    })),
  );

  return valid;
}
