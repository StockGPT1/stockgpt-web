import type { Tables } from "@/lib/database.types";
import type {
  PortfolioIntelligenceInput,
  PortfolioIntelligenceResult,
} from "@/lib/portfolio-intelligence";

export type CurrentPortfolioFact = Pick<
  Tables<"user_portfolios">,
  | "id"
  | "risk_tolerance"
  | "objective"
  | "time_horizon"
  | "cash_balance"
  | "currency"
>;

export type CurrentHoldingFact = Pick<
  Tables<"portfolio_holdings">,
  | "id"
  | "portfolio_id"
  | "ticker"
  | "shares"
  | "entry_price"
  | "score_at_entry"
  | "rank_at_entry"
  | "allocation_pct"
  | "source"
  | "risk_level_at_entry"
  | "target_level_at_entry"
>;

export type CurrentRankingFact = Pick<
  Tables<"stock_rankings">,
  | "ticker"
  | "score"
  | "rank"
  | "price"
  | "last_price_update"
  | "last_ranking_update"
>;

export type CurrentDiagnosticFact = Pick<
  Tables<"stock_factor_diagnostics">,
  "ticker" | "current_score" | "previous_score" | "updated_at"
>;

export type CurrentPortfolioIntelligenceFacts = {
  portfolio: CurrentPortfolioFact;
  holdings: CurrentHoldingFact[];
  rankings: CurrentRankingFact[];
  diagnostics: CurrentDiagnosticFact[];
  rankingUniverseSize: number | null;
};

export type CurrentPortfolioIntelligenceAdapterResult = {
  status: "ready";
  input: PortfolioIntelligenceInput;
  assessment: PortfolioIntelligenceResult;
  adapterLimitations: string[];
};

export type CurrentPortfolioIntelligenceNotFoundResult = {
  status: "not_found";
  input: null;
  assessment: null;
  adapterLimitations: string[];
};

export type CurrentPortfolioIntelligenceLoadResult =
  | CurrentPortfolioIntelligenceAdapterResult
  | CurrentPortfolioIntelligenceNotFoundResult;
