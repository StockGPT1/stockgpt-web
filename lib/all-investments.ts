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

export type AllInvestmentsSourceFacts = AllInvestmentsPortfolio & {
  availability: "ready" | "unavailable";
  valueUsd: number | null;
  cashUsd: number | null;
  holdingCount: number | null;
  holdings: HoldingIntelligenceInput[];
  limitations: string[];
};

export function buildAllInvestmentsFromSources(
  sourceFacts: AllInvestmentsSourceFacts[],
  asOf: string,
) {
  const limitations = new Set<string>(["canonical_event_severity_source_unmapped"]);
  const holdings: HoldingIntelligenceInput[] = [];
  let cashValue = 0;
  let allCashKnown = true;
  let allValuesKnown = true;

  for (const source of sourceFacts) {
    source.limitations.forEach((limitation) => limitations.add(limitation));
    if (source.availability === "unavailable") {
      limitations.add(`all_investments_source_unavailable:${source.id}`);
    }
    if (source.cashUsd == null) allCashKnown = false;
    else cashValue += source.cashUsd;
    if (source.valueUsd == null) allValuesKnown = false;
    source.holdings.forEach((holding) => holdings.push({
      ...holding,
      instrumentKey: `${source.id}:${holding.instrumentKey}`,
    }));
  }

  const aggregateComplete = allCashKnown && allValuesKnown;
  const input = {
    asOf,
    portfolio: { id: "all-investments", riskTolerance: null, objective: null, timeHorizon: null, cashValue: allCashKnown ? cashValue : 0 },
    holdings: aggregateComplete ? holdings : holdings.map((holding) => ({ ...holding, currentValue: null })),
  };
  const assessment = assessPortfolioIntelligence(input);
  const totalValueUsd = allValuesKnown
    ? sourceFacts.reduce((sum, source) => sum + source.valueUsd!, 0)
    : null;
  if (!allCashKnown) limitations.add("all_investments_cash_incomplete");
  if (!allValuesKnown) limitations.add("all_investments_valuation_incomplete");
  return {
    input,
    assessment,
    intelligence: buildPortfolioIntelligenceView({ result: assessment, adapterLimitations: [...limitations] }),
    sources: sourceFacts.map((source) => ({
      id: source.id,
      name: source.name,
      source: source.source,
      availability: source.availability,
      valueUsd: source.valueUsd,
      cashUsd: source.cashUsd,
      holdingCount: source.holdingCount,
    })),
    totalValueUsd,
    cashValueUsd: allCashKnown ? cashValue : null,
    adapterLimitations: [...limitations],
  };
}

export async function loadAllInvestments(
  supabase: SupabaseClient<Database>,
  userId: string,
  portfolios: AllInvestmentsPortfolio[],
  asOf: string,
) {
  const sourceFacts: AllInvestmentsSourceFacts[] = [];

  for (const portfolio of portfolios) {
    if (portfolio.source === "connected") {
      const result = await loadConnectedPortfolioIntelligence(supabase, portfolio.id, asOf);
      sourceFacts.push(result ? {
        ...portfolio,
        availability: "ready",
        valueUsd: result.totalValueUsd,
        cashUsd: result.cashValueUsd,
        holdingCount: result.positions.length,
        holdings: result.input.holdings,
        limitations: result.adapterLimitations,
      } : {
        ...portfolio,
        availability: "unavailable",
        valueUsd: null,
        cashUsd: null,
        holdingCount: null,
        holdings: [],
        limitations: [],
      });
    } else {
      const result = await loadCurrentPortfolioIntelligenceFromClient({ supabase, userId, portfolioId: portfolio.id, asOf });
      sourceFacts.push(result.status === "ready" ? {
        ...portfolio,
        availability: "ready",
        valueUsd: result.assessment.portfolio.valuation.totalValue,
        cashUsd: result.input.portfolio.cashValue,
        holdingCount: result.input.holdings.length,
        holdings: result.input.holdings,
        limitations: result.adapterLimitations,
      } : {
        ...portfolio,
        availability: "unavailable",
        valueUsd: null,
        cashUsd: null,
        holdingCount: null,
        holdings: [],
        limitations: result.adapterLimitations,
      });
    }
  }
  return buildAllInvestmentsFromSources(sourceFacts, asOf);
}
