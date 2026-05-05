import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { PortfolioBuilder } from "@/components/PortfolioBuilder";
import { SavedPortfolio } from "@/components/SavedPortfolio";
import { createClient } from "@/utils/supabase/server";
import { enrichHoldings } from "@/lib/portfolio-alerts";

export default async function PortfolioPage({
  searchParams,
}: {
  searchParams: Promise<{ builder?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (params.builder === "1") {
    return (
      <AppShell activePath="/portfolio">
        <main className="h-full min-h-0 overflow-y-auto pr-1">
          <PortfolioBuilder />
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
          <PortfolioBuilder />
        </main>
      </AppShell>
    );
  }

  // ✦ Now also fetching shares and allocation_pct
  const { data: holdingsData } = await supabase
    .from("portfolio_holdings")
    .select("ticker, entry_price, score_at_entry, rank_at_entry, added_at, last_reviewed_at, shares, allocation_pct")
    .eq("portfolio_id", savedPortfolio.id)
    .order("added_at", { ascending: false });

  const enriched = await enrichHoldings(
    (holdingsData ?? []).map((h) => ({
      ticker: h.ticker as string,
      entry_price: h.entry_price as number | null,
      score_at_entry: h.score_at_entry as number | null,
      rank_at_entry: h.rank_at_entry as number | null,
      shares: h.shares as number | null,
      allocation_pct: h.allocation_pct as number | null,
      added_at: h.added_at as string,
      last_reviewed_at: h.last_reviewed_at as string,
    }))
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
