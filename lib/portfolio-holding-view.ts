import type { EnrichedHolding } from "@/lib/portfolio-alerts";

/** Presentation-only holding shape used by the canonical Portfolio workspace. */
export type ExtendedHolding = EnrichedHolding & {
  purchaseDate?: string | null;
  source?: string | null;
  notes?: string | null;
};
