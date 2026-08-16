import {
  portfolioConstructionPolicy,
  positionSizingRoom,
} from "@/lib/portfolio-construction-policy";

export type PortfolioAction = "none" | "review" | "buy_more" | "trim" | "exit";
export type PortfolioActionConfidence = "low" | "medium" | "high";

export type PortfolioActionAlertLike = {
  action?: string | null;
  severity?: string | null;
  title?: string | null;
  message?: string | null;
  recommendation?: string | null;
  dataUpdatedAt?: string | null;
  generatedAt?: string | null;
  sourceData?: {
    rankingUpdatedAt?: string | null;
    diagnosticsUpdatedAt?: string | null;
    latestNewsPublishedAt?: string | null;
  } | null;
};

export type PortfolioActionHoldingLike = {
  ticker: string;
  company?: string | null;
  sector?: string | null;
  score: number;
  rank?: number | null;
  currentPrice: number;
  entryPrice: number;
  shares: number;
  currentValue: number;
  totalPnLDollars: number;
  currentAllocationPct: number;
  targetAllocationPct?: number | null;
  scoreAtEntry?: number | null;
  rankAtEntry?: number | null;
  scoreChange?: number | null;
  rankChange?: number | null;
  rankPercentile?: number | null;
  scorePercentile?: number | null;
  pnlPercent?: number | null;
  daysSinceReview?: number | null;
  isRecentlyAdded?: boolean | null;
  actionAlerts?: PortfolioActionAlertLike[];
  eventAlerts?: PortfolioActionAlertLike[];
  recommendation?: string | null;
};

export type PortfolioActionContext = {
  riskTolerance?: string | null;
  objective?: string | null;
  timeHorizon?: string | null;
  cashBalance?: number | null;
  cashDrag?: number | null;
  sectorExposurePct?: number | null;
  dataUpdatedAt?: string | null;
  generatedAt?: string | null;
  nowMs?: number;
};

export type PortfolioActionRecommendation = {
  action: PortfolioAction;
  confidence: PortfolioActionConfidence;
  label: string;
  plainEnglishReason: string;
  evidence: string[];
  risks: string[];
  suggestedTrimRange: [number, number] | null;
  suggestedBuyAmount: number | null;
  generatedAt: string;
  dataUpdatedAt: string | null;
  freshness: "fresh" | "stale" | "unknown";
};

function finiteNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function latestIso(values: Array<string | null | undefined>) {
  let latest: number | null = null;
  for (const value of values) {
    if (!value) continue;
    const ms = new Date(value).getTime();
    if (!Number.isFinite(ms)) continue;
    latest = latest == null || ms > latest ? ms : latest;
  }
  return latest == null ? null : new Date(latest).toISOString();
}

function freshnessFor(value: string | null, nowMs: number) {
  if (!value) return "unknown" as const;
  const ms = new Date(value).getTime();
  if (!Number.isFinite(ms)) return "unknown" as const;
  return nowMs - ms > 72 * 60 * 60 * 1000 ? "stale" : "fresh";
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function actionFromAlert(action?: string | null): PortfolioAction | null {
  if (action === "buy_more") return "buy_more";
  if (action === "trim") return "trim";
  if (action === "sell") return "exit";
  if (action === "review") return "review";
  return null;
}

function confidenceFor(score: number, stale: boolean): PortfolioActionConfidence {
  if (stale) return "low";
  if (score >= 80) return "high";
  if (score >= 52) return "medium";
  return "low";
}

function trimRangeFor(allocation: number, target: number | null, trimThreshold: number) {
  const ceiling = target != null && target > 0 ? target * 1.2 : trimThreshold;
  const excess = Math.max(0, allocation - ceiling);
  if (excess <= 0 || allocation <= 0) return null;
  const midpointPct = clamp((excess / allocation) * 100, 8, 28);
  const low = Math.max(5, Math.round((midpointPct * 0.7) / 5) * 5);
  const high = Math.max(low + 5, Math.round((midpointPct * 1.25) / 5) * 5);
  return [low, clamp(high, low, 40)] as [number, number];
}

function isSizingOnlyTrimAlert(alert: PortfolioActionAlertLike | null) {
  if (!alert || alert.action !== "trim") return false;
  const text = [alert.title, alert.message, alert.recommendation]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return /too large|oversized|concentration|allocation|position sizing|risk threshold/.test(text);
}

export function derivePortfolioHoldingAction(
  holding: PortfolioActionHoldingLike,
  context: PortfolioActionContext = {},
): PortfolioActionRecommendation {
  const nowMs = context.nowMs ?? Date.now();
  const alertTimestamps = [...(holding.actionAlerts ?? []), ...(holding.eventAlerts ?? [])].flatMap((alert) => [
    alert.dataUpdatedAt,
    alert.generatedAt,
    alert.sourceData?.rankingUpdatedAt,
    alert.sourceData?.diagnosticsUpdatedAt,
    alert.sourceData?.latestNewsPublishedAt,
  ]);
  const dataUpdatedAt = latestIso([context.dataUpdatedAt, ...alertTimestamps]);
  const generatedAt = context.generatedAt ?? new Date(nowMs).toISOString();
  const freshness = freshnessFor(dataUpdatedAt, nowMs);
  const stale = freshness === "stale";

  const ticker = holding.ticker.toUpperCase();
  const score = finiteNumber(holding.score);
  const rank = holding.rank ?? null;
  const allocation = finiteNumber(holding.currentAllocationPct);
  const target = holding.targetAllocationPct == null ? null : finiteNumber(holding.targetAllocationPct);
  const policy = portfolioConstructionPolicy(context.riskTolerance);
  const pnlPct = finiteNumber(holding.pnlPercent);
  const scoreAtEntry = holding.scoreAtEntry == null ? null : finiteNumber(holding.scoreAtEntry);
  const scoreChange = scoreAtEntry == null ? finiteNumber(holding.scoreChange) : score - scoreAtEntry;
  const rankAtEntry = holding.rankAtEntry ?? null;
  const rankWorsened = rank != null && rankAtEntry != null ? rank - rankAtEntry : 0;
  const actionAlert = holding.actionAlerts?.[0] ?? null;
  const alertAction = actionFromAlert(actionAlert?.action);
  const eventWarnings = (holding.eventAlerts ?? []).filter((alert) =>
    alert.severity === "critical" || alert.severity === "warning",
  );
  const evidence: string[] = [];
  const risks: string[] = [];

  if (rank != null) evidence.push(`Current rank #${rank}.`);
  evidence.push(`Current AI score ${Math.round(score).toLocaleString()}.`);
  if (scoreAtEntry != null) evidence.push(`Score moved ${scoreChange >= 0 ? "+" : ""}${Math.round(scoreChange).toLocaleString()} since entry.`);
  if (rankWorsened > 0) evidence.push(`Rank weakened by ${rankWorsened} places since entry.`);
  if (allocation > 0) evidence.push(`Position is ${allocation.toFixed(1)}% of this portfolio.`);
  evidence.push(`Risk profile allows adds up to ${policy.maxAddAllocationPct}% and concentration review from ${policy.concentrationReviewPct}%.`);
  if (actionAlert?.title) evidence.push(actionAlert.title);
  if (eventWarnings.length > 0) evidence.push(`${eventWarnings.length} warning event${eventWarnings.length === 1 ? "" : "s"} active.`);

  if (stale) risks.push("Source ranking/diagnostic data is stale, so high-confidence actions are blocked.");
  if (allocation > policy.concentrationReviewPct) risks.push(`${holding.sector ?? "Sector"} exposure/position sizing needs review before adding.`);
  if (eventWarnings.length > 0) risks.push("Recent alerts should be reviewed before increasing exposure.");
  if (holding.isRecentlyAdded) risks.push("The holding was added recently, so StockGPT applies a construction grace period unless risk is severe.");

  const reviewSized = allocation > (target != null && target > 0 ? target * 1.15 : policy.concentrationReviewPct);
  const oversized = allocation > (target != null && target > 0 ? target * 1.25 : policy.concentrationTrimPct);
  const severelyOversized = allocation > (target != null && target > 0 ? Math.max(target * 1.6, policy.hardConcentrationPct) : policy.hardConcentrationPct);
  const weakConviction = score < 6200 || (scoreChange < -900 && rankWorsened > 20);
  const strongConviction = score >= 7200 && (rank == null || rank <= 120);
  const underTarget =
    target != null && target > 0
      ? allocation < target * 0.82
      : allocation > 0 && allocation < policy.recommendedStarterPct;
  const sizingRoom = positionSizingRoom({
    currentAllocationPct: allocation,
    currentValue: finiteNumber(holding.currentValue),
    targetAllocationPct: target,
    cashBalance: context.cashBalance,
    riskTolerance: context.riskTolerance,
  });
  const cashSupportsAdding = sizingRoom.suggestedAddValue >= 50 || finiteNumber(context.cashDrag) >= 2;
  const sectorFitsAdding =
    context.sectorExposurePct == null ||
    finiteNumber(context.sectorExposurePct) <= policy.sectorCapPct * 0.92;
  const constructionRoomSupportsAdding = sizingRoom.roomPct >= 1 && sizingRoom.suggestedAddValue >= 50;
  const trimRange = trimRangeFor(allocation, target, policy.concentrationTrimPct);
  const recentSizingGrace =
    Boolean(holding.isRecentlyAdded) &&
    !weakConviction &&
    eventWarnings.length === 0 &&
    allocation <= policy.hardConcentrationPct;
  const shouldRespectSizingTrimAlert =
    alertAction === "trim" &&
    !(recentSizingGrace && isSizingOnlyTrimAlert(actionAlert));

  let action: PortfolioAction = "none";
  let scoreForConfidence = 0;
  let label = "No clear action";
  let reason = `${ticker} does not currently have enough aligned evidence for StockGPT to suggest buying more, trimming, or exiting.`;
  let suggestedTrimRange: [number, number] | null = null;
  let suggestedBuyAmount: number | null = null;

  if (!stale && alertAction === "exit" && weakConviction && (severelyOversized || pnlPct < -25)) {
    action = "exit";
    scoreForConfidence = 86;
    label = "Consider exiting / cutting heavily";
    reason = `${ticker} has weak AI conviction and a severe risk signal. Treat this as a research prompt to review whether the position still belongs in the portfolio.`;
    suggestedTrimRange = [50, 100];
  } else if (!stale && (shouldRespectSizingTrimAlert || (oversized && weakConviction)) && trimRange) {
    action = "trim";
    scoreForConfidence = oversized && weakConviction ? 82 : 64;
    label = `Consider trimming ${trimRange[0]}-${trimRange[1]}%`;
    reason = `${ticker} is above the same construction sizing band used for StockGPT add ideas, and conviction is not strong enough to ignore the concentration risk.`;
    suggestedTrimRange = trimRange;
  } else if (!stale && alertAction === "buy_more" && strongConviction && underTarget && cashSupportsAdding && constructionRoomSupportsAdding && sectorFitsAdding && eventWarnings.length === 0) {
    action = "buy_more";
    scoreForConfidence = 70;
    label = "Consider buying more";
    reason = `${ticker} remains high conviction, is below the portfolio construction sizing band, and cash/context can support a measured add without creating an immediate trim conflict.`;
    suggestedBuyAmount = Math.max(50, Math.min(sizingRoom.suggestedAddValue, finiteNumber(holding.currentValue) * 0.25));
  } else if (alertAction === "review" || eventWarnings.length > 0 || weakConviction || reviewSized || finiteNumber(holding.daysSinceReview) > 30) {
    action = "review";
    scoreForConfidence = stale ? 38 : 56;
    label = "Review / watch";
    reason = recentSizingGrace && isSizingOnlyTrimAlert(actionAlert)
      ? `${ticker} is newly added and only marginally above the review band, so StockGPT flags construction review instead of immediately contradicting the add with a trim.`
      : `${ticker} has a signal worth checking, but the evidence does not currently justify a concrete trim or buy-more suggestion.`;
  }

  if (action === "buy_more") {
    risks.push(`Keep the post-add position under roughly ${sizingRoom.targetCeiling.toFixed(1)}% so it does not conflict with the trim logic.`);
  }
  if (action === "trim" || action === "exit") {
    risks.push("Use an actual order price in the trim form; do not rely on stale ranking price alone.");
  }

  return {
    action,
    confidence: confidenceFor(scoreForConfidence, stale),
    label,
    plainEnglishReason: reason,
    evidence,
    risks,
    suggestedTrimRange,
    suggestedBuyAmount,
    generatedAt,
    dataUpdatedAt,
    freshness,
  };
}
