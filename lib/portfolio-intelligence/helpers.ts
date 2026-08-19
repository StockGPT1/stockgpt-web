import {
  REASON_ORDER,
  SOURCE_FRESHNESS_HOURS,
} from "./constants";
import type {
  AssessmentEvidence,
  AssessmentReason,
  DataFreshness,
  ReasonCode,
  ReasonLevel,
} from "./types";

const HOUR_MS = 60 * 60 * 1000;

export function finiteNonNegative(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

export function finitePositive(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;
}

export function parseTimestamp(value: string | null | undefined): number | null {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function sourceFreshness({
  valuePresent,
  observedAt,
  asOfMs,
  windowHours = SOURCE_FRESHNESS_HOURS,
}: {
  valuePresent: boolean;
  observedAt: string | null | undefined;
  asOfMs: number | null;
  windowHours?: number;
}): DataFreshness {
  if (!valuePresent || !observedAt) return "missing";
  const observedMs = parseTimestamp(observedAt);
  if (observedMs === null || asOfMs === null) return "unknown";
  return asOfMs - observedMs > windowHours * HOUR_MS ? "stale" : "fresh";
}

export function percentageDecline(
  previousValue: number | null,
  currentValue: number | null,
): number | null {
  const previous = finitePositive(previousValue);
  const current = finitePositive(currentValue);
  if (previous === null || current === null) return null;
  return Math.max(0, ((previous - current) / Math.abs(previous)) * 100);
}

export function rankPercentile(
  rankValue: number | null,
  universeValue: number | null,
): number | null {
  const rank = finitePositive(rankValue);
  const universe = finitePositive(universeValue);
  if (rank === null || universe === null || universe < 2) return null;
  const percentile = ((universe - rank) / (universe - 1)) * 100;
  return Math.min(100, Math.max(0, percentile));
}

export function addReason(
  reasons: Map<ReasonCode, AssessmentReason>,
  code: ReasonCode,
  level: ReasonLevel,
  evidence: AssessmentEvidence[],
) {
  const existing = reasons.get(code);
  if (!existing) {
    reasons.set(code, { code, level, evidence: [...evidence] });
    return;
  }

  if (level === "review") existing.level = "review";
  existing.evidence.push(...evidence);
}

function evidenceKey(evidence: AssessmentEvidence) {
  return [
    evidence.instrumentKey ?? "",
    evidence.source,
    evidence.metric,
    evidence.observedAt ?? "",
    String(evidence.observed),
    evidence.comparison ?? "",
    evidence.threshold == null ? "" : String(evidence.threshold),
  ].join("|");
}

export function sortAndDedupeEvidence(
  evidence: AssessmentEvidence[],
): AssessmentEvidence[] {
  const unique = new Map<string, AssessmentEvidence>();
  for (const item of evidence) unique.set(evidenceKey(item), item);
  return [...unique.values()].sort((left, right) =>
    evidenceKey(left).localeCompare(evidenceKey(right)),
  );
}

export function sortedReasons(
  reasons: Iterable<AssessmentReason>,
): AssessmentReason[] {
  const position = new Map(REASON_ORDER.map((code, index) => [code, index]));
  return [...reasons]
    .map((reason) => ({
      ...reason,
      evidence: sortAndDedupeEvidence(reason.evidence),
    }))
    .sort(
      (left, right) =>
        (position.get(left.code) ?? Number.MAX_SAFE_INTEGER) -
          (position.get(right.code) ?? Number.MAX_SAFE_INTEGER) ||
        left.code.localeCompare(right.code),
    );
}

export function sortedUnique(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}
