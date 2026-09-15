export type BrokerCandidateAvailability = "complete" | "incomplete" | "unavailable";

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

export function validateBrokerSyncCandidate(candidate: BrokerSyncCandidate): BrokerCandidateValidation {
  if (!Number.isFinite(Date.parse(candidate.fetchedAt)) ||
      !Number.isFinite(Date.parse(candidate.providerFreshnessAt)) ||
      Date.parse(candidate.providerFreshnessAt) > Date.parse(candidate.fetchedAt) ||
      candidate.accounts.length === 0) {
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
          !isFiniteNumber(activity.quantity) || !isFiniteNumber(activity.price) ||
          !isFiniteNumber(activity.grossAmount) || !isFiniteNumber(activity.netAmount)) {
        return { ok: false, retryable: false, errorCode: "candidate_activity_invalid" };
      }
    }
  }
  return { ok: true };
}
