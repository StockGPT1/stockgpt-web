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

function toMetrics(row: YahooQuoteResult): FinancialMetrics | null {
  const ticker = cleanTicker(row.symbol);
  if (!ticker) return null;

  return {
    ticker,
    marketCap: finiteNumber(row.marketCap),
    trailingPE: finiteNumber(row.trailingPE),
    forwardPE: finiteNumber(row.forwardPE),
    priceToBook: finiteNumber(row.priceToBook),
    epsTrailingTwelveMonths: finiteNumber(row.epsTrailingTwelveMonths),
    epsForward: finiteNumber(row.epsForward),
    dividendYieldPct: normalizeDividendYield(row.dividendYield ?? row.trailingAnnualDividendYield),
    fiftyTwoWeekLow: finiteNumber(row.fiftyTwoWeekLow),
    fiftyTwoWeekHigh: finiteNumber(row.fiftyTwoWeekHigh),
    regularMarketPrice: finiteNumber(row.regularMarketPrice),
    targetMeanPrice: finiteNumber(row.targetMeanPrice),
  };
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
    rows.forEach((row) => {
      const metrics = toMetrics(row);
      if (metrics) map.set(metrics.ticker, metrics);
    });
  }

  return map;
}
