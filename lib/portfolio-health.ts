import type { EnrichedHolding } from "@/lib/portfolio-alerts";

export type PortfolioHealthTransaction = {
  realisedPnl?: number | null;
};

export type PortfolioHealthSummary = {
  id?: string;
  name: string;
  currency: string;
  riskTolerance?: string | null;
  holdingsCount: number;
  holdingsValue: number;
  totalValue: number;
  unrealisedPnl: number;
  realisedPnl: number;
  totalPnl: number;
  totalPnlPct: number;
  weightedAvgScore: number | null;
  avgScore: number;
  sectorCount: number;
  actionAlerts: number;
  eventAlerts: number;
  oversizedCount: number;
  weakCount: number;
  cashDrag: number;
  largestPositionPct: number;
  score: number;
  label: string;
  explanation: string;
};

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function portfolioHealthLabel(score: number) {
  if (score >= 82) return "Strong";
  if (score >= 68) return "Healthy";
  if (score >= 52) return "Needs review";
  return "High risk";
}

function isOversized(holding: EnrichedHolding) {
  if (!holding.targetAllocationPct) return false;
  return holding.currentAllocationPct - holding.targetAllocationPct > 3;
}

function buildExplanation(summary: {
  weightedAvgScore: number | null;
  actionAlerts: number;
  eventAlerts: number;
  oversizedCount: number;
  cashDrag: number;
  largestPositionPct: number;
  sectorCount: number;
  totalPnlPct: number;
}) {
  const positives: string[] = [];
  const risks: string[] = [];

  if ((summary.weightedAvgScore ?? 0) >= 7000) positives.push("strong weighted AI score");
  if (summary.sectorCount >= 5) positives.push("reasonable sector spread");
  if (summary.totalPnlPct > 0) positives.push("positive total return");

  if (summary.actionAlerts > 0) risks.push(`${summary.actionAlerts} action alert${summary.actionAlerts === 1 ? "" : "s"}`);
  if (summary.eventAlerts > 2) risks.push(`${summary.eventAlerts} review events`);
  if (summary.oversizedCount > 0) risks.push(`${summary.oversizedCount} oversized position${summary.oversizedCount === 1 ? "" : "s"}`);
  if (summary.largestPositionPct > 30) risks.push("single-position concentration");
  if (summary.cashDrag > 30) risks.push("high cash drag");

  if (risks.length === 0 && positives.length === 0) return "Balanced portfolio with no extreme warning signal.";
  if (risks.length === 0) return `Strongest drivers: ${positives.join(", ")}.`;
  if (positives.length === 0) return `Main drag: ${risks.join(", ")}.`;
  return `Strengths: ${positives.join(", ")}. Main drag: ${risks.join(", ")}.`;
}

export function buildPortfolioHealthSummary({
  id,
  name,
  currency = "USD",
  riskTolerance = null,
  holdings,
  transactions = [],
  cashBalance = 0,
  cashDepositedTotal = 0,
}: {
  id?: string;
  name: string;
  currency?: string | null;
  riskTolerance?: string | null;
  holdings: EnrichedHolding[];
  transactions?: PortfolioHealthTransaction[];
  cashBalance?: number | null;
  cashDepositedTotal?: number | null;
}): PortfolioHealthSummary {
  const safeCash = Number.isFinite(Number(cashBalance)) ? Number(cashBalance) : 0;
  const holdingsValue = holdings.reduce((sum, holding) => sum + holding.currentValue, 0);
  const totalValue = holdingsValue + safeCash;
  const unrealisedPnl = holdings.reduce((sum, holding) => sum + holding.totalPnLDollars, 0);
  const realisedPnl = transactions.reduce((sum, transaction) => sum + Number(transaction.realisedPnl ?? 0), 0);
  const totalPnl = unrealisedPnl + realisedPnl;
  const costBasis = holdings.reduce((sum, holding) => sum + holding.costBasis, 0);
  const basis = Math.max(Number(cashDepositedTotal) || 0, costBasis, 1);
  const totalPnlPct = (totalPnl / basis) * 100;
  const sectorCount = new Set(holdings.map((holding) => holding.sector).filter(Boolean)).size;
  const actionAlerts = holdings.reduce((sum, holding) => sum + holding.actionAlerts.length, 0);
  const eventAlerts = holdings.reduce((sum, holding) => sum + holding.eventAlerts.length, 0);
  const oversizedCount = holdings.filter(isOversized).length;
  const weakCount = holdings.filter(
    (holding) => holding.scorePercentile < 35 || (holding.rankPercentile < 35 && holding.actionAlerts.length > 0),
  ).length;
  const cashDrag = totalValue > 0 ? (safeCash / totalValue) * 100 : 0;
  const largestPositionPct = holdings.reduce(
    (max, holding) => Math.max(max, totalValue > 0 ? (holding.currentValue / totalValue) * 100 : 0),
    0,
  );
  const weightedAvgScore = holdingsValue > 0
    ? holdings.reduce((sum, holding) => sum + holding.score * holding.currentValue, 0) / holdingsValue
    : null;
  const avgScore = holdings.length > 0
    ? Math.round(holdings.reduce((sum, holding) => sum + holding.score, 0) / holdings.length)
    : 0;

  const qualityComponent = weightedAvgScore == null
    ? 45
    : clamp((weightedAvgScore / 10000) * 100, 0, 100);
  const sectorComponent = clamp((sectorCount / 5) * 70, 0, 70);
  const holdingCountComponent = clamp((holdings.length / 8) * 20, 0, 20);
  const concentrationComponent = largestPositionPct <= 18 ? 10 : largestPositionPct <= 28 ? 5 : 0;
  const diversificationComponent = clamp(sectorComponent + holdingCountComponent + concentrationComponent, 0, 100);
  const riskComponent = clamp(
    100 - actionAlerts * 18 - eventAlerts * 4 - oversizedCount * 9 - weakCount * 8,
    0,
    100,
  );
  const performanceComponent = clamp(50 + totalPnlPct * 2, 0, 100);
  const cashComponent = clamp(100 - Math.max(0, cashDrag - 10) * 2.4, 0, 100);

  const emptyPortfolioPenalty = holdings.length === 0 ? 35 : holdings.length < 3 ? 8 : 0;
  const score = Math.round(
    clamp(
      qualityComponent * 0.4 +
        riskComponent * 0.25 +
        diversificationComponent * 0.2 +
        performanceComponent * 0.1 +
        cashComponent * 0.05 -
        emptyPortfolioPenalty,
      0,
      100,
    ),
  );

  return {
    id,
    name,
    currency: currency ?? "USD",
    riskTolerance,
    holdingsCount: holdings.length,
    holdingsValue,
    totalValue,
    unrealisedPnl,
    realisedPnl,
    totalPnl,
    totalPnlPct,
    weightedAvgScore: weightedAvgScore == null ? null : Math.round(weightedAvgScore),
    avgScore,
    sectorCount,
    actionAlerts,
    eventAlerts,
    oversizedCount,
    weakCount,
    cashDrag,
    largestPositionPct,
    score,
    label: portfolioHealthLabel(score),
    explanation: buildExplanation({
      weightedAvgScore,
      actionAlerts,
      eventAlerts,
      oversizedCount,
      cashDrag,
      largestPositionPct,
      sectorCount,
      totalPnlPct,
    }),
  };
}
