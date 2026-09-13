export const MARKET_DATA_COVERAGE = [
  "ranked",
  "tracked_only",
  "unsupported",
] as const;

export type MarketDataCoverage = (typeof MARKET_DATA_COVERAGE)[number];

export type InstrumentAlias = {
  instrumentId: string;
  namespace: string;
  scope: string;
  value: string;
  validFrom?: string | null;
  validTo?: string | null;
};

export function classifyMarketDataCoverage(input: {
  instrumentId: string | null;
  hasRanking: boolean;
  hasTrackedMarketData: boolean;
}): MarketDataCoverage {
  if (!input.instrumentId) return "unsupported";
  if (input.hasRanking) return "ranked";
  if (input.hasTrackedMarketData) return "tracked_only";
  return "unsupported";
}

export function normalizeCurrentMarketPrice(value: unknown): number | null {
  const price = typeof value === "number" ? value : Number(value);
  return Number.isFinite(price) && price > 0 ? price : null;
}

export function resolveInstrumentAlias(
  aliases: readonly InstrumentAlias[],
  query: { namespace: string; scope?: string; value: string; asOf: string },
): string | null {
  const namespace = query.namespace.trim().toLowerCase();
  const scope = (query.scope ?? "").trim();
  const value = query.value.trim();
  const asOf = Date.parse(query.asOf);

  if (!Number.isFinite(asOf)) return null;

  const matches = aliases.filter((alias) => {
    if (
      alias.namespace.trim().toLowerCase() !== namespace
      || alias.scope.trim() !== scope
      || alias.value.trim() !== value
    ) return false;

    const validFrom = alias.validFrom ? Date.parse(alias.validFrom) : null;
    const validTo = alias.validTo ? Date.parse(alias.validTo) : null;
    return (validFrom === null || validFrom <= asOf) && (validTo === null || asOf < validTo);
  });

  return matches.length === 1 ? matches[0].instrumentId : null;
}
