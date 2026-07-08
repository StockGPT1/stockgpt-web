import type { Metadata } from "next";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { PortfolioBuilder } from "@/components/PortfolioBuilder";
import {
  PortfolioCommandCentreRevolut,
  type ExtendedHolding,
  type PortfolioTransaction,
} from "@/components/PortfolioCommandCentreRevolut";
import { Trading212CsvImport } from "@/components/Trading212CsvImport";
import { PortfolioCreationSuccess } from "@/components/PortfolioCreationSuccess";
import type { ChartPoint, TimeRange } from "@/components/StockChart";
import { createClient } from "@/utils/supabase/server";
import { enrichHoldings, enrichHoldingsAdmin, type RiskTolerance } from "@/lib/portfolio-alerts";
import { buildPortfolioHealthSummary } from "@/lib/portfolio-health";
import { buildPortfolioPageChartResult } from "@/lib/portfolio-page-chart";
import {
  repairPortfolioChartForPortfolio,
  shouldRepairHistorical,
} from "@/lib/portfolio-chart-repair";
import type { PortfolioChartMeta } from "@/lib/portfolio-chart-health";
import {
  enrichArticleWithStockInsights,
  type BaseNewsArticle,
  type EnrichedNewsArticle,
  type StockLike,
} from "@/lib/news-intelligence";
import {
  getCachedPortfolioNews,
  getCachedPortfolioStockUniverse,
  getPortfolioPageSnapshotWithFallback,
  hashPortfolioInputs,
  savePortfolioPageSnapshot,
  startPortfolioTimer,
  tryStartPortfolioPageSnapshotRefresh,
} from "@/lib/portfolio-speed-cache";
import {
  convertUsdToCurrency,
  normaliseCurrency,
  rateForCurrency,
  type SupportedCurrency,
  type UsdFxRates,
} from "@/lib/currency";
import { getUsdFxRates } from "@/lib/fx-rates";

export const metadata: Metadata = {
  title: "Portfolio Tracker | StockGPT AI Alerts",
  description:
    "Track portfolios with StockGPT AI alerts, portfolio health, holdings, imports, cash, transactions and market research insights.",
};

const PORTFOLIO_SNAPSHOT_VERSION = "portfolio-fast-v10";

type SearchParams = {
  builder?: string;
  created?: string;
  mode?: string;
  portfolio?: string;
};

type PortfolioRow = {
  id: string;
  name: string | null;
  risk_tolerance: string | null;
  time_horizon: string | null;
  investment_amount: number | null;
  cash_balance: number | null;
  cash_deposited_total: number | null;
  currency?: string | null;
  created_at?: string | null;
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
  purchase_date?: string | null;
  source?: string | null;
  notes?: string | null;
};

type StockOption = {
  ticker: string;
  company: string | null;
  sector: string | null;
  rank: number | null;
  price: number | null;
};

type StockUniverseRow = {
  ticker?: string | null;
  company?: string | null;
  sector?: string | null;
  rank?: number | string | null;
  score?: number | string | null;
  price?: number | string | null;
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

type ProfileCurrencyRow = {
  preferred_currency?: string | null;
};

function toNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function displayNumber(
  value: number | null | undefined,
  displayCurrency: SupportedCurrency,
  usdFxRates: UsdFxRates,
) {
  return convertUsdToCurrency(toNumber(value, 0), displayCurrency, usdFxRates);
}

function displayStockOptionsForCurrency({
  stockOptions,
  displayCurrency,
  usdFxRates,
}: {
  stockOptions: StockOption[];
  displayCurrency: SupportedCurrency;
  usdFxRates: UsdFxRates;
}) {
  if (displayCurrency === "USD") return stockOptions;
  return stockOptions.map((stock) => ({
    ...stock,
    price: stock.price == null ? null : displayNumber(stock.price, displayCurrency, usdFxRates),
  }));
}

function displayHoldingsForCurrency({
  holdings,
  displayCurrency,
  usdFxRates,
}: {
  holdings: ExtendedHolding[];
  displayCurrency: SupportedCurrency;
  usdFxRates: UsdFxRates;
}) {
  if (displayCurrency === "USD") return holdings;
  return holdings.map((holding) => ({
    ...holding,
    entryPrice: displayNumber(holding.entryPrice, displayCurrency, usdFxRates),
    currentPrice: displayNumber(holding.currentPrice, displayCurrency, usdFxRates),
    currentValue: displayNumber(holding.currentValue, displayCurrency, usdFxRates),
    costBasis: displayNumber(holding.costBasis, displayCurrency, usdFxRates),
    pnlDollars: displayNumber(holding.pnlDollars, displayCurrency, usdFxRates),
    totalPnLDollars: displayNumber(holding.totalPnLDollars, displayCurrency, usdFxRates),
  }));
}

function displayTransactionsForCurrency({
  transactions,
  displayCurrency,
  usdFxRates,
}: {
  transactions: TransactionRow[];
  displayCurrency: SupportedCurrency;
  usdFxRates: UsdFxRates;
}) {
  if (displayCurrency === "USD") return transactions;
  return transactions.map((transaction) => ({
    ...transaction,
    price:
      transaction.price == null
        ? null
        : displayNumber(transaction.price, displayCurrency, usdFxRates),
    amount:
      transaction.amount == null
        ? null
        : displayNumber(transaction.amount, displayCurrency, usdFxRates),
    realised_pnl:
      transaction.realised_pnl == null
        ? null
        : displayNumber(transaction.realised_pnl, displayCurrency, usdFxRates),
    currency: displayCurrency,
  }));
}

function displayChartForCurrency({
  chartData,
  displayCurrency,
  usdFxRates,
}: {
  chartData: Partial<Record<TimeRange, ChartPoint[]>>;
  displayCurrency: SupportedCurrency;
  usdFxRates: UsdFxRates;
}) {
  if (displayCurrency === "USD") return chartData;
  return Object.fromEntries(
    Object.entries(chartData).map(([range, points]) => [
      range,
      points?.map((point) => ({
        ...point,
        close: displayNumber(point.close, displayCurrency, usdFxRates),
        basis:
          point.basis == null
            ? undefined
            : displayNumber(point.basis, displayCurrency, usdFxRates),
        pnl:
          point.pnl == null
            ? undefined
            : displayNumber(point.pnl, displayCurrency, usdFxRates),
      })),
    ]),
  ) as typeof chartData;
}

function cleanPortfolioName(name: string | null | undefined, index: number) {
  const cleaned = String(name ?? "").trim();
  return cleaned || `Portfolio ${index + 1}`;
}

function parseAffectedTickers(value: BaseNewsArticle["affected_tickers"]) {
  if (Array.isArray(value)) {
    return value.map((ticker) => String(ticker).trim().toUpperCase()).filter(Boolean);
  }

  if (typeof value !== "string") return [];

  const trimmed = value.trim();
  if (!trimmed) return [];

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed.map((ticker) => String(ticker).trim().toUpperCase()).filter(Boolean);
    }
  } catch {
    // Fallback to comma/space parsing below.
  }

  return trimmed
    .split(/[\s,;|]+/)
    .map((ticker) => ticker.trim().toUpperCase())
    .filter(Boolean);
}

function buildPortfolioNews({
  newsData,
  stockUniverse,
  portfolioTickerSet,
}: {
  newsData: BaseNewsArticle[];
  stockUniverse: StockLike[];
  portfolioTickerSet: Set<string>;
}) {
  const portfolioStocks = stockUniverse.filter((stock) =>
    portfolioTickerSet.has(String(stock.ticker ?? "").toUpperCase()),
  );
  const knownPortfolioTickers = new Set(
    portfolioStocks.map((stock) => String(stock.ticker ?? "").toUpperCase()),
  );

  portfolioTickerSet.forEach((ticker) => {
    if (knownPortfolioTickers.has(ticker)) return;
    portfolioStocks.push({
      ticker,
      company: null,
      sector: null,
      rank: null,
      score: null,
      price: null,
    });
  });

  return newsData
    .map((article) => {
      const directTickers = parseAffectedTickers(article.affected_tickers);
      const hasDirectPortfolioMatch = directTickers.some((ticker) =>
        portfolioTickerSet.has(ticker),
      );
      const enriched = enrichArticleWithStockInsights(article, portfolioStocks, 10);

      return { enriched, hasDirectPortfolioMatch };
    })
    .filter(({ enriched, hasDirectPortfolioMatch }) => {
      if (hasDirectPortfolioMatch) return true;
      return enriched.affectedStocks.some((stock) => portfolioTickerSet.has(stock.ticker));
    })
    .sort(
      (a, b) =>
        new Date(b.enriched.published_at ?? 0).getTime() -
        new Date(a.enriched.published_at ?? 0).getTime(),
    )
    .slice(0, 30)
    .map(({ enriched }) => enriched);
}

function CompactImportLauncher({
  portfolioId,
}: {
  portfolioId: string | null;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-[#00a6ff]/20 bg-[#f7fbff] p-4 text-[#072116] shadow-[0_8px_22px_rgba(0,0,0,0.16)]">
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[#00a6ff] text-[12px] font-black text-white shadow-[0_8px_20px_rgba(0,166,255,0.24)]">
          212
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#00a6ff]">
            Trading 212
          </p>
          <h3 className="mt-0.5 text-[19px] font-black leading-none tracking-[-0.04em]">
            Import CSV
          </h3>
          <p className="mt-2 text-[11px] font-semibold leading-5 text-[#072116]/58">
            Upload a CSV, preview matches, then append or replace this portfolio.
          </p>
        </div>
      </div>

      <div className="mt-4">
        <Trading212CsvImport portfolioId={portfolioId} compact launcherOnly />
      </div>
    </div>
  );
}

type RawHoldingInput = {
  ticker: string;
  entry_price: number | null;
  score_at_entry: number | null;
  rank_at_entry: number | null;
  added_at: string;
  last_reviewed_at: string;
  shares: number | null;
  allocation_pct: number | null;
  purchase_date: string | null;
  source: string | null;
  notes: string | null;
};

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function buildPortfolioStructureHash({
  portfolio,
  holdings,
  transactions,
}: {
  portfolio: PortfolioRow;
  holdings: RawHoldingInput[];
  transactions: TransactionRow[];
}) {
  return hashPortfolioInputs({
    version: PORTFOLIO_SNAPSHOT_VERSION,
    portfolio,
    holdings,
    transactions,
  });
}

function repriceCachedHoldings({
  holdings,
  stockRows,
}: {
  holdings: ExtendedHolding[];
  stockRows: StockUniverseRow[];
}) {
  const marketByTicker = new Map(
    stockRows
      .filter((stock) => stock.ticker)
      .map((stock) => [String(stock.ticker).toUpperCase(), stock] as const),
  );
  const maxScore = Math.max(
    1,
    ...stockRows
      .map((stock) => toNumber(stock.score, 0))
      .filter((score) => Number.isFinite(score) && score > 0),
  );

  const repriced = holdings.map((holding) => {
    const market = marketByTicker.get(holding.ticker);
    const currentPrice = Math.max(
      0,
      toNumber(market?.price, toNumber(holding.currentPrice, 0)),
    );
    const shares = Math.max(0, toNumber(holding.shares, 0));
    const entryPrice = Math.max(0, toNumber(holding.entryPrice, currentPrice));
    const costBasis = entryPrice * shares;
    const currentValue = currentPrice * shares;
    const totalPnLDollars = currentValue - costBasis;
    const pnlDollars = currentPrice - entryPrice;
    const pnlPercent = entryPrice > 0 ? (pnlDollars / entryPrice) * 100 : 0;

    return {
      ...holding,
      company: market?.company ? String(market.company) : holding.company,
      sector: market?.sector ? String(market.sector) : holding.sector,
      rank: market?.rank == null ? holding.rank : Number(market.rank),
      score: market?.score == null ? holding.score : toNumber(market.score, holding.score),
      maxScore,
      currentPrice: round1(currentPrice),
      entryPrice: round1(entryPrice),
      shares,
      costBasis: round1(costBasis),
      currentValue: round1(currentValue),
      totalPnLDollars: round1(totalPnLDollars),
      pnlDollars: round1(pnlDollars),
      pnlPercent: round1(pnlPercent),
    };
  });

  const totalPortfolioValue = repriced.reduce((sum, holding) => sum + holding.currentValue, 0);
  return repriced.map((holding) => ({
    ...holding,
    currentAllocationPct:
      totalPortfolioValue > 0 ? round1((holding.currentValue / totalPortfolioValue) * 100) : 0,
  }));
}

async function buildPortfolioSnapshotPayload({
  activePortfolio,
  rawHoldings,
  transactions,
  stockUniverse,
  selectedPortfolioId,
  currency,
  cashDepositedTotal,
  ownerId,
  useAdminEnrichment = false,
}: {
  activePortfolio: PortfolioRow;
  rawHoldings: RawHoldingInput[];
  transactions: TransactionRow[];
  stockUniverse: StockLike[];
  selectedPortfolioId: string;
  currency: string;
  cashDepositedTotal: number;
  ownerId: string;
  useAdminEnrichment?: boolean;
}) {
  const newsData = (await getCachedPortfolioNews()) as BaseNewsArticle[];
  const portfolioTickerSet = new Set(rawHoldings.map((holding) => holding.ticker));
  const portfolioNews = buildPortfolioNews({
    newsData,
    stockUniverse,
    portfolioTickerSet,
  });
  const riskTolerance = (activePortfolio.risk_tolerance as RiskTolerance) ?? null;
  const enriched = useAdminEnrichment
    ? await enrichHoldingsAdmin(rawHoldings, riskTolerance)
    : await enrichHoldings(rawHoldings, riskTolerance);
  const summary = buildPortfolioHealthSummary({
    id: selectedPortfolioId,
    name: activePortfolio.name as string,
    currency,
    riskTolerance: activePortfolio.risk_tolerance,
    holdings: enriched,
    transactions: transactions.map((transaction) => ({ realisedPnl: transaction.realised_pnl })),
    cashBalance: toNumber(activePortfolio.cash_balance, 0),
    cashDepositedTotal,
  });
  const chartResult = await buildPortfolioPageChartResult({
    portfolio: {
      id: activePortfolio.id,
      name: activePortfolio.name,
      risk_tolerance: activePortfolio.risk_tolerance,
      time_horizon: activePortfolio.time_horizon,
      investment_amount: toNumber(activePortfolio.investment_amount, 0),
      cash_balance: toNumber(activePortfolio.cash_balance, 0),
      cash_deposited_total: cashDepositedTotal,
      currency,
      created_at: activePortfolio.created_at ?? null,
    },
    enriched,
    transactions,
    summary,
    ownerId,
  });

  return { enriched, summary, chartData: chartResult.chartData, chartMeta: chartResult.meta, portfolioNews };
}

async function schedulePortfolioSnapshotRefresh({
  portfolioId,
  ownerId,
  inputHash,
  activePortfolio,
  rawHoldings,
  transactions,
  stockUniverse,
  currency,
  cashDepositedTotal,
}: {
  portfolioId: string;
  ownerId: string;
  inputHash: string;
  activePortfolio: PortfolioRow;
  rawHoldings: RawHoldingInput[];
  transactions: TransactionRow[];
  stockUniverse: StockLike[];
  currency: string;
  cashDepositedTotal: number;
}) {
  const shouldRefresh = await tryStartPortfolioPageSnapshotRefresh({ portfolioId, ownerId });
  if (!shouldRefresh) return false;

  after(async () => {
    const startedAt = performance.now();
    try {
      const snapshot = await buildPortfolioSnapshotPayload({
        activePortfolio,
        rawHoldings,
        transactions,
        stockUniverse,
        selectedPortfolioId: portfolioId,
        currency,
        cashDepositedTotal,
        ownerId,
        useAdminEnrichment: true,
      });
      await savePortfolioPageSnapshot({
        portfolioId,
        ownerId,
        inputHash,
        snapshot,
      });
      console.info(
        `[portfolio-page-refresh] portfolioId=${portfolioId} holdings=${rawHoldings.length} transactions=${transactions.length} elapsedMs=${Math.round(performance.now() - startedAt)}`,
      );
    } catch (error) {
      console.warn("Portfolio page snapshot background refresh failed", error);
    }
  });

  return true;
}

function schedulePortfolioChartRepair({
  portfolioId,
  ownerId,
  chartMeta,
}: {
  portfolioId: string;
  ownerId: string;
  chartMeta: PortfolioChartMeta;
}) {
  if (!chartMeta.health.repairNeeded) return false;

  after(async () => {
    try {
      await repairPortfolioChartForPortfolio({
        portfolioId,
        userId: ownerId,
        reason: chartMeta.health.reason,
        includeHistorical: shouldRepairHistorical(
          chartMeta.health.status,
          chartMeta.health.reason,
        ),
        source: "portfolio-page",
      });
    } catch (error) {
      console.warn("Portfolio chart background repair failed", error);
    }
  });

  return true;
}

export default async function PortfolioPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const timer = startPortfolioTimer("portfolio-page");
  const params = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  timer.mark("auth");

  if (!user) redirect("/login");

  const showBuilder = params.builder === "1";

  const [stockOptionsData, { data: portfoliosData }, { data: profileCurrencyData }, usdFxRates] = await Promise.all([
    getCachedPortfolioStockUniverse(),
    supabase
      .from("user_portfolios")
      .select(
        "id, name, risk_tolerance, time_horizon, investment_amount, cash_balance, cash_deposited_total, currency, created_at",
      )
      .eq("user_id", user.id)
      .is("archived_at", null)
      .order("created_at", { ascending: true }),
    supabase
      .from("profiles")
      .select("preferred_currency")
      .eq("id", user.id)
      .maybeSingle(),
    getUsdFxRates(),
  ]);

  timer.mark("base-data");

  const stockRows = (stockOptionsData ?? []) as StockUniverseRow[];
  const displayCurrency = normaliseCurrency(
    (profileCurrencyData as ProfileCurrencyRow | null)?.preferred_currency,
  );
  const usdToDisplayRate = rateForCurrency(displayCurrency, usdFxRates);

  const stockUniverse: StockLike[] = stockRows
    .filter((stock) => stock.ticker)
    .map((stock) => ({
      ticker: String(stock.ticker).toUpperCase(),
      company: stock.company ? String(stock.company) : null,
      sector: stock.sector ? String(stock.sector) : null,
      rank: stock.rank == null ? null : Number(stock.rank),
      score: stock.score ?? null,
      price: stock.price ?? null,
    }));

  const stockOptions: StockOption[] = stockRows
    .filter((stock) => stock.ticker)
    .map((stock) => ({
      ticker: String(stock.ticker).toUpperCase(),
      company: stock.company ? String(stock.company) : null,
      sector: stock.sector ? String(stock.sector) : null,
      rank: stock.rank == null ? null : Number(stock.rank),
      price:
        stock.price == null || !Number.isFinite(Number(stock.price))
          ? null
          : Number(stock.price),
    }));
  const displayStockOptions = displayStockOptionsForCurrency({
    stockOptions,
    displayCurrency,
    usdFxRates,
  });

  const portfolios: PortfolioRow[] = ((portfoliosData ?? []) as PortfolioRow[]).map(
    (portfolio, index) => ({
      ...portfolio,
      name: cleanPortfolioName(portfolio.name, index),
      cash_balance: toNumber(portfolio.cash_balance, 0),
      cash_deposited_total: toNumber(
        portfolio.cash_deposited_total,
        toNumber(portfolio.investment_amount, 0),
      ),
      investment_amount: toNumber(portfolio.investment_amount, 0),
      currency: portfolio.currency ?? "USD",
    }),
  );

  if (showBuilder) {
    timer.end({ mode: "builder" });
    return (
      <AppShell activePath="/portfolio">
        <main className="h-full min-h-0 w-full max-w-full overflow-y-auto overflow-x-hidden pr-1">
          <div className="grid min-w-0 max-w-full gap-4 overflow-x-hidden">
            <PortfolioBuilder
              existingPortfolios={portfolios.map((portfolio) => ({
                id: portfolio.id,
                name: portfolio.name ?? "Portfolio",
              }))}
              stockOptions={displayStockOptions}
              displayCurrency={displayCurrency}
              usdToDisplayRate={usdToDisplayRate}
              initialMode={
                params.mode === "manual"
                  ? "manual"
                  : params.mode === "ai"
                    ? "ai"
                    : "choice"
              }
            />
          </div>
        </main>
      </AppShell>
    );
  }

  const selectedPortfolioId =
    params.portfolio && portfolios.some((portfolio) => portfolio.id === params.portfolio)
      ? params.portfolio
      : portfolios[0]?.id ?? null;

  if (!selectedPortfolioId) {
    timer.end({ mode: "empty" });
    return (
      <AppShell activePath="/portfolio">
        <main className="h-full min-h-0 w-full max-w-full overflow-y-auto overflow-x-hidden pr-1">
          <div className="grid min-w-0 max-w-full gap-4 overflow-x-hidden">
            <PortfolioBuilder
              existingPortfolios={[]}
              stockOptions={displayStockOptions}
              displayCurrency={displayCurrency}
              usdToDisplayRate={usdToDisplayRate}
            />
          </div>
        </main>
      </AppShell>
    );
  }

  const activePortfolio =
    portfolios.find((portfolio) => portfolio.id === selectedPortfolioId) ?? portfolios[0];

  const [{ data: holdingsData }, { data: transactionData }] = await Promise.all([
    supabase
      .from("portfolio_holdings")
      .select(
        "ticker, entry_price, score_at_entry, rank_at_entry, added_at, last_reviewed_at, shares, allocation_pct, purchase_date, source, notes",
      )
      .eq("portfolio_id", selectedPortfolioId)
      .order("added_at", { ascending: false }),

    supabase
      .from("portfolio_transactions")
      .select(
        "id, portfolio_id, ticker, type, shares, price, amount, realised_pnl, currency, notes, created_at",
      )
      .eq("portfolio_id", selectedPortfolioId)
      .order("created_at", { ascending: true })
      .limit(1000),
  ]);

  timer.mark("portfolio-rows");

  const rawHoldings: RawHoldingInput[] = ((holdingsData ?? []) as HoldingRow[])
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
      purchase_date: holding.purchase_date ?? null,
      source: holding.source ?? "manual",
      notes: holding.notes ?? null,
    }));

  const transactions = (transactionData ?? []) as TransactionRow[];
  const currency = activePortfolio.currency ?? "USD";
  const cashDepositedTotal = toNumber(
    activePortfolio.cash_deposited_total,
    toNumber(activePortfolio.investment_amount, 0),
  );

  const recentTransactions = [...transactions]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 40);
  const displayTransactions = displayTransactionsForCurrency({
    transactions: recentTransactions,
    displayCurrency,
    usdFxRates,
  });

  const portfolioTickerSet = new Set(rawHoldings.map((holding) => holding.ticker));
  const inputHash = buildPortfolioStructureHash({
    portfolio: activePortfolio,
    holdings: rawHoldings,
    transactions,
  });

  const snapshotLookup = await getPortfolioPageSnapshotWithFallback({
    portfolioId: selectedPortfolioId,
    ownerId: user.id,
    inputHash,
  });
  const cachedSnapshot = snapshotLookup.snapshot;

  const cachedEnriched = cachedSnapshot?.enriched as ExtendedHolding[] | undefined;
  const cachedPortfolioNews = cachedSnapshot?.portfolioNews as EnrichedNewsArticle[] | undefined;

  if (cachedEnriched && cachedPortfolioNews) {
    const canonicalEnriched = repriceCachedHoldings({ holdings: cachedEnriched, stockRows });
    const canonicalSummary = buildPortfolioHealthSummary({
      id: selectedPortfolioId,
      name: activePortfolio.name as string,
      currency,
      riskTolerance: activePortfolio.risk_tolerance,
      holdings: canonicalEnriched,
      transactions: transactions.map((transaction) => ({ realisedPnl: transaction.realised_pnl })),
      cashBalance: toNumber(activePortfolio.cash_balance, 0),
      cashDepositedTotal,
    });
    const displayEnriched = displayHoldingsForCurrency({
      holdings: canonicalEnriched,
      displayCurrency,
      usdFxRates,
    });
    const backgroundRefreshScheduled =
      snapshotLookup.mode === "stale"
        ? await schedulePortfolioSnapshotRefresh({
            portfolioId: selectedPortfolioId,
            ownerId: user.id,
            inputHash,
            activePortfolio,
            rawHoldings,
            transactions,
            stockUniverse,
            currency,
            cashDepositedTotal,
          })
        : false;
    const chartResult = await buildPortfolioPageChartResult({
      portfolio: {
        id: activePortfolio.id,
        name: activePortfolio.name,
        risk_tolerance: activePortfolio.risk_tolerance,
        time_horizon: activePortfolio.time_horizon,
        investment_amount: toNumber(activePortfolio.investment_amount, 0),
        cash_balance: toNumber(activePortfolio.cash_balance, 0),
        cash_deposited_total: cashDepositedTotal,
        currency,
        created_at: activePortfolio.created_at ?? null,
      },
      enriched: canonicalEnriched,
      transactions,
      summary: canonicalSummary,
      ownerId: user.id,
    });
    const displayChartData = displayChartForCurrency({
      chartData: chartResult.chartData,
      displayCurrency,
      usdFxRates,
    });
    const chartRepairScheduled = schedulePortfolioChartRepair({
      portfolioId: selectedPortfolioId,
      ownerId: user.id,
      chartMeta: chartResult.meta,
    });

    timer.end({
      cacheMode: snapshotLookup.mode,
      inputHashMatched: snapshotLookup.inputHashMatched,
      backgroundRefreshScheduled,
      chartRepairScheduled,
      holdings: rawHoldings.length,
      selectedPortfolioId,
    });
    return (
      <AppShell activePath="/portfolio">
        <main className="h-full min-h-0 w-full max-w-full overflow-y-auto overflow-x-visible pr-0 sm:overflow-x-hidden sm:pr-1">
          <div className="grid min-w-0 max-w-full gap-3 overflow-visible sm:overflow-x-hidden">
            {params.created === "manual" && (
              <PortfolioCreationSuccess portfolioId={selectedPortfolioId} />
            )}
            <div id="portfolio-check">
            <PortfolioCommandCentreRevolut
              portfolioId={selectedPortfolioId}
              portfolios={portfolios.map((portfolio, index) => ({
                id: portfolio.id,
                name: cleanPortfolioName(portfolio.name, index),
                currency: displayCurrency,
                createdAt: portfolio.created_at ?? null,
              }))}
              holdings={displayEnriched}
              stockOptions={displayStockOptions}
              transactions={displayTransactions.map((transaction): PortfolioTransaction => ({
                id: transaction.id,
                portfolioId: transaction.portfolio_id,
                ticker: transaction.ticker,
                type: transaction.type,
                shares: transaction.shares,
                price: transaction.price,
                amount: transaction.amount,
                realisedPnl: transaction.realised_pnl,
                currency: displayCurrency,
                notes: transaction.notes,
                createdAt: transaction.created_at,
              }))}
              newsArticles={cachedPortfolioNews}
              chartData={displayChartData}
              chartMeta={chartResult.meta}
              displayCurrency={displayCurrency}
              usdToDisplayRate={usdToDisplayRate}
              portfolioMeta={{
                id: selectedPortfolioId,
                name: activePortfolio.name as string,
                riskTolerance: activePortfolio.risk_tolerance as string | null,
                timeHorizon: activePortfolio.time_horizon as string | null,
                investmentAmount: displayNumber(activePortfolio.investment_amount, displayCurrency, usdFxRates),
                cashBalance: displayNumber(activePortfolio.cash_balance, displayCurrency, usdFxRates),
                cashDepositedTotal: displayNumber(cashDepositedTotal, displayCurrency, usdFxRates),
                currency: displayCurrency,
                createdAt: activePortfolio.created_at ?? null,
              }}
              compactImportWidget={<CompactImportLauncher portfolioId={selectedPortfolioId} />}
            />
            </div>
          </div>
        </main>
      </AppShell>
    );
  }

  const newsData = (await getCachedPortfolioNews()) as BaseNewsArticle[];
  const portfolioNews = buildPortfolioNews({
    newsData,
    stockUniverse,
    portfolioTickerSet,
  });

  timer.mark("news-filter");

  const riskTolerance = (activePortfolio.risk_tolerance as RiskTolerance) ?? null;
  const enriched = await enrichHoldings(rawHoldings, riskTolerance);

  timer.mark("enrich-holdings");

  const summary = buildPortfolioHealthSummary({
    id: selectedPortfolioId,
    name: activePortfolio.name as string,
    currency,
    riskTolerance: activePortfolio.risk_tolerance,
    holdings: enriched,
    transactions: transactions.map((transaction) => ({ realisedPnl: transaction.realised_pnl })),
    cashBalance: toNumber(activePortfolio.cash_balance, 0),
    cashDepositedTotal,
  });
  const chartResult = await buildPortfolioPageChartResult({
    portfolio: {
      id: activePortfolio.id,
      name: activePortfolio.name,
      risk_tolerance: activePortfolio.risk_tolerance,
      time_horizon: activePortfolio.time_horizon,
      investment_amount: toNumber(activePortfolio.investment_amount, 0),
      cash_balance: toNumber(activePortfolio.cash_balance, 0),
      cash_deposited_total: cashDepositedTotal,
      currency,
      created_at: activePortfolio.created_at ?? null,
    },
    enriched,
    transactions,
    summary,
    ownerId: user.id,
  });
  const chartRepairScheduled = schedulePortfolioChartRepair({
    portfolioId: selectedPortfolioId,
    ownerId: user.id,
    chartMeta: chartResult.meta,
  });
  const displayEnriched = displayHoldingsForCurrency({
    holdings: enriched,
    displayCurrency,
    usdFxRates,
  });
  const displayChartData = displayChartForCurrency({
    chartData: chartResult.chartData,
    displayCurrency,
    usdFxRates,
  });

  timer.mark("portfolio-chart");

  after(() =>
    savePortfolioPageSnapshot({
      portfolioId: selectedPortfolioId,
      ownerId: user.id,
      inputHash,
      snapshot: {
        enriched,
        summary,
        chartData: chartResult.chartData,
        chartMeta: chartResult.meta,
        portfolioNews,
      },
    }),
  );

  timer.end({
    cacheMode: "miss",
    backgroundRefreshScheduled: true,
    chartRepairScheduled,
    holdings: rawHoldings.length,
    selectedPortfolioId,
  });

  return (
    <AppShell activePath="/portfolio">
      <main className="h-full min-h-0 w-full max-w-full overflow-y-auto overflow-x-visible pr-0 sm:overflow-x-hidden sm:pr-1">
        <div className="grid min-w-0 max-w-full gap-3 overflow-visible sm:overflow-x-hidden">
          {params.created === "manual" && (
            <PortfolioCreationSuccess portfolioId={selectedPortfolioId} />
          )}
          <div id="portfolio-check">
          <PortfolioCommandCentreRevolut
            portfolioId={selectedPortfolioId}
            portfolios={portfolios.map((portfolio, index) => ({
              id: portfolio.id,
              name: cleanPortfolioName(portfolio.name, index),
              currency: displayCurrency,
              createdAt: portfolio.created_at ?? null,
            }))}
            holdings={displayEnriched}
            stockOptions={displayStockOptions}
            transactions={displayTransactions.map((transaction) => ({
              id: transaction.id,
              portfolioId: transaction.portfolio_id,
              ticker: transaction.ticker,
              type: transaction.type,
              shares: transaction.shares,
              price: transaction.price,
              amount: transaction.amount,
              realisedPnl: transaction.realised_pnl,
              currency: displayCurrency,
              notes: transaction.notes,
              createdAt: transaction.created_at,
            }))}
            newsArticles={portfolioNews}
            chartData={displayChartData}
            chartMeta={chartResult.meta}
            displayCurrency={displayCurrency}
            usdToDisplayRate={usdToDisplayRate}
            portfolioMeta={{
              id: selectedPortfolioId,
              name: activePortfolio.name as string,
              riskTolerance: activePortfolio.risk_tolerance as string | null,
              timeHorizon: activePortfolio.time_horizon as string | null,
              investmentAmount: displayNumber(activePortfolio.investment_amount, displayCurrency, usdFxRates),
              cashBalance: displayNumber(activePortfolio.cash_balance, displayCurrency, usdFxRates),
              cashDepositedTotal: displayNumber(cashDepositedTotal, displayCurrency, usdFxRates),
              currency: displayCurrency,
              createdAt: activePortfolio.created_at ?? null,
            }}
            compactImportWidget={<CompactImportLauncher portfolioId={selectedPortfolioId} />}
          />
          </div>
        </div>
      </main>
    </AppShell>
  );
}
