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
import { buildPortfolioPageChartResult } from "@/lib/portfolio-page-chart";
import type { PortfolioChartMeta } from "@/lib/portfolio-chart-health";
import { derivePortfolioHoldingAction } from "@/lib/portfolio-action-engine";
import { getOneDayMoveMap } from "@/lib/yahoo";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

type PortfolioRow = {
  id: string;
  name: string | null;
  objective?: string | null;
  risk_tolerance: string | null;
  time_horizon: string | null;
  investment_amount: number | null;
  cash_balance: number | null;
  cash_deposited_total?: number | null;
  currency?: string | null;
  created_at?: string | null;
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

export type DashboardPortfolioOpportunity = {
  ticker: string;
  company: string | null;
  sector: string;
  category:
    | "High-conviction fit"
    | "Diversification fit"
    | "Add-more candidate"
    | "Alternative to review"
    | "Review existing holding"
    | "Watchlist idea";
  score: number;
  rank: number | null;
  recentMovePct: number | null;
  updatedAt: string | null;
  reason: string;
  risk: string;
};

export type DashboardMainPortfolioResult = {
  portfolioId: string | null;
  portfolios: Array<{ id: string; name: string }>;
  summary: PortfolioHealthSummary | null;
  chartData: Partial<Record<TimeRange, ChartPoint[]>>;
  chartMeta: PortfolioChartMeta | null;
  tickers: string[];
  opportunities: DashboardPortfolioOpportunity[];
  valuationState: "exact" | "partial" | "unavailable" | "empty";
  missingPriceTickers: string[];
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

function recentIsoMs(value?: string | null) {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function isFreshEnough(value?: string | null) {
  const ms = recentIsoMs(value);
  if (ms == null) return false;
  return Date.now() - ms <= 36 * 60 * 60 * 1000;
}

function riskSectorCap(riskTolerance?: string | null) {
  if (riskTolerance === "conservative") return 18;
  if (riskTolerance === "aggressive") return 34;
  return 26;
}

function objectiveBonus(objective: string | null | undefined, stock: { score: number; rank: number | null; sector: string | null }) {
  if (objective === "growth") return stock.score >= 7600 ? 10 : 0;
  if (objective === "income") {
    return /utilities|consumer|health|financial/i.test(stock.sector ?? "") ? 6 : -4;
  }
  if (objective === "capital_preservation") return stock.rank != null && stock.rank <= 75 ? 5 : -8;
  if (objective === "watchlist") return stock.rank != null && stock.rank <= 125 ? 4 : 0;
  return stock.rank != null && stock.rank <= 100 ? 4 : 0;
}

export async function buildPortfolioOpportunities(
  supabase: SupabaseClient,
  portfolio: PortfolioRow,
  holdings: EnrichedHolding[],
  summary: PortfolioHealthSummary,
): Promise<DashboardPortfolioOpportunity[]> {
  if (holdings.length === 0) return [];

  const { data } = await supabase
    .from("stock_rankings")
    .select("ticker,company,sector,score,rank,price,updated_at,last_price_update,last_ranking_update")
    .order("rank", { ascending: true })
    .limit(180);

  const heldByTicker = new Map(holdings.map((holding) => [holding.ticker.toUpperCase(), holding]));
  const sectorExposure = holdings.reduce<Map<string, number>>((acc, holding) => {
    const sector = String(holding.sector ?? "Unclassified");
    acc.set(sector, (acc.get(sector) ?? 0) + holding.currentAllocationPct);
    return acc;
  }, new Map());
  const weakBySector = holdings.reduce<Map<string, EnrichedHolding>>((acc, holding) => {
    const sector = String(holding.sector ?? "Unclassified");
    const current = acc.get(sector);
    const action = derivePortfolioHoldingAction(holding, {
      riskTolerance: portfolio.risk_tolerance,
      objective: portfolio.objective,
      timeHorizon: portfolio.time_horizon,
      cashBalance: portfolio.cash_balance,
      cashDrag: summary.cashDrag,
      sectorExposurePct: sectorExposure.get(sector) ?? 0,
    });
    const isWeak =
      action.action === "review" ||
      action.action === "trim" ||
      action.action === "exit" ||
      holding.score < 6200 ||
      holding.rankPercentile < 35;
    if (isWeak && (!current || holding.score < current.score)) acc.set(sector, holding);
    return acc;
  }, new Map());
  const sectorCap = riskSectorCap(portfolio.risk_tolerance);

  const rawCandidates = ((data ?? []) as Array<{
    ticker: string | null;
    company: string | null;
    sector: string | null;
    score: number | string | null;
    rank: number | null;
    price: number | string | null;
    updated_at: string | null;
    last_price_update?: string | null;
    last_ranking_update?: string | null;
  }>)
    .map((stock) => {
      const ticker = cleanTicker(stock.ticker);
      const score = toNumber(stock.score, Number.NaN);
      const price = toNumber(stock.price, Number.NaN);
      const updatedAt = stock.last_ranking_update ?? stock.updated_at ?? stock.last_price_update ?? null;
      const sector = stock.sector ?? "Unclassified";
      const held = heldByTicker.get(ticker);
      const exposure = sectorExposure.get(sector) ?? 0;
      const weakSameSector = weakBySector.get(sector);

      if (!ticker || !Number.isFinite(score) || score < 6500 || !Number.isFinite(price) || price <= 0) return null;
      if (!isFreshEnough(updatedAt)) return null;

      let category: DashboardPortfolioOpportunity["category"] = "Watchlist idea";
      let fitScore = score / 100;
      const rank = stock.rank;

      if (held) {
        const holdingAction = derivePortfolioHoldingAction(held, {
          riskTolerance: portfolio.risk_tolerance,
          objective: portfolio.objective,
          timeHorizon: portfolio.time_horizon,
          cashBalance: portfolio.cash_balance,
          cashDrag: summary.cashDrag,
          sectorExposurePct: exposure,
        });
        if (holdingAction.action === "review" || holdingAction.action === "trim" || holdingAction.action === "exit") {
          category = "Review existing holding";
          fitScore += holdingAction.action === "exit" ? 7 : 5;
        } else {
          const target = held.targetAllocationPct ?? held.currentAllocationPct;
          if (held.currentAllocationPct >= target - 1 || summary.cashDrag < 2 || exposure > sectorCap * 0.9) return null;
          category = "Add-more candidate";
          fitScore += Math.max(0, target - held.currentAllocationPct) * 1.6;
        }
      } else if (weakSameSector && score >= weakSameSector.score + 900) {
        if (exposure > sectorCap * 1.15) return null;
        category = "Alternative to review";
        fitScore += 14;
      } else if (exposure <= 3 && score >= 7200) {
        category = "Diversification fit";
        fitScore += 12;
      } else if (score >= 8000 && (rank ?? 9999) <= 50 && exposure <= sectorCap * 0.6) {
        category = "High-conviction fit";
        fitScore += 8;
      } else if (score < 7200 || exposure > sectorCap * 0.75) {
        return null;
      }

      if (!held && exposure > sectorCap && category !== "Alternative to review") return null;

      fitScore += objectiveBonus(portfolio.objective, { score, rank, sector });
      fitScore -= Math.max(0, exposure - sectorCap) * 1.2;

      const reason =
        category === "Add-more candidate"
          ? `${ticker} is already held but remains below target with a strong current StockGPT score.`
          : category === "Review existing holding"
            ? `${ticker} is already in the portfolio and has a review signal, so this is not a diversification idea.`
          : category === "Alternative to review"
            ? `${ticker} screens stronger than ${weakSameSector?.ticker ?? "a weaker same-sector holding"} and may be worth comparing as an alternative.`
            : category === "Diversification fit"
              ? `${ticker} adds exposure outside the portfolio's current main sectors while retaining strong AI conviction.`
              : `${ticker} combines strong AI conviction with a reasonable portfolio fit.`;
      const risk =
        exposure > 0
          ? `${sector} exposure is already ${exposure.toFixed(1)}%, so sizing should stay controlled.`
          : "New sector exposure should still be sized conservatively and reviewed against current news.";
      const opportunity: DashboardPortfolioOpportunity = {
        ticker,
        company: stock.company,
        sector,
        category,
        score,
        rank,
        recentMovePct: null,
        updatedAt,
        reason,
        risk,
      };

      return {
        opportunity,
        fitScore,
      };
    })
    .filter((candidate): candidate is { opportunity: DashboardPortfolioOpportunity; fitScore: number } => Boolean(candidate))
    .sort((a, b) => b.fitScore - a.fitScore)
    .slice(0, 6);

  const moveMap = await getOneDayMoveMap(rawCandidates.map((candidate) => candidate.opportunity.ticker));
  return rawCandidates
    .map(({ opportunity }) => {
      const move = moveMap.get(opportunity.ticker);
      return {
        ...opportunity,
        recentMovePct: move?.changePct == null ? null : Math.round(move.changePct * 10) / 10,
      };
    })
    .slice(0, 3);
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

export async function getDashboardMainPortfolio(
  supabase: SupabaseClient,
  userId: string,
  requestedPortfolioId?: string | null,
): Promise<DashboardMainPortfolioResult> {
  const { data: portfoliosData } = await supabase
    .from("user_portfolios")
    .select(
      "id,name,objective,risk_tolerance,time_horizon,investment_amount,cash_balance,cash_deposited_total,currency,created_at",
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
    return { portfolioId: null, portfolios: [], summary: null, chartData: {}, chartMeta: null, tickers: [], opportunities: [], valuationState: "empty", missingPriceTickers: [] };
  }

  const selectedPortfolio =
    portfolios.find((portfolio) => portfolio.id === requestedPortfolioId) ?? portfolios[0];
  const portfolioIds = [selectedPortfolio.id];

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

  for (const portfolio of [selectedPortfolio]) {
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
  if (!mainPortfolio) return { portfolioId: null, portfolios: portfolios.map((portfolio) => ({ id: portfolio.id, name: cleanPortfolioName(portfolio.name) })), summary: null, chartData: {}, chartMeta: null, tickers: [], opportunities: [], valuationState: "empty", missingPriceTickers: [] };

  const missingPriceTickers = mainPortfolio.enriched
    .filter((holding) => toNumber(holding.shares, 0) > 0 && toNumber(holding.currentPrice, 0) <= 0)
    .map((holding) => holding.ticker);
  const valuationState =
    mainPortfolio.enriched.length === 0 && toNumber(mainPortfolio.portfolio.cash_balance, 0) <= 0
      ? "empty"
      : missingPriceTickers.length === 0
        ? "exact"
        : missingPriceTickers.length === mainPortfolio.enriched.length
          ? "unavailable"
          : "partial";

  const chartResult = await buildPortfolioPageChartResult({
    portfolio: {
      id: mainPortfolio.portfolio.id,
      name: mainPortfolio.portfolio.name,
      objective: mainPortfolio.portfolio.objective ?? null,
      risk_tolerance: mainPortfolio.portfolio.risk_tolerance,
      time_horizon: mainPortfolio.portfolio.time_horizon,
      investment_amount: mainPortfolio.portfolio.investment_amount,
      cash_balance: mainPortfolio.portfolio.cash_balance,
      cash_deposited_total: mainPortfolio.portfolio.cash_deposited_total,
      currency: mainPortfolio.portfolio.currency ?? null,
      created_at: mainPortfolio.portfolio.created_at ?? null,
      user_id: userId,
    },
    enriched: mainPortfolio.enriched,
    transactions: mainPortfolio.transactions,
    summary: mainPortfolio.summary,
    ownerId: userId,
    allowCurrentSnapshot: missingPriceTickers.length === 0,
  });

  return {
    portfolioId: mainPortfolio.portfolio.id,
    portfolios: portfolios.map((portfolio) => ({ id: portfolio.id, name: cleanPortfolioName(portfolio.name) })),
    summary: mainPortfolio.summary,
    chartData: chartResult.chartData,
    chartMeta: chartResult.meta,
    tickers: mainPortfolio.rawHoldings.map((holding) => holding.ticker),
    opportunities: await buildPortfolioOpportunities(
      supabase,
      mainPortfolio.portfolio,
      mainPortfolio.enriched,
      mainPortfolio.summary,
    ),
    valuationState,
    missingPriceTickers,
  };
}
