export type PortfolioRiskProfile = "conservative" | "moderate" | "aggressive";

export type PortfolioConstructionPolicy = {
  riskProfile: PortfolioRiskProfile;
  recommendedStarterPct: number;
  maxAddAllocationPct: number;
  concentrationReviewPct: number;
  concentrationTrimPct: number;
  hardConcentrationPct: number;
  sectorCapPct: number;
  recentHoldingGraceDays: number;
};

function normaliseRiskProfile(riskTolerance?: string | null): PortfolioRiskProfile {
  if (riskTolerance === "conservative") return "conservative";
  if (riskTolerance === "aggressive") return "aggressive";
  return "moderate";
}

export function portfolioConstructionPolicy(
  riskTolerance?: string | null,
): PortfolioConstructionPolicy {
  const riskProfile = normaliseRiskProfile(riskTolerance);

  if (riskProfile === "conservative") {
    return {
      riskProfile,
      recommendedStarterPct: 5,
      maxAddAllocationPct: 10,
      concentrationReviewPct: 18,
      concentrationTrimPct: 21,
      hardConcentrationPct: 28,
      sectorCapPct: 18,
      recentHoldingGraceDays: 7,
    };
  }

  if (riskProfile === "aggressive") {
    return {
      riskProfile,
      recommendedStarterPct: 9,
      maxAddAllocationPct: 18,
      concentrationReviewPct: 32,
      concentrationTrimPct: 36,
      hardConcentrationPct: 44,
      sectorCapPct: 34,
      recentHoldingGraceDays: 7,
    };
  }

  return {
    riskProfile,
    recommendedStarterPct: 7,
    maxAddAllocationPct: 14,
    concentrationReviewPct: 24,
    concentrationTrimPct: 28,
    hardConcentrationPct: 36,
    sectorCapPct: 26,
    recentHoldingGraceDays: 7,
  };
}

export function positionSizingRoom({
  currentAllocationPct,
  currentValue,
  targetAllocationPct,
  cashBalance,
  riskTolerance,
}: {
  currentAllocationPct: number;
  currentValue: number;
  targetAllocationPct?: number | null;
  cashBalance?: number | null;
  riskTolerance?: string | null;
}) {
  const policy = portfolioConstructionPolicy(riskTolerance);
  const targetCeiling =
    targetAllocationPct != null && targetAllocationPct > 0
      ? Math.min(targetAllocationPct * 1.15, policy.maxAddAllocationPct)
      : policy.maxAddAllocationPct;
  const roomPct = Math.max(0, targetCeiling - currentAllocationPct);
  const inferredPortfolioValue =
    currentAllocationPct > 0 ? currentValue / (currentAllocationPct / 100) : null;
  const roomValue =
    inferredPortfolioValue != null && Number.isFinite(inferredPortfolioValue)
      ? (inferredPortfolioValue * roomPct) / 100
      : 0;
  const cash = Number(cashBalance);
  const cashAvailable = Number.isFinite(cash) && cash > 0 ? cash : 0;

  return {
    policy,
    targetCeiling,
    roomPct,
    roomValue,
    cashAvailable,
    suggestedAddValue: Math.max(0, Math.min(roomValue, cashAvailable)),
  };
}
