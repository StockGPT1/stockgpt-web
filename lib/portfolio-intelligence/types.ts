export type PortfolioStatus =
  | "on_track"
  | "monitor"
  | "review"
  | "urgent_review";

export type ReasonLevel = "monitor" | "review";

export type DataFreshness = "fresh" | "stale" | "missing" | "unknown";

export type InstrumentCoverage = "ranked" | "tracked_only" | "unsupported";

export type HoldingProvenance = "manual" | "csv" | "broker" | "unknown";

export type ReasonCode =
  | "portfolio_empty"
  | "position_concentration"
  | "ranking_deterioration"
  | "diagnostic_deterioration"
  | "event_risk"
  | "saved_risk_level_breached"
  | "data_stale"
  | "data_missing"
  | "instrument_coverage_limited";

export type AssessmentEvidenceSource =
  | "holding"
  | "portfolio"
  | "ranking"
  | "diagnostics"
  | "market_price"
  | "event"
  | "technical_level";

export interface AssessmentEvidence {
  instrumentKey?: string;
  source: AssessmentEvidenceSource;
  metric: string;
  observed: string | number | boolean | null;
  unit?:
    | "percent"
    | "percentage_points"
    | "currency"
    | "rank"
    | "score"
    | "count"
    | "hours"
    | "days";
  comparison?: "gte" | "lte" | "declined_by" | "missing" | "stale";
  threshold?: number | null;
  observedAt?: string | null;
  freshness?: DataFreshness;
  provenance?: string | null;
}

export interface AssessmentReason {
  code: ReasonCode;
  level: ReasonLevel;
  evidence: AssessmentEvidence[];
}

export type PortfolioRiskTolerance =
  | "conservative"
  | "moderate"
  | "aggressive";

export interface HoldingEventInput {
  id?: string | null;
  kind: string;
  severity: "low" | "medium" | "high";
  occurredAt: string | null;
  source: string;
}

export interface HoldingIntelligenceInput {
  instrumentKey: string;
  ticker?: string | null;
  coverage: InstrumentCoverage;
  provenance: HoldingProvenance;
  currentValue: number | null;
  costBasis?: number | null;
  shares?: number | null;
  unrealisedPnlPct?: number | null;
  legacyReferenceAllocationPct?: number | null;
  market: {
    currentPrice: number | null;
    savedRiskLevel?: number | null;
    priceAsOf: string | null;
  };
  ranking: {
    currentScore: number | null;
    scoreAtEntry: number | null;
    currentRank: number | null;
    rankAtEntry: number | null;
    universeSize: number | null;
    asOf: string | null;
  } | null;
  diagnostics?: {
    currentScore: number | null;
    previousScore: number | null;
    asOf: string | null;
  } | null;
  events?: HoldingEventInput[];
}

export interface PortfolioIntelligenceInput {
  asOf: string;
  portfolio: {
    id: string;
    riskTolerance: string | null;
    objective?: string | null;
    timeHorizon?: string | null;
    cashValue: number;
  };
  holdings: HoldingIntelligenceInput[];
}

export interface HoldingAssessment {
  instrumentKey: string;
  ticker: string | null;
  status: PortfolioStatus;
  reasons: AssessmentReason[];
  attentionRank: number;
  allocation: {
    pctOfInvestedAssets: number | null;
    pctOfTotalPortfolio: number | null;
  };
  ranking: {
    scoreDeclinePct: number | null;
    rankPercentileDeclinePp: number | null;
  };
  freshness: {
    ranking: DataFreshness;
    marketPrice: DataFreshness;
    diagnostics: DataFreshness;
  };
  dataLimitations: string[];
}

export interface PortfolioAssessment {
  status: PortfolioStatus;
  reasons: AssessmentReason[];
  holdingAssessments: HoldingAssessment[];
  holdingsByStatus: Record<PortfolioStatus, string[]>;
  countsByStatus: Record<PortfolioStatus, number>;
  attentionOrder: string[];
  valuation: {
    state: "exact" | "partial" | "unavailable" | "empty";
    holdingsValue: number | null;
    cashValue: number;
    totalValue: number | null;
  };
  concentration: {
    largestPositionPctOfTotalPortfolio: number | null;
  };
  dataLimitations: string[];
}

export interface PortfolioIntelligenceResult {
  version: "1";
  asOf: string;
  portfolio: PortfolioAssessment;
}
