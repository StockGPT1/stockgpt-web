import type { EnrichedHolding } from "@/lib/portfolio-alerts";

export type PortfolioTrimDriver = {
  name: string;
  detail: string;
  pct: number;
  riskScore: number;
  weight: number;
};

export type PortfolioTrimRecommendation = {
  pct: number | null;
  label: string;
  reason: string;
  riskScore: number;
  estimatedValue: number | null;
  estimatedShares: number | null;
  drivers: PortfolioTrimDriver[];
};

type Holding = EnrichedHolding & {
  purchaseDate?: string | null;
  source?: string | null;
  notes?: string | null;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function positiveNumber(value: number | null | undefined) {
  return Number.isFinite(value) && Number(value) > 0 ? Number(value) : null;
}

function signedPct(value: number) {
  const safe = Number.isFinite(value) ? value : 0;
  return `${safe >= 0 ? "+" : ""}${safe.toFixed(1)}%`;
}

function concentrationCap(riskTolerance: string | null) {
  if (riskTolerance === "conservative") return 18;
  if (riskTolerance === "aggressive") return 32;
  return 25;
}

function severityScore(severity: string) {
  if (severity === "critical") return 100;
  if (severity === "warning") return 70;
  return 0;
}

function alertRisk(holding: Holding) {
  const action = holding.actionAlerts[0];

  if (action?.action === "sell") return 100;
  if (action?.action === "trim") return 78;
  if (action?.action === "review") return Math.max(55, severityScore(action.severity));
  if (action?.action === "buy_more") return 0;

  return Math.max(0, ...holding.eventAlerts.map((event) => severityScore(event.severity))) * 0.55;
}

export function buildPortfolioTrimRecommendation(
  holding: Holding,
  riskTolerance: string | null,
): PortfolioTrimRecommendation {
  const currentAllocation = positiveNumber(holding.currentAllocationPct) ?? 0;
  const userTarget = positiveNumber(holding.targetAllocationPct);
  const riskCap = concentrationCap(riskTolerance);
  const activeAction = holding.actionAlerts[0]?.action ?? "none";
  const exitSignal = activeAction === "sell" || holding.recommendation.includes("Sell");
  const addingSignal = activeAction === "buy_more" || holding.recommendation.includes("Buying");

  const buffer = userTarget ? Math.max(0.75, userTarget * 0.12) : 0;
  const ceiling = userTarget ? userTarget + buffer : riskCap;
  const desiredAllocation = userTarget ? userTarget + buffer * 0.25 : riskCap;
  const allocationTrimPct =
    currentAllocation > ceiling && currentAllocation > 0
      ? ((currentAllocation - desiredAllocation) / currentAllocation) * 100
      : 0;

  const allocationDriftPct = userTarget ? currentAllocation - userTarget : currentAllocation - riskCap;
  const allocationRisk =
    allocationDriftPct <= 0
      ? 0
      : userTarget
        ? clamp((allocationDriftPct / Math.max(buffer, 0.75)) * 25, 0, 100)
        : clamp((allocationDriftPct / Math.max(riskCap, 1)) * 100, 0, 100);

  const scoreDeclinePct =
    holding.scoreAtEntry && holding.scoreAtEntry > 0
      ? Math.max(0, ((holding.scoreAtEntry - holding.score) / holding.scoreAtEntry) * 100)
      : 0;
  const rankDeteriorationPct =
    holding.rankAtEntry && holding.rank
      ? Math.max(0, ((holding.rank - holding.rankAtEntry) / 500) * 100)
      : 0;
  const convictionRisk = clamp(
    scoreDeclinePct * 1.6 +
      rankDeteriorationPct * 1.2 +
      Math.max(0, 65 - holding.rankPercentile) * 0.6,
    0,
    100,
  );
  const convictionTrimPct =
    convictionRisk >= 20 && !addingSignal ? clamp((convictionRisk - 15) * 0.55, 5, 35) : 0;

  const rawAlertRisk = alertRisk(holding);
  const alertTrimPct =
    rawAlertRisk >= 35 && !addingSignal ? clamp((rawAlertRisk - 25) * 0.45, 5, 40) : 0;

  const priceRisk =
    holding.pnlPercent > 30 && holding.rankPercentile < 75 && !addingSignal
      ? clamp((holding.pnlPercent - 30) * 1.1 + (75 - holding.rankPercentile) * 1.2, 0, 100)
      : holding.pnlPercent <= -20 && holding.rankPercentile < 60 && !addingSignal
        ? clamp(Math.abs(holding.pnlPercent + 20) * 1.3 + (60 - holding.rankPercentile) * 1.1, 0, 100)
        : 0;
  const profitProtectionTrimPct =
    holding.pnlPercent > 30 && holding.rankPercentile < 75 && !addingSignal
      ? clamp((holding.pnlPercent - 30) * 0.35 + (75 - holding.rankPercentile) * 0.25, 5, 30)
      : 0;

  const riskScore = Math.round(
    clamp(allocationRisk * 0.4 + convictionRisk * 0.3 + rawAlertRisk * 0.2 + priceRisk * 0.1, 0, 100),
  );

  const drivers: PortfolioTrimDriver[] = [
    {
      name: "Position size",
      detail: userTarget
        ? `${currentAllocation.toFixed(1)}% vs ${userTarget.toFixed(1)}% target`
        : `${currentAllocation.toFixed(1)}% vs ${riskCap}% cap`,
      pct: allocationTrimPct,
      riskScore: Math.round(allocationRisk),
      weight: 40,
    },
    {
      name: "AI conviction",
      detail: `score -${scoreDeclinePct.toFixed(1)}%, rank percentile ${holding.rankPercentile}/100`,
      pct: convictionTrimPct,
      riskScore: Math.round(convictionRisk),
      weight: 30,
    },
    {
      name: "Alerts / news",
      detail: holding.actionAlerts[0]?.title ?? `${holding.eventAlerts.length} warning event alerts`,
      pct: alertTrimPct,
      riskScore: Math.round(rawAlertRisk),
      weight: 20,
    },
    {
      name: "Price / P&L",
      detail: signedPct(holding.pnlPercent),
      pct: profitProtectionTrimPct,
      riskScore: Math.round(priceRisk),
      weight: 10,
    },
  ].sort((a, b) => b.riskScore - a.riskScore || b.pct - a.pct);

  if (exitSignal) {
    return {
      pct: 100,
      label: "Exit candidate: 100%",
      reason:
        "A confirmed exit action is active, so StockGPT treats this as a full exit candidate rather than a rebalance trim.",
      riskScore: 100,
      estimatedValue: holding.currentValue,
      estimatedShares: holding.shares,
      drivers,
    };
  }

  const rawTrimPct = Math.max(allocationTrimPct, convictionTrimPct, alertTrimPct, profitProtectionTrimPct);

  if (!Number.isFinite(rawTrimPct) || rawTrimPct < 5 || holding.currentValue * (rawTrimPct / 100) < 25) {
    return {
      pct: null,
      label: "No trim suggested",
      reason:
        riskScore > 0
          ? "There is some low-level signal movement, but it is below the threshold for a practical trim."
          : "Allocation is inside range, AI conviction is stable, and no confirmed trim signal is active.",
      riskScore,
      estimatedValue: null,
      estimatedShares: null,
      drivers,
    };
  }

  const pct = clamp(Math.round(rawTrimPct), 5, 60);
  const topDriver = drivers.find((driver) => driver.pct === rawTrimPct) ?? drivers[0];
  const reason =
    topDriver.name === "Position size"
      ? `Calculated from allocation: ${currentAllocation.toFixed(1)}% back toward ${desiredAllocation.toFixed(1)}%.`
      : topDriver.name === "AI conviction"
        ? "Calculated from score decline, rank deterioration and current rank percentile."
        : topDriver.name === "Price / P&L"
          ? "Calculated from profit protection because gains are extended while rank is no longer top tier."
          : "Calculated from active alert severity and event pressure.";

  return {
    pct,
    label: `Suggested trim: ${pct}%`,
    reason,
    riskScore,
    estimatedValue: holding.currentValue * (pct / 100),
    estimatedShares: holding.shares * (pct / 100),
    drivers,
  };
}
