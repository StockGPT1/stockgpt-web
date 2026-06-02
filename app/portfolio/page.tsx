import type { Metadata } from "next";
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
    "Track your portfolio with StockGPT AI alerts, ranking changes, risk levels and market research insights.",
};

function PortfolioImportPanel() {
  return (
    <div className="grid min-w-0 gap-4">
      <Trading212CsvImport />
    </div>
  );
}

export default async function PortfolioPage({
  searchParams,
}: {
  searchParams: Promise<{ builder?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const showBuilder = params.builder === "1";

  const { data: stockOptionsData } = await supabase
    .from("stock_rankings")
    .select("ticker, company, sector, rank")
    .order("rank", { ascending: true })
    .limit(500);

  const stockOptions = (stockOptionsData ?? [])
    .filter((stock) => stock.ticker)
    .map((stock) => ({
      ticker: String(stock.ticker),
      company: stock.company ? String(stock.company) : null,
      sector: stock.sector ? String(stock.sector) : null,
      rank: stock.rank == null ? null : Number(stock.rank),
    }));

  if (showBuilder) {
    return (
      <AppShell activePath="/portfolio">
        <main className="h-full min-h-0 overflow-y-auto pr-1">
          <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_430px]">
            <PortfolioBuilder />

            <div className="min-w-0 xl:sticky xl:top-4 xl:self-start">
              <PortfolioImportPanel />
            </div>
          </div>
        </main>
      </AppShell>
    );
  }

  const { data: savedPortfolio } = await supabase
    .from("user_portfolios")
    .select(
      "id, name, risk_tolerance, time_horizon, investment_amount, cash_balance, cash_deposited_total",
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (!savedPortfolio) {
    return (
      <AppShell activePath="/portfolio">
        <main className="h-full min-h-0 overflow-y-auto pr-1">
          <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_430px]">
            <PortfolioBuilder />

            <div className="min-w-0 xl:sticky xl:top-4 xl:self-start">
              <PortfolioImportPanel />
            </div>
          </div>
        </main>
      </AppShell>
    );
  }

  const { data: holdingsData } = await supabase
    .from("portfolio_holdings")
    .select(
      "ticker, entry_price, score_at_entry, rank_at_entry, added_at, last_reviewed_at, shares, allocation_pct",
    )
    .eq("portfolio_id", savedPortfolio.id)
    .order("added_at", { ascending: false });

  const riskTolerance = (savedPortfolio.risk_tolerance as RiskTolerance) ?? null;

  const enriched = await enrichHoldings(
    (holdingsData ?? []).map((holding) => ({
      ticker: holding.ticker as string,
      entry_price: holding.entry_price as number | null,
      score_at_entry: holding.score_at_entry as number | null,
      rank_at_entry: holding.rank_at_entry as number | null,
      shares: holding.shares as number | null,
      allocation_pct: holding.allocation_pct as number | null,
      added_at: holding.added_at as string,
      last_reviewed_at: holding.last_reviewed_at as string,
    })),
    riskTolerance,
  );

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

  const replacements = Object.fromEntries(
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
                ? `${candidate.ticker} is the strongest available ${candidate.sector} replacement not already in your portfolio, ranked #${candidate.rank ?? "—"}. It keeps sector exposure similar while upgrading model conviction.`
                : `${candidate.ticker} is the strongest available replacement not already in your portfolio, ranked #${candidate.rank ?? "—"}. It improves overall portfolio quality without adding to the weakened position.`,
            }
          : null,
      ];
    }),
  );

  return (
    <AppShell activePath="/portfolio">
      <main className="h-full min-h-0 overflow-y-auto pr-1">
        <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_430px]">
          <SavedPortfolio
            holdings={enriched}
            stockOptions={stockOptions}
            portfolioMeta={{
              name: savedPortfolio.name as string,
              riskTolerance: savedPortfolio.risk_tolerance as string | null,
              timeHorizon: savedPortfolio.time_horizon as string | null,
              investmentAmount: savedPortfolio.investment_amount as number | null,
              cashBalance: Number(savedPortfolio.cash_balance ?? 0),
              cashDepositedTotal: Number(
                savedPortfolio.cash_deposited_total ??
                  savedPortfolio.investment_amount ??
                  0,
              ),
            }}
            replacements={replacements}
          />

          <div className="min-w-0 xl:sticky xl:top-4 xl:self-start">
            <PortfolioImportPanel />
          </div>
        </div>
      </main>
    </AppShell>
  );
}
