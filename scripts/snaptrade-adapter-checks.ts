import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { Account, AccountPosition, Balance, BrokerageAuthorization, AccountUniversalActivity } from "snaptrade-typescript-sdk";
import { normalizeSnapTradeAccount, snapTradeProviderUserId } from "../lib/brokerage/providers/snaptrade/normalize";
import { validateBrokerSyncCandidate } from "../lib/brokerage/sync-candidate";

const asOf = "2026-01-15T12:00:00Z";
const account: Account = {
  id: "account-1",
  brokerage_authorization: "connection-1",
  name: "Synthetic brokerage account",
  number: "masked",
  institution_name: "Synthetic Brokerage",
  created_date: asOf,
  sync_status: { holdings: { initial_sync_completed: true, last_successful_sync: asOf } },
  balance: { total: { amount: 1000, currency: "USD" } },
  is_paper: true,
};
const connection: BrokerageAuthorization = { id: "connection-1", disabled: false, type: "read", brokerage: { id: "broker-1", name: "Synthetic Brokerage" } };
const position: AccountPosition = {
  instrument: { kind: "stock", id: "provider-stock-1", symbol: "AAA", raw_symbol: "AAA", currency: "USD", exchange: "XNAS" },
  units: "2",
  price: "10.50",
  currency: "USD",
};
const unresolved: AccountPosition = {
  instrument: { kind: "etf", id: "provider-etf-2", symbol: "BBB", raw_symbol: "BBB", currency: "GBP", exchange: "XLON" },
  units: "3",
  price: null,
  currency: "GBP",
};
const balances: Balance[] = [
  { currency: { code: "USD" }, cash: 100.25 },
  { currency: { code: "GBP" }, cash: 50 },
];
const activities: AccountUniversalActivity[] = [{
  id: "activity-1", type: "DIVIDEND", amount: 2.5, currency: { code: "USD" }, trade_date: asOf,
}];
const aliases = [{ instrumentId: "60000000-0000-4000-8000-000000000001", namespace: "snaptrade.instrument", scope: "", value: "provider-stock-1" }];
const source = { account, connection, positions: { results: [position, unresolved], data_freshness: { as_of: asOf } }, balances, activities, activitiesComplete: true };

assert.equal(snapTradeProviderUserId("11111111-1111-4111-8111-111111111111"), "stockgpt-11111111-1111-4111-8111-111111111111");
assert.throws(() => snapTradeProviderUserId("user@example.invalid"));

const normalized = normalizeSnapTradeAccount(source, aliases, asOf);
assert.equal(normalized.externalAccountId, "account-1");
assert.equal(normalized.externalInstitutionId, "broker-1");
assert.equal(normalized.institutionName, "Synthetic Brokerage");
assert.equal(normalized.positions.state, "complete");
assert.equal(normalized.positions.items[0].instrumentId, aliases[0].instrumentId);
assert.equal(normalized.positions.items[1].instrumentId, null);
assert.equal(normalized.positions.items[1].externalInstrumentId, "provider-etf-2");
assert.equal(normalized.positions.items[1].price, null);
assert.equal(normalized.positions.items[1].marketValue, null);
assert.deepEqual(normalized.balances.items.map((item) => item.currency), ["USD", "GBP"]);
assert.equal(normalized.activities.items.length, 1);
assert.match(normalized.activities.items[0].fingerprint, /^[0-9a-f]{64}$/u);
assert.deepEqual(validateBrokerSyncCandidate({ fetchedAt: asOf, providerFreshnessAt: asOf, accounts: [normalized] }), { ok: true });

for (const change of [
  { connection: { ...connection, disabled: true } },
  { account: { ...account, sync_status: { holdings: { ...account.sync_status.holdings, holdings_unavailable: true } } } },
  { account: { ...account, sync_status: { holdings: { initial_sync_completed: false } } } },
  { positions: null },
]) {
  const candidate = normalizeSnapTradeAccount({ ...source, ...change }, aliases, asOf);
  assert.notEqual(candidate.positions.state, "complete", "Provider uncertainty was mistaken for confirmed empty positions");
  if (!("positions" in change)) {
    assert.notEqual(candidate.balances.state, "complete", "Provider uncertainty was mistaken for confirmed empty cash");
  }
  assert.equal(validateBrokerSyncCandidate({ fetchedAt: asOf, providerFreshnessAt: asOf, accounts: [candidate] }).ok, false);
}

const explicitEmpty = normalizeSnapTradeAccount({ ...source, positions: { results: [], data_freshness: { as_of: asOf } }, balances: [] }, aliases, asOf);
assert.equal(explicitEmpty.positions.state, "complete");
assert.equal(explicitEmpty.positions.items.length, 0);
assert.equal(validateBrokerSyncCandidate({ fetchedAt: asOf, providerFreshnessAt: asOf, accounts: [explicitEmpty] }).ok, true);

const service = readFileSync("lib/brokerage/providers/snaptrade/service.ts", "utf8");
const client = readFileSync("lib/brokerage/providers/snaptrade/client.ts", "utf8");
assert.match(service, /connectionType:\s*"read"/u);
assert.match(service, /resetSnapTradeUserSecret/u);
assert(!/\.trading\.|getUserHoldings|refreshBrokerageAuthorization|place(Order|ForceOrder|MlegOrder|ComplexOrder)/u.test(service + client));
assert.match(service, /getAllAccountPositions/u);
assert.match(service, /getUserAccountBalance/u);
assert.match(service, /getAccountActivities/u);
assert.match(service, /offset:\s*page \* PAGE_SIZE/u);
assert(!/NEXT_PUBLIC_SNAPTRADE/u.test(service + client));

console.log("SnapTrade fixture normalization, uncertain freshness, explicit empty, identity, pagination and read-only source guards passed.");
