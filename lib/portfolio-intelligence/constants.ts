import type {
  PortfolioRiskTolerance,
  PortfolioStatus,
  ReasonCode,
} from "./types";

export const SOURCE_FRESHNESS_HOURS = 96;
export const EVENT_WINDOW_DAYS = 14;

export const CONCENTRATION_CAP_PCT: Record<PortfolioRiskTolerance, number> = {
  conservative: 20,
  moderate: 25,
  aggressive: 30,
};

export const CONCENTRATION_MONITOR_RATIO = 0.8;

export const RANKING_THRESHOLDS = {
  monitorRankPercentilePoints: 8,
  reviewRankPercentilePoints: 20,
  monitorScoreDeclinePct: 8,
  reviewScoreDeclinePct: 20,
  combinedReviewRankPercentilePoints: 12,
  combinedReviewScoreDeclinePct: 10,
} as const;

export const DIAGNOSTIC_THRESHOLDS = {
  monitorDeclinePct: 8,
  reviewDeclinePct: 15,
} as const;

export const REASON_ORDER: readonly ReasonCode[] = [
  "saved_risk_level_breached",
  "event_risk",
  "ranking_deterioration",
  "diagnostic_deterioration",
  "position_concentration",
  "instrument_coverage_limited",
  "data_missing",
  "data_stale",
  "portfolio_empty",
];

export const STATUS_SEVERITY: Record<PortfolioStatus, number> = {
  on_track: 0,
  monitor: 1,
  review: 2,
  urgent_review: 3,
};

export const URGENT_CORROBORATING_REASONS: readonly ReasonCode[] = [
  "ranking_deterioration",
  "diagnostic_deterioration",
  "event_risk",
];
