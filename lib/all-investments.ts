import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { loadCurrentPortfolioIntelligenceFromClient } from "@/lib/current-portfolio-intelligence";
import { loadConnectedPortfolioIntelligence } from "@/lib/connected-portfolio-intelligence";
import { assessPortfolioIntelligence, type HoldingIntelligenceInput } from "@/lib/portfolio-intelligence";
import { buildPortfolioIntelligenceView } from "@/lib/portfolio-intelligence-presentation";

export type AllInvestmentsPortfolio = {
  id: string;
  name: string;
  source: "manual" | "connected";
};

export async function loadAllInvestments(
  supabase: SupabaseClient<Database>,
  userId: string,
  portfolios: AllInvestmentsPortfolio[],
  asOf: string,
) {
  const sources = [] as Array<{
    id: string;
    name: string;
    source: "manual" | "connected";
    valueUsd: number | null;
    cashUsd: number | null;
    holdingCount: number;
  }>;
  const holdings: HoldingIntelligenceInput[] = [];
  const limitations = new Set<string>(["canonical_event_severity_source_unmapped"]);
  let cashValue = 0;
  let allCashKnown = true;

  for (const portfolio of portfolios) {
    if (portfolio.source === "connected") {
      const result = await loadConnectedPortfolioIntelligence(supabase, portfolio.id, asOf);
      if (!result) continue;
      result.input.holdings.forEach((holding) => holdings.push({
        ...holding,
        instrumentKey: `${portfolio.id}:${holding.instrumentKey}`,
      }));
      if (result.cashValueUsd == null) allCashKnown = false;
      else cashValue += result.cashValueUsd;
      result.adapterLimitations.forEach((limitation) => limitations.add(limitation));
      sources.push({ id: portfolio.id, name: portfolio.name, source: portfolio.source, valueUsd: result.totalValueUsd, cashUsd: result.cashValueUsd, holdingCount: result.positions.length });
    } else {
      const result = await loadCurrentPortfolioIntelligenceFromClient({ supabase, userId, portfolioId: portfolio.id, asOf });
      if (result.status !== "ready") continue;
      result.input.holdings.forEach((holding) => holdings.push({
        ...holding,
        instrumentKey: `${portfolio.id}:${holding.instrumentKey}`,
      }));
      cashValue += result.input.portfolio.cashValue;
      result.adapterLimitations.forEach((limitation) => limitations.add(limitation));
      sources.push({ id: portfolio.id, name: portfolio.name, source: portfolio.source, valueUsd: result.assessment.portfolio.valuation.totalValue, cashUsd: result.input.portfolio.cashValue, holdingCount: result.input.holdings.length });
    }
  }

  const input = {
    asOf,
    portfolio: { id: "all-investments", riskTolerance: null, objective: null, timeHorizon: null, cashValue: allCashKnown ? cashValue : 0 },
    holdings: allCashKnown ? holdings : holdings.map((holding) => ({ ...holding, currentValue: null })),
  };
  const assessment = assessPortfolioIntelligence(input);
  const totalValueUsd = sources.every((source) => source.valueUsd != null)
    ? sources.reduce((sum, source) => sum + (source.valueUsd ?? 0), 0)
    : null;
  if (!allCashKnown) limitations.add("all_investments_cash_incomplete");
  if (totalValueUsd == null) limitations.add("all_investments_valuation_incomplete");
  return {
    input,
    assessment,
    intelligence: buildPortfolioIntelligenceView({ result: assessment, adapterLimitations: [...limitations] }),
    sources,
    totalValueUsd,
    cashValueUsd: allCashKnown ? cashValue : null,
    adapterLimitations: [...limitations],
  };
}
