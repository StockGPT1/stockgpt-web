"use server";

import { createClient } from "@/utils/supabase/server";
import { pilotDraftAccess } from "@/lib/brokerage/pilot-feature-access";
import { PILOT_DRAFT_UNAVAILABLE } from "@/lib/brokerage/pilot-feature-policy";
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
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { portfolio: null, error: "Please sign in to create a Portfolio Draft." };
  if (!pilotDraftAccess(user.id).allowed) return { portfolio: null, error: PILOT_DRAFT_UNAVAILABLE };

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
