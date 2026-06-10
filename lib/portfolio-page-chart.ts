import type { ChartPoint, TimeRange } from "@/components/StockChart";
import { getStockChart } from "@/lib/yahoo";
import type { PortfolioHealthSummary } from "@/lib/portfolio-health";
import type { EnrichedHolding } from "@/lib/portfolio-alerts";

type PortfolioLike = {
  id: string;
  name: string | null;
  risk_tolerance: string | null;
  time_horizon: string | null;
  investment_amount: number | null;
  cash_balance: number | null;
  cash_deposited_total?: number | null;
  currency: string | null;
  created_at?: string | null;
};

type TransactionLike = {
  id?: string | null;
  portfolio_id?: string | null;
  ticker?: string | null;
  type?: string | null;
  shares?: number | null;
  price?: number | null;
  amount?: number | null;
  realised_pnl?: number | null;
  currency?: string | null;
  notes?: string | null;
  created_at?: string | null;
};

type PortfolioEvent = {
  dateMs: number;
  ticker?: string;
  cashDelta?: number;
  shareDelta?: number;
  costDelta?: number;
  realisedPnlDelta?: number;
  setShares?: number;
  setCostBasis?: number;
};

type TickerChartResult = {
  ticker: string;
  points: ChartPoint[];
  intradayPoints: ChartPoint[];
};

const EPSILON = 0.000001;

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

function safeDateMs(value: string | null | undefined, fallbackMs = Date.now()) {
  if (!value) return fallbackMs;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : fallbackMs;
}

function chooseHistoryRange(createdAtMs: number): TimeRange {
  const ageDays = Math.max(0, (Date.now() - createdAtMs) / 86_400_000);
  if (ageDays <= 370) return "1Y";
  if (ageDays <= 365 * 5 + 30) return "5Y";
  return "MAX";
}

function displayedPerformanceBasis(summary: PortfolioHealthSummary) {
  const valueLessPnl = summary.totalValue - summary.totalPnl;
  if (Number.isFinite(valueLessPnl) && valueLessPnl > 0) return valueLessPnl;

  if (Math.abs(summary.totalPnlPct) > EPSILON) {
    const basisFromDisplayedPct = summary.totalPnl / (summary.totalPnlPct / 100);
    if (Number.isFinite(basisFromDisplayedPct) && basisFromDisplayedPct > 0) {
      return basisFromDisplayedPct;
    }
  }

  return Math.max(summary.totalValue, 1);
}

function fallbackPortfolioChart(
  summary: PortfolioHealthSummary,
  createdAtMs: number,
): Partial<Record<TimeRange, ChartPoint[]>> {
  const basis = displayedPerformanceBasis(summary);
  const now = Date.now();
  const points = [
    { date: new Date(createdAtMs).toISOString(), close: roundMoney(basis) },
    { date: new Date(now).toISOString(), close: roundMoney(basis + summary.totalPnl) },
  ];

  return { MAX: points, "1D": points };
}

function transactionEvent(transaction: TransactionLike): PortfolioEvent | null {
  const type = String(transaction.type ?? "").toLowerCase();
  const dateMs = safeDateMs(transaction.created_at);
  const ticker = cleanTicker(transaction.ticker);
  const amount = Math.abs(toNumber(transaction.amount, 0));
  const shares = Math.abs(toNumber(transaction.shares, 0));
  const price = Math.abs(toNumber(transaction.price, 0));
  const impliedShares = shares > 0 ? shares : amount > 0 && price > 0 ? amount / price : 0;

  if (type === "deposit") return { dateMs, cashDelta: amount };
  if (type === "withdrawal") return { dateMs, cashDelta: -amount };
  if (type === "cash_adjustment") return { dateMs, cashDelta: toNumber(transaction.amount, 0) };

  if (!ticker) return null;

  if (type === "buy") return { dateMs, ticker, shareDelta: impliedShares, cashDelta: -amount, costDelta: amount };

  if (type === "sell") {
    const realisedPnl = toNumber(transaction.realised_pnl, 0);
    const soldCostBasis = Math.max(0, amount - realisedPnl);
    return { dateMs, ticker, shareDelta: -impliedShares, cashDelta: amount, costDelta: -soldCostBasis, realisedPnlDelta: realisedPnl };
  }

  if (type === "log_existing") {
    return { dateMs, ticker, shareDelta: impliedShares, costDelta: amount > 0 ? amount : impliedShares * price };
  }

  if (type === "adjustment" && shares > 0) return { dateMs, ticker, setShares: shares, setCostBasis: shares * price };

  return null;
}

function replayFinalExposure(events: PortfolioEvent[]) {
  const shares = new Map<string, number>();
  const costBasis = new Map<string, number>();

  events
    .filter((event) => event.ticker)
    .sort((a, b) => a.dateMs - b.dateMs)
    .forEach((event) => {
      const ticker = event.ticker!;
      if (event.setShares != null) shares.set(ticker, Math.max(0, event.setShares));
      else shares.set(ticker, Math.max(0, (shares.get(ticker) ?? 0) + toNumber(event.shareDelta, 0)));

      if (event.setCostBasis != null) costBasis.set(ticker, Math.max(0, event.setCostBasis));
      else costBasis.set(ticker, Math.max(0, (costBasis.get(ticker) ?? 0) + toNumber(event.costDelta, 0)));
    });

  return { shares, costBasis };
}

function replayFinalCash(events: PortfolioEvent[]) {
  return events.reduce((cash, event) => cash + toNumber(event.cashDelta, 0), 0);
}

function getFallbackPrice(holding: EnrichedHolding | undefined) {
  const current = toNumber(holding?.currentPrice, 0);
  if (current > 0) return current;
  const entry = toNumber(holding?.entryPrice, 0);
  return entry > 0 ? entry : 0;
}

function getPriceAtOrBefore(points: ChartPoint[], dateMs: number, fallbackPrice: number) {
  if (points.length === 0) return fallbackPrice;
  let candidate = fallbackPrice;

  for (const point of points) {
    const pointMs = safeDateMs(point.date, 0);
    if (pointMs > dateMs) break;
    if (Number.isFinite(point.close) && point.close > 0) candidate = point.close;
  }

  return candidate;
}

function buildContributionAdjustedPoints({
  dates,
  events,
  priceMap,
  holdingMap,
  displayBasis,
  summary,
}: {
  dates: number[];
  events: PortfolioEvent[];
  priceMap: Map<string, ChartPoint[]>;
  holdingMap: Map<string, EnrichedHolding>;
  displayBasis: number;
  summary: PortfolioHealthSummary;
}) {
  const sortedDates = Array.from(new Set(dates)).sort((a, b) => a - b);
  if (sortedDates.length < 2) return [];

  const sortedEvents = [...events].sort((a, b) => a.dateMs - b.dateMs);
  const shares = new Map<string, number>();
  const costBasis = new Map<string, number>();
  let realisedPnl = 0;
  let eventIndex = 0;

  const points = sortedDates.map((dateMs) => {
    while (eventIndex < sortedEvents.length && sortedEvents[eventIndex].dateMs <= dateMs) {
      const event = sortedEvents[eventIndex];
      realisedPnl += toNumber(event.realisedPnlDelta, 0);

      if (event.ticker) {
        if (event.setShares != null) shares.set(event.ticker, Math.max(0, event.setShares));
        else shares.set(event.ticker, Math.max(0, (shares.get(event.ticker) ?? 0) + toNumber(event.shareDelta, 0)));

        if (event.setCostBasis != null) costBasis.set(event.ticker, Math.max(0, event.setCostBasis));
        else costBasis.set(event.ticker, Math.max(0, (costBasis.get(event.ticker) ?? 0) + toNumber(event.costDelta, 0)));
      }

      eventIndex += 1;
    }

    let unrealisedPnl = 0;
    shares.forEach((shareCount, ticker) => {
      if (shareCount <= EPSILON) return;
      const fallbackPrice = getFallbackPrice(holdingMap.get(ticker));
      const price = getPriceAtOrBefore(priceMap.get(ticker) ?? [], dateMs, fallbackPrice);
      unrealisedPnl += shareCount * price - (costBasis.get(ticker) ?? 0);
    });

    return { date: new Date(dateMs).toISOString(), close: Math.max(0, roundMoney(displayBasis + realisedPnl + unrealisedPnl)) };
  });

  points[0] = { ...points[0], close: roundMoney(displayBasis) };
  points[points.length - 1] = { ...points[points.length - 1], close: Math.max(0, roundMoney(displayBasis + summary.totalPnl)) };
  return points;
}

export async function buildPortfolioPageChart({
  portfolio,
  enriched,
  transactions,
  summary,
}: {
  portfolio: PortfolioLike;
  enriched: EnrichedHolding[];
  transactions: TransactionLike[];
  summary: PortfolioHealthSummary;
}): Promise<Partial<Record<TimeRange, ChartPoint[]>>> {
  const createdAtMs = safeDateMs(portfolio.created_at, Date.now());
  const nowMs = Date.now();
  const currentCash = toNumber(portfolio.cash_balance, 0);
  const displayBasis = displayedPerformanceBasis(summary);
  const holdingMap = new Map(enriched.map((holding) => [holding.ticker, holding]));
  const events: PortfolioEvent[] = transactions.map(transactionEvent).filter((event): event is PortfolioEvent => event !== null);

  const finalExposure = replayFinalExposure(events);
  enriched.forEach((holding) => {
    const currentShares = toNumber(holding.shares, 0);
    const currentCostBasis = toNumber(holding.costBasis, currentShares * holding.entryPrice);
    const replayedShares = finalExposure.shares.get(holding.ticker) ?? 0;
    const replayedCostBasis = finalExposure.costBasis.get(holding.ticker) ?? 0;
    const missingShares = roundShares(currentShares - replayedShares);
    const missingCostBasis = roundMoney(currentCostBasis - replayedCostBasis);
    if (Math.abs(missingShares) <= EPSILON && Math.abs(missingCostBasis) <= 0.009) return;

    events.push({
      dateMs: safeDateMs(holding.purchaseDate ?? holding.addedAt, createdAtMs),
      ticker: holding.ticker,
      shareDelta: missingShares,
      costDelta: missingCostBasis,
    });
  });

  const cashAdjustment = roundMoney(currentCash - replayFinalCash(events));
  if (Math.abs(cashAdjustment) > 0.009) events.push({ dateMs: createdAtMs, cashDelta: cashAdjustment });

  const tickers = Array.from(new Set([...enriched.map((holding) => holding.ticker), ...transactions.map((transaction) => cleanTicker(transaction.ticker)).filter(Boolean)])).slice(0, 50);
  if (tickers.length === 0) return fallbackPortfolioChart(summary, createdAtMs);

  const range = chooseHistoryRange(createdAtMs);
  const chartResults: TickerChartResult[] = await Promise.all(
    tickers.map(async (ticker) => {
      const chart = await getStockChart(ticker, ["1D", range]);
      return { ticker, points: chart[range] ?? [], intradayPoints: chart["1D"] ?? [] };
    }),
  );

  const historyPriceMap = new Map(chartResults.map((item) => [item.ticker, item.points]));
  const intradayPriceMap = new Map(chartResults.map((item) => [item.ticker, item.intradayPoints]));

  const historyDates = new Set<number>([createdAtMs, nowMs]);
  events.forEach((event) => {
    if (event.dateMs >= createdAtMs && event.dateMs <= nowMs) historyDates.add(event.dateMs);
  });
  chartResults.forEach(({ points }) => {
    points.forEach((point) => {
      const ms = safeDateMs(point.date, 0);
      if (ms >= createdAtMs && ms <= nowMs) historyDates.add(ms);
    });
  });

  const maxPoints = buildContributionAdjustedPoints({
    dates: Array.from(historyDates),
    events,
    priceMap: historyPriceMap,
    holdingMap,
    displayBasis,
    summary,
  });

  const intradayDates = new Set<number>([createdAtMs, nowMs]);
  events.forEach((event) => {
    if (event.dateMs >= createdAtMs && event.dateMs <= nowMs) intradayDates.add(event.dateMs);
  });
  chartResults.forEach(({ intradayPoints }) => {
    intradayPoints.forEach((point) => {
      const ms = safeDateMs(point.date, 0);
      if (ms >= createdAtMs && ms <= nowMs) intradayDates.add(ms);
    });
  });

  const intradayPoints = buildContributionAdjustedPoints({
    dates: Array.from(intradayDates),
    events,
    priceMap: intradayPriceMap,
    holdingMap,
    displayBasis,
    summary,
  });

  const fallback = fallbackPortfolioChart(summary, createdAtMs);
  return {
    MAX: maxPoints.length >= 2 ? maxPoints : fallback.MAX,
    "1D": intradayPoints.length >= 2 ? intradayPoints : fallback["1D"],
  };
}
