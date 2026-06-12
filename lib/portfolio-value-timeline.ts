import type { ChartPoint, TimeRange } from "@/components/StockChart";
import { getCachedStockChart } from "@/lib/yahoo";

export type PortfolioTimelineChartData = Partial<Record<TimeRange, ChartPoint[]>>;

export type PortfolioTimelinePortfolio = {
  id?: string | null;
  cash_balance?: unknown;
  created_at?: string | null;
  createdAt?: string | null;
};

export type PortfolioTimelineHolding = {
  ticker?: string | null;
  shares?: unknown;
  entry_price?: unknown;
  entryPrice?: unknown;
  currentPrice?: unknown;
  currentValue?: unknown;
  purchase_date?: string | null;
  purchaseDate?: string | null;
  added_at?: string | null;
  addedAt?: string | null;
};

export type PortfolioTimelineTransaction = {
  ticker?: string | null;
  type?: string | null;
  shares?: unknown;
  price?: unknown;
  amount?: unknown;
  realised_pnl?: unknown;
  realisedPnl?: unknown;
  created_at?: string | null;
  createdAt?: string | null;
};

export type PortfolioPriceFetcher = (
  ticker: string,
  ranges: TimeRange[],
) => Promise<PortfolioTimelineChartData>;

const OUTPUT_RANGES: TimeRange[] = ["1D", "1M", "6M", "1Y", "MAX"];
const FETCH_RANGES: TimeRange[] = ["1D", "5D", "1M", "6M", "1Y", "MAX"];
const RANGE_DAYS: Partial<Record<TimeRange, number>> = {
  "1D": 1,
  "1M": 30,
  "6M": 182,
  "1Y": 365,
};
const FALLBACK_RANGES: Record<TimeRange, TimeRange[]> = {
  "1D": ["1D", "5D", "1M", "6M", "1Y", "MAX"],
  "5D": ["5D", "1M", "6M", "1Y", "MAX"],
  "1M": ["1M", "6M", "1Y", "MAX"],
  "6M": ["6M", "1Y", "MAX"],
  "1Y": ["1Y", "MAX"],
  "5Y": ["5Y", "MAX"],
  MAX: ["MAX", "1Y", "6M"],
};
const EPSILON = 0.000001;
const MAX_POINTS = 260;

type Lot = {
  ticker: string;
  shares: number;
  entryPrice: number;
  startMs: number;
};

type CashEvent = {
  ms: number;
  amount: number;
};

type NormalisedHolding = {
  ticker: string;
  shares: number;
  entryPrice: number;
  currentPrice: number;
  startMs: number;
};

function toNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function roundShares(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function cleanTicker(ticker?: string | null) {
  return String(ticker ?? "").trim().toUpperCase();
}

function safeDateMs(value: string | null | undefined) {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function isDateOnly(value: string | null | undefined) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
}

function pointMs(point: ChartPoint) {
  const ms = new Date(point.date).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function normaliseTransactionType(type: string | null | undefined) {
  return String(type ?? "").trim().toLowerCase();
}

function holdingDate(holding: PortfolioTimelineHolding, fallbackMs: number) {
  const addedMs = safeDateMs(holding.added_at ?? holding.addedAt ?? null);
  const purchaseRaw = holding.purchase_date ?? holding.purchaseDate ?? null;
  const purchaseMs = safeDateMs(purchaseRaw);

  if (purchaseMs != null && !isDateOnly(purchaseRaw)) return Math.max(fallbackMs, purchaseMs);
  return Math.max(fallbackMs, addedMs ?? purchaseMs ?? fallbackMs);
}

function normaliseHoldings(
  holdings: PortfolioTimelineHolding[],
  portfolioStartMs: number,
) {
  return holdings
    .map((holding): NormalisedHolding | null => {
      const ticker = cleanTicker(holding.ticker);
      const shares = roundShares(toNumber(holding.shares, 0));
      if (!ticker || shares <= EPSILON) return null;

      const currentValue = toNumber(holding.currentValue, 0);
      const currentPriceFromValue = currentValue > 0 ? currentValue / shares : 0;
      const currentPrice = toNumber(
        holding.currentPrice,
        currentPriceFromValue > 0 ? currentPriceFromValue : 0,
      );
      const entryPrice = toNumber(
        holding.entry_price ?? holding.entryPrice,
        currentPrice > 0 ? currentPrice : currentPriceFromValue,
      );

      return {
        ticker,
        shares,
        entryPrice: Math.max(0, entryPrice),
        currentPrice: Math.max(0, currentPrice || currentPriceFromValue || entryPrice),
        startMs: holdingDate(holding, portfolioStartMs),
      };
    })
    .filter((holding): holding is NormalisedHolding => holding !== null);
}

function reduceLots(lots: Lot[], ticker: string, sharesToReduce: number) {
  let remaining = Math.max(0, sharesToReduce);
  for (const lot of lots) {
    if (lot.ticker !== ticker || remaining <= EPSILON) continue;
    const reduction = Math.min(lot.shares, remaining);
    lot.shares = roundShares(lot.shares - reduction);
    remaining = roundShares(remaining - reduction);
  }
}

function setTickerExposure(lots: Lot[], ticker: string, shares: number, price: number, startMs: number) {
  lots.forEach((lot) => {
    if (lot.ticker === ticker) lot.shares = 0;
  });

  if (shares > EPSILON) {
    lots.push({
      ticker,
      shares: roundShares(shares),
      entryPrice: Math.max(0, price),
      startMs,
    });
  }
}

function finalSharesByTicker(lots: Lot[]) {
  const shares = new Map<string, number>();
  lots.forEach((lot) => {
    if (lot.shares <= EPSILON) return;
    shares.set(lot.ticker, roundShares((shares.get(lot.ticker) ?? 0) + lot.shares));
  });
  return shares;
}

function buildLedger({
  transactions,
  holdings,
  currentCash,
  portfolioStartMs,
  nowMs,
}: {
  transactions: PortfolioTimelineTransaction[];
  holdings: NormalisedHolding[];
  currentCash: number;
  portfolioStartMs: number;
  nowMs: number;
}) {
  const lots: Lot[] = [];
  const cashEvents: CashEvent[] = [];

  [...transactions]
    .sort(
      (a, b) =>
        (safeDateMs(a.created_at ?? a.createdAt ?? null) ?? portfolioStartMs) -
        (safeDateMs(b.created_at ?? b.createdAt ?? null) ?? portfolioStartMs),
    )
    .forEach((transaction) => {
      const type = normaliseTransactionType(transaction.type);
      const ms = Math.min(
        nowMs,
        Math.max(portfolioStartMs, safeDateMs(transaction.created_at ?? transaction.createdAt ?? null) ?? portfolioStartMs),
      );
      const ticker = cleanTicker(transaction.ticker);
      const amount = toNumber(transaction.amount, 0);
      const absoluteAmount = Math.abs(amount);
      const shares = Math.abs(toNumber(transaction.shares, 0));
      const price = Math.abs(toNumber(transaction.price, 0));
      const impliedShares = shares > 0 ? shares : absoluteAmount > 0 && price > 0 ? absoluteAmount / price : 0;

      if (type === "deposit") {
        if (absoluteAmount > 0) cashEvents.push({ ms, amount: absoluteAmount });
        return;
      }

      if (type === "withdrawal") {
        if (absoluteAmount > 0) cashEvents.push({ ms, amount: -absoluteAmount });
        return;
      }

      if (type === "cash_adjustment") {
        if (Math.abs(amount) > 0.009) cashEvents.push({ ms, amount });
        return;
      }

      if (!ticker) return;

      if (type === "buy" && impliedShares > EPSILON) {
        lots.push({
          ticker,
          shares: roundShares(impliedShares),
          entryPrice: price > 0 ? price : absoluteAmount / impliedShares,
          startMs: ms,
        });
        cashEvents.push({ ms, amount: -(absoluteAmount || impliedShares * price) });
        return;
      }

      if (type === "sell" && impliedShares > EPSILON) {
        reduceLots(lots, ticker, impliedShares);
        cashEvents.push({ ms, amount: absoluteAmount || impliedShares * price });
        return;
      }

      if ((type === "log_existing" || type === "import_holding") && impliedShares > EPSILON) {
        lots.push({
          ticker,
          shares: roundShares(impliedShares),
          entryPrice: price > 0 ? price : absoluteAmount / impliedShares,
          startMs: ms,
        });
        return;
      }

      if (type === "adjustment") {
        if (shares > EPSILON) {
          setTickerExposure(
            lots,
            ticker,
            shares,
            price > 0 ? price : shares > 0 ? absoluteAmount / shares : 0,
            ms,
          );
        } else if (absoluteAmount <= 0.009) {
          setTickerExposure(lots, ticker, 0, 0, ms);
        }
      }
    });

  const currentHoldingsByTicker = new Map(holdings.map((holding) => [holding.ticker, holding]));
  let finalShares = finalSharesByTicker(lots);

  holdings.forEach((holding) => {
    const replayedShares = finalShares.get(holding.ticker) ?? 0;
    const difference = roundShares(holding.shares - replayedShares);

    if (difference > EPSILON) {
      lots.push({
        ticker: holding.ticker,
        shares: difference,
        entryPrice: holding.entryPrice || holding.currentPrice,
        startMs: holding.startMs,
      });
    } else if (difference < -EPSILON) {
      reduceLots(lots, holding.ticker, Math.abs(difference));
    }
  });

  finalShares = finalSharesByTicker(lots);
  finalShares.forEach((shares, ticker) => {
    if (currentHoldingsByTicker.has(ticker) || shares <= EPSILON) return;
    reduceLots(lots, ticker, shares);
  });

  const finalCash = cashEvents.reduce((sum, event) => sum + event.amount, 0);
  const cashAdjustment = roundMoney(currentCash - finalCash);
  if (Math.abs(cashAdjustment) > 0.009) {
    cashEvents.push({ ms: portfolioStartMs, amount: cashAdjustment });
  }

  return {
    lots: lots.filter((lot) => lot.shares > EPSILON),
    cashEvents: cashEvents.filter((event) => Math.abs(event.amount) > 0.009 && event.ms <= nowMs),
  };
}

function sortPoints(points: ChartPoint[]) {
  return [...points]
    .filter((point) => Number.isFinite(point.close) && point.close > 0 && pointMs(point) != null)
    .sort((a, b) => (pointMs(a) ?? 0) - (pointMs(b) ?? 0));
}

function samplePoints(points: ChartPoint[]) {
  if (points.length <= MAX_POINTS) return points;
  const step = Math.ceil(points.length / MAX_POINTS);
  const sampled = points.filter((_, index) => index % step === 0);
  const last = points.at(-1);
  if (last && sampled.at(-1)?.date !== last.date) sampled.push(last);
  return sampled;
}

async function loadCharts({
  tickers,
  priceFetcher,
}: {
  tickers: string[];
  priceFetcher: PortfolioPriceFetcher;
}) {
  const charts = new Map<string, ChartPoint[]>();
  const results = await Promise.allSettled(
    tickers.map(async (ticker) => ({
      ticker,
      chart: await priceFetcher(ticker, FETCH_RANGES),
    })),
  );

  results.forEach((result) => {
    if (result.status !== "fulfilled") return;
    FETCH_RANGES.forEach((range) => {
      const points = sortPoints(result.value.chart[range] ?? []);
      if (points.length > 0) charts.set(`${result.value.ticker}:${range}`, points);
    });
  });

  return charts;
}

function priceAtTime({
  ticker,
  targetMs,
  range,
  lot,
  charts,
  currentPrices,
  nowMs,
}: {
  ticker: string;
  targetMs: number;
  range: TimeRange;
  lot: Lot;
  charts: Map<string, ChartPoint[]>;
  currentPrices: Map<string, number>;
  nowMs: number;
}) {
  const currentPrice = currentPrices.get(ticker) ?? 0;
  if (targetMs >= nowMs - 60_000 && currentPrice > 0) return currentPrice;

  let candidate = lot.entryPrice > 0 ? lot.entryPrice : currentPrice;

  for (const lookupRange of FALLBACK_RANGES[range]) {
    let foundRangePrice = false;
    const points = charts.get(`${ticker}:${lookupRange}`) ?? [];
    for (const point of points) {
      const ms = pointMs(point);
      if (ms == null || ms < lot.startMs) continue;
      if (ms > targetMs) break;
      candidate = point.close;
      foundRangePrice = true;
    }
    if (foundRangePrice) break;
  }

  return candidate > 0 ? candidate : currentPrice;
}

function cashAtTime(cashEvents: CashEvent[], ms: number) {
  return cashEvents.reduce((sum, event) => (event.ms <= ms ? sum + event.amount : sum), 0);
}

function rangeStartFor(range: TimeRange, portfolioStartMs: number, nowMs: number) {
  const days = RANGE_DAYS[range];
  if (!days) return portfolioStartMs;
  return Math.max(portfolioStartMs, nowMs - days * 86_400_000);
}

function collectTimes({
  range,
  rangeStartMs,
  nowMs,
  lots,
  cashEvents,
  charts,
}: {
  range: TimeRange;
  rangeStartMs: number;
  nowMs: number;
  lots: Lot[];
  cashEvents: CashEvent[];
  charts: Map<string, ChartPoint[]>;
}) {
  const times = new Set<number>([rangeStartMs, nowMs]);

  lots.forEach((lot) => {
    if (lot.startMs >= rangeStartMs && lot.startMs <= nowMs) times.add(lot.startMs);

    FALLBACK_RANGES[range].forEach((lookupRange) => {
      const points = charts.get(`${lot.ticker}:${lookupRange}`) ?? [];
      points.forEach((point) => {
        const ms = pointMs(point);
        if (ms != null && ms >= Math.max(rangeStartMs, lot.startMs) && ms <= nowMs) {
          times.add(ms);
        }
      });
    });
  });

  cashEvents.forEach((event) => {
    if (event.ms >= rangeStartMs && event.ms <= nowMs) times.add(event.ms);
  });

  if (times.size < 2 && nowMs > rangeStartMs) times.add(nowMs);
  if (times.size < 2) times.add(Math.max(0, nowMs - 60_000));

  return Array.from(times).sort((a, b) => a - b);
}

function buildRangeSeries({
  range,
  portfolioStartMs,
  nowMs,
  lots,
  cashEvents,
  charts,
  currentPrices,
}: {
  range: TimeRange;
  portfolioStartMs: number;
  nowMs: number;
  lots: Lot[];
  cashEvents: CashEvent[];
  charts: Map<string, ChartPoint[]>;
  currentPrices: Map<string, number>;
}) {
  const rangeStartMs = rangeStartFor(range, portfolioStartMs, nowMs);
  const times = collectTimes({ range, rangeStartMs, nowMs, lots, cashEvents, charts });

  const points = times.map((ms) => {
    const holdingsValue = lots.reduce((sum, lot) => {
      if (ms < lot.startMs || lot.shares <= EPSILON) return sum;
      const price = priceAtTime({
        ticker: lot.ticker,
        targetMs: ms,
        range,
        lot,
        charts,
        currentPrices,
        nowMs,
      });
      return sum + lot.shares * price;
    }, 0);

    return {
      date: new Date(ms).toISOString(),
      close: Math.max(0, roundMoney(cashAtTime(cashEvents, ms) + holdingsValue)),
    };
  });

  const deduped = Array.from(
    points
      .reduce((map, point) => map.set(point.date, point), new Map<string, ChartPoint>())
      .values(),
  ).sort((a, b) => (pointMs(a) ?? 0) - (pointMs(b) ?? 0));

  return samplePoints(deduped).filter((point) => Number.isFinite(point.close));
}

export async function buildPortfolioValueTimeline({
  portfolio,
  holdings,
  transactions,
  currentPrices = {},
  priceFetcher = getCachedStockChart,
  maxTickers = 50,
}: {
  portfolio: PortfolioTimelinePortfolio;
  holdings: PortfolioTimelineHolding[];
  transactions: PortfolioTimelineTransaction[];
  currentPrices?: Record<string, unknown> | Map<string, unknown>;
  priceFetcher?: PortfolioPriceFetcher;
  maxTickers?: number;
}): Promise<PortfolioTimelineChartData> {
  const nowMs = Date.now();
  const explicitStart = safeDateMs(portfolio.created_at ?? portfolio.createdAt ?? null);
  const portfolioStartMs = Math.min(nowMs, explicitStart ?? nowMs);
  const currentCash = toNumber(portfolio.cash_balance, 0);
  const normalisedHoldings = normaliseHoldings(holdings, portfolioStartMs);
  const currentPriceMap = new Map<string, number>();

  if (currentPrices instanceof Map) {
    currentPrices.forEach((value, ticker) => {
      const clean = cleanTicker(ticker);
      const price = toNumber(value, 0);
      if (clean && price > 0) currentPriceMap.set(clean, price);
    });
  } else {
    Object.entries(currentPrices).forEach(([ticker, value]) => {
      const clean = cleanTicker(ticker);
      const price = toNumber(value, 0);
      if (clean && price > 0) currentPriceMap.set(clean, price);
    });
  }

  normalisedHoldings.forEach((holding) => {
    if (holding.currentPrice > 0) currentPriceMap.set(holding.ticker, holding.currentPrice);
  });

  const { lots, cashEvents } = buildLedger({
    transactions,
    holdings: normalisedHoldings,
    currentCash,
    portfolioStartMs,
    nowMs,
  });

  if (lots.length === 0 && cashEvents.length === 0) return {};

  const tickers = Array.from(new Set(lots.map((lot) => lot.ticker))).slice(0, maxTickers);
  const charts = tickers.length > 0 ? await loadCharts({ tickers, priceFetcher }) : new Map<string, ChartPoint[]>();

  return OUTPUT_RANGES.reduce<PortfolioTimelineChartData>((acc, range) => {
    const points = buildRangeSeries({
      range,
      portfolioStartMs,
      nowMs,
      lots,
      cashEvents,
      charts,
      currentPrices: currentPriceMap,
    });

    if (points.length > 1) acc[range] = points;
    return acc;
  }, {});
}
