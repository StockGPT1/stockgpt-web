"use server";

import {
  generatePortfolio,
  type Portfolio,
  type RiskTolerance,
  type TimeHorizon,
} from "@/lib/portfolio";

export async function generatePortfolioAction(
  riskTolerance: RiskTolerance,
  timeHorizon: TimeHorizon,
  investmentAmount: number
): Promise<{ portfolio: Portfolio | null; error?: string }> {
  if (!["conservative", "moderate", "aggressive"].includes(riskTolerance)) {
    return { portfolio: null, error: "Invalid risk tolerance" };
  }
  if (!["short", "medium", "long"].includes(timeHorizon)) {
    return { portfolio: null, error: "Invalid time horizon" };
  }
  if (
    !investmentAmount ||
    investmentAmount < 100 ||
    investmentAmount > 10_000_000
  ) {
    return { portfolio: null, error: "Investment amount must be $100–$10M" };
  }

  const portfolio = await generatePortfolio({
    riskTolerance,
    timeHorizon,
    investmentAmount,
  });

  if (!portfolio) {
    return { portfolio: null, error: "Could not generate portfolio" };
  }

  return { portfolio };
}
