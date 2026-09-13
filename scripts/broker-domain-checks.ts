import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { brokerActivityFingerprint } from "../lib/brokerage/activity-fingerprint";

const base = {
  providerKey: "synthetic_alpha",
  externalAccountId: "account-1",
  activityType: "trade",
  occurredAt: "2026-01-10T10:00:00Z",
  externalInstrumentId: "instrument-1",
  quantity: "2",
  price: "10.25",
  grossAmount: "20.50",
  netAmount: "20.50",
  currency: "USD",
};
const first = brokerActivityFingerprint(base);
assert.match(first, /^[0-9a-f]{64}$/u);
assert.equal(brokerActivityFingerprint(base), first);
assert.notEqual(brokerActivityFingerprint({ ...base, quantity: "3" }), first);

const providerIdentity = brokerActivityFingerprint({ ...base, externalActivityId: "event-1" });
assert.equal(providerIdentity, brokerActivityFingerprint({ ...base, externalActivityId: "event-1", quantity: "999" }));
assert.notEqual(providerIdentity, brokerActivityFingerprint({ ...base, externalActivityId: "event-2" }));

const migration = readFileSync("supabase/migrations/20260913175530_establish_provider_neutral_broker_domain.sql", "utf8");
const types = readFileSync("lib/brokerage/types.ts", "utf8");
assert(!/snaptrade/iu.test(migration + types), "Core broker domain leaked a provider-specific contract");
assert(!/raw[_ ]?(payload|response|json)/iu.test(migration), "Core broker schema added unrestricted provider payload storage");
assert(!/portfolio_id/iu.test(migration.match(/create table public\.broker_accounts[\s\S]*?\n\);/u)?.[0] ?? ""), "Broker account was collapsed into a StockGPT Portfolio");

console.log("Provider-neutral broker type and deterministic activity identity contracts passed.");
