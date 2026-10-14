import { getStockChart } from "@/lib/yahoo";
import type { SupabaseClient } from "@supabase/supabase-js";

export type FundamentalSnapshot = {
  ticker: string;
  collected_at: string;
  source: string;
  values: Record<string, unknown>;
  metadata?: {
    fields?: Record<string, { status?: string; source?: string; period?: unknown; periods?: unknown; basis?: string; reason?: string }>;
    metric_extra?: Record<string, unknown>;
  } | null;
};

export type FinancialMetrics = {
  ticker: string;
  marketCap: number | null;
  trailingPE: number | null;
  forwardPE: number | null;
  priceToBook: number | null;
  epsTrailingTwelveMonths: number | null;
  epsForward: number | null;
  dividendYieldPct: number | null;
  fiftyTwoWeekLow: number | null;
  fiftyTwoWeekHigh: number | null;
  regularMarketPrice: number | null;
  targetMeanPrice: number | null;
  rsi14: number | null;
  macdSignal: "bullish_cross" | "bearish_cross" | "bullish" | "bearish" | "neutral" | null;
  ma50: number | null;
  ma200: number | null;
  sixMonthChangePct: number | null;
  metricsSource: "quote" | "quote+chart" | "snapshot+chart" | "chart";
  fundamentals: Record<string, number | null>;
  fundamentalsStatus: "available" | "partial" | "unavailable";
  fundamentalsSource: string | null;
  fundamentalsAsOf: string | null;
  fundamentalMetadata: FundamentalSnapshot["metadata"];
  quoteStatus: "available" | "unauthorized" | "rate_limited" | "unavailable" | "not_requested";
};

type YahooQuoteResult = {
  symbol?: string;
  marketCap?: number | null;
  trailingPE?: number | null;
  forwardPE?: number | null;
  priceToBook?: number | null;
  epsTrailingTwelveMonths?: number | null;
  epsForward?: number | null;
  dividendYield?: number | null;
  trailingAnnualDividendYield?: number | null;
  fiftyTwoWeekLow?: number | null;
  fiftyTwoWeekHigh?: number | null;
  regularMarketPrice?: number | null;
  targetMeanPrice?: number | null;
};

type YahooQuoteResponse = {
  quoteResponse?: {
    result?: YahooQuoteResult[];
  };
};

const YAHOO_QUOTE_URL = "https://query1.finance.yahoo.com/v7/finance/quote";
const CHUNK_SIZE = 60;
const FINANCIAL_FETCH_TIMEOUT_MS = 4500;
// Collected_at records retrieval, not the financial statement's reporting date.
// Do not quietly present an abandoned snapshot as current financial data.
const SNAPSHOT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const FUNDAMENTAL_KEYS = [
  "MarketCap", "EPS", "PE", "PS", "PB", "EVToEBITDA", "ROE", "ROIC",
  "GrossMargin", "OperatingMargin", "NetMargin", "RevenueGrowth", "EPSGrowth",
  "FCFMargin", "FCFGrowth", "FCFYield", "DebtToEquity", "DividendYield", "Beta",
] as const;

function cleanTicker(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9.-]/g, "");
}

function finiteNumber(value: unknown, options: { allowZero?: boolean } = {}) {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  if (!options.allowZero && parsed === 0) return null;
  return parsed;
}

function dividendYieldPct(row: YahooQuoteResult) {
  // Yahoo dividendYield is already in percentage points; the annual yield
  // field is a fraction. A magnitude guess corrupts yields below 1%.
  const percent = finiteNumber(row.dividendYield, { allowZero: true });
  if (percent != null && percent >= 0) return percent;
  const fraction = finiteNumber(row.trailingAnnualDividendYield, { allowZero: true });
  return fraction != null && fraction >= 0 ? fraction * 100 : null;
}

function snapshotValues(snapshot: FundamentalSnapshot | undefined) {
  if (!snapshot) return null;
  const collectedAt = Date.parse(snapshot.collected_at);
  const age = Date.now() - collectedAt;
  if (!Number.isFinite(collectedAt) || age > SNAPSHOT_MAX_AGE_MS || age < -5 * 60 * 1000) return null;
  const values: Record<string, number | null> = {};
  for (const key of [...FUNDAMENTAL_KEYS, "ForwardPE", "ForwardEPS", "TargetMeanPrice"]) {
    const status = snapshot.metadata?.fields?.[key]?.status;
    const blocked = status && /missing|unavailable|not_applicable|not_collected|invalid|imputed|error|stale/.test(status.toLowerCase());
    const value = blocked ? null : finiteNumber(snapshot.values?.[key] ?? snapshot.metadata?.metric_extra?.[key], { allowZero: true });
    const requiresPositive = ["MarketCap", "PE", "PS", "PB", "EVToEBITDA", "ForwardPE", "TargetMeanPrice"].includes(key);
    const requiresNonnegative = ["DividendYield", "DebtToEquity"].includes(key);
    values[key] = value != null && (!requiresPositive || value > 0) && (!requiresNonnegative || value >= 0) ? value : null;
  }
  return FUNDAMENTAL_KEYS.some((key) => values[key] != null) ? values : null;
}

export async function getFundamentalSnapshots(tickers: string[], supabase: SupabaseClient): Promise<FundamentalSnapshot[]> {
  const variants = Array.from(new Set(tickers.flatMap((ticker) => {
    const cleaned = cleanTicker(ticker);
    return [cleaned, cleaned.replace(/\./g, "-"), cleaned.replace(/-/g, ".")];
  }).filter(Boolean)));
  if (!variants.length) return [];
  try {
    const { data, error } = await supabase.from("stock_fundamental_snapshots")
      .select("ticker,collected_at,source,values,metadata")
      .in("ticker", variants);
    if (error) {
      console.warn("[yahoo-financials] stored fundamentals unavailable", { code: error.code });
      return [];
    }
    return Array.isArray(data) ? data as FundamentalSnapshot[] : [];
  } catch {
    console.warn("[yahoo-financials] stored fundamentals read failed");
    return [];
  }
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function ema(values: number[], period: number) {
  if (values.length < period) return [];
  const k = 2 / (period + 1);
  const output: number[] = [];
  let prev = average(values.slice(0, period)) ?? values[0];
  output.push(prev);
  for (let i = period; i < values.length; i += 1) {
    prev = values[i] * k + prev * (1 - k);
    output.push(prev);
  }
  return output;
}

function rsi(values: number[], period = 14) {
  if (values.length <= period) return null;
  let gain = 0;
  let loss = 0;

  for (let i = 1; i <= period; i += 1) {
    const change = values[i] - values[i - 1];
    if (change >= 0) gain += change;
    else loss += Math.abs(change);
  }

  let avgGain = gain / period;
  let avgLoss = loss / period;

  for (let i = period + 1; i < values.length; i += 1) {
    const change = values[i] - values[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(change, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-change, 0)) / period;
  }

  if (avgLoss === 0) return avgGain === 0 ? 50 : 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function macdSignal(values: number[]): FinancialMetrics["macdSignal"] {
  if (values.length < 35) return null;
  const ema12 = ema(values, 12);
  const ema26 = ema(values, 26);
  const offset = ema12.length - ema26.length;
  const macdLine = ema26.map((value, index) => ema12[index + offset] - value);
  const signalLine = ema(macdLine, 9);
  if (signalLine.length < 2) return null;
  const currentMacd = macdLine[macdLine.length - 1];
  const previousMacd = macdLine[macdLine.length - 2];
  const currentSignal = signalLine[signalLine.length - 1];
  const previousSignal = signalLine[signalLine.length - 2];
  if (previousMacd <= previousSignal && currentMacd > currentSignal) return "bullish_cross";
  if (previousMacd >= previousSignal && currentMacd < currentSignal) return "bearish_cross";
  if (currentMacd > currentSignal && currentMacd > 0) return "bullish";
  if (currentMacd < currentSignal && currentMacd < 0) return "bearish";
  return "neutral";
}

function validRange(low: number | null, high: number | null) {
  return low != null && high != null && low > 0 && high >= low;
}

async function getChartFallback(ticker: string) {
  try {
    const chart = await getStockChart(ticker, ["6M", "1Y"]);
    const points = chart["1Y"]?.length ? chart["1Y"]! : chart["6M"] ?? [];
    const closes = points.map((point) => Number(point.close)).filter((value) => Number.isFinite(value) && value > 0);
    if (closes.length < 2) {
      return {
        regularMarketPrice: null,
        fiftyTwoWeekLow: null,
        fiftyTwoWeekHigh: null,
        rsi14: null,
        macdSignal: null,
        ma50: null,
        ma200: null,
        sixMonthChangePct: null,
      };
    }

    const last = closes[closes.length - 1];
    const recentRangeCloses = closes.slice(-126);
    const sixMonthAnchor = recentRangeCloses[0] ?? closes[0];
    return {
      regularMarketPrice: last,
      // Daily closing prices cannot establish the true yearly high or low.
      fiftyTwoWeekLow: null,
      fiftyTwoWeekHigh: null,
      rsi14: rsi(closes),
      macdSignal: macdSignal(closes),
      ma50: closes.length >= 50 ? average(closes.slice(-50)) : null,
      ma200: closes.length >= 200 ? average(closes.slice(-200)) : null,
      sixMonthChangePct: sixMonthAnchor > 0 ? ((last - sixMonthAnchor) / sixMonthAnchor) * 100 : null,
    };
  } catch (error) {
    console.warn("[yahoo-financials] chart fallback failed", error);
    return {
      regularMarketPrice: null,
      fiftyTwoWeekLow: null,
      fiftyTwoWeekHigh: null,
      rsi14: null,
      macdSignal: null,
      ma50: null,
      ma200: null,
      sixMonthChangePct: null,
    };
  }
}

async function toMetrics(
  ticker: string,
  row: YahooQuoteResult | undefined,
  snapshot: FundamentalSnapshot | undefined,
  quoteStatus: FinancialMetrics["quoteStatus"],
  chartPromise: ReturnType<typeof getChartFallback>,
): Promise<FinancialMetrics> {
  const chartFallback = await chartPromise;
  const stored = snapshotValues(snapshot);
  const quotePrice = finiteNumber(row?.regularMarketPrice);
  const quoteLow = finiteNumber(row?.fiftyTwoWeekLow);
  const quoteHigh = finiteNumber(row?.fiftyTwoWeekHigh);
  const useQuoteRange = validRange(quoteLow, quoteHigh);
  const yieldPct = row ? dividendYieldPct(row) : null;
  const fundamentals: Record<string, number | null> = stored ?? Object.fromEntries(FUNDAMENTAL_KEYS.map((key) => [key, null]));
  if (!stored && row) {
    Object.assign(fundamentals, {
      MarketCap: finiteNumber(row.marketCap),
      PE: finiteNumber(row.trailingPE),
      PB: finiteNumber(row.priceToBook),
      EPS: finiteNumber(row.epsTrailingTwelveMonths, { allowZero: true }),
      DividendYield: yieldPct != null ? yieldPct / 100 : null,
      ForwardPE: finiteNumber(row.forwardPE),
      ForwardEPS: finiteNumber(row.epsForward, { allowZero: true }),
      TargetMeanPrice: finiteNumber(row.targetMeanPrice),
    });
  }
  const present = FUNDAMENTAL_KEYS.filter((key) => fundamentals[key] != null).length;

  return {
    ticker,
    marketCap: fundamentals.MarketCap ?? null,
    trailingPE: fundamentals.PE ?? null,
    forwardPE: fundamentals.ForwardPE ?? null,
    priceToBook: fundamentals.PB ?? null,
    epsTrailingTwelveMonths: fundamentals.EPS ?? null,
    epsForward: fundamentals.ForwardEPS ?? null,
    dividendYieldPct: fundamentals.DividendYield != null ? fundamentals.DividendYield * 100 : null,
    fiftyTwoWeekLow: useQuoteRange ? quoteLow : chartFallback.fiftyTwoWeekLow,
    fiftyTwoWeekHigh: useQuoteRange ? quoteHigh : chartFallback.fiftyTwoWeekHigh,
    regularMarketPrice: quotePrice ?? chartFallback.regularMarketPrice,
    targetMeanPrice: fundamentals.TargetMeanPrice ?? null,
    rsi14: chartFallback.rsi14,
    macdSignal: chartFallback.macdSignal,
    ma50: chartFallback.ma50,
    ma200: chartFallback.ma200,
    sixMonthChangePct: chartFallback.sixMonthChangePct,
    metricsSource: stored ? "snapshot+chart" : present ? "quote+chart" : "chart",
    fundamentals,
    fundamentalsStatus: present === FUNDAMENTAL_KEYS.length ? "available" : present > 0 ? "partial" : "unavailable",
    fundamentalsSource: stored ? snapshot?.source ?? null : present ? "Yahoo Finance quote" : null,
    fundamentalsAsOf: stored ? snapshot?.collected_at ?? null : present ? new Date().toISOString() : null,
    fundamentalMetadata: stored ? snapshot?.metadata ?? null : null,
    quoteStatus,
  };
}

async function fetchQuoteChunk(tickers: string[]) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FINANCIAL_FETCH_TIMEOUT_MS);

  try {
    const url = `${YAHOO_QUOTE_URL}?symbols=${encodeURIComponent(tickers.map((ticker) => ticker.replace(/\./g, "-")).join(","))}`;
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 StockGPT/1.0",
      },
      // In particular, an authorization failure must not be cached as data.
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      const status: FinancialMetrics["quoteStatus"] = response.status === 401 || response.status === 403
        ? "unauthorized" : response.status === 429 ? "rate_limited" : "unavailable";
      console.warn("[yahoo-financials] quote request rejected", { status: response.status });
      return { rows: [] as YahooQuoteResult[], status };
    }
    const json = (await response.json()) as YahooQuoteResponse;
    const rows = json.quoteResponse?.result;
    return { rows: Array.isArray(rows) ? rows : [], status: Array.isArray(rows) && rows.length ? "available" as const : "unavailable" as const };
  } catch (error) {
    console.warn("[yahoo-financials] quote fetch failed", error);
    return { rows: [] as YahooQuoteResult[], status: "unavailable" as const };
  } finally {
    clearTimeout(timeout);
  }
}

export async function getFinancialMetricMap(tickers: string[], snapshots: FundamentalSnapshot[] = []) {
  const cleanTickers = Array.from(new Set(tickers.map(cleanTicker).filter(Boolean)));
  const map = new Map<string, FinancialMetrics>();
  const snapshotMap = new Map<string, FundamentalSnapshot>();
  for (const snapshot of snapshots) {
    if (!Number.isFinite(Date.parse(snapshot.collected_at))) continue;
    const key = cleanTicker(snapshot.ticker).replace(/\./g, "-");
    const previous = snapshotMap.get(key);
    if (!previous || Date.parse(snapshot.collected_at) > Date.parse(previous.collected_at)) snapshotMap.set(key, snapshot);
  }

  for (let i = 0; i < cleanTickers.length; i += CHUNK_SIZE) {
    const chunk = cleanTickers.slice(i, i + CHUNK_SIZE);
    const charts = new Map(chunk.map((ticker) => [ticker, getChartFallback(ticker)]));
    const needsQuote = chunk.filter((ticker) => !snapshotValues(snapshotMap.get(ticker.replace(/\./g, "-"))));
    const quote = needsQuote.length ? await fetchQuoteChunk(needsQuote) : { rows: [] as YahooQuoteResult[], status: "not_requested" as const };
    const quoteMap = new Map(quote.rows.map((row) => [cleanTicker(row.symbol).replace(/\./g, "-"), row]));
    await Promise.all(chunk.map(async (ticker) => {
      const key = ticker.replace(/\./g, "-");
      const snapshot = snapshotMap.get(key);
      const row = quoteMap.get(key);
      const status = snapshotValues(snapshot) ? "not_requested" : quote.status === "available" && !row ? "unavailable" : quote.status;
      const metrics = await toMetrics(ticker, row, snapshot, status, charts.get(ticker)!);
      map.set(ticker, metrics);
    }));
  }

  return map;
}
