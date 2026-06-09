import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { PortfolioBuilder } from "@/components/PortfolioBuilder";
import { PortfolioCommandCentreRevolut } from "@/components/PortfolioCommandCentreRevolut";
import { Trading212CsvImport } from "@/components/Trading212CsvImport";
import { createClient } from "@/utils/supabase/server";
import { enrichHoldings, type RiskTolerance } from "@/lib/portfolio-alerts";
import { buildPortfolioHealthSummary } from "@/lib/portfolio-health";
import { buildPortfolioPageChart } from "@/lib/portfolio-page-chart";

export const metadata: Metadata = {
  title: "Portfolio Tracker | StockGPT AI Alerts",
  description:
    "Track portfolios with StockGPT AI alerts, portfolio health, holdings, imports, cash, transactions and market research insights.",
};

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

export default async function PortfolioPage({
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

  const showBuilder = params.builder === "1";

  const [{ data: stockOptionsData }, { data: portfoliosData }] = await Promise.all([
    supabase
      .from("stock_rankings")
      .select("ticker, company, sector, rank, price")
      .order("rank", { ascending: true })
      .limit(500),

    supabase
      .from("user_portfolios")
      .select(
        "id, name, risk_tolerance, time_horizon, investment_amount, cash_balance, cash_deposited_total, currency, created_at",
      )
      .eq("user_id", user.id)
      .is("archived_at", null)
      .order("created_at", { ascending: true }),
  ]);

  const stockOptions: StockOption[] = (stockOptionsData ?? [])
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

  const rawHoldings = ((holdingsData ?? []) as HoldingRow[])
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

  const riskTolerance = (activePortfolio.risk_tolerance as RiskTolerance) ?? null;
  const enriched = await enrichHoldings(rawHoldings, riskTolerance);
  const transactions = (transactionData ?? []) as TransactionRow[];
  const currency = activePortfolio.currency ?? "USD";
  const summary = buildPortfolioHealthSummary({
    id: selectedPortfolioId,
    name: activePortfolio.name as string,
    currency,
    riskTolerance: activePortfolio.risk_tolerance,
    holdings: enriched,
    transactions: transactions.map((transaction) => ({ realisedPnl: transaction.realised_pnl })),
    cashBalance: toNumber(activePortfolio.cash_balance, 0),
    cashDepositedTotal: toNumber(
      activePortfolio.cash_deposited_total,
      toNumber(activePortfolio.investment_amount, 0),
    ),
  });
  const chartData = await buildPortfolioPageChart({
    portfolio: activePortfolio,
    enriched,
    transactions,
    summary,
  });

  const displayTransactions = [...transactions]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 40);

  return (
    <AppShell activePath="/portfolio">
      <main className="h-full min-h-0 w-full max-w-full overflow-y-auto overflow-x-hidden pr-1">
        <div className="grid min-w-0 max-w-full gap-3 overflow-x-hidden">
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
            chartData={chartData}
            portfolioMeta={{
              id: selectedPortfolioId,
              name: activePortfolio.name as string,
              riskTolerance: activePortfolio.risk_tolerance as string | null,
              timeHorizon: activePortfolio.time_horizon as string | null,
              investmentAmount: toNumber(activePortfolio.investment_amount, 0),
              cashBalance: toNumber(activePortfolio.cash_balance, 0),
              cashDepositedTotal: toNumber(
                activePortfolio.cash_deposited_total,
                toNumber(activePortfolio.investment_amount, 0),
              ),
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
