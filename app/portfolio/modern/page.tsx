import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { PortfolioBuilder } from "@/components/PortfolioBuilder";
import { PortfolioModernWorkspace } from "@/components/PortfolioModernWorkspace";
import type { ChartPoint, TimeRange } from "@/components/StockChart";
import { createClient } from "@/utils/supabase/server";
import { enrichHoldings, type EnrichedHolding, type RiskTolerance } from "@/lib/portfolio-alerts";
import { buildPortfolioHealthSummary } from "@/lib/portfolio-health";
import { buildPortfolioPageChartResult } from "@/lib/portfolio-page-chart";
import { buildPortfolioOpportunities } from "@/lib/dashboard-portfolio";
import { hasActiveSubscription } from "@/lib/subscription";
import { getUsdFxRates } from "@/lib/fx-rates";
import {
  convertUsdToCurrency,
  normaliseCurrency,
  rateForCurrency,
  type SupportedCurrency,
  type UsdFxRates,
} from "@/lib/currency";

export const dynamic = "force-dynamic";

type SearchParams = {
  portfolio?: string;
  builder?: string;
  mode?: string;
  section?: string;
};

type PortfolioRow = {
  id: string;
  name: string | null;
  objective: string | null;
  risk_tolerance: string | null;
  time_horizon: string | null;
  investment_amount: number | null;
  cash_balance: number | null;
  cash_deposited_total: number | null;
  currency: string | null;
  created_at: string | null;
};

type HoldingRow = {
  ticker: string | null;
  entry_price: number | null;
  score_at_entry: number | null;
  rank_at_entry: number | null;
  added_at: string | null;
  last_reviewed_at: string | null;
  shares: number | null;
  allocation_pct: number | null;
  purchase_date: string | null;
  source: string | null;
  notes: string | null;
};

type TransactionRow = {
  id: string;
  portfolio_id: string;
  ticker: string | null;
  type: string;
  shares: number | null;
  price: number | null;
  amount: number | null;
  realised_pnl: number | null;
  currency: string | null;
  notes: string | null;
  created_at: string;
};

type StockRow = {
  ticker: string | null;
  company: string | null;
  sector: string | null;
  rank: number | null;
  score: number | null;
  price: number | null;
};

function n(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function cleanName(value: string | null | undefined, index: number) {
  return String(value ?? "").trim() || `Portfolio ${index + 1}`;
}

function convertHolding(
  holding: EnrichedHolding,
  currency: SupportedCurrency,
  rates: UsdFxRates,
  totalValue: number,
): EnrichedHolding {
  const currentValue = convertUsdToCurrency(holding.currentValue, currency, rates);
  return {
    ...holding,
    currentPrice: convertUsdToCurrency(holding.currentPrice, currency, rates),
    entryPrice: convertUsdToCurrency(holding.entryPrice, currency, rates),
    costBasis: convertUsdToCurrency(holding.costBasis, currency, rates),
    currentValue,
    totalPnLDollars: convertUsdToCurrency(holding.totalPnLDollars, currency, rates),
    pnlDollars: convertUsdToCurrency(holding.pnlDollars, currency, rates),
    currentAllocationPct: totalValue > 0 ? (currentValue / totalValue) * 100 : 0,
  };
}

function convertChart(
  chartData: Partial<Record<TimeRange, ChartPoint[]>>,
  currency: SupportedCurrency,
  rates: UsdFxRates,
) {
  return Object.fromEntries(
    Object.entries(chartData).map(([range, points]) => [
      range,
      (points ?? []).map((point) => ({
        ...point,
        close: convertUsdToCurrency(point.close, currency, rates),
        basis:
          point.basis == null
            ? undefined
            : convertUsdToCurrency(point.basis, currency, rates),
        pnl:
          point.pnl == null
            ? undefined
            : convertUsdToCurrency(point.pnl, currency, rates),
      })),
    ]),
  ) as Partial<Record<TimeRange, ChartPoint[]>>;
}

export default async function ModernPortfolioPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [{ data: portfolioRows }, { data: profile }, fxRates, { data: stockRows }] =
    await Promise.all([
      supabase
        .from("user_portfolios")
        .select(
          "id,name,objective,risk_tolerance,time_horizon,investment_amount,cash_balance,cash_deposited_total,currency,created_at",
        )
        .eq("user_id", user.id)
        .is("archived_at", null)
        .order("created_at", { ascending: true }),
      supabase
        .from("profiles")
        .select("preferred_currency,subscription_status")
        .eq("id", user.id)
        .maybeSingle(),
      getUsdFxRates(),
      supabase
        .from("stock_rankings")
        .select("ticker,company,sector,rank,score,price")
        .order("rank", { ascending: true })
        .limit(500),
    ]);

  const portfolios = ((portfolioRows ?? []) as PortfolioRow[]).map((portfolio, index) => ({
    ...portfolio,
    name: cleanName(portfolio.name, index),
  }));
  const displayCurrency = normaliseCurrency(profile?.preferred_currency);
  const usdToDisplayRate = rateForCurrency(displayCurrency, fxRates);
  const stocks = ((stockRows ?? []) as StockRow[])
    .filter((stock) => stock.ticker)
    .map((stock) => ({
      ticker: String(stock.ticker).toUpperCase(),
      company: stock.company,
      sector: stock.sector,
      rank: stock.rank,
      score: stock.score,
      price:
        stock.price == null
          ? null
          : convertUsdToCurrency(n(stock.price), displayCurrency, fxRates),
    }));

  if (params.builder === "1" || portfolios.length === 0) {
    return (
      <AppShell activePath="/portfolio">
        <main className="h-full min-h-0 overflow-y-auto overflow-x-hidden pb-[calc(112px+env(safe-area-inset-bottom))] lg:pb-10">
          <PortfolioBuilder
            existingPortfolios={portfolios.map((portfolio) => ({
              id: portfolio.id,
              name: portfolio.name ?? "Portfolio",
            }))}
            stockOptions={stocks}
            displayCurrency={displayCurrency}
            usdToDisplayRate={usdToDisplayRate}
            initialMode={
              params.mode === "manual" ? "manual" : params.mode === "ai" ? "ai" : "choice"
            }
          />
        </main>
      </AppShell>
    );
  }

  const selectedPortfolioId =
    params.portfolio && portfolios.some((portfolio) => portfolio.id === params.portfolio)
      ? params.portfolio
      : portfolios[0].id;
  const activePortfolio =
    portfolios.find((portfolio) => portfolio.id === selectedPortfolioId) ?? portfolios[0];

  const [{ data: holdingRows }, { data: transactionRows }] = await Promise.all([
    supabase
      .from("portfolio_holdings")
      .select(
        "ticker,entry_price,score_at_entry,rank_at_entry,added_at,last_reviewed_at,shares,allocation_pct,purchase_date,source,notes",
      )
      .eq("portfolio_id", selectedPortfolioId)
      .order("added_at", { ascending: false }),
    supabase
      .from("portfolio_transactions")
      .select(
        "id,portfolio_id,ticker,type,shares,price,amount,realised_pnl,currency,notes,created_at",
      )
      .eq("portfolio_id", selectedPortfolioId)
      .order("created_at", { ascending: true })
      .limit(1000),
  ]);

  const rawHoldings = ((holdingRows ?? []) as HoldingRow[])
    .filter((holding) => holding.ticker)
    .map((holding) => ({
      ticker: String(holding.ticker).toUpperCase(),
      entry_price: holding.entry_price,
      score_at_entry: holding.score_at_entry,
      rank_at_entry: holding.rank_at_entry,
      shares: holding.shares,
      allocation_pct: holding.allocation_pct,
      added_at: holding.added_at ?? new Date().toISOString(),
      last_reviewed_at:
        holding.last_reviewed_at ?? holding.added_at ?? new Date().toISOString(),
      purchase_date: holding.purchase_date,
      source: holding.source,
      notes: holding.notes,
    }));
  const transactions = (transactionRows ?? []) as TransactionRow[];
  const riskTolerance = (activePortfolio.risk_tolerance as RiskTolerance) ?? null;
  const enriched = await enrichHoldings(rawHoldings, riskTolerance);
  const cashBalanceUsd = n(activePortfolio.cash_balance);
  const cashDepositedTotalUsd = n(
    activePortfolio.cash_deposited_total,
    n(activePortfolio.investment_amount),
  );
  const summaryUsd = buildPortfolioHealthSummary({
    id: selectedPortfolioId,
    name: activePortfolio.name ?? "Portfolio",
    currency: activePortfolio.currency ?? "USD",
    riskTolerance,
    holdings: enriched,
    transactions: transactions.map((transaction) => ({ realisedPnl: transaction.realised_pnl })),
    cashBalance: cashBalanceUsd,
    cashDepositedTotal: cashDepositedTotalUsd,
  });
  const chartResult = await buildPortfolioPageChartResult({
    portfolio: {
      id: activePortfolio.id,
      name: activePortfolio.name,
      risk_tolerance: activePortfolio.risk_tolerance,
      time_horizon: activePortfolio.time_horizon,
      investment_amount: n(activePortfolio.investment_amount),
      cash_balance: cashBalanceUsd,
      cash_deposited_total: cashDepositedTotalUsd,
      currency: activePortfolio.currency ?? "USD",
      created_at: activePortfolio.created_at,
    },
    enriched,
    transactions,
    summary: summaryUsd,
    ownerId: user.id,
    allowCurrentSnapshot: enriched.every(
      (holding) => holding.shares <= 0 || holding.currentPrice > 0,
    ),
  });
  const canUsePremium = hasActiveSubscription(profile?.subscription_status);
  const opportunities = canUsePremium
    ? await buildPortfolioOpportunities(supabase, activePortfolio, enriched, summaryUsd)
    : [];

  const totalValueDisplay = convertUsdToCurrency(summaryUsd.totalValue, displayCurrency, fxRates);
  const displayHoldings = enriched.map((holding) =>
    convertHolding(holding, displayCurrency, fxRates, totalValueDisplay),
  );
  const displaySummary = {
    ...summaryUsd,
    currency: displayCurrency,
    holdingsValue: convertUsdToCurrency(summaryUsd.holdingsValue, displayCurrency, fxRates),
    totalValue: totalValueDisplay,
    unrealisedPnl: convertUsdToCurrency(summaryUsd.unrealisedPnl, displayCurrency, fxRates),
    realisedPnl: convertUsdToCurrency(summaryUsd.realisedPnl, displayCurrency, fxRates),
    totalPnl: convertUsdToCurrency(summaryUsd.totalPnl, displayCurrency, fxRates),
  };
  const displayTransactions = transactions
    .slice()
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .map((transaction) => ({
      id: transaction.id,
      portfolioId: transaction.portfolio_id,
      ticker: transaction.ticker,
      type: transaction.type,
      shares: transaction.shares,
      price:
        transaction.price == null
          ? null
          : convertUsdToCurrency(transaction.price, displayCurrency, fxRates),
      amount:
        transaction.amount == null
          ? null
          : convertUsdToCurrency(transaction.amount, displayCurrency, fxRates),
      realisedPnl:
        transaction.realised_pnl == null
          ? null
          : convertUsdToCurrency(transaction.realised_pnl, displayCurrency, fxRates),
      currency: displayCurrency,
      notes: transaction.notes,
      createdAt: transaction.created_at,
    }));

  return (
    <AppShell
      activePath="/portfolio"
      askLabel="Ask about this portfolio"
      askContext={{ contextType: "portfolio", portfolioId: selectedPortfolioId }}
    >
      <PortfolioModernWorkspace
        portfolioId={selectedPortfolioId}
        portfolios={portfolios.map((portfolio) => ({
          id: portfolio.id,
          name: portfolio.name ?? "Portfolio",
          createdAt: portfolio.created_at,
        }))}
        portfolioMeta={{
          name: activePortfolio.name ?? "Portfolio",
          objective: activePortfolio.objective,
          riskTolerance: activePortfolio.risk_tolerance,
          timeHorizon: activePortfolio.time_horizon,
          createdAt: activePortfolio.created_at,
          cashBalance: convertUsdToCurrency(cashBalanceUsd, displayCurrency, fxRates),
          cashDepositedTotal: convertUsdToCurrency(
            cashDepositedTotalUsd,
            displayCurrency,
            fxRates,
          ),
          currency: displayCurrency,
        }}
        summary={displaySummary}
        holdings={displayHoldings}
        stockOptions={stocks}
        transactions={displayTransactions}
        chartData={convertChart(chartResult.chartData, displayCurrency, fxRates)}
        chartMeta={chartResult.meta}
        opportunities={opportunities}
        usdToDisplayRate={usdToDisplayRate}
        canUsePremium={canUsePremium}
        initialSection={
          params.section === "holdings" || params.section === "activity"
            ? params.section
            : "overview"
        }
      />
    </AppShell>
  );
}
