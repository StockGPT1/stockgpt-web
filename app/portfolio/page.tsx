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
import { createClient } from "@/utils/supabase/server";
import { enrichHoldings, enrichHoldingsAdmin, type RiskTolerance } from "@/lib/portfolio-alerts";
import { buildPortfolioHealthSummary } from "@/lib/portfolio-health";
import { buildPortfolioPageChart } from "@/lib/portfolio-page-chart";
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

export const metadata: Metadata = {
  title: "Portfolio Tracker | StockGPT AI Alerts",
  description:
    "Track portfolios with StockGPT AI alerts, portfolio health, holdings, imports, cash, transactions and market research insights.",
};

const PORTFOLIO_SNAPSHOT_VERSION = "portfolio-fast-v10";

type SearchParams = {
  builder?: string;
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

function toNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
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
  const chartData = await buildPortfolioPageChart({
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

  return { enriched, summary, chartData, portfolioNews };
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

  const [stockOptionsData, { data: portfoliosData }] = await Promise.all([
    getCachedPortfolioStockUniverse(),
    supabase
      .from("user_portfolios")
      .select(
        "id, name, risk_tolerance, time_horizon, investment_amount, cash_balance, cash_deposited_total, currency, created_at",
      )
      .eq("user_id", user.id)
      .is("archived_at", null)
      .order("created_at", { ascending: true }),
  ]);

  timer.mark("base-data");

  const stockRows = (stockOptionsData ?? []) as StockUniverseRow[];

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
            <PortfolioBuilder existingPortfolios={[]} />
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

  const displayTransactions = [...transactions]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 40);

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
    const displayEnriched = repriceCachedHoldings({ holdings: cachedEnriched, stockRows });
    const displaySummary = buildPortfolioHealthSummary({
      id: selectedPortfolioId,
      name: activePortfolio.name as string,
      currency,
      riskTolerance: activePortfolio.risk_tolerance,
      holdings: displayEnriched,
      transactions: transactions.map((transaction) => ({ realisedPnl: transaction.realised_pnl })),
      cashBalance: toNumber(activePortfolio.cash_balance, 0),
      cashDepositedTotal,
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
    const chartData = await buildPortfolioPageChart({
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
      enriched: displayEnriched,
      transactions,
      summary: displaySummary,
      ownerId: user.id,
    });

    timer.end({
      cacheMode: snapshotLookup.mode,
      inputHashMatched: snapshotLookup.inputHashMatched,
      backgroundRefreshScheduled,
      holdings: rawHoldings.length,
      selectedPortfolioId,
    });
    return (
      <AppShell activePath="/portfolio">
        <main className="h-full min-h-0 w-full max-w-full overflow-y-auto overflow-x-visible pr-0 sm:overflow-x-hidden sm:pr-1">
          <div className="grid min-w-0 max-w-full gap-3 overflow-visible sm:overflow-x-hidden">
            <PortfolioCommandCentreRevolut
              portfolioId={selectedPortfolioId}
              portfolios={portfolios.map((portfolio, index) => ({
                id: portfolio.id,
                name: cleanPortfolioName(portfolio.name, index),
                currency: portfolio.currency ?? "USD",
                createdAt: portfolio.created_at ?? null,
              }))}
              holdings={displayEnriched}
              stockOptions={stockOptions}
              transactions={displayTransactions.map((transaction): PortfolioTransaction => ({
                id: transaction.id,
                portfolioId: transaction.portfolio_id,
                ticker: transaction.ticker,
                type: transaction.type,
                shares: transaction.shares,
                price: transaction.price,
                amount: transaction.amount,
                realisedPnl: transaction.realised_pnl,
                currency: transaction.currency ?? "USD",
                notes: transaction.notes,
                createdAt: transaction.created_at,
              }))}
              newsArticles={cachedPortfolioNews}
              chartData={chartData}
              portfolioMeta={{
                id: selectedPortfolioId,
                name: activePortfolio.name as string,
                riskTolerance: activePortfolio.risk_tolerance as string | null,
                timeHorizon: activePortfolio.time_horizon as string | null,
                investmentAmount: toNumber(activePortfolio.investment_amount, 0),
                cashBalance: toNumber(activePortfolio.cash_balance, 0),
                cashDepositedTotal,
                currency,
                createdAt: activePortfolio.created_at ?? null,
              }}
              compactImportWidget={<CompactImportLauncher portfolioId={selectedPortfolioId} />}
            />
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
  const chartData = await buildPortfolioPageChart({
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

  timer.mark("portfolio-chart");

  after(() =>
    savePortfolioPageSnapshot({
      portfolioId: selectedPortfolioId,
      ownerId: user.id,
      inputHash,
      snapshot: {
        enriched,
        summary,
        chartData,
        portfolioNews,
      },
    }),
  );

  timer.end({
    cacheMode: "miss",
    backgroundRefreshScheduled: true,
    holdings: rawHoldings.length,
    selectedPortfolioId,
  });

  return (
    <AppShell activePath="/portfolio">
      <main className="h-full min-h-0 w-full max-w-full overflow-y-auto overflow-x-visible pr-0 sm:overflow-x-hidden sm:pr-1">
        <div className="grid min-w-0 max-w-full gap-3 overflow-visible sm:overflow-x-hidden">
          <PortfolioCommandCentreRevolut
            portfolioId={selectedPortfolioId}
            portfolios={portfolios.map((portfolio, index) => ({
              id: portfolio.id,
              name: cleanPortfolioName(portfolio.name, index),
              currency: portfolio.currency ?? "USD",
              createdAt: portfolio.created_at ?? null,
            }))}
            holdings={enriched}
            stockOptions={stockOptions}
            transactions={displayTransactions.map((transaction) => ({
              id: transaction.id,
              portfolioId: transaction.portfolio_id,
              ticker: transaction.ticker,
              type: transaction.type,
              shares: transaction.shares,
              price: transaction.price,
              amount: transaction.amount,
              realisedPnl: transaction.realised_pnl,
              currency: transaction.currency ?? "USD",
              notes: transaction.notes,
              createdAt: transaction.created_at,
            }))}
            newsArticles={portfolioNews}
            chartData={chartData}
            portfolioMeta={{
              id: selectedPortfolioId,
              name: activePortfolio.name as string,
              riskTolerance: activePortfolio.risk_tolerance as string | null,
              timeHorizon: activePortfolio.time_horizon as string | null,
              investmentAmount: toNumber(activePortfolio.investment_amount, 0),
              cashBalance: toNumber(activePortfolio.cash_balance, 0),
              cashDepositedTotal,
              currency,
              createdAt: activePortfolio.created_at ?? null,
            }}
            compactImportWidget={<CompactImportLauncher portfolioId={selectedPortfolioId} />}
          />
        </div>
      </main>
    </AppShell>
  );
}
