import { getStockChart } from "@/lib/yahoo";

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
  ma50: number | null;
  ma200: number | null;
  sixMonthChangePct: number | null;
  metricsSource: "quote" | "quote+chart" | "chart";
};

type YahooQuoteResult = {
  symbol?: string;
  marketCap?: number;
  trailingPE?: number;
  forwardPE?: number;
  priceToBook?: number;
  epsTrailingTwelveMonths?: number;
  epsForward?: number;
  dividendYield?: number;
  trailingAnnualDividendYield?: number;
  fiftyTwoWeekLow?: number;
  fiftyTwoWeekHigh?: number;
  regularMarketPrice?: number;
  targetMeanPrice?: number;
};

type YahooQuoteResponse = {
  quoteResponse?: {
    result?: YahooQuoteResult[];
  };
};

const YAHOO_QUOTE_URL = "https://query1.finance.yahoo.com/v7/finance/quote";
const CHUNK_SIZE = 60;
const FINANCIAL_FETCH_TIMEOUT_MS = 4500;

function cleanTicker(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9.-]/g, "");
}

function finiteNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeDividendYield(value: unknown) {
  const n = finiteNumber(value);
  if (n == null || n <= 0) return null;
  return n <= 1 ? n * 100 : n;
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
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

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
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
        ma50: null,
        ma200: null,
        sixMonthChangePct: null,
      };
    }

    const last = closes[closes.length - 1];
    const sixMonthAnchor = closes[Math.max(0, closes.length - 126)] ?? closes[0];
    return {
      regularMarketPrice: last,
      fiftyTwoWeekLow: Math.min(...closes),
      fiftyTwoWeekHigh: Math.max(...closes),
      rsi14: rsi(closes),
      ma50: average(closes.slice(-50)),
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
      ma50: null,
      ma200: null,
      sixMonthChangePct: null,
    };
  }
}

function hasQuoteFundamentals(metrics: FinancialMetrics) {
  return [
    metrics.marketCap,
    metrics.trailingPE,
    metrics.forwardPE,
    metrics.priceToBook,
    metrics.epsTrailingTwelveMonths,
    metrics.epsForward,
    metrics.dividendYieldPct,
    metrics.targetMeanPrice,
  ].some((value) => value != null);
}

async function toMetrics(row: YahooQuoteResult): Promise<FinancialMetrics | null> {
  const ticker = cleanTicker(row.symbol);
  if (!ticker) return null;
  const chartFallback = await getChartFallback(ticker);

  const metrics: FinancialMetrics = {
    ticker,
    marketCap: finiteNumber(row.marketCap),
    trailingPE: finiteNumber(row.trailingPE),
    forwardPE: finiteNumber(row.forwardPE),
    priceToBook: finiteNumber(row.priceToBook),
    epsTrailingTwelveMonths: finiteNumber(row.epsTrailingTwelveMonths),
    epsForward: finiteNumber(row.epsForward),
    dividendYieldPct: normalizeDividendYield(row.dividendYield ?? row.trailingAnnualDividendYield),
    fiftyTwoWeekLow: finiteNumber(row.fiftyTwoWeekLow) ?? chartFallback.fiftyTwoWeekLow,
    fiftyTwoWeekHigh: finiteNumber(row.fiftyTwoWeekHigh) ?? chartFallback.fiftyTwoWeekHigh,
    regularMarketPrice: finiteNumber(row.regularMarketPrice) ?? chartFallback.regularMarketPrice,
    targetMeanPrice: finiteNumber(row.targetMeanPrice),
    rsi14: chartFallback.rsi14,
    ma50: chartFallback.ma50,
    ma200: chartFallback.ma200,
    sixMonthChangePct: chartFallback.sixMonthChangePct,
    metricsSource: "quote",
  };

  metrics.metricsSource = hasQuoteFundamentals(metrics) ? "quote+chart" : "chart";
  return metrics;
}

async function fetchQuoteChunk(tickers: string[]) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FINANCIAL_FETCH_TIMEOUT_MS);

  try {
    const url = `${YAHOO_QUOTE_URL}?symbols=${encodeURIComponent(tickers.join(","))}`;
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 StockGPT/1.0",
      },
      next: { revalidate: 15 * 60 },
      signal: controller.signal,
    });

    if (!response.ok) return [];
    const json = (await response.json()) as YahooQuoteResponse;
    return json.quoteResponse?.result ?? [];
  } catch (error) {
    console.warn("[yahoo-financials] quote fetch failed", error);
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

export async function getFinancialMetricMap(tickers: string[]) {
  const cleanTickers = Array.from(new Set(tickers.map(cleanTicker).filter(Boolean)));
  const map = new Map<string, FinancialMetrics>();

  for (let i = 0; i < cleanTickers.length; i += CHUNK_SIZE) {
    const chunk = cleanTickers.slice(i, i + CHUNK_SIZE);
    const rows = await fetchQuoteChunk(chunk);
    const returnedTickers = new Set<string>();
    for (const row of rows) {
      const metrics = await toMetrics(row);
      if (metrics) {
        returnedTickers.add(metrics.ticker);
        map.set(metrics.ticker, metrics);
      }
    }

    const missingTickers = chunk.filter((ticker) => !returnedTickers.has(ticker));
    for (const ticker of missingTickers) {
      const chartFallback = await getChartFallback(ticker);
      map.set(ticker, {
        ticker,
        marketCap: null,
        trailingPE: null,
        forwardPE: null,
        priceToBook: null,
        epsTrailingTwelveMonths: null,
        epsForward: null,
        dividendYieldPct: null,
        fiftyTwoWeekLow: chartFallback.fiftyTwoWeekLow,
        fiftyTwoWeekHigh: chartFallback.fiftyTwoWeekHigh,
        regularMarketPrice: chartFallback.regularMarketPrice,
        targetMeanPrice: null,
        rsi14: chartFallback.rsi14,
        ma50: chartFallback.ma50,
        ma200: chartFallback.ma200,
        sixMonthChangePct: chartFallback.sixMonthChangePct,
        metricsSource: "chart",
      });
    }
  }

  return map;
}
