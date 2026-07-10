import type { EnrichedHolding } from "@/lib/portfolio-alerts";

export type PortfolioTrimDriver = {
  name: string;
  detail: string;
  pct: number;
  riskScore: number;
  weight: number;
};

export type PortfolioReinvestmentCandidate = {
  ticker: string;
  company: string | null;
  sector: string | null;
  score: number | null;
  rank: number | null;
  price: number | null;
  sameSector: boolean;
  rationale: string;
};

export type PortfolioTrimRecommendation = {
  pct: number | null;
  label: string;
  reason: string;
  riskScore: number;
  estimatedValue: number | null;
  estimatedShares: number | null;
  drivers: PortfolioTrimDriver[];
  reinvestment: PortfolioReinvestmentCandidate | null;
  reinvestmentSummary: string | null;
};

type Holding = EnrichedHolding & {
  purchaseDate?: string | null;
  source?: string | null;
  notes?: string | null;
};

type StockCandidate = {
  ticker: string;
  company: string | null;
  sector: string | null;
  score?: number | null;
  rank: number | null;
  price: number | null;
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
  if (riskTolerance === "aggressive") return 30;
  return 24;
}

function severityScore(severity: string) {
  if (severity === "critical") return 100;
  if (severity === "warning") return 70;
  return 0;
}

function alertRisk(holding: Holding) {
  const action = holding.actionAlerts[0];

  if (action?.action === "trim") return 78;
  if (action?.action === "review") return Math.max(50, severityScore(action.severity));
  if (action?.action === "sell" || action?.action === "buy_more") return 0;

  return Math.max(0, ...holding.eventAlerts.map((event) => severityScore(event.severity))) * 0.35;
}

function rankMovementRisk(holding: Holding, scoreDeclinePct: number) {
  if (!holding.rankAtEntry || !holding.rank) return 0;

  const rankWorsening = Math.max(0, holding.rank - holding.rankAtEntry);
  if (rankWorsening <= 0) return 0;

  const scoreBase = Math.max(Number(holding.scoreAtEntry) || Number(holding.score) || 1, 1);
  const scoreScaledMove = (rankWorsening / scoreBase) * 100;

  return scoreScaledMove * (1 + Math.min(scoreDeclinePct, 40) / 100);
}

function buildReinvestmentCandidate({
  holding,
  candidates = [],
  heldTickers,
}: {
  holding: Holding;
  candidates?: StockCandidate[];
  heldTickers: Set<string>;
}): PortfolioReinvestmentCandidate | null {
  const holdingTicker = holding.ticker.toUpperCase();
  const holdingSector = String(holding.sector ?? "").trim().toLowerCase();

  const rankedCandidates = candidates
    .filter((candidate) => {
      const ticker = String(candidate.ticker ?? "").trim().toUpperCase();
      if (!ticker || ticker === holdingTicker || heldTickers.has(ticker)) return false;
      if (!Number.isFinite(Number(candidate.price)) || Number(candidate.price) <= 0) return false;
      return Number.isFinite(Number(candidate.score)) || Number.isFinite(Number(candidate.rank));
    })
    .map((candidate) => {
      const sameSector =
        holdingSector.length > 0 &&
        String(candidate.sector ?? "").trim().toLowerCase() === holdingSector;
      const score = Number.isFinite(Number(candidate.score)) ? Number(candidate.score) : null;
      const rank = Number.isFinite(Number(candidate.rank)) ? Number(candidate.rank) : null;
      const rankingScore =
        (score ?? 0) +
        (rank == null ? 0 : Math.max(0, 10000 - rank) * 0.18) +
        (sameSector ? 750 : 0);

      return { candidate, sameSector, score, rank, rankingScore };
    })
    .sort((a, b) => b.rankingScore - a.rankingScore);

  const picked =
    rankedCandidates.find((item) => item.sameSector) ?? rankedCandidates[0] ?? null;

  if (!picked) return null;

  const ticker = String(picked.candidate.ticker).toUpperCase();
  const company = picked.candidate.company ?? null;
  const sector = picked.candidate.sector ?? null;

  return {
    ticker,
    company,
    sector,
    score: picked.score,
    rank: picked.rank,
    price: positiveNumber(picked.candidate.price),
    sameSector: picked.sameSector,
    rationale: picked.sameSector
      ? `${ticker} is the strongest available same-sector replacement by StockGPT score/rank, so it keeps the portfolio exposed to ${sector ?? "the same sector"} while moving cash away from the oversized holding.`
      : `${ticker} is the strongest available replacement by StockGPT score/rank. StockGPT could not find a better unheld same-sector candidate, so this is the best cross-sector option from the current rankings.`,
  };
}

export function buildPortfolioTrimRecommendation(
  holding: Holding,
  riskTolerance: string | null,
  candidates: StockCandidate[] = [],
  heldTickers: Set<string> = new Set(),
): PortfolioTrimRecommendation {
  const currentAllocation = positiveNumber(holding.currentAllocationPct) ?? 0;
  const userTarget = positiveNumber(holding.targetAllocationPct);
  const riskCap = concentrationCap(riskTolerance);
  const activeAction = holding.actionAlerts[0]?.action ?? "none";
  const addingSignal = activeAction === "buy_more" || holding.recommendation.includes("Buying");

  const targetBuffer = userTarget ? Math.max(1.5, userTarget * 0.2) : 0;
  const ceiling = userTarget ? userTarget + targetBuffer : riskCap;
  const desiredAllocation = userTarget ? userTarget + targetBuffer * 0.35 : riskCap * 0.92;
  const materiallyOversized = currentAllocation > ceiling && currentAllocation - ceiling >= 1.25;
  const allocationTrimPct =
    materiallyOversized && currentAllocation > 0
      ? ((currentAllocation - desiredAllocation) / currentAllocation) * 100
      : 0;

  const allocationDriftPct = userTarget ? currentAllocation - userTarget : currentAllocation - riskCap;
  const allocationRisk =
    allocationDriftPct <= 0
      ? 0
      : userTarget
        ? clamp((allocationDriftPct / Math.max(targetBuffer, 1.5)) * 35, 0, 100)
        : clamp((allocationDriftPct / Math.max(riskCap * 0.35, 1)) * 100, 0, 100);

  const scoreDeclinePct =
    holding.scoreAtEntry && holding.scoreAtEntry > 0
      ? Math.max(0, ((holding.scoreAtEntry - holding.score) / holding.scoreAtEntry) * 100)
      : 0;
  const rankDeteriorationPct = rankMovementRisk(holding, scoreDeclinePct);

  const convictionRisk = clamp(
    scoreDeclinePct * 1.35 +
      rankDeteriorationPct * 1.1 +
      Math.max(0, 55 - holding.rankPercentile) * 0.75,
    0,
    100,
  );
  const convictionBreak =
    !addingSignal &&
    convictionRisk >= 65 &&
    (scoreDeclinePct >= 18 || rankDeteriorationPct >= 16 || holding.rankPercentile < 45);
  const convictionTrimPct = convictionBreak
    ? clamp((convictionRisk - 50) * 0.42, materiallyOversized ? 10 : 5, materiallyOversized ? 30 : 18)
    : 0;

  const rawAlertRisk = alertRisk(holding);
  const alertTrimPct =
    !addingSignal && materiallyOversized && activeAction === "trim" && rawAlertRisk >= 70
      ? clamp((rawAlertRisk - 55) * 0.35, 5, 20)
      : 0;

  const profitProtectionSetup =
    !addingSignal &&
    holding.pnlPercent >= 45 &&
    currentAllocation >= Math.max(12, (userTarget ?? riskCap) + 3) &&
    holding.rankPercentile < 65;
  const priceRisk = profitProtectionSetup
    ? clamp((holding.pnlPercent - 45) * 0.9 + (65 - holding.rankPercentile) * 1.05, 0, 100)
    : 0;
  const profitProtectionTrimPct = profitProtectionSetup
    ? clamp((holding.pnlPercent - 45) * 0.22 + (65 - holding.rankPercentile) * 0.18, 5, 22)
    : 0;

  const riskScore = Math.round(
    clamp(allocationRisk * 0.55 + convictionRisk * 0.25 + rawAlertRisk * 0.1 + priceRisk * 0.1, 0, 100),
  );

  const drivers: PortfolioTrimDriver[] = [
    {
      name: "Position size",
      detail: userTarget
        ? `${currentAllocation.toFixed(1)}% vs ${userTarget.toFixed(1)}% target`
        : `${currentAllocation.toFixed(1)}% vs ${riskCap}% cap`,
      pct: allocationTrimPct,
      riskScore: Math.round(allocationRisk),
      weight: 55,
    },
    {
      name: "AI conviction",
      detail: `score -${scoreDeclinePct.toFixed(1)}%, rank move risk ${rankDeteriorationPct.toFixed(1)}`,
      pct: convictionTrimPct,
      riskScore: Math.round(convictionRisk),
      weight: 25,
    },
    {
      name: "Alerts / news",
      detail: holding.actionAlerts[0]?.title ?? `${holding.eventAlerts.length} warning event alerts`,
      pct: alertTrimPct,
      riskScore: Math.round(rawAlertRisk),
      weight: 10,
    },
    {
      name: "Price / P&L",
      detail: signedPct(holding.pnlPercent),
      pct: profitProtectionTrimPct,
      riskScore: Math.round(priceRisk),
      weight: 10,
    },
  ].sort((a, b) => b.riskScore - a.riskScore || b.pct - a.pct);

  const rawTrimPct = Math.max(allocationTrimPct, convictionTrimPct, alertTrimPct, profitProtectionTrimPct);
  const hasStrongReason =
    materiallyOversized ||
    (profitProtectionSetup && profitProtectionTrimPct >= 5) ||
    (convictionBreak && (materiallyOversized || currentAllocation >= 10));

  if (
    !hasStrongReason ||
    !Number.isFinite(rawTrimPct) ||
    rawTrimPct < 7 ||
    holding.currentValue * (rawTrimPct / 100) < 50
  ) {
    return {
      pct: null,
      label: "No trim suggested",
      reason:
        riskScore > 0
          ? "Some signals have moved, but not enough to justify a practical trim. StockGPT now requires a clearer oversized, profit-protection, or conviction-break setup."
          : "Allocation is inside range, AI conviction is stable, and no confirmed trim setup is active.",
      riskScore,
      estimatedValue: null,
      estimatedShares: null,
      drivers,
      reinvestment: null,
      reinvestmentSummary: null,
    };
  }

  const pct = clamp(Math.round(rawTrimPct / 5) * 5, 5, materiallyOversized ? 40 : 25);
  const topDriver = drivers.find((driver) => driver.pct === rawTrimPct) ?? drivers[0];
  const reason =
    topDriver.name === "Position size"
      ? `StockGPT suggests a ${pct}% trim because this holding is ${currentAllocation.toFixed(1)}% of the portfolio, above the ${ceiling.toFixed(1)}% level StockGPT allows before treating it as concentrated. The suggested trim moves the position back toward roughly ${desiredAllocation.toFixed(1)}%, rather than removing it completely.`
      : topDriver.name === "AI conviction"
        ? `StockGPT suggests a ${pct}% trim because conviction has weakened since entry: the score is down ${scoreDeclinePct.toFixed(1)}% and the rank-movement risk is ${rankDeteriorationPct.toFixed(1)}. The trim is intentionally partial because the position may still have a valid role in the portfolio.`
        : topDriver.name === "Price / P&L"
          ? `StockGPT suggests a ${pct}% trim because gains are extended at ${signedPct(holding.pnlPercent)}, the position is now large, and rank quality has weakened. This is a profit-protection rebalance rather than a full exit.`
          : `StockGPT suggests a ${pct}% trim because a confirmed trim alert is active and the position is also oversized. Alerts alone are not enough to trigger a trim.`;

  const reinvestment = buildReinvestmentCandidate({
    holding,
    candidates,
    heldTickers,
  });
  const estimatedValue = holding.currentValue * (pct / 100);
  const reinvestmentSummary = reinvestment
    ? `If you choose to reallocate later, StockGPT's strongest candidate for the estimated ${estimatedValue.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: estimatedValue >= 1000 ? 0 : 2,
      })} trimmed cash is ${reinvestment.ticker}${reinvestment.company ? ` (${reinvestment.company})` : ""}. ${reinvestment.rationale}`
    : "StockGPT could not find a suitable reinvestment candidate from the current ranking universe, so the trimmed cash should remain as portfolio cash until a better candidate appears.";

  return {
    pct,
    label: `Trim holding: ${pct}%`,
    reason: `${reason} ${reinvestmentSummary}`,
    riskScore,
    estimatedValue,
    estimatedShares: holding.shares * (pct / 100),
    drivers,
    reinvestment,
    reinvestmentSummary,
  };
}
