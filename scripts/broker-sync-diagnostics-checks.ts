import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../lib/database.types";
import type { BrokerCandidateDiagnosticReason, BrokerSyncCandidate, BrokerTimestampAheadBucket } from "../lib/brokerage/sync-candidate";
import { validateBrokerSyncCandidate } from "../lib/brokerage/sync-candidate";
import { processBrokerSyncJob } from "../lib/brokerage/sync-runner";

const asOf = "2026-01-15T12:00:00Z";
const sensitive = "NEVER_LOG_PROVIDER_DATA";
const base: BrokerSyncCandidate = {
  fetchedAt: asOf, providerFreshnessAt: asOf,
  accounts: [{
    externalAccountId: sensitive, externalInstitutionId: sensitive, institutionName: sensitive,
    name: sensitive, accountType: null, baseCurrency: "USD", status: "active",
    positions: { state: "complete", items: [{
      positionKey: sensitive, externalPositionId: sensitive, externalInstrumentId: sensitive,
      instrumentId: null, symbol: sensitive, description: sensitive, assetType: null,
      quantity: 2, price: 10, priceCurrency: "USD", marketValue: 20,
      marketValueCurrency: "USD", asOf,
    }] },
    balances: { state: "complete", items: [] }, activities: { state: "complete", items: [] },
  }],
};

type Fixture = { reason: BrokerCandidateDiagnosticReason; mutate: (candidate: BrokerSyncCandidate) => void; code?: string; aheadBucket?: BrokerTimestampAheadBucket };
const fixtures: Fixture[] = [
  { reason: "missing_position_key", mutate: c => { c.accounts[0].positions.items[0].positionKey = ""; } },
  { reason: "duplicate_position_key", mutate: c => { c.accounts[0].positions.items.push({ ...c.accounts[0].positions.items[0] }); } },
  { reason: "zero_quantity", mutate: c => { c.accounts[0].positions.items[0].quantity = 0; } },
  ...[NaN, Infinity, -Infinity].map(quantity => ({ reason: "invalid_quantity" as const, mutate: (c: BrokerSyncCandidate) => { c.accounts[0].positions.items[0].quantity = quantity; } })),
  ...[NaN, Infinity, -Infinity].map(price => ({ reason: "invalid_price" as const, mutate: (c: BrokerSyncCandidate) => { c.accounts[0].positions.items[0].price = price; } })),
  { reason: "invalid_market_value", mutate: c => { c.accounts[0].positions.items[0].marketValue = NaN; } },
  { reason: "invalid_position_timestamp", mutate: c => { c.accounts[0].positions.items[0].asOf = sensitive; } },
  ...([
    [1, "seconds"], [59_999, "seconds"],
    [60_000, "minutes"], [3_599_999, "minutes"],
    [3_600_000, "hours"], [86_400_000, "hours"], [86_400_001, "more_than_a_day"],
  ] satisfies [number, BrokerTimestampAheadBucket][]).map(([aheadMs, aheadBucket]): Fixture => ({
    reason: "future_position_timestamp", aheadBucket,
    mutate: c => { c.accounts[0].positions.items[0].asOf = new Date(Date.parse(asOf) + aheadMs).toISOString(); },
  })),
  { reason: "invalid_fetched_timestamp", code: "candidate_invalid", mutate: c => { c.fetchedAt = sensitive; } },
  { reason: "invalid_freshness_timestamp", code: "candidate_invalid", mutate: c => { c.providerFreshnessAt = sensitive; } },
  { reason: "future_freshness_timestamp", code: "candidate_invalid", mutate: c => { c.providerFreshnessAt = "2026-01-15T12:00:01Z"; } },
];

const job: Parameters<typeof processBrokerSyncJob>[1] = {
  id: sensitive, connection_id: sensitive, user_id: sensitive, attempt_count: 1,
  available_at: asOf, created_at: asOf, updated_at: asOf, completed_at: null,
  error_code: null, lease_expires_at: null, leased_by: null,
  provider_freshness_at: null, started_at: null, status: "running",
};

async function main() {
  const previousFlag = process.env.STOCKGPT_ALLOW_SNAPTRADE_SANDBOX;
  const originalInfo = console.info;
  const originalWarn = console.warn;
  const originalFetch = globalThis.fetch;
  const logs: unknown[][] = [];
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  const query = {
    select: () => query, eq: () => query,
    single: async () => ({ error: null, data: {
      id: sensitive, user_id: sensitive, provider_id: sensitive,
      external_connection_id: sensitive, status: "active", broker_providers: { provider_key: "snaptrade" },
    } }),
  };
  // Only this explicit in-memory test double can be reached; no real DB/provider.
  const admin = {
    from: () => query,
    rpc: async (name: string, args: Record<string, unknown>) => { calls.push({ name, args }); return { error: null }; },
  } as unknown as SupabaseClient<Database>;
  try {
    globalThis.fetch = async () => { throw new Error("Network forbidden in diagnostic regressions"); };
    console.info = (...args: unknown[]) => { logs.push(args); };
    console.warn = () => {};
    for (const fixture of fixtures) {
      const candidate = structuredClone(base);
      fixture.mutate(candidate);
      const reasons: BrokerCandidateDiagnosticReason[] = [];
      const buckets: (BrokerTimestampAheadBucket | undefined)[] = [];
      const originalCandidate = structuredClone(candidate);
      const validation = validateBrokerSyncCandidate(candidate, (reason, bucket) => { reasons.push(reason); buckets.push(bucket); });
      assert.deepEqual(validation, { ok: false, retryable: false, errorCode: fixture.code ?? "candidate_position_invalid" });
      assert.deepEqual(validateBrokerSyncCandidate(candidate), validation, "Diagnostics changed the validation result");
      assert.deepEqual(reasons, [fixture.reason]);
      assert.deepEqual(buckets, [fixture.aheadBucket]);
      assert.deepEqual(candidate, originalCandidate, "Diagnostic rewrote financial/timestamp evidence");
      for (const flag of [undefined, "false", "TRUE", "true"]) {
        if (flag === undefined) delete process.env.STOCKGPT_ALLOW_SNAPTRADE_SANDBOX;
        else process.env.STOCKGPT_ALLOW_SNAPTRADE_SANDBOX = flag;
        logs.length = 0; calls.length = 0;
        assert.deepEqual(await processBrokerSyncJob(admin, job, sensitive, async () => candidate), { status: "terminal_failure" });
        assert.deepEqual(calls.map(c => c.name), ["fail_broker_sync_job"], "Rejected candidate was promoted or retried");
        assert.equal(calls[0].args.p_error_code, fixture.code ?? "candidate_position_invalid");
        assert.equal(calls[0].args.p_retryable, false);
        assert.deepEqual(logs, flag === "true" ? [["[broker-sync-sandbox-validation]", {
          reason: fixture.reason, ...(fixture.aheadBucket ? { aheadBucket: fixture.aheadBucket } : {}),
        }]] : []);
        assert(!JSON.stringify(logs).includes(sensitive), "Provider data/identity leaked into Sandbox diagnostic");
        assert(!JSON.stringify(logs).includes(candidate.accounts[0].positions.items[0].asOf), "Exact position timestamp leaked");
        assert(!JSON.stringify(logs).includes(asOf), "Exact fetched timestamp leaked");
      }
    }
    process.env.STOCKGPT_ALLOW_SNAPTRADE_SANDBOX = "true";
    for (const offset of [-1, 0]) {
      const candidate = structuredClone(base);
      candidate.accounts[0].positions.items[0].asOf = new Date(Date.parse(asOf) + offset).toISOString();
      const reasons: BrokerCandidateDiagnosticReason[] = [];
      assert.deepEqual(validateBrokerSyncCandidate(candidate, reason => reasons.push(reason)), { ok: true });
      assert.deepEqual(reasons, [], "Non-future timestamp emitted an ahead bucket");
    }
    for (const price of [null, 0, -10, 10]) {
      const candidate = structuredClone(base);
      candidate.accounts[0].positions.items[0].price = price;
      candidate.accounts[0].positions.items[0].quantity = -2;
      candidate.accounts[0].positions.items[0].marketValue = null;
      logs.length = 0; calls.length = 0;
      assert.deepEqual(validateBrokerSyncCandidate(candidate), { ok: true });
      assert.deepEqual(await processBrokerSyncJob(admin, job, sensitive, async () => candidate), { status: "succeeded" });
      assert.deepEqual(calls.map(c => c.name), ["promote_broker_sync_candidate"]);
      assert.deepEqual(logs, [], "Accepted missing price/short position unexpectedly generated a rejection");
    }
    console.info = () => { throw new Error(sensitive); };
    const rejected = structuredClone(base);
    rejected.accounts[0].positions.items[0].quantity = 0;
    assert.deepEqual(await processBrokerSyncJob(admin, job, sensitive, async () => rejected), { status: "terminal_failure" }, "Logging failure changed worker handling");
  } finally {
    console.info = originalInfo; console.warn = originalWarn; globalThis.fetch = originalFetch;
    if (previousFlag === undefined) delete process.env.STOCKGPT_ALLOW_SNAPTRADE_SANDBOX;
    else process.env.STOCKGPT_ALLOW_SNAPTRADE_SANDBOX = previousFlag;
  }
  console.log("Sandbox sync rejection categories, unchanged validation, secret-free logs, default-off behavior and mocked worker handling passed.");
}

main().catch(() => { console.error("Sandbox sync diagnostic regression failed."); process.exitCode = 1; });
