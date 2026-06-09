import type { ChartPoint, TimeRange } from "@/components/StockChart";
import type { createClient } from "@/utils/supabase/server";
import { getStockChart } from "@/lib/yahoo";
import {
  buildPortfolioHealthSummary,
  type PortfolioHealthSummary,
} from "@/lib/portfolio-health";
import {
  enrichHoldings,
  type EnrichedHolding,
  type RiskTolerance,
} from "@/lib/portfolio-alerts";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

type PortfolioRow = {
  id: string;
  name: string | null;
  risk_tolerance: string | null;
  time_horizon: string | null;
  investment_amount: number | null;
  cash_balance: number | null;
  cash_deposited_total?: number | null;
  currency: string | null;
  created_at: string | null;
};

type HoldingRow = {
  portfolio_id: string;
  ticker: string | null;
  entry_price: number | null;
  score_at_entry: number | null;
  rank_at_entry: number | null;
  added_at: string | null;
  last_reviewed_at: string | null;
  shares: number | null;
  allocation_pct: number | null;
  purchase_date?: string | null;
  source?: string | null;
  notes?: string | null;
};

type TransactionRow = {
  id: string;
  portfolio_id: string;
  ticker: string | null;
  type: string | null;
  shares: number | null;
  price: number | null;
  amount: number | null;
  realised_pnl: number | null;
  currency: string | null;
  notes: string | null;
  created_at: string | null;
};

type RawHolding = {
  ticker: string;
  entry_price: number | null;
  score_at_entry: number | null;
  rank_at_entry: number | null;
  shares: number | null;
  allocation_pct: number | null;
  added_at: string;
  last_reviewed_at: string;
  purchase_date?: string | null;
  source?: string | null;
  notes?: string | null;
};

type PortfolioCandidate = {
  portfolio: PortfolioRow;
  rawHoldings: RawHolding[];
  enriched: EnrichedHolding[];
  transactions: TransactionRow[];
  summary: PortfolioHealthSummary;
};

type PortfolioEvent = {
  dateMs: number;
  ticker?: string;
  cashDelta?: number;
  shareDelta?: number;
  setShares?: number;
};

export type DashboardMainPortfolioResult = {
  summary: PortfolioHealthSummary | null;
  chartData: Partial<Record<TimeRange, ChartPoint[]>>;
  tickers: string[];
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

function cleanPortfolioName(name: string | null | undefined) {
  return String(name ?? "").trim() || "Main Portfolio";
}

function safeDateMs(value: string | null | undefined, fallbackMs = Date.now()) {
  if (!value) return fallbackMs;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : fallbackMs;
}

function normaliseHolding(holding: HoldingRow): RawHolding | null {
  const ticker = cleanTicker(holding.ticker);
  if (!ticker) return null;

  return {
    ticker,
    entry_price: holding.entry_price,
    score_at_entry: holding.score_at_entry,
    rank_at_entry: holding.rank_at_entry,
    shares: holding.shares,
    allocation_pct: holding.allocation_pct,
    added_at: holding.added_at ?? new Date().toISOString(),
    last_reviewed_at:
      holding.last_reviewed_at ?? holding.added_at ?? new Date().toISOString(),
    purchase_date: holding.purchase_date ?? null,
    source: holding.source ?? null,
    notes: holding.notes ?? null,
  };
}

function chooseHistoryRange(createdAtMs: number): TimeRange {
  const ageDays = Math.max(0, (Date.now() - createdAtMs) / 86_400_000);
  if (ageDays <= 370) return "1Y";
  if (ageDays <= 365 * 5 + 30) return "5Y";
  return "MAX";
}

function fallbackPortfolioChart(totalValue: number, createdAtMs: number): Partial<Record<TimeRange, ChartPoint[]>> {
  if (!Number.isFinite(totalValue) || totalValue <= 0) return {};
  const now = Date.now();
  return {
    MAX: [
      { date: new Date(createdAtMs).toISOString(), close: roundMoney(totalValue) },
      { date: new Date(now).toISOString(), close: roundMoney(totalValue) },
    ],
  };
}

function transactionEvent(transaction: TransactionRow): PortfolioEvent | null {
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

  if (type === "buy") {
    return { dateMs, ticker, shareDelta: impliedShares, cashDelta: -amount };
  }

  if (type === "sell") {
    return { dateMs, ticker, shareDelta: -impliedShares, cashDelta: amount };
  }

  if (type === "log_existing") {
    return { dateMs, ticker, shareDelta: impliedShares };
  }

  if (type === "adjustment") {
    if (shares > 0) return { dateMs, ticker, setShares: shares };
    return null;
  }

  return null;
}

function replayFinalShares(events: PortfolioEvent[]) {
  const shares = new Map<string, number>();

  events
    .filter((event) => event.ticker)
    .sort((a, b) => a.dateMs - b.dateMs)
    .forEach((event) => {
      const ticker = event.ticker!;
      if (event.setShares != null) {
        shares.set(ticker, Math.max(0, event.setShares));
        return;
      }
      shares.set(ticker, Math.max(0, (shares.get(ticker) ?? 0) + toNumber(event.shareDelta, 0)));
    });

  return shares;
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

function getPriceAtOrBefore(
  points: ChartPoint[],
  dateMs: number,
  fallbackPrice: number,
) {
  if (points.length === 0) return fallbackPrice;

  let candidate = fallbackPrice;

  for (const point of points) {
    const pointMs = safeDateMs(point.date, 0);
    if (pointMs > dateMs) break;
    if (Number.isFinite(point.close) && point.close > 0) {
      candidate = point.close;
    }
  }

  return candidate;
}

async function buildPortfolioValueHistoryChart({
  portfolio,
  enriched,
  transactions,
  summary,
}: PortfolioCandidate): Promise<Partial<Record<TimeRange, ChartPoint[]>>> {
  const createdAtMs = safeDateMs(portfolio.created_at, Date.now());
  const nowMs = Date.now();
  const currentCash = toNumber(portfolio.cash_balance, 0);
  const currentTotalValue = summary.totalValue;

  const holdingMap = new Map(enriched.map((holding) => [holding.ticker, holding]));
  const events: PortfolioEvent[] = transactions
    .map(transactionEvent)
    .filter((event): event is PortfolioEvent => event !== null);

  const finalSharesFromTransactions = replayFinalShares(events);

  enriched.forEach((holding) => {
    const currentShares = toNumber(holding.shares, 0);
    const replayedShares = finalSharesFromTransactions.get(holding.ticker) ?? 0;
    const missingShares = roundShares(currentShares - replayedShares);

    if (Math.abs(missingShares) <= EPSILON) return;

    events.push({
      dateMs: safeDateMs(holding.purchaseDate ?? holding.addedAt, createdAtMs),
      ticker: holding.ticker,
      shareDelta: missingShares,
    });
  });

  const finalCashFromTransactions = replayFinalCash(events);
  const cashAdjustment = roundMoney(currentCash - finalCashFromTransactions);

  if (Math.abs(cashAdjustment) > 0.009) {
    events.push({ dateMs: createdAtMs, cashDelta: cashAdjustment });
  }

  const tickers = Array.from(
    new Set([
      ...enriched.map((holding) => holding.ticker),
      ...transactions.map((transaction) => cleanTicker(transaction.ticker)).filter(Boolean),
    ]),
  ).slice(0, 50);

  if (tickers.length === 0) {
    return fallbackPortfolioChart(currentTotalValue, createdAtMs);
  }

  const range = chooseHistoryRange(createdAtMs);
  const chartResults = await Promise.all(
    tickers.map(async (ticker) => {
      const chart = await getStockChart(ticker, [range]);
      return { ticker, points: chart[range] ?? [] };
    }),
  );

  const priceMap = new Map(chartResults.map((item) => [item.ticker, item.points]));
  const dateSet = new Set<number>([createdAtMs, nowMs]);

  events.forEach((event) => {
    if (event.dateMs >= createdAtMs && event.dateMs <= nowMs) {
      dateSet.add(event.dateMs);
    }
  });

  chartResults.forEach(({ points }) => {
    points.forEach((point) => {
      const ms = safeDateMs(point.date, 0);
      if (ms >= createdAtMs && ms <= nowMs) dateSet.add(ms);
    });
  });

  const sortedDates = Array.from(dateSet).sort((a, b) => a - b);
  if (sortedDates.length < 2) return fallbackPortfolioChart(currentTotalValue, createdAtMs);

  const sortedEvents = [...events].sort((a, b) => a.dateMs - b.dateMs);
  const shares = new Map<string, number>();
  let cash = 0;
  let eventIndex = 0;

  const points: ChartPoint[] = sortedDates.map((dateMs) => {
    while (eventIndex < sortedEvents.length && sortedEvents[eventIndex].dateMs <= dateMs) {
      const event = sortedEvents[eventIndex];
      cash += toNumber(event.cashDelta, 0);

      if (event.ticker) {
        if (event.setShares != null) {
          shares.set(event.ticker, Math.max(0, event.setShares));
        } else {
          shares.set(
            event.ticker,
            Math.max(0, (shares.get(event.ticker) ?? 0) + toNumber(event.shareDelta, 0)),
          );
        }
      }

      eventIndex += 1;
    }

    let close = cash;

    shares.forEach((shareCount, ticker) => {
      if (shareCount <= EPSILON) return;
      const fallbackPrice = getFallbackPrice(holdingMap.get(ticker));
      const price = getPriceAtOrBefore(priceMap.get(ticker) ?? [], dateMs, fallbackPrice);
      close += shareCount * price;
    });

    return {
      date: new Date(dateMs).toISOString(),
      close: Math.max(0, roundMoney(close)),
    };
  });

  const last = points[points.length - 1];
  if (last) last.close = roundMoney(currentTotalValue);

  return points.length > 1 ? { MAX: points } : fallbackPortfolioChart(currentTotalValue, createdAtMs);
}

export async function getDashboardMainPortfolio(
  supabase: SupabaseClient,
  userId: string,
): Promise<DashboardMainPortfolioResult> {
  const { data: portfoliosData } = await supabase
    .from("user_portfolios")
    .select(
      "id,name,risk_tolerance,time_horizon,investment_amount,cash_balance,cash_deposited_total,currency,created_at",
    )
    .eq("user_id", userId)
    .is("archived_at", null)
    .order("created_at", { ascending: true });

  const portfolios = ((portfoliosData ?? []) as PortfolioRow[]).map((portfolio) => ({
    ...portfolio,
    name: cleanPortfolioName(portfolio.name),
    cash_balance: toNumber(portfolio.cash_balance, 0),
    cash_deposited_total: toNumber(
      portfolio.cash_deposited_total,
      toNumber(portfolio.investment_amount, 0),
    ),
    investment_amount: toNumber(portfolio.investment_amount, 0),
    currency: portfolio.currency ?? "USD",
  }));

  if (portfolios.length === 0) {
    return { summary: null, chartData: {}, tickers: [] };
  }

  const portfolioIds = portfolios.map((portfolio) => portfolio.id);

  const [{ data: holdingsData }, { data: transactionData }] = await Promise.all([
    supabase
      .from("portfolio_holdings")
      .select(
        "portfolio_id,ticker,entry_price,score_at_entry,rank_at_entry,added_at,last_reviewed_at,shares,allocation_pct,purchase_date,source,notes",
      )
      .in("portfolio_id", portfolioIds),
    supabase
      .from("portfolio_transactions")
      .select(
        "id,portfolio_id,ticker,type,shares,price,amount,realised_pnl,currency,notes,created_at",
      )
      .in("portfolio_id", portfolioIds)
      .order("created_at", { ascending: true })
      .limit(1000),
  ]);

  const holdingsByPortfolio = new Map<string, RawHolding[]>();
  ((holdingsData ?? []) as HoldingRow[]).forEach((holding) => {
    const normalised = normaliseHolding(holding);
    if (!normalised) return;
    const existing = holdingsByPortfolio.get(holding.portfolio_id) ?? [];
    existing.push(normalised);
    holdingsByPortfolio.set(holding.portfolio_id, existing);
  });

  const transactionsByPortfolio = new Map<string, TransactionRow[]>();
  ((transactionData ?? []) as TransactionRow[]).forEach((transaction) => {
    const existing = transactionsByPortfolio.get(transaction.portfolio_id) ?? [];
    existing.push(transaction);
    transactionsByPortfolio.set(transaction.portfolio_id, existing);
  });

  const candidates: PortfolioCandidate[] = [];

  for (const portfolio of portfolios) {
    const rawHoldings = holdingsByPortfolio.get(portfolio.id) ?? [];
    const transactions = transactionsByPortfolio.get(portfolio.id) ?? [];
    const enriched = await enrichHoldings(
      rawHoldings,
      (portfolio.risk_tolerance as RiskTolerance) ?? null,
    );

    const summary = buildPortfolioHealthSummary({
      id: portfolio.id,
      name: cleanPortfolioName(portfolio.name),
      currency: portfolio.currency ?? "USD",
      riskTolerance: portfolio.risk_tolerance,
      holdings: enriched,
      transactions: transactions.map((transaction) => ({ realisedPnl: transaction.realised_pnl })),
      cashBalance: toNumber(portfolio.cash_balance, 0),
      cashDepositedTotal: toNumber(
        portfolio.cash_deposited_total,
        toNumber(portfolio.investment_amount, 0),
      ),
    });

    candidates.push({ portfolio, rawHoldings, enriched, transactions, summary });
  }

  const mainPortfolio = candidates.sort((a, b) => b.summary.totalValue - a.summary.totalValue)[0];

  if (!mainPortfolio) return { summary: null, chartData: {}, tickers: [] };

  const chartData = await buildPortfolioValueHistoryChart(mainPortfolio);

  return {
    summary: mainPortfolio.summary,
    chartData,
    tickers: mainPortfolio.rawHoldings.map((holding) => holding.ticker),
  };
}
