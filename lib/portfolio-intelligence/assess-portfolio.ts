import { STATUS_SEVERITY } from "./constants";
import { assessHolding } from "./assess-holding";
import {
  addReason,
  finiteNonNegative,
  sortedReasons,
  sortedUnique,
} from "./helpers";
import type {
  AssessmentReason,
  HoldingAssessment,
  PortfolioAssessment,
  PortfolioIntelligenceInput,
  PortfolioIntelligenceResult,
  PortfolioRiskTolerance,
  PortfolioStatus,
  ReasonCode,
} from "./types";

function normaliseRiskTolerance(value: string | null): {
  value: PortfolioRiskTolerance;
  defaulted: boolean;
} {
  if (value === "conservative" || value === "moderate" || value === "aggressive") {
    return { value, defaulted: false };
  }
  return { value: "moderate", defaulted: true };
}
function attentionSort(left: HoldingAssessment, right: HoldingAssessment) {
  const severityDifference =
    STATUS_SEVERITY[right.status] - STATUS_SEVERITY[left.status];
  if (severityDifference !== 0) return severityDifference;

  const leftReviewCount = left.reasons.filter(
    (reason) => reason.level === "review",
  ).length;
  const rightReviewCount = right.reasons.filter(
    (reason) => reason.level === "review",
  ).length;
  if (rightReviewCount !== leftReviewCount) {
    return rightReviewCount - leftReviewCount;
  }

  const leftMonitorCount = left.reasons.filter(
    (reason) => reason.level === "monitor",
  ).length;
  const rightMonitorCount = right.reasons.filter(
    (reason) => reason.level === "monitor",
  ).length;
  if (rightMonitorCount !== leftMonitorCount) {
    return rightMonitorCount - leftMonitorCount;
  }

  return left.instrumentKey.localeCompare(right.instrumentKey);
}

function statusFromHoldings(holdings: HoldingAssessment[]): PortfolioStatus {
  if (holdings.length === 0) return "monitor";
  return holdings.reduce<PortfolioStatus>(
    (status, holding) =>
      STATUS_SEVERITY[holding.status] > STATUS_SEVERITY[status]
        ? holding.status
        : status,
    "on_track",
  );
}

function aggregatePortfolioReasons(
  holdings: HoldingAssessment[],
): AssessmentReason[] {
  const reasons = new Map<ReasonCode, AssessmentReason>();
  for (const holding of holdings) {
    for (const reason of holding.reasons) {
      addReason(
        reasons,
        reason.code,
        reason.level,
        reason.evidence.map((evidence) => ({
          ...evidence,
          instrumentKey: holding.instrumentKey,
        })),
      );
    }
  }
  return sortedReasons(reasons.values());
}

function emptyStatusGroups(): Record<PortfolioStatus, string[]> {
  return {
    on_track: [],
    monitor: [],
    review: [],
    urgent_review: [],
  };
}

function emptyStatusCounts(): Record<PortfolioStatus, number> {
  return {
    on_track: 0,
    monitor: 0,
    review: 0,
    urgent_review: 0,
  };
}

export function assessPortfolioIntelligence(
  input: PortfolioIntelligenceInput,
): PortfolioIntelligenceResult {
  const portfolioLimitations: string[] = [];
  const riskTolerance = normaliseRiskTolerance(input.portfolio.riskTolerance);
  if (riskTolerance.defaulted) {
    portfolioLimitations.push("risk_tolerance_defaulted");
  }

  const normalisedCash = finiteNonNegative(input.portfolio.cashValue);
  const cashValue = normalisedCash ?? 0;
  if (normalisedCash === null) portfolioLimitations.push("cash_value_normalized");

  const values = input.holdings.map((holding) =>
    finiteNonNegative(holding.currentValue),
  );
  const knownValues = values.filter((value): value is number => value !== null);
  const knownValueSum = knownValues.reduce((sum, value) => sum + value, 0);
  const valuationState: PortfolioAssessment["valuation"]["state"] =
    input.holdings.length === 0
      ? "empty"
      : knownValues.length === 0
        ? "unavailable"
        : knownValues.length < input.holdings.length
          ? "partial"
          : "exact";

  if (valuationState === "partial") portfolioLimitations.push("valuation_partial");
  if (valuationState === "unavailable") {
    portfolioLimitations.push("valuation_unavailable");
  }

  const holdingsValue =
    valuationState === "unavailable" ? null : knownValueSum;
  const totalValue =
    valuationState === "exact" || valuationState === "empty"
      ? knownValueSum + cashValue
      : null;
  const concentrationAssessmentAvailable =
    valuationState === "exact" && totalValue !== null && totalValue > 0;

  const assessed = input.holdings.map((holding, index) => {
    const value = values[index];
    const pctOfInvestedAssets =
      valuationState === "exact" && value !== null && knownValueSum > 0
        ? (value / knownValueSum) * 100
        : null;
    const pctOfTotalPortfolio =
      concentrationAssessmentAvailable && value !== null && totalValue !== null
        ? (value / totalValue) * 100
        : null;

    return assessHolding(holding, {
      asOf: input.asOf,
      riskTolerance: riskTolerance.value,
      allocationPctOfInvestedAssets: pctOfInvestedAssets,
      allocationPctOfTotalPortfolio: pctOfTotalPortfolio,
      concentrationAssessmentAvailable,
    });
  });

  const holdingAssessments = [...assessed]
    .sort(attentionSort)
    .map((holding, index) => ({ ...holding, attentionRank: index + 1 }));
  const holdingsByStatus = emptyStatusGroups();
  const countsByStatus = emptyStatusCounts();
  for (const holding of holdingAssessments) {
    holdingsByStatus[holding.status].push(holding.instrumentKey);
    countsByStatus[holding.status] += 1;
  }

  const portfolioReasons =
    holdingAssessments.length === 0
      ? [
          {
            code: "portfolio_empty" as const,
            level: "monitor" as const,
            evidence: [
              {
                source: "portfolio" as const,
                metric: "holding_count",
                observed: 0,
                unit: "count" as const,
              },
            ],
          },
        ]
      : aggregatePortfolioReasons(holdingAssessments);

  const largestPositionPctOfTotalPortfolio = concentrationAssessmentAvailable
    ? holdingAssessments.reduce(
        (largest, holding) =>
          Math.max(largest, holding.allocation.pctOfTotalPortfolio ?? 0),
        0,
      )
    : null;
  const holdingLimitations = holdingAssessments.flatMap((holding) =>
    holding.dataLimitations.map(
      (limitation) => `${holding.instrumentKey}:${limitation}`,
    ),
  );

  return {
    version: "1",
    asOf: input.asOf,
    portfolio: {
      status: statusFromHoldings(holdingAssessments),
      reasons: sortedReasons(portfolioReasons),
      holdingAssessments,
      holdingsByStatus,
      countsByStatus,
      attentionOrder: holdingAssessments.map((holding) => holding.instrumentKey),
      valuation: {
        state: valuationState,
        holdingsValue,
        cashValue,
        totalValue,
      },
      concentration: {
        largestPositionPctOfTotalPortfolio,
      },
      dataLimitations: sortedUnique([
        ...portfolioLimitations,
        ...holdingLimitations,
      ]),
    },
  };
}
