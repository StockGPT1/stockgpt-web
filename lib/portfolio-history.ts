export type PortfolioHistoryQuality = "exact" | "estimated" | "unavailable";
export type PortfolioReturnMethod = "time_weighted" | "modified_dietz" | null;

export type PortfolioHistoryPoint = {
  at: string;
  value: number;
  cash: number | null;
  currency: string;
  source: "manual_snapshot" | "sync_promotion" | "provider_history";
  quality: string;
};

export type PortfolioExternalFlow = {
  at: string | null;
  amount: number | null;
  currency: string | null;
  direction: "inflow" | "outflow" | "internal" | "unknown";
  sourceId: string;
};

export type HistoricalFxRate = {
  baseCurrency: string;
  quoteCurrency: string;
  effectiveDate: string;
  rate: number;
};

export type PortfolioPerformanceResult = {
  status: "available" | "unavailable";
  method: PortfolioReturnMethod;
  quality: PortfolioHistoryQuality;
  returnPct: number | null;
  limitations: string[];
};

const DAY_MS = 86_400_000;
const NEARBY_FLOW_BOUNDARY_MS = DAY_MS;
export const SIGNIFICANT_ESTIMATED_FLOW_RATIO = 0.1;

function finite(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function day(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : null;
}

export function classifyBrokerActivityFlow(activityType: string): PortfolioExternalFlow["direction"] {
  const type = activityType.trim().toLowerCase().replace(/[\s-]+/gu, "_");
  if (["deposit", "cash_deposit", "contribution", "transfer_in", "external_transfer_in"].includes(type)) return "inflow";
  if (["withdrawal", "cash_withdrawal", "distribution", "transfer_out", "external_transfer_out"].includes(type)) return "outflow";
  if (["buy", "sell", "trade", "dividend", "interest", "fee", "tax", "split"].includes(type)) return "internal";
  return "unknown";
}

export function convertHistoricalValue(
  value: number,
  fromCurrency: string,
  toCurrency: string,
  at: string,
  rates: HistoricalFxRate[],
) {
  if (!Number.isFinite(value)) return null;
  const from = fromCurrency.toUpperCase();
  const to = toCurrency.toUpperCase();
  if (from === to) return value;
  const effectiveDate = day(at);
  if (!effectiveDate) return null;
  const direct = rates.find((rate) => rate.baseCurrency === from && rate.quoteCurrency === to && rate.effectiveDate === effectiveDate);
  if (direct && finite(direct.rate) && direct.rate > 0) return value * direct.rate;
  const inverse = rates.find((rate) => rate.baseCurrency === to && rate.quoteCurrency === from && rate.effectiveDate === effectiveDate);
  if (inverse && finite(inverse.rate) && inverse.rate > 0) return value / inverse.rate;
  return null;
}

export function calculatePortfolioPerformance({
  points,
  flows,
}: {
  points: Array<{ at: string; value: number }>;
  flows: Array<{ at: string | null; amount: number | null; direction: PortfolioExternalFlow["direction"] }>;
}): PortfolioPerformanceResult {
  const ordered = points
    .map((point) => ({ ...point, ms: Date.parse(point.at), value: finite(point.value) }))
    .filter((point): point is { at: string; ms: number; value: number } => Number.isFinite(point.ms) && point.value != null && point.value > 0)
    .sort((a, b) => a.ms - b.ms);
  if (ordered.length < 2) return { status: "unavailable", method: null, quality: "unavailable", returnPct: null, limitations: ["insufficient_value_history"] };

  const external = flows.filter((flow) => flow.direction === "inflow" || flow.direction === "outflow");
  if (flows.some((flow) => flow.direction === "unknown")) {
    return { status: "unavailable", method: null, quality: "unavailable", returnPct: null, limitations: ["unclassified_external_flow"] };
  }
  if (external.some((flow) => flow.at == null || finite(flow.amount) == null)) {
    return { status: "unavailable", method: null, quality: "unavailable", returnPct: null, limitations: ["external_flow_evidence_incomplete"] };
  }

  const start = ordered[0];
  const end = ordered.at(-1)!;
  const timedFlows = external
    .map((flow) => ({
      ms: Date.parse(flow.at!),
      signedAmount: flow.direction === "inflow" ? finite(flow.amount)! : -finite(flow.amount)!,
    }))
    .filter((flow) => Number.isFinite(flow.ms) && flow.ms >= start.ms && flow.ms <= end.ms);
  const hasNearbyBoundaries = timedFlows.every((flow) =>
    ordered.some((point) => Math.abs(point.ms - flow.ms) <= NEARBY_FLOW_BOUNDARY_MS),
  );

  if (hasNearbyBoundaries) {
    let factor = 1;
    for (let index = 1; index < ordered.length; index += 1) {
      const previous = ordered[index - 1];
      const current = ordered[index];
      const intervalFlow = timedFlows
        .filter((flow) => flow.ms > previous.ms && flow.ms <= current.ms)
        .reduce((sum, flow) => sum + flow.signedAmount, 0);
      const intervalReturn = (current.value - intervalFlow) / previous.value;
      if (!Number.isFinite(intervalReturn) || intervalReturn <= 0) {
        return { status: "unavailable", method: null, quality: "unavailable", returnPct: null, limitations: ["time_weighted_denominator_invalid"] };
      }
      factor *= intervalReturn;
    }
    return { status: "available", method: "time_weighted", quality: "exact", returnPct: (factor - 1) * 100, limitations: [] };
  }

  const significantUnbounded = timedFlows.some((flow) => Math.abs(flow.signedAmount) / start.value >= SIGNIFICANT_ESTIMATED_FLOW_RATIO);
  if (significantUnbounded) {
    return { status: "unavailable", method: null, quality: "unavailable", returnPct: null, limitations: ["significant_flow_without_boundary_valuation"] };
  }
  const duration = end.ms - start.ms;
  if (duration <= 0) return { status: "unavailable", method: null, quality: "unavailable", returnPct: null, limitations: ["invalid_history_window"] };
  const netFlow = timedFlows.reduce((sum, flow) => sum + flow.signedAmount, 0);
  const weightedFlow = timedFlows.reduce((sum, flow) => sum + flow.signedAmount * ((end.ms - flow.ms) / duration), 0);
  const denominator = start.value + weightedFlow;
  if (!Number.isFinite(denominator) || denominator <= 0) {
    return { status: "unavailable", method: null, quality: "unavailable", returnPct: null, limitations: ["modified_dietz_denominator_invalid"] };
  }
  return {
    status: "available",
    method: "modified_dietz",
    quality: "estimated",
    returnPct: ((end.value - start.value - netFlow) / denominator) * 100,
    limitations: ["flow_timing_estimated"],
  };
}
