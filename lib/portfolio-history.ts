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
  timingPrecision: "exact" | "date_only" | "unknown";
  exactBoundary?: {
    beforeValue: number;
    afterValue: number;
  };
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
  flows: Array<Pick<PortfolioExternalFlow, "at" | "amount" | "direction" | "timingPrecision" | "exactBoundary">>;
}): PortfolioPerformanceResult {
  const normalized = points.map((point) => ({ ...point, ms: Date.parse(point.at), value: finite(point.value) }));
  if (normalized.some((point) => !Number.isFinite(point.ms) || point.value == null || point.value < 0)) {
    return { status: "unavailable", method: null, quality: "unavailable", returnPct: null, limitations: ["invalid_value_history"] };
  }
  const ordered = normalized
    .map((point) => ({ at: point.at, ms: point.ms, value: point.value! }))
    .sort((a, b) => a.ms - b.ms);
  if (ordered.length < 2) return { status: "unavailable", method: null, quality: "unavailable", returnPct: null, limitations: ["insufficient_value_history"] };

  const external = flows.filter((flow) => flow.direction === "inflow" || flow.direction === "outflow");
  if (flows.some((flow) => flow.direction === "unknown")) {
    return { status: "unavailable", method: null, quality: "unavailable", returnPct: null, limitations: ["unclassified_external_flow"] };
  }
  if (external.some((flow) => flow.at == null || finite(flow.amount) == null || finite(flow.amount)! < 0 || flow.timingPrecision === "unknown")) {
    return { status: "unavailable", method: null, quality: "unavailable", returnPct: null, limitations: ["external_flow_evidence_incomplete"] };
  }

  const start = ordered[0];
  const end = ordered.at(-1)!;
  if (start.value <= 0) {
    return { status: "unavailable", method: null, quality: "unavailable", returnPct: null, limitations: ["performance_opening_value_invalid"] };
  }
  const timedFlows = external
    .map((flow) => ({
      ...flow,
      ms: flow.timingPrecision === "date_only"
        ? Date.parse(`${flow.at!.slice(0, 10)}T12:00:00.000Z`)
        : Date.parse(flow.at!),
      signedAmount: flow.direction === "inflow" ? finite(flow.amount)! : -finite(flow.amount)!,
    }))
    .filter((flow) => Number.isFinite(flow.ms) && flow.ms >= start.ms && flow.ms <= end.ms);

  if (timedFlows.length === 0) {
    return {
      status: "available",
      method: "time_weighted",
      quality: "exact",
      returnPct: ((end.value / start.value) - 1) * 100,
      limitations: [],
    };
  }

  const hasExactBoundaries = timedFlows.every((flow) =>
    flow.timingPrecision === "exact" && flow.exactBoundary !== undefined,
  );
  if (hasExactBoundaries) {
    let factor = 1;
    let segmentOpeningValue = start.value;
    for (const flow of timedFlows.sort((left, right) => left.ms - right.ms)) {
      const beforeValue = finite(flow.exactBoundary!.beforeValue);
      const afterValue = finite(flow.exactBoundary!.afterValue);
      if (beforeValue == null || afterValue == null || beforeValue < 0 || afterValue < 0 || segmentOpeningValue <= 0) {
        return { status: "unavailable", method: null, quality: "unavailable", returnPct: null, limitations: ["time_weighted_boundary_invalid"] };
      }
      const expectedAfter = beforeValue + flow.signedAmount;
      const tolerance = Math.max(0.01, Math.abs(flow.signedAmount) * 0.000001);
      if (Math.abs(afterValue - expectedAfter) > tolerance) {
        return { status: "unavailable", method: null, quality: "unavailable", returnPct: null, limitations: ["time_weighted_boundary_inconsistent"] };
      }
      factor *= beforeValue / segmentOpeningValue;
      segmentOpeningValue = afterValue;
    }
    if (segmentOpeningValue <= 0) {
      return { status: "unavailable", method: null, quality: "unavailable", returnPct: null, limitations: ["time_weighted_denominator_invalid"] };
    }
    factor *= end.value / segmentOpeningValue;
    return { status: "available", method: "time_weighted", quality: "exact", returnPct: (factor - 1) * 100, limitations: [] };
  }

  for (const flow of timedFlows.filter((candidate) => candidate.timingPrecision === "date_only")) {
    const relevant = ordered
      .map((point) => ({ point, distance: Math.abs(point.ms - flow.ms) }))
      .filter(({ point, distance }) => distance <= DAY_MS && point.value > 0)
      .sort((left, right) => left.distance - right.distance)[0]?.point;
    if (!relevant) {
      return { status: "unavailable", method: null, quality: "unavailable", returnPct: null, limitations: ["flow_relevant_value_unavailable"] };
    }
    if (Math.abs(flow.signedAmount) / relevant.value >= SIGNIFICANT_ESTIMATED_FLOW_RATIO) {
      return { status: "unavailable", method: null, quality: "unavailable", returnPct: null, limitations: ["significant_flow_without_boundary_valuation"] };
    }
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
