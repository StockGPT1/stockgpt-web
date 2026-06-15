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
const ONE_HOUR_MS = 3_600_000;
const ONE_DAY_MS = 86_400_000;
const PORTFOLIO_ONE_DAY_POINTS = 24;
const RANGE_DAYS: Partial<Record<TimeRange, number>> = {
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
  implicitBasis: boolean;
};

type CashEvent = {
  ms: number;
  amount: number;
};

type BasisEvent = {
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

function pointMs(point: ChartPoint) {
  const ms = new Date(point.date).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function normaliseTransactionType(type: string | null | undefined) {
  return String(type ?? "").trim().toLowerCase();
}

function startOfUtcDay(ms: number) {
  const date = new Date(ms);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function buildOneDayHourlyTimes(nowMs: number) {
  const end = Math.floor(nowMs / ONE_HOUR_MS) * ONE_HOUR_MS;
  return Array.from({ length: PORTFOLIO_ONE_DAY_POINTS }, (_, index) =>
    end - (PORTFOLIO_ONE_DAY_POINTS - 1 - index) * ONE_HOUR_MS,
  );
}

function holdingDate(holding: PortfolioTimelineHolding, fallbackMs: number) {
  const addedMs = safeDateMs(holding.added_at ?? holding.addedAt ?? null);
  const purchaseRaw = holding.purchase_date ?? holding.purchaseDate ?? null;
  const purchaseMs = safeDateMs(purchaseRaw);

  if (purchaseMs != null) return Math.max(fallbackMs, purchaseMs);
  return Math.max(fallbackMs, addedMs ?? fallbackMs);
}

function normaliseHoldings(holdings: PortfolioTimelineHolding[], portfolioStartMs: number) {
  return holdings
    .map((holding): NormalisedHolding | null => {
      const ticker = cleanTicker(holding.ticker);
      const shares = roundShares(toNumber(holding.shares, 0));
      if (!ticker || shares <= EPSILON) return null;

      const currentValue = toNumber(holding.currentValue, 0);
      const currentPriceFromValue = currentValue > 0 ? currentValue / shares : 0;
      const currentPrice = toNumber(holding.currentPrice, currentPriceFromValue > 0 ? currentPriceFromValue : 0);
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

function setTickerExposure(lots: Lot[], ticker: string, shares: number, price: number, startMs: number, implicitBasis: boolean) {
  lots.forEach((lot) => {
    if (lot.ticker === ticker) lot.shares = 0;
  });

  if (shares > EPSILON) {
    lots.push({ ticker, shares: roundShares(shares), entryPrice: Math.max(0, price), startMs, implicitBasis });
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

function lotCost(lot: Lot) {
  return Math.max(0, lot.shares) * Math.max(0, lot.entryPrice);
}

function activeImplicitLotCost(lots: Lot[], ticker: string) {
  return lots.reduce((sum, lot) => (lot.ticker === ticker && lot.implicitBasis && lot.shares > EPSILON ? sum + lotCost(lot) : sum), 0);
}

function activeLotShares(lots: Lot[], ticker: string) {
  return lots.reduce((sum, lot) => (lot.ticker === ticker && lot.shares > EPSILON ? sum + lot.shares : sum), 0);
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
  const basisEvents: BasisEvent[] = [];

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
        if (absoluteAmount > 0) basisEvents.push({ ms, amount: absoluteAmount });
        return;
      }

      if (type === "withdrawal") {
        if (absoluteAmount > 0) cashEvents.push({ ms, amount: -absoluteAmount });
        if (absoluteAmount > 0) basisEvents.push({ ms, amount: -absoluteAmount });
        return;
      }

      if (type === "cash_adjustment") {
        if (Math.abs(amount) > 0.009) cashEvents.push({ ms, amount });
        if (Math.abs(amount) > 0.009) basisEvents.push({ ms, amount });
        return;
      }

      if (type === "import") return;

      if (!ticker) return;

      if (type === "buy" && impliedShares > EPSILON) {
        lots.push({
          ticker,
          shares: roundShares(impliedShares),
          entryPrice: price > 0 ? price : absoluteAmount / impliedShares,
          startMs: ms,
          implicitBasis: false,
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
        const entryPrice = price > 0 ? price : absoluteAmount / impliedShares;
        lots.push({
          ticker,
          shares: roundShares(impliedShares),
          entryPrice,
          startMs: ms,
          implicitBasis: true,
        });
        basisEvents.push({ ms, amount: impliedShares * entryPrice });
        return;
      }

      if (type === "adjustment") {
        if (shares > EPSILON) {
          const currentCost = activeImplicitLotCost(lots, ticker);
          const hasExistingExplicitExposure = activeLotShares(lots, ticker) > EPSILON && currentCost <= EPSILON;
          const entryPrice = price > 0 ? price : shares > 0 ? absoluteAmount / shares : 0;
          const nextCost = shares * entryPrice;
          const tracksImplicitBasis = !hasExistingExplicitExposure;
          setTickerExposure(lots, ticker, shares, entryPrice, ms, tracksImplicitBasis);
          if (tracksImplicitBasis && Math.abs(nextCost - currentCost) > 0.009) {
            basisEvents.push({ ms, amount: nextCost - currentCost });
          }
        } else if (absoluteAmount <= 0.009) {
          const currentCost = activeImplicitLotCost(lots, ticker);
          setTickerExposure(lots, ticker, 0, 0, ms, false);
          if (currentCost > 0.009) basisEvents.push({ ms, amount: -currentCost });
        }
      }
    });

  const currentHoldingsByTicker = new Map(holdings.map((holding) => [holding.ticker, holding]));
  let finalShares = finalSharesByTicker(lots);

  holdings.forEach((holding) => {
    const replayedShares = finalShares.get(holding.ticker) ?? 0;
    const difference = roundShares(holding.shares - replayedShares);

    if (difference > EPSILON) {
      const entryPrice = holding.entryPrice || holding.currentPrice;
      lots.push({
        ticker: holding.ticker,
        shares: difference,
        entryPrice,
        startMs: holding.startMs,
        implicitBasis: true,
      });
      basisEvents.push({ ms: holding.startMs, amount: difference * entryPrice });
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
    basisEvents.push({ ms: portfolioStartMs, amount: cashAdjustment });
  }

  return {
    lots: lots.filter((lot) => lot.shares > EPSILON),
    cashEvents: cashEvents.filter((event) => Math.abs(event.amount) > 0.009 && event.ms <= nowMs),
    basisEvents: basisEvents.filter((event) => Math.abs(event.amount) > 0.009 && event.ms <= nowMs),
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

async function loadCharts({ tickers, priceFetcher }: { tickers: string[]; priceFetcher: PortfolioPriceFetcher }) {
  const charts = new Map<string, ChartPoint[]>();
  const results = await Promise.allSettled(
    tickers.map(async (ticker) => ({ ticker, chart: await priceFetcher(ticker, FETCH_RANGES) })),
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

function interpolatePriceAtTime(points: ChartPoint[], targetMs: number, earliestLookupMs: number) {
  let previous: { ms: number; close: number } | null = null;
  let next: { ms: number; close: number } | null = null;

  for (const point of points) {
    const ms = pointMs(point);
    if (ms == null || ms < earliestLookupMs || !Number.isFinite(point.close) || point.close <= 0) continue;

    if (ms <= targetMs) previous = { ms, close: point.close };
    if (ms >= targetMs) {
      next = { ms, close: point.close };
      break;
    }
  }

  if (previous && next && next.ms !== previous.ms) {
    const progress = (targetMs - previous.ms) / (next.ms - previous.ms);
    return previous.close + (next.close - previous.close) * progress;
  }

  if (previous) return previous.close;
  if (next) return next.close;
  return null;
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
  const earliestLookupMs = lot.startMs;

  for (const lookupRange of FALLBACK_RANGES[range]) {
    const points = charts.get(`${ticker}:${lookupRange}`) ?? [];

    if (range === "1D") {
      const interpolated = interpolatePriceAtTime(points, targetMs, 0);
      if (interpolated != null && interpolated > 0) return interpolated;
      continue;
    }

    let foundRangePrice = false;
    for (const point of points) {
      const ms = pointMs(point);
      if (ms == null || ms < earliestLookupMs) continue;
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

function basisAtTime(basisEvents: BasisEvent[], ms: number) {
  return Math.max(0, basisEvents.reduce((sum, event) => (event.ms <= ms ? sum + event.amount : sum), 0));
}

function rangeStartFor(range: TimeRange, portfolioStartMs: number, nowMs: number) {
  if (range === "1D") return Math.max(0, nowMs - (PORTFOLIO_ONE_DAY_POINTS - 1) * ONE_HOUR_MS);
  if (range === "MAX") return portfolioStartMs;
  const days = RANGE_DAYS[range];
  return days ? Math.max(0, nowMs - days * ONE_DAY_MS) : portfolioStartMs;
}

function buildCalendarDayTimes(rangeStartMs: number, nowMs: number) {
  const startDay = startOfUtcDay(rangeStartMs);
  const endDay = startOfUtcDay(nowMs);
  const times: number[] = [];

  for (let ms = startDay; ms <= endDay; ms += ONE_DAY_MS) {
    times.push(ms === endDay ? nowMs : ms);
  }

  if (times.length === 0 || times[times.length - 1] !== nowMs) times.push(nowMs);
  return Array.from(new Set(times)).sort((a, b) => a - b);
}

function collectTimes({
  range,
  rangeStartMs,
  nowMs,
  cashEvents,
}: {
  range: TimeRange;
  rangeStartMs: number;
  nowMs: number;
  lots: Lot[];
  cashEvents: CashEvent[];
  charts: Map<string, ChartPoint[]>;
}) {
  if (range === "1D") return buildOneDayHourlyTimes(nowMs);

  const times = new Set<number>(buildCalendarDayTimes(rangeStartMs, nowMs));
  cashEvents.forEach((event) => {
    if (event.ms >= rangeStartMs && event.ms <= nowMs) times.add(event.ms);
  });

  return Array.from(times).sort((a, b) => a - b);
}

function buildRangeSeries({
  range,
  portfolioStartMs,
  nowMs,
  lots,
  cashEvents,
  basisEvents,
  charts,
  currentPrices,
}: {
  range: TimeRange;
  portfolioStartMs: number;
  nowMs: number;
  lots: Lot[];
  cashEvents: CashEvent[];
  basisEvents: BasisEvent[];
  charts: Map<string, ChartPoint[]>;
  currentPrices: Map<string, number>;
}) {
  const rangeStartMs = rangeStartFor(range, portfolioStartMs, nowMs);
  const times = collectTimes({ range, rangeStartMs, nowMs, lots, cashEvents, charts });
  const currentCash = cashAtTime(cashEvents, nowMs);

  const points = times.map((ms) => {
    if (ms < portfolioStartMs && range !== "MAX") {
      return { date: new Date(ms).toISOString(), close: 0, basis: 0, pnl: 0, pnlPct: 0 };
    }

    const holdingsValue = lots.reduce((sum, lot) => {
      if (ms < lot.startMs) return sum;
      if (lot.shares <= EPSILON) return sum;
      const price = priceAtTime({ ticker: lot.ticker, targetMs: ms, range, lot, charts, currentPrices, nowMs });
      return sum + lot.shares * price;
    }, 0);

    const close = Math.max(0, roundMoney((range === "1D" ? currentCash : cashAtTime(cashEvents, ms)) + holdingsValue));
    const basis = roundMoney(basisAtTime(basisEvents, ms));
    const pnl = roundMoney(close - basis);

    return {
      date: new Date(ms).toISOString(),
      close,
      basis,
      pnl,
      pnlPct: basis > EPSILON ? (pnl / basis) * 100 : 0,
    };
  });

  const deduped = Array.from(
    points.reduce((map, point) => map.set(point.date, point), new Map<string, ChartPoint>()).values(),
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

  const { lots, cashEvents, basisEvents } = buildLedger({
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
    const points = buildRangeSeries({ range, portfolioStartMs, nowMs, lots, cashEvents, basisEvents, charts, currentPrices: currentPriceMap });
    if (points.length > 1) acc[range] = points;
    return acc;
  }, {});
}
