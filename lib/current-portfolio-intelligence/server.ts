import "server-only";

import { createClient } from "@/utils/supabase/server";
import { loadCurrentPortfolioIntelligenceFromClient } from "./load-from-client";
import type { CurrentPortfolioIntelligenceLoadResult } from "./types";

export async function loadCurrentPortfolioIntelligence({
  portfolioId,
  asOf,
}: {
  portfolioId?: string | null;
  asOf: string;
}): Promise<CurrentPortfolioIntelligenceLoadResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      status: "not_found",
      input: null,
      assessment: null,
      adapterLimitations: ["authenticated_user_not_found"],
    };
  }

  return loadCurrentPortfolioIntelligenceFromClient({
    supabase,
    userId: user.id,
    portfolioId,
    asOf,
  });
}
