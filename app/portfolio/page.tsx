import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { PortfolioBuilder } from "@/components/PortfolioBuilder";
import { SavedPortfolio } from "@/components/SavedPortfolio";
import { Trading212CsvImport } from "@/components/Trading212CsvImport";
import { createClient } from "@/utils/supabase/server";
import { enrichHoldings, type RiskTolerance } from "@/lib/portfolio-alerts";

export const metadata: Metadata = {
  title: "Portfolio Tracker | StockGPT AI Alerts",
  description:
    "Track multiple portfolios with StockGPT AI alerts, ranking changes, risk levels, cash, transactions and market research insights.",
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

type ReplacementRecommendation = {
  ticker: string;
  company: string;
  sector: string;
  rank: number | null;
  score: number | null;
  price: number | null;
  reason: string;
};

function toNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function cleanPortfolioName(name: string | null | undefined, index: number) {
  const cleaned = String(name ?? "").trim();
  return cleaned || `Portfolio ${index + 1}`;
}

function PortfolioSelector({
  portfolios,
  activePortfolioId,
}: {
  portfolios: Array<{
    id: string;
    name: string;
    valueLabel: string;
    holdingsLabel: string;
  }>;
  activePortfolioId: string | null;
}) {
  if (portfolios.length === 0) return null;

  return (
    <div className="min-w-0 rounded-3xl border border-[#ddb159]/22 bg-[#061b12]/72 p-3 shadow-[0_14px_36px_rgba(0,0,0,0.22)] backdrop-blur sm:p-4">
      <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#ddb159] sm:text-[10px]">
            Portfolio selector
          </p>
          <h2 className="mt-1 text-[22px] font-black leading-none tracking-[-0.04em] text-[#faf6f0] sm:text-[26px]">
            Choose which portfolio to view.
          </h2>
          <p className="mt-1.5 text-[12px] font-semibold leading-5 text-[#faf6f0]/52">
            Existing portfolios are preserved. New AI portfolios are added
            separately rather than replacing your current one.
          </p>
        </div>

        <Link
          href="/portfolio?builder=1"
          className="inline-flex h-10 shrink-0 items-center justify-center rounded-full bg-[#ddb159] px-4 text-[11px] font-black uppercase tracking-[0.12em] text-[#072116] transition hover:brightness-105 sm:px-5"
        >
          + Build new AI portfolio
        </Link>
      </div>

      <div className="mt-4 grid min-w-0 gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {portfolios.map((portfolio) => {
          const active = portfolio.id === activePortfolioId;

          return (
            <Link
              key={portfolio.id}
              href={`/portfolio?portfolio=${portfolio.id}`}
              className={[
                "min-w-0 rounded-2xl border px-3 py-3 transition",
                active
                  ? "border-[#ddb159] bg-[#ddb159]/12 shadow-[0_0_0_1px_rgba(221,177,89,0.18)]"
                  : "border-[#ddb159]/14 bg-[#04180f]/70 hover:border-[#ddb159]/42 hover:bg-[#ddb159]/8",
              ].join(" ")}
            >
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-black tracking-[-0.02em] text-[#faf6f0]">
                    {portfolio.name}
                  </p>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[#faf6f0]/42">
                    {portfolio.holdingsLabel}
                  </p>
                </div>

                {active && (
                  <span className="shrink-0 rounded-full bg-[#ddb159] px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.08em] text-[#072116]">
                    Active
                  </span>
                )}
              </div>

              <p className="mt-3 text-[20px] font-black tabular-nums tracking-[-0.04em] text-[#ddb159]">
                {portfolio.valueLabel}
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
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
            Upload a CSV, preview matches, then append or replace this
            portfolio.
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
      .order("created_at", { ascending: false })
      .limit(40),
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

  const heldTickers = new Set(enriched.map((holding) => holding.ticker));
  const needsReplacement = enriched.filter((holding) =>
    holding.actionAlerts.some(
      (alert) => alert.action === "sell" || alert.action === "trim",
    ),
  );

  const { data: candidateData } =
    needsReplacement.length > 0
      ? await supabase
          .from("stock_rankings")
          .select("ticker, company, sector, rank, score, price")
          .order("rank", { ascending: true })
          .limit(80)
      : { data: [] };

  const replacementCandidates = (
    (candidateData ?? []) as Array<{
      ticker: string | null;
      company: string | null;
      sector: string | null;
      rank: number | null;
      score: number | null;
      price: number | null;
    }>
  ).filter((candidate) => candidate.ticker && !heldTickers.has(candidate.ticker));

  const replacements: Record<string, ReplacementRecommendation | null> = Object.fromEntries(
    needsReplacement.map((holding) => {
      const sameSector = replacementCandidates.find(
        (candidate) => candidate.sector && candidate.sector === holding.sector,
      );
      const candidate = sameSector ?? replacementCandidates[0] ?? null;

      return [
        holding.ticker,
        candidate
          ? {
              ticker: candidate.ticker as string,
              company: candidate.company ?? candidate.ticker ?? "—",
              sector: candidate.sector ?? "—",
              rank: Number(candidate.rank) || null,
              score: Number(candidate.score) || null,
              price: Number(candidate.price) || null,
              reason: sameSector
                ? `${candidate.ticker} is the strongest available ${candidate.sector} replacement not already in this portfolio, ranked #${candidate.rank ?? "—"}. It keeps sector exposure similar while upgrading model conviction.`
                : `${candidate.ticker} is the strongest available replacement not already in this portfolio, ranked #${candidate.rank ?? "—"}. It improves overall portfolio quality without adding to the weakened position.`,
            }
          : null,
      ];
    }),
  );

  const holdingsValue = enriched.reduce(
    (sum, holding) => sum + Number(holding.currentValue ?? 0),
    0,
  );

  const selectorPortfolios = portfolios.map((portfolio, index) => {
    const isActive = portfolio.id === selectedPortfolioId;
    const value = isActive
      ? holdingsValue + toNumber(portfolio.cash_balance, 0)
      : toNumber(portfolio.cash_balance, 0) +
        toNumber(portfolio.investment_amount, 0);

    return {
      id: portfolio.id,
      name: cleanPortfolioName(portfolio.name, index),
      valueLabel: `$${Math.round(value).toLocaleString()}`,
      holdingsLabel: isActive
        ? `${enriched.length} ${enriched.length === 1 ? "holding" : "holdings"}`
        : "Open portfolio",
    };
  });

  return (
    <AppShell activePath="/portfolio">
      <main className="h-full min-h-0 w-full max-w-full overflow-y-auto overflow-x-hidden pr-1">
        <div className="grid min-w-0 max-w-full gap-4 overflow-x-hidden">
          <PortfolioSelector
            portfolios={selectorPortfolios}
            activePortfolioId={selectedPortfolioId}
          />

          <SavedPortfolio
            portfolioId={selectedPortfolioId}
            portfolios={portfolios.map((portfolio, index) => ({
              id: portfolio.id,
              name: cleanPortfolioName(portfolio.name, index),
              currency: portfolio.currency ?? "USD",
              createdAt: portfolio.created_at ?? null,
            }))}
            holdings={enriched}
            stockOptions={stockOptions}
            transactions={((transactionData ?? []) as TransactionRow[]).map(
              (transaction) => ({
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
              }),
            )}
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
              currency: activePortfolio.currency ?? "USD",
            }}
            replacements={replacements}
            compactImportWidget={<CompactImportLauncher portfolioId={selectedPortfolioId} />}
          />
        </div>
      </main>
    </AppShell>
  );
}
