import type { ChartPoint, TimeRange } from "@/components/StockChart";
import type { createClient } from "@/utils/supabase/server";
import {
  buildPortfolioHealthSummary,
  type PortfolioHealthSummary,
} from "@/lib/portfolio-health";
import {
  enrichHoldings,
  type EnrichedHolding,
  type RiskTolerance,
} from "@/lib/portfolio-alerts";
import { buildPortfolioValueTimeline } from "@/lib/portfolio-value-timeline";

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

export type DashboardMainPortfolioResult = {
  summary: PortfolioHealthSummary | null;
  chartData: Partial<Record<TimeRange, ChartPoint[]>>;
  tickers: string[];
};

function toNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function cleanTicker(ticker?: string | null) {
  return String(ticker ?? "").trim().toUpperCase();
}

function cleanPortfolioName(name: string | null | undefined) {
  return String(name ?? "").trim() || "Main Portfolio";
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

async function buildPortfolioPerformanceChart({
  portfolio,
  enriched,
  transactions,
}: PortfolioCandidate): Promise<Partial<Record<TimeRange, ChartPoint[]>>> {
  return buildPortfolioValueTimeline({
    portfolio: {
      id: portfolio.id,
      cash_balance: portfolio.cash_balance,
      created_at: portfolio.created_at,
    },
    holdings: enriched.map((holding) => ({
      ticker: holding.ticker,
      shares: holding.shares,
      entryPrice: holding.entryPrice,
      currentPrice: holding.currentPrice,
      currentValue: holding.currentValue,
      purchaseDate: holding.purchaseDate,
      addedAt: holding.addedAt,
    })),
    transactions,
    currentPrices: Object.fromEntries(
      enriched.map((holding) => [holding.ticker, toNumber(holding.currentPrice, 0)]),
    ),
  });
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

  const chartData = await buildPortfolioPerformanceChart(mainPortfolio);

  return {
    summary: mainPortfolio.summary,
    chartData,
    tickers: mainPortfolio.rawHoldings.map((holding) => holding.ticker),
  };
}
