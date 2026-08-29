import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { PortfolioBuilder } from "@/components/PortfolioBuilder";
import { PortfolioModernWorkspace } from "@/components/PortfolioModernWorkspace";
import type { ChartPoint, TimeRange } from "@/components/StockChart";
import { createClient } from "@/utils/supabase/server";
import { enrichHoldings, type EnrichedHolding, type RiskTolerance } from "@/lib/portfolio-alerts";
import { buildPortfolioHealthSummary } from "@/lib/portfolio-health";
import { buildPortfolioPageChartResult } from "@/lib/portfolio-page-chart";
import { hasActiveSubscription } from "@/lib/subscription";
import { getUsdFxRates } from "@/lib/fx-rates";
import {
  assessCurrentPortfolioIntelligenceFacts,
  type CurrentDiagnosticFact,
  type CurrentHoldingFact,
  type CurrentPortfolioFact,
  type CurrentRankingFact,
} from "@/lib/current-portfolio-intelligence";
import { buildPortfolioIntelligenceView } from "@/lib/portfolio-intelligence-presentation";
import type { Tables } from "@/lib/database.types";
import {
  convertUsdToCurrency,
  normaliseCurrency,
  rateForCurrency,
  type SupportedCurrency,
  type UsdFxRates,
} from "@/lib/currency";
import { comparePortfolioTransactionActivityDesc } from "@/lib/portfolio-transaction-chronology";

export const dynamic = "force-dynamic";

type SearchParams = {
  portfolio?: string;
  builder?: string;
  mode?: string;
  section?: string;
};

type PortfolioRow = CurrentPortfolioFact & {
  name: string;
  investment_amount: number | null;
  cash_deposited_total: number;
  created_at: string;
};

type HoldingRow = CurrentHoldingFact &
  Pick<
    Tables<"portfolio_holdings">,
    "added_at" | "last_reviewed_at" | "purchase_date" | "notes"
  >;

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
  occurred_at: string | null;
  created_at: string;
};

type StockRow = CurrentRankingFact & {
  company: string | null;
  sector: string | null;
};

function n(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function positiveNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
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
  const intelligenceAsOf = new Date().toISOString();

  const [
    { data: portfolioRows, error: portfoliosError },
    { data: profile, error: profileError },
    fxRates,
    { data: stockRows, error: stocksError },
  ] =
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
        .select(
          "ticker,company,sector,rank,score,price,last_price_update,last_ranking_update",
        )
        .order("rank", { ascending: true })
        .limit(500),
    ]);

  if (portfoliosError) throw new Error("Portfolio list could not be loaded.");
  if (profileError) throw new Error("Portfolio profile could not be loaded.");

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

  const [
    { data: holdingRows, error: holdingsError },
    { data: transactionRows, error: transactionsError },
  ] = await Promise.all([
    supabase
      .from("portfolio_holdings")
      .select(
        "id,portfolio_id,ticker,entry_price,score_at_entry,rank_at_entry,added_at,last_reviewed_at,shares,allocation_pct,purchase_date,source,notes,risk_level_at_entry,target_level_at_entry",
      )
      .eq("portfolio_id", selectedPortfolioId)
      .order("added_at", { ascending: false }),
    supabase
      .from("portfolio_transactions")
      .select(
        "id,portfolio_id,ticker,type,shares,price,amount,realised_pnl,currency,notes,occurred_at,created_at",
      )
      .eq("portfolio_id", selectedPortfolioId)
      .order("created_at", { ascending: true })
      .limit(1000),
  ]);

  if (holdingsError) throw new Error("Portfolio holdings could not be loaded.");
  if (transactionsError) throw new Error("Portfolio activity could not be loaded.");

  const factualHoldings = ((holdingRows ?? []) as HoldingRow[]).filter(
    (holding) => holding.ticker.trim().length > 0,
  );
  const heldTickers = [
    ...new Set(
      factualHoldings.map((holding) => holding.ticker.trim().toUpperCase()),
    ),
  ];
  if (stocksError && heldTickers.length > 0) {
    throw new Error("Portfolio ranking facts could not be loaded.");
  }
  const initialRankingRows = (stockRows ?? []) as StockRow[];
  const loadedRankingTickers = new Set(
    initialRankingRows
      .map((ranking) => String(ranking.ticker ?? "").trim().toUpperCase())
      .filter(Boolean),
  );
  const missingHeldTickers = heldTickers.filter(
    (ticker) => !loadedRankingTickers.has(ticker),
  );
  const diagnosticsPromise =
    heldTickers.length > 0
      ? supabase
          .from("stock_factor_diagnostics")
          .select("ticker,current_score,previous_score,updated_at")
          .in("ticker", heldTickers)
          .order("ticker", { ascending: true })
      : Promise.resolve({ data: [] as CurrentDiagnosticFact[], error: null });
  const universePromise =
    heldTickers.length > 0
      ? supabase
          .from("stock_rankings")
          .select("rank", { count: "exact", head: true })
          .not("rank", "is", null)
      : Promise.resolve({ count: null as number | null, error: null });
  const missingRankingsPromise =
    missingHeldTickers.length > 0
      ? supabase
          .from("stock_rankings")
          .select(
            "ticker,score,rank,price,last_price_update,last_ranking_update",
          )
          .in("ticker", missingHeldTickers)
          .order("ticker", { ascending: true })
      : Promise.resolve({ data: [] as CurrentRankingFact[], error: null });
  const [diagnosticsResult, universeResult, missingRankingsResult] =
    await Promise.all([
      diagnosticsPromise,
      universePromise,
      missingRankingsPromise,
    ]);

  if (diagnosticsResult.error) {
    throw new Error("Portfolio diagnostic facts could not be loaded.");
  }
  if (universeResult.error) {
    throw new Error("Portfolio ranking universe could not be counted.");
  }
  if (missingRankingsResult.error) {
    throw new Error("Held ranking facts could not be loaded.");
  }

  const currentIntelligence = assessCurrentPortfolioIntelligenceFacts(
    {
      portfolio: activePortfolio,
      holdings: factualHoldings,
      rankings: [
        ...initialRankingRows,
        ...(missingRankingsResult.data ?? []),
      ],
      diagnostics: diagnosticsResult.data ?? [],
      rankingUniverseSize: universeResult.count,
    },
    intelligenceAsOf,
  );
  const intelligence = buildPortfolioIntelligenceView({
    result: currentIntelligence.assessment,
    adapterLimitations: currentIntelligence.adapterLimitations,
  });

  const rawHoldings = factualHoldings
    .map((holding) => ({
      ticker: holding.ticker.trim().toUpperCase(),
      entry_price: holding.entry_price,
      score_at_entry: holding.score_at_entry,
      rank_at_entry: holding.rank_at_entry,
      shares: holding.shares,
      allocation_pct: holding.allocation_pct,
      added_at: holding.added_at ?? intelligenceAsOf,
      last_reviewed_at: holding.last_reviewed_at ?? holding.added_at ?? intelligenceAsOf,
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

  const totalValueDisplay = convertUsdToCurrency(summaryUsd.totalValue, displayCurrency, fxRates);
  const displayHoldings = enriched.map((holding) =>
    convertHolding(holding, displayCurrency, fxRates, totalValueDisplay),
  );
  const holdingReferenceLevels = Object.fromEntries(
    factualHoldings.map((holding) => {
      const convertStoredLevel = (value: unknown) => {
        const parsed = positiveNumber(value);
        return parsed == null
          ? null
          : convertUsdToCurrency(parsed, displayCurrency, fxRates);
      };
      return [
        holding.ticker.trim().toUpperCase(),
        {
          entryPrice: convertStoredLevel(holding.entry_price),
          savedRiskLevel: convertStoredLevel(holding.risk_level_at_entry),
          savedTargetLevel: convertStoredLevel(holding.target_level_at_entry),
        },
      ];
    }),
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
      occurredAt: transaction.occurred_at,
      recordedAt: transaction.created_at,
    }))
    .sort(comparePortfolioTransactionActivityDesc);

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
        intelligence={intelligence}
        holdingReferenceLevels={holdingReferenceLevels}
        summary={displaySummary}
        holdings={displayHoldings}
        stockOptions={stocks}
        transactions={displayTransactions}
        chartData={convertChart(chartResult.chartData, displayCurrency, fxRates)}
        chartMeta={chartResult.meta}
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
