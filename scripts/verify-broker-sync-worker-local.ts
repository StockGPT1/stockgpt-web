import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../lib/database.types";
import type { BrokerSyncCandidate } from "../lib/brokerage/sync-candidate";
import { runBoundedBrokerSyncWorker } from "../lib/brokerage/sync-runner";

const cli = resolve("node_modules", "supabase", "dist", "supabase.js");
const output = execFileSync(process.execPath, [cli, "status", "-o", "env"], { encoding: "utf8" });
const env = Object.fromEntries(output.split(/\r?\n/u).map((line) => line.match(/^([A-Z0-9_]+)=(.*)$/u)).filter((match): match is RegExpMatchArray => match !== null).map((match) => [match[1], match[2].startsWith('"') ? JSON.parse(match[2]) : match[2]]));
const admin = createClient<Database>(env.API_URL, env.SERVICE_ROLE_KEY ?? env.SECRET_KEY, { auth: { persistSession: false } });
const userId = "11111111-1111-4111-8111-111111111111";
let providerId = "";
const connectionId = "72000000-0000-4000-8000-000000000099";
const institutionId = "71000000-0000-4000-8000-000000000001";
const asOf = "2026-09-01T00:00:00Z";
const candidate: BrokerSyncCandidate = {
  fetchedAt: asOf,
  providerFreshnessAt: asOf,
  accounts: [{
    externalAccountId: "worker-account-local-099", externalInstitutionId: "synthetic-institution-1",
    institutionName: "Synthetic Brokerage One", name: "Synthetic worker account",
    accountType: "general", baseCurrency: "USD", status: "active",
    positions: { state: "complete", items: [{
      positionKey: "synthetic-position-1", externalPositionId: null, externalInstrumentId: "synthetic-instrument-1",
      instrumentId: null, symbol: "SYNTH", description: "Synthetic worker position", assetType: "stock",
      quantity: 2, price: 10, priceCurrency: "USD", marketValue: null, marketValueCurrency: null, asOf,
    }] },
    balances: { state: "complete", items: [{ currency: "USD", amount: 50, asOf }] },
    activities: { state: "complete", items: [] },
  }],
};

async function main() {
try {
  const provider = await admin.from("broker_providers").select("id").eq("provider_key", "snaptrade").single();
  if (provider.error) throw provider.error;
  providerId = provider.data.id;
  const connection = await admin.from("broker_connections").insert({
    id: connectionId, user_id: userId, provider_id: providerId, institution_id: institutionId,
    external_connection_id: "worker-connection-local-099", status: "active",
  });
  if (connection.error) throw connection.error;

  const queued = await admin.rpc("enqueue_broker_sync", { p_user_id: userId, p_connection_id: connectionId });
  if (queued.error) throw queued.error;
  const success = await runBoundedBrokerSyncWorker(admin, {
    workerId: "synthetic-worker-success", limit: 1,
    fetchSnapTrade: async (_admin, scope) => {
      assert.equal(scope.userId, userId);
      assert.equal(scope.providerId, providerId);
      assert.equal(scope.externalConnectionId, "worker-connection-local-099");
      return candidate;
    },
  });
  assert.equal(success.claimed, 1);
  assert.equal(success.results[0].status, "succeeded");
  const account = await admin.from("broker_accounts").select("id").eq("connection_id", connectionId).single();
  if (account.error) throw account.error;
  const before = await admin.from("broker_positions").select("id,position_key,quantity").eq("account_id", account.data.id);
  if (before.error) throw before.error;
  assert.equal(before.data.length, 1);

  const retry = await admin.rpc("enqueue_broker_sync", { p_user_id: userId, p_connection_id: connectionId });
  if (retry.error) throw retry.error;
  const failure = await runBoundedBrokerSyncWorker(admin, {
    workerId: "synthetic-worker-failure", limit: 1,
    fetchSnapTrade: async () => { throw new Error("Synthetic upstream timeout with payload that must never be logged"); },
  });
  assert.equal(failure.claimed, 1);
  assert.equal(failure.results[0].status, "retryable_failure");
  const after = await admin.from("broker_positions").select("id,position_key,quantity").eq("account_id", account.data.id);
  if (after.error) throw after.error;
  assert.deepEqual(after.data, before.data, "Failed fetch changed last-good account facts");
  const job = await admin.from("broker_sync_jobs").select("status,error_code").eq("id", retry.data).single();
  if (job.error) throw job.error;
  assert.equal(job.data.status, "retryable_failure");
  assert.equal(job.data.error_code, "provider_unavailable");
} finally {
  await admin.from("broker_connections").delete().eq("id", connectionId);
}

console.log("Local injected-provider worker queue→fetch→validate→promote and failure-preserves-last-good passed.");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Broker worker test failed");
  process.exitCode = 1;
});
