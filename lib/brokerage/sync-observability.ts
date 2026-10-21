/** Privacy-safe bounded operational projection, not a log of jobs, identities or financial facts. */
export const BROKER_SYNC_SUMMARY_LIMIT = 1000;
const STATES = ["queued", "running", "succeeded", "retryable_failure", "terminal_failure"] as const;
type SyncState = typeof STATES[number];

export function summarizeBrokerSyncHealth(input: {
  rows: readonly { status: string; lastSuccessfulSyncAt: string | null }[];
  asOf: Date;
  complete: boolean;
}) {
  if (input.rows.length > BROKER_SYNC_SUMMARY_LIMIT || !Number.isFinite(input.asOf.getTime())) {
    return { availability: "unavailable" as const, reason: "summary_budget_or_time_invalid" as const };
  }
  const counts: Record<SyncState | "unknown", number> = { queued: 0, running: 0, succeeded: 0, retryable_failure: 0, terminal_failure: 0, unknown: 0 };
  const freshness = { within_day: 0, older: 0, unknown: 0 };
  for (const row of input.rows) {
    counts[STATES.includes(row.status as SyncState) ? row.status as SyncState : "unknown"] += 1;
    const timestamp = row.lastSuccessfulSyncAt === null ? NaN : Date.parse(row.lastSuccessfulSyncAt);
    const age = input.asOf.getTime() - timestamp;
    if (!Number.isFinite(age) || age < 0) freshness.unknown += 1;
    else if (age <= 86_400_000) freshness.within_day += 1;
    else freshness.older += 1;
  }
  return { availability: input.complete ? "available" as const : "partial" as const, counts, freshness };
}
