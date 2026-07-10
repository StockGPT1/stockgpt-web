export type PortfolioAction = "none" | "review" | "buy_more" | "trim" | "exit";
export type PortfolioActionConfidence = "low" | "medium" | "high";

export type PortfolioActionAlertLike = {
  action?: string | null;
  severity?: string | null;
  title?: string | null;
  message?: string | null;
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

function concentrationCap(riskTolerance?: string | null) {
  if (riskTolerance === "conservative") return 18;
  if (riskTolerance === "aggressive") return 32;
  return 24;
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

function trimRangeFor(allocation: number, target: number | null, cap: number) {
  const ceiling = target != null && target > 0 ? target * 1.2 : cap;
  const excess = Math.max(0, allocation - ceiling);
  if (excess <= 0 || allocation <= 0) return null;
  const midpointPct = clamp((excess / allocation) * 100, 8, 28);
  const low = Math.max(5, Math.round((midpointPct * 0.7) / 5) * 5);
  const high = Math.max(low + 5, Math.round((midpointPct * 1.25) / 5) * 5);
  return [low, clamp(high, low, 40)] as [number, number];
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
  const cap = concentrationCap(context.riskTolerance);
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
  if (actionAlert?.title) evidence.push(actionAlert.title);
  if (eventWarnings.length > 0) evidence.push(`${eventWarnings.length} warning event${eventWarnings.length === 1 ? "" : "s"} active.`);

  if (stale) risks.push("Source ranking/diagnostic data is stale, so high-confidence actions are blocked.");
  if (allocation > cap) risks.push(`${holding.sector ?? "Sector"} exposure/position sizing needs review before adding.`);
  if (eventWarnings.length > 0) risks.push("Recent alerts should be reviewed before increasing exposure.");
  if (holding.isRecentlyAdded) risks.push("The holding was added recently, so StockGPT applies extra caution.");

  const oversized = allocation > (target != null && target > 0 ? target * 1.2 : cap);
  const severelyOversized = allocation > Math.max(cap + 8, 34);
  const weakConviction = score < 6200 || (scoreChange < -900 && rankWorsened > 20);
  const strongConviction = score >= 7200 && (rank == null || rank <= 120);
  const underTarget =
    target != null && target > 0
      ? allocation < target * 0.82
      : allocation > 0 && allocation < Math.min(cap * 0.45, 10);
  const cashSupportsAdding = finiteNumber(context.cashBalance) > 50 || finiteNumber(context.cashDrag) >= 2;
  const trimRange = trimRangeFor(allocation, target, cap);

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
  } else if (!stale && (alertAction === "trim" || (oversized && weakConviction)) && trimRange) {
    action = "trim";
    scoreForConfidence = oversized && weakConviction ? 82 : 64;
    label = `Consider trimming ${trimRange[0]}-${trimRange[1]}%`;
    reason = `${ticker} is large enough and conviction is weak enough for StockGPT to suggest a partial risk reduction.`;
    suggestedTrimRange = trimRange;
  } else if (!stale && alertAction === "buy_more" && strongConviction && underTarget && cashSupportsAdding && eventWarnings.length === 0) {
    action = "buy_more";
    scoreForConfidence = 70;
    label = "Consider buying more";
    reason = `${ticker} remains high conviction, is below target sizing, and portfolio cash/context can support a measured add.`;
    suggestedBuyAmount = Math.max(50, Math.min(finiteNumber(context.cashBalance), holding.currentValue * 0.25));
  } else if (alertAction === "review" || eventWarnings.length > 0 || weakConviction || oversized || finiteNumber(holding.daysSinceReview) > 30) {
    action = "review";
    scoreForConfidence = stale ? 38 : 56;
    label = "Review / watch";
    reason = `${ticker} has a signal worth checking, but the evidence does not currently justify a concrete trim or buy-more suggestion.`;
  }

  if (action === "buy_more") {
    risks.push("Only consider adding if it does not worsen concentration or conflict with recent news.");
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
