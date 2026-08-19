import {
  CONCENTRATION_CAP_PCT,
  CONCENTRATION_MONITOR_RATIO,
  DIAGNOSTIC_THRESHOLDS,
  EVENT_WINDOW_DAYS,
  RANKING_THRESHOLDS,
  URGENT_CORROBORATING_REASONS,
} from "./constants";
import {
  addReason,
  finiteNonNegative,
  finitePositive,
  parseTimestamp,
  percentageDecline,
  rankPercentile,
  sortedReasons,
  sortedUnique,
  sourceFreshness,
} from "./helpers";
import type {
  AssessmentEvidence,
  AssessmentReason,
  HoldingAssessment,
  HoldingEventInput,
  HoldingIntelligenceInput,
  PortfolioRiskTolerance,
  PortfolioStatus,
  ReasonCode,
  ReasonLevel,
} from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface HoldingAssessmentContext {
  asOf: string;
  riskTolerance: PortfolioRiskTolerance;
  allocationPctOfInvestedAssets: number | null;
  allocationPctOfTotalPortfolio: number | null;
  concentrationAssessmentAvailable: boolean;
}

function dataReasonLevel(freshness: "fresh" | "stale" | "missing" | "unknown") {
  return freshness === "stale" ? "data_stale" : "data_missing";
}

function dataEvidence({
  source,
  metric,
  observed,
  observedAt,
  freshness,
}: {
  source: "ranking" | "market_price";
  metric: string;
  observed: string | number | null;
  observedAt: string | null;
  freshness: "stale" | "missing" | "unknown";
}): AssessmentEvidence {
  return {
    source,
    metric,
    observed,
    comparison: freshness === "stale" ? "stale" : "missing",
    observedAt,
    freshness,
  };
}

function normaliseEvents(
  events: HoldingEventInput[],
  asOfMs: number | null,
): HoldingEventInput[] {
  if (asOfMs === null) return [];
  const windowMs = EVENT_WINDOW_DAYS * DAY_MS;
  const severityOrder = { high: 0, medium: 1, low: 2 } as const;

  return events
    .filter((event) => {
      const occurredMs = parseTimestamp(event.occurredAt);
      if (occurredMs === null) return false;
      const ageMs = asOfMs - occurredMs;
      return ageMs >= 0 && ageMs <= windowMs;
    })
    .sort(
      (left, right) =>
        severityOrder[left.severity] - severityOrder[right.severity] ||
        left.kind.localeCompare(right.kind) ||
        left.source.localeCompare(right.source) ||
        String(left.occurredAt).localeCompare(String(right.occurredAt)) ||
        String(left.id ?? "").localeCompare(String(right.id ?? "")),
    );
}

function statusFromReasons(reasons: AssessmentReason[]): PortfolioStatus {
  const reviewCodes = new Set(
    reasons
      .filter((reason) => reason.level === "review")
      .map((reason) => reason.code),
  );
  const hasCorroboratingReason = URGENT_CORROBORATING_REASONS.some((code) =>
    reviewCodes.has(code),
  );
  const savedRiskCorroborated =
    reviewCodes.has("saved_risk_level_breached") && hasCorroboratingReason;
  const threeCategoryCorroboration =
    reviewCodes.size >= 3 && hasCorroboratingReason;

  if (savedRiskCorroborated || threeCategoryCorroboration) {
    return "urgent_review";
  }
  if (reviewCodes.size > 0) return "review";
  if (reasons.some((reason) => reason.level === "monitor")) return "monitor";
  return "on_track";
}

export function assessHolding(
  input: HoldingIntelligenceInput,
  context: HoldingAssessmentContext,
): HoldingAssessment {
  const reasons = new Map<ReasonCode, AssessmentReason>();
  const dataLimitations: string[] = [];
  const asOfMs = parseTimestamp(context.asOf);
  if (asOfMs === null) dataLimitations.push("as_of_invalid");

  const instrumentKey = input.instrumentKey.replace(/^\s+|\s+$/g, "");
  const currentValue = finiteNonNegative(input.currentValue);
  const currentPrice = finitePositive(input.market.currentPrice);
  const marketEvidencePresent = currentValue !== null && currentPrice !== null;
  const marketFreshness = sourceFreshness({
    valuePresent: marketEvidencePresent,
    observedAt: input.market.priceAsOf,
    asOfMs,
  });

  if (marketFreshness !== "fresh") {
    const code = dataReasonLevel(marketFreshness);
    const missingMarketMetric =
      currentValue === null
        ? "current_value"
        : currentPrice === null
          ? "current_market_price"
          : "market_price_timestamp";
    addReason(reasons, code, "monitor", [
      dataEvidence({
        source: "market_price",
        metric: missingMarketMetric,
        observed:
          missingMarketMetric === "current_value"
            ? input.currentValue
            : missingMarketMetric === "current_market_price"
              ? input.market.currentPrice
              : input.market.priceAsOf,
        observedAt: input.market.priceAsOf,
        freshness: marketFreshness,
      }),
    ]);
  }

  if (input.coverage !== "ranked") {
    addReason(reasons, "instrument_coverage_limited", "monitor", [
      {
        source: "holding",
        metric: "instrument_coverage",
        observed: input.coverage,
        provenance: input.provenance,
      },
    ]);
  }

  const ranking = input.ranking;
  const currentScore = finitePositive(ranking?.currentScore ?? null);
  const currentRank = finitePositive(ranking?.currentRank ?? null);
  const universeSize = finitePositive(ranking?.universeSize ?? null);
  const rankingEvidencePresent =
    ranking !== null &&
    currentScore !== null &&
    currentRank !== null &&
    universeSize !== null &&
    universeSize >= 2;
  const rankingFreshness = sourceFreshness({
    valuePresent: rankingEvidencePresent,
    observedAt: ranking?.asOf,
    asOfMs,
  });

  let scoreDeclinePct: number | null = null;
  let rankPercentileDeclinePp: number | null = null;

  if (input.coverage === "ranked") {
    if (rankingFreshness !== "fresh") {
      const code = dataReasonLevel(rankingFreshness);
      const missingRankingMetric =
        ranking === null
          ? "ranking_data"
          : currentScore === null
            ? "current_score"
            : currentRank === null
              ? "current_rank"
              : universeSize === null || universeSize < 2
                ? "universe_size"
                : "ranking_timestamp";
      addReason(reasons, code, "monitor", [
        dataEvidence({
          source: "ranking",
          metric: missingRankingMetric,
          observed:
            missingRankingMetric === "current_score"
              ? ranking?.currentScore ?? null
              : missingRankingMetric === "current_rank"
                ? ranking?.currentRank ?? null
                : missingRankingMetric === "universe_size"
                  ? ranking?.universeSize ?? null
                  : missingRankingMetric === "ranking_timestamp"
                    ? ranking?.asOf ?? null
                    : null,
          observedAt: ranking?.asOf ?? null,
          freshness: rankingFreshness,
        }),
      ]);
    } else {
      scoreDeclinePct = percentageDecline(
        ranking?.scoreAtEntry ?? null,
        currentScore,
      );
      const entryRankPercentile = rankPercentile(
        ranking?.rankAtEntry ?? null,
        universeSize,
      );
      const currentRankPercentile = rankPercentile(currentRank, universeSize);
      rankPercentileDeclinePp =
        entryRankPercentile === null || currentRankPercentile === null
          ? null
          : Math.max(0, entryRankPercentile - currentRankPercentile);

      const reviewFromRank =
        rankPercentileDeclinePp !== null &&
        rankPercentileDeclinePp >=
          RANKING_THRESHOLDS.reviewRankPercentilePoints;
      const reviewFromScore =
        scoreDeclinePct !== null &&
        scoreDeclinePct >= RANKING_THRESHOLDS.reviewScoreDeclinePct;
      const reviewFromCombination =
        rankPercentileDeclinePp !== null &&
        scoreDeclinePct !== null &&
        rankPercentileDeclinePp >=
          RANKING_THRESHOLDS.combinedReviewRankPercentilePoints &&
        scoreDeclinePct >= RANKING_THRESHOLDS.combinedReviewScoreDeclinePct;
      const monitorFromRank =
        rankPercentileDeclinePp !== null &&
        rankPercentileDeclinePp >=
          RANKING_THRESHOLDS.monitorRankPercentilePoints;
      const monitorFromScore =
        scoreDeclinePct !== null &&
        scoreDeclinePct >= RANKING_THRESHOLDS.monitorScoreDeclinePct;
      const rankingLevel: ReasonLevel | null =
        reviewFromRank || reviewFromScore || reviewFromCombination
          ? "review"
          : monitorFromRank || monitorFromScore
            ? "monitor"
            : null;

      if (rankingLevel) {
        const combinedThresholds = rankingLevel === "review" && reviewFromCombination;
        const evidence: AssessmentEvidence[] = [];
        if (rankPercentileDeclinePp !== null) {
          evidence.push({
            source: "ranking",
            metric: "rank_percentile_decline",
            observed: rankPercentileDeclinePp,
            unit: "percentage_points",
            comparison: "declined_by",
            threshold:
              rankingLevel === "monitor"
                ? RANKING_THRESHOLDS.monitorRankPercentilePoints
                : combinedThresholds
                  ? RANKING_THRESHOLDS.combinedReviewRankPercentilePoints
                  : RANKING_THRESHOLDS.reviewRankPercentilePoints,
            observedAt: ranking?.asOf ?? null,
            freshness: rankingFreshness,
          });
        }
        if (scoreDeclinePct !== null) {
          evidence.push({
            source: "ranking",
            metric: "score_decline",
            observed: scoreDeclinePct,
            unit: "percent",
            comparison: "declined_by",
            threshold:
              rankingLevel === "monitor"
                ? RANKING_THRESHOLDS.monitorScoreDeclinePct
                : combinedThresholds
                  ? RANKING_THRESHOLDS.combinedReviewScoreDeclinePct
                  : RANKING_THRESHOLDS.reviewScoreDeclinePct,
            observedAt: ranking?.asOf ?? null,
            freshness: rankingFreshness,
          });
        }
        addReason(reasons, "ranking_deterioration", rankingLevel, evidence);
      }
    }
  }

  const diagnostics = input.diagnostics ?? null;
  const diagnosticCurrent = finitePositive(diagnostics?.currentScore ?? null);
  const diagnosticPrevious = finitePositive(diagnostics?.previousScore ?? null);
  const diagnosticFreshness = diagnostics
    ? sourceFreshness({
        valuePresent: diagnosticCurrent !== null && diagnosticPrevious !== null,
        observedAt: diagnostics.asOf,
        asOfMs,
      })
    : "missing";

  if (diagnostics && diagnosticFreshness !== "fresh") {
    dataLimitations.push(
      diagnosticFreshness === "stale"
        ? "diagnostics_stale"
        : "diagnostics_unavailable",
    );
  }

  if (diagnostics && diagnosticFreshness === "fresh") {
    const decline = percentageDecline(diagnosticPrevious, diagnosticCurrent);
    const level: ReasonLevel | null =
      decline !== null && decline >= DIAGNOSTIC_THRESHOLDS.reviewDeclinePct
        ? "review"
        : decline !== null && decline >= DIAGNOSTIC_THRESHOLDS.monitorDeclinePct
          ? "monitor"
          : null;
    if (level && decline !== null) {
      addReason(reasons, "diagnostic_deterioration", level, [
        {
          source: "diagnostics",
          metric: "diagnostic_score_decline",
          observed: decline,
          unit: "percent",
          comparison: "declined_by",
          threshold:
            level === "review"
              ? DIAGNOSTIC_THRESHOLDS.reviewDeclinePct
              : DIAGNOSTIC_THRESHOLDS.monitorDeclinePct,
          observedAt: diagnostics.asOf,
          freshness: diagnosticFreshness,
        },
      ]);
    }
  }

  const currentEvents = normaliseEvents(input.events ?? [], asOfMs);
  const eventLevel: ReasonLevel | null = currentEvents.some(
    (event) => event.severity === "high",
  )
    ? "review"
    : currentEvents.some((event) => event.severity === "medium")
      ? "monitor"
      : null;
  if (eventLevel) {
    addReason(
      reasons,
      "event_risk",
      eventLevel,
      currentEvents
        .filter((event) => event.severity !== "low")
        .map((event) => ({
          source: "event" as const,
          metric: event.kind,
          observed: event.severity,
          observedAt: event.occurredAt,
          provenance: event.source,
        })),
    );
  }

  if (
    context.concentrationAssessmentAvailable &&
    context.allocationPctOfTotalPortfolio !== null
  ) {
    const allocation = context.allocationPctOfTotalPortfolio;
    const cap = CONCENTRATION_CAP_PCT[context.riskTolerance];
    const monitorThreshold = cap * CONCENTRATION_MONITOR_RATIO;
    const level: ReasonLevel | null =
      allocation >= cap
        ? "review"
        : allocation >= monitorThreshold
          ? "monitor"
          : null;
    if (level) {
      addReason(reasons, "position_concentration", level, [
        {
          source: "portfolio",
          metric: "allocation_pct_of_total_portfolio",
          observed: allocation,
          unit: "percent",
          comparison: "gte",
          threshold: level === "review" ? cap : monitorThreshold,
        },
      ]);
    }
  }

  const savedRiskLevel = finitePositive(input.market.savedRiskLevel ?? null);
  if (
    marketFreshness === "fresh" &&
    savedRiskLevel !== null &&
    currentPrice !== null &&
    currentPrice <= savedRiskLevel
  ) {
    addReason(reasons, "saved_risk_level_breached", "review", [
      {
        source: "technical_level",
        metric: "saved_risk_level",
        observed: currentPrice,
        unit: "currency",
        comparison: "lte",
        threshold: savedRiskLevel,
        observedAt: input.market.priceAsOf,
        freshness: marketFreshness,
      },
    ]);
  }

  const sorted = sortedReasons(reasons.values());

  return {
    instrumentKey,
    ticker: input.ticker?.replace(/^\s+|\s+$/g, "").toUpperCase() || null,
    status: statusFromReasons(sorted),
    reasons: sorted,
    attentionRank: 1,
    allocation: {
      pctOfInvestedAssets: context.allocationPctOfInvestedAssets,
      pctOfTotalPortfolio: context.allocationPctOfTotalPortfolio,
    },
    ranking: {
      scoreDeclinePct,
      rankPercentileDeclinePp,
    },
    freshness: {
      ranking: rankingFreshness,
      marketPrice: marketFreshness,
      diagnostics: diagnosticFreshness,
    },
    dataLimitations: sortedUnique(dataLimitations),
  };
}
