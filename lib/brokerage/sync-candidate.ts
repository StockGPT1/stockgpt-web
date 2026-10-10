export type BrokerCandidateAvailability = "complete" | "incomplete" | "unavailable";
export type BrokerActivityTimingPrecision = "exact" | "date_only" | "unknown";

export type BrokerPositionCandidate = {
  positionKey: string;
  externalPositionId: string | null;
  externalInstrumentId: string | null;
  instrumentId: string | null;
  symbol: string | null;
  description: string | null;
  assetType: string | null;
  quantity: number;
  price: number | null;
  priceCurrency: string | null;
  marketValue: number | null;
  marketValueCurrency: string | null;
  asOf: string;
};

export type BrokerCashCandidate = {
  currency: string;
  amount: number;
  asOf: string;
};

export type BrokerActivityCandidate = {
  externalActivityId: string | null;
  fingerprint: string;
  fingerprintVersion: "sha256-v1";
  instrumentId: string | null;
  activityType: string;
  occurredAt: string | null;
  occurredAtPrecision: BrokerActivityTimingPrecision;
  quantity: number | null;
  price: number | null;
  grossAmount: number | null;
  netAmount: number | null;
  currency: string | null;
  description: string | null;
};

export type BrokerAccountSyncCandidate = {
  externalAccountId: string;
  externalInstitutionId: string | null;
  institutionName: string | null;
  name: string;
  accountType: string | null;
  baseCurrency: string | null;
  status: "active" | "closed" | "inaccessible";
  positions: { state: BrokerCandidateAvailability; items: BrokerPositionCandidate[] };
  balances: { state: BrokerCandidateAvailability; items: BrokerCashCandidate[] };
  activities: { state: BrokerCandidateAvailability; items: BrokerActivityCandidate[] };
};

export type BrokerSyncCandidate = {
  fetchedAt: string;
  providerFreshnessAt: string;
  accounts: BrokerAccountSyncCandidate[];
};

export type BrokerCandidateValidation =
  | { ok: true }
  | { ok: false; retryable: boolean; errorCode: string };

const isFiniteNumber = (value: number | null) => value === null || Number.isFinite(value);

export type BrokerCandidateDiagnosticReason =
  | "missing_position_key" | "duplicate_position_key"
  | "zero_quantity" | "invalid_quantity" | "invalid_price" | "invalid_market_value"
  | "invalid_position_timestamp" | "future_position_timestamp"
  | "invalid_fetched_timestamp" | "invalid_freshness_timestamp" | "future_freshness_timestamp";

export type BrokerTimestampAheadBucket = "seconds" | "minutes" | "hours" | "more_than_a_day";

export function validateBrokerSyncCandidate(
  candidate: BrokerSyncCandidate,
  diagnostic?: (reason: BrokerCandidateDiagnosticReason, aheadBucket?: BrokerTimestampAheadBucket) => void,
): BrokerCandidateValidation {
  if (!Number.isFinite(Date.parse(candidate.fetchedAt)) ||
      !Number.isFinite(Date.parse(candidate.providerFreshnessAt)) ||
      Date.parse(candidate.providerFreshnessAt) > Date.parse(candidate.fetchedAt) ||
      candidate.accounts.length === 0) {
    if (!Number.isFinite(Date.parse(candidate.fetchedAt))) diagnostic?.("invalid_fetched_timestamp");
    else if (!Number.isFinite(Date.parse(candidate.providerFreshnessAt))) diagnostic?.("invalid_freshness_timestamp");
    else if (Date.parse(candidate.providerFreshnessAt) > Date.parse(candidate.fetchedAt)) diagnostic?.("future_freshness_timestamp");
    return { ok: false, retryable: false, errorCode: "candidate_invalid" };
  }
  const accountIds = new Set<string>();
  for (const account of candidate.accounts) {
    if (!account.externalAccountId || accountIds.has(account.externalAccountId)) {
      return { ok: false, retryable: false, errorCode: "candidate_account_invalid" };
    }
    accountIds.add(account.externalAccountId);
    if (account.positions.state !== "complete" || account.balances.state !== "complete" || account.activities.state !== "complete") {
      return { ok: false, retryable: true, errorCode: "provider_holdings_unavailable" };
    }
    if (account.positions.items.length > 5000 || account.balances.items.length > 100 || account.activities.items.length > 10000) {
      return { ok: false, retryable: true, errorCode: "candidate_window_exceeded" };
    }
    const positionKeys = new Set<string>();
    for (const position of account.positions.items) {
      if (!position.positionKey || positionKeys.has(position.positionKey) || !Number.isFinite(position.quantity) || position.quantity === 0 ||
          !isFiniteNumber(position.price) || !isFiniteNumber(position.marketValue) ||
          !Number.isFinite(Date.parse(position.asOf)) || Date.parse(position.asOf) > Date.parse(candidate.fetchedAt)) {
        // Fixed labels only, preserving the existing first-failure precedence.
        if (!position.positionKey) diagnostic?.("missing_position_key");
        else if (positionKeys.has(position.positionKey)) diagnostic?.("duplicate_position_key");
        else if (!Number.isFinite(position.quantity)) diagnostic?.("invalid_quantity");
        else if (position.quantity === 0) diagnostic?.("zero_quantity");
        else if (!isFiniteNumber(position.price)) diagnostic?.("invalid_price");
        else if (!isFiniteNumber(position.marketValue)) diagnostic?.("invalid_market_value");
        else if (!Number.isFinite(Date.parse(position.asOf))) diagnostic?.("invalid_position_timestamp");
        else {
          // Relative to this candidate's fetched time, not a new wall-clock read.
          // Coarse diagnostic only: never clamp or rewrite provider evidence.
          const aheadMs = Date.parse(position.asOf) - Date.parse(candidate.fetchedAt);
          diagnostic?.("future_position_timestamp", aheadMs < 60_000 ? "seconds"
            : aheadMs < 3_600_000 ? "minutes" : aheadMs <= 86_400_000 ? "hours" : "more_than_a_day");
        }
        return { ok: false, retryable: false, errorCode: "candidate_position_invalid" };
      }
      positionKeys.add(position.positionKey);
    }
    const currencies = new Set<string>();
    for (const balance of account.balances.items) {
      if (!/^[A-Z]{3}$/u.test(balance.currency) || currencies.has(balance.currency) || !Number.isFinite(balance.amount) ||
          !Number.isFinite(Date.parse(balance.asOf)) || Date.parse(balance.asOf) > Date.parse(candidate.fetchedAt)) {
        return { ok: false, retryable: false, errorCode: "candidate_balance_invalid" };
      }
      currencies.add(balance.currency);
    }
    for (const activity of account.activities.items) {
      if (!/^[0-9a-f]{64}$/u.test(activity.fingerprint) || !activity.activityType ||
          !["exact", "date_only", "unknown"].includes(activity.occurredAtPrecision) ||
          (activity.occurredAtPrecision !== "unknown" && !activity.occurredAt) ||
          (activity.occurredAt !== null && !Number.isFinite(Date.parse(activity.occurredAt))) ||
          !isFiniteNumber(activity.quantity) || !isFiniteNumber(activity.price) ||
          !isFiniteNumber(activity.grossAmount) || !isFiniteNumber(activity.netAmount)) {
        return { ok: false, retryable: false, errorCode: "candidate_activity_invalid" };
      }
    }
  }
  return { ok: true };
}
