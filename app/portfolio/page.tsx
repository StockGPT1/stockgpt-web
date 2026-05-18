import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { ManualPortfolioEntry } from "@/components/ManualPortfolioEntry";
import { PortfolioBuilder } from "@/components/PortfolioBuilder";
import { SavedPortfolio } from "@/components/SavedPortfolio";
import { createClient } from "@/utils/supabase/server";
import { enrichHoldings, type RiskTolerance } from "@/lib/portfolio-alerts";

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

  if (showBuilder) {
    return (
      <AppShell activePath="/portfolio">
        <main className="h-full min-h-0 overflow-y-auto pr-1">
          <div className="grid gap-4">
            <PortfolioBuilder />
            <ManualPortfolioEntry isAuthenticated={true} />
          </div>
        </main>
      </AppShell>
    );
  }

  const { data: savedPortfolio } = await supabase
    .from("user_portfolios")
    .select("id, name, risk_tolerance, time_horizon, investment_amount")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!savedPortfolio) {
    return (
      <AppShell activePath="/portfolio">
        <main className="h-full min-h-0 overflow-y-auto pr-1">
          <div className="grid gap-4">
            <div className="relative overflow-hidden rounded-3xl border border-[#ddb159]/25 bg-[linear-gradient(160deg,#0d3420,#082519)] px-5 py-5 shadow-[0_16px_40px_rgba(0,0,0,0.3)] sm:px-6 sm:py-6">
              <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-[#ddb159]/10 blur-3xl" />

              <div className="relative">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#ddb159]">
                  ✦ Portfolio
                </p>

                <h1 className="mt-1 text-[30px] font-black leading-[1.05] tracking-[-0.04em] text-[#faf6f0] sm:text-[34px]">
                  Generate with AI or add your holdings manually.
                </h1>

                <p className="mt-2 max-w-2xl text-[13px] font-medium text-[#faf6f0]/60 sm:text-[14px]">
                  Use the AI builder to create a portfolio, or enter your real
                  holdings so StockGPT can track value, AI score movement,
                  rank changes and alerts.
                </p>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_430px]">
              <PortfolioBuilder />

              <div className="xl:sticky xl:top-4 xl:self-start">
                <ManualPortfolioEntry isAuthenticated={true} />
              </div>
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

  return (
    <AppShell activePath="/portfolio">
      <main className="h-full min-h-0 overflow-y-auto pr-1">
        <SavedPortfolio
          holdings={enriched}
          portfolioMeta={{
            name: savedPortfolio.name as string,
            riskTolerance: savedPortfolio.risk_tolerance as string | null,
            timeHorizon: savedPortfolio.time_horizon as string | null,
            investmentAmount: savedPortfolio.investment_amount as number | null,
          }}
        />
      </main>
    </AppShell>
  );
}
