import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const cli = resolve("node_modules", "supabase", "dist", "supabase.js");
const output = execFileSync(process.execPath, [cli, "status", "-o", "env"], { encoding: "utf8" });
const env = Object.fromEntries(output.split(/\r?\n/u).map((line) => line.match(/^([A-Z0-9_]+)=(.*)$/u)).filter(Boolean).map((match) => [match[1], match[2].startsWith('"') ? JSON.parse(match[2]) : match[2]]));
const admin = createClient(env.API_URL, env.SERVICE_ROLE_KEY ?? env.SECRET_KEY, { auth: { persistSession: false } });
const owner = createClient(env.API_URL, env.ANON_KEY, { auth: { persistSession: false } });
const other = createClient(env.API_URL, env.ANON_KEY, { auth: { persistSession: false } });
const anon = createClient(env.API_URL, env.ANON_KEY, { auth: { persistSession: false } });
for (const [client, email] of [[owner, "active-subscriber@stockgpt.invalid"], [other, "isolation-user@stockgpt.invalid"]]) {
  const { error } = await client.auth.signInWithPassword({ email, password: "LocalStockGPT!2026" });
  if (error) throw error;
}

const scope = {
  userId: "11111111-1111-4111-8111-111111111111",
  otherUserId: "33333333-3333-4333-8333-333333333333",
  connectionId: "72000000-0000-4000-8000-000000000001",
  otherConnectionId: "72000000-0000-4000-8000-000000000002",
  accountId: "73000000-0000-4000-8000-000000000001",
  otherAccountId: "73000000-0000-4000-8000-000000000002",
};
const worker = "local-wave2-worker";
const fetchedAt = "2026-08-01T00:00:00Z";
const position = {
  positionKey: "instrument:synthetic-1", externalPositionId: null, externalInstrumentId: "synthetic-1",
  instrumentId: null, symbol: "SYNTH", description: "Synthetic position", assetType: "stock",
  quantity: 4, price: 12.5, priceCurrency: "USD", marketValue: null, marketValueCurrency: null, asOf: fetchedAt,
};
const activity = {
  externalActivityId: "wave2-activity-1", fingerprint: "f".repeat(64), fingerprintVersion: "sha256-v1",
  instrumentId: null, activityType: "dividend", occurredAt: fetchedAt, quantity: null, price: null,
  grossAmount: 2, netAmount: 2, currency: "USD", description: "Synthetic dividend",
};
const candidate = {
  fetchedAt,
  providerFreshnessAt: fetchedAt,
  accounts: [{
    externalAccountId: "alpha-account-local-001", externalInstitutionId: "synthetic-institution-1",
    institutionName: "Synthetic Brokerage One", name: "Synthetic Alpha Account", accountType: "general",
    baseCurrency: "USD", status: "active",
    positions: { state: "complete", items: [position] },
    balances: { state: "complete", items: [{ currency: "USD", amount: 123, asOf: fetchedAt }, { currency: "GBP", amount: 22, asOf: fetchedAt }] },
    activities: { state: "complete", items: [activity] },
  }],
};

async function rows(table, accountId = scope.accountId) {
  const { data, error } = await admin.from(table).select("*").eq("account_id", accountId).order("id");
  if (error) throw error;
  return data;
}
async function enqueue(userId = scope.userId, connectionId = scope.connectionId) {
  const { data, error } = await admin.rpc("enqueue_broker_sync", { p_user_id: userId, p_connection_id: connectionId });
  if (error) throw error;
  return data;
}
async function claim(workerId = worker) {
  const { data, error } = await admin.rpc("claim_broker_sync_jobs", { p_worker_id: workerId, p_limit: 1, p_lease_seconds: 120 });
  if (error) throw error;
  return data;
}
async function promote(jobId, value = candidate, workerId = worker) {
  return admin.rpc("promote_broker_sync_candidate", { p_job_id: jobId, p_worker_id: workerId, p_candidate: value });
}
async function fail(jobId, errorCode = "provider_unavailable") {
  const { error } = await admin.rpc("fail_broker_sync_job", {
    p_job_id: jobId, p_worker_id: worker, p_error_code: errorCode, p_retryable: true, p_retry_after_seconds: 1,
  });
  if (error) throw error;
}

try {
  for (const client of [anon, owner, other]) {
    assert((await client.rpc("enqueue_broker_sync", { p_user_id: scope.userId, p_connection_id: scope.connectionId })).error, "Browser enqueued trusted sync");
    assert((await client.rpc("claim_broker_sync_jobs", { p_worker_id: "hostile", p_limit: 1, p_lease_seconds: 120 })).error, "Browser claimed trusted sync");
    assert((await client.rpc("promote_broker_sync_candidate", { p_job_id: scope.connectionId, p_worker_id: "hostile", p_candidate: candidate })).error, "Browser promoted trusted facts");
  }

  const before = { positions: await rows("broker_positions"), balances: await rows("broker_cash_balances"), activities: await rows("broker_activities") };
  assert((await admin.rpc("enqueue_broker_sync", { p_user_id: scope.userId, p_connection_id: scope.otherConnectionId })).error, "Cross-owner enqueue accepted");
  const jobId = await enqueue();
  assert.equal(await enqueue(), jobId, "Duplicate enqueue did not coalesce");
  assert.equal((await owner.from("broker_sync_jobs").select("id")).data?.length, 1);
  assert.equal((await other.from("broker_sync_jobs").select("id")).data?.length, 0);

  const [firstClaim, secondClaim] = await Promise.all([claim(worker), claim("other-worker")]);
  assert.equal(firstClaim.length + secondClaim.length, 1, "Concurrent workers claimed the same job");
  const claimed = firstClaim[0] ?? secondClaim[0];
  const claimingWorker = firstClaim[0] ? worker : "other-worker";
  assert.equal(claimed.attempt_count, 1);
  assert((await promote(jobId, candidate, claimingWorker === worker ? "other-worker" : worker)).error, "Unleased worker promoted facts");

  // A candidate with incomplete positions cannot erase last-good state.
  const unavailable = structuredClone(candidate);
  unavailable.accounts[0].positions = { state: "unavailable", items: [] };
  assert((await promote(jobId, unavailable, claimingWorker)).error, "Unavailable positions were promoted as empty");
  assert.deepEqual(await rows("broker_positions"), before.positions);

  const unknownCash = structuredClone(candidate);
  unknownCash.accounts[0].balances = { state: "unavailable", items: [] };
  assert((await promote(jobId, unknownCash, claimingWorker)).error, "Unknown cash was promoted as zero");
  assert.deepEqual(await rows("broker_cash_balances"), before.balances);

  const initialIncomplete = structuredClone(candidate);
  initialIncomplete.accounts[0].positions = { state: "incomplete", items: [] };
  assert((await promote(jobId, initialIncomplete, claimingWorker)).error, "Incomplete initial sync was promoted as empty");
  assert.deepEqual(await rows("broker_positions"), before.positions);

  const stale = structuredClone(candidate);
  stale.providerFreshnessAt = "2025-12-01T00:00:00Z";
  assert((await promote(jobId, stale, claimingWorker)).error, "Older provider snapshot overwrote newer last-good freshness");
  assert.deepEqual(await rows("broker_positions"), before.positions);

  // Malformed facts fail after promotion has begun, yet the entire DB call rolls back.
  const malformed = structuredClone(candidate);
  malformed.accounts[0].positions.items.push({ ...position, positionKey: "invalid-negative-price", price: -1 });
  assert((await promote(jobId, malformed, claimingWorker)).error, "Malformed DB candidate promoted");
  assert.deepEqual(await rows("broker_positions"), before.positions, "Partial DB failure erased positions");
  assert.deepEqual(await rows("broker_cash_balances"), before.balances, "Partial DB failure altered cash");

  const promoted = await promote(jobId, candidate, claimingWorker);
  if (promoted.error) throw promoted.error;
  const newPositions = await rows("broker_positions");
  const newBalances = await rows("broker_cash_balances");
  assert.equal(newPositions.length, 1);
  assert.equal(newPositions[0].external_instrument_id, "synthetic-1");
  assert.equal(newPositions[0].instrument_id, null);
  assert.equal(newBalances.length, 2);
  assert.equal(newBalances.find((row) => row.currency === "USD")?.amount, 123);
  assert.equal((await rows("broker_activities")).length, before.activities.length + 1);
  const promotedPositionId = newPositions[0].id;
  const promotedUsdBalanceId = newBalances.find((row) => row.currency === "USD").id;
  assert.equal((await admin.from("broker_sync_jobs").select("status").eq("id", jobId).single()).data?.status, "succeeded");

  const replayJob = await enqueue();
  const replayClaim = await claim(worker);
  assert.equal(replayClaim[0].id, replayJob);
  const replay = await promote(replayJob);
  if (replay.error) throw replay.error;
  assert.equal((await rows("broker_activities")).length, before.activities.length + 1, "Replayed activity duplicated");
  assert.equal((await rows("broker_positions")).length, 1, "Replay duplicated positions");
  assert.equal((await rows("broker_positions"))[0].id, promotedPositionId, "Replay changed stable normalized position identity");
  assert.equal((await rows("broker_cash_balances")).find((row) => row.currency === "USD").id, promotedUsdBalanceId, "Replay changed stable balance identity");

  const emptyJob = await enqueue();
  const emptyClaim = await claim(worker);
  assert.equal(emptyClaim[0].id, emptyJob);
  const explicitEmpty = structuredClone(candidate);
  explicitEmpty.accounts[0].positions.items = [];
  const cleared = await promote(emptyJob, explicitEmpty);
  if (cleared.error) throw cleared.error;
  assert.equal((await rows("broker_positions")).length, 0, "Provider-confirmed empty set did not clear positions");

  const failureJob = await enqueue();
  const failureClaim = await claim(worker);
  assert.equal(failureClaim[0].id, failureJob);
  const lastGoodBalances = await rows("broker_cash_balances");
  await fail(failureJob);
  assert.deepEqual(await rows("broker_cash_balances"), lastGoodBalances, "Provider failure erased last-good cash");

  const disconnected = await admin.from("broker_connections").update({ status: "disconnected", disconnected_at: fetchedAt }).eq("id", scope.connectionId);
  if (disconnected.error) throw disconnected.error;
  assert.equal((await rows("broker_cash_balances")).length, 2, "Disconnect deleted normalized history");
} finally {
  await admin.from("broker_connections").update({ status: "active", disconnected_at: null, last_attempted_sync_at: "2026-01-15T12:00:00Z", last_successful_sync_at: "2026-01-15T12:00:00Z" }).eq("id", scope.connectionId);
  await admin.from("broker_sync_jobs").delete().eq("connection_id", scope.connectionId);
  await admin.from("broker_activities").delete().eq("fingerprint", activity.fingerprint);
  await admin.from("broker_positions").delete().eq("account_id", scope.accountId);
  await admin.from("broker_cash_balances").delete().eq("account_id", scope.accountId);
  await admin.from("broker_positions").insert([
    { id: "74000000-0000-4000-8000-000000000001", user_id: scope.userId, account_id: scope.accountId, position_key: "alpha-position-aapl", external_position_id: "alpha-position-local-001", external_instrument_id: "alpha-aapl-001", instrument_id: "60000000-0000-4000-8000-000000000001", symbol: "AAPL", description: "Synthetic mapped position", asset_type: "equity", quantity: 3, price: 121, price_currency: "USD", market_value: 363, market_value_currency: "USD", as_of: "2026-01-15T12:00:00Z" },
    { id: "74000000-0000-4000-8000-000000000003", user_id: scope.userId, account_id: scope.accountId, position_key: "alpha-position-unmapped", external_position_id: "alpha-position-local-003", external_instrument_id: "alpha-unmapped-003", symbol: "LOCAL.UNMAPPED", description: "Synthetic unmapped provider asset", asset_type: "other", quantity: 5, price: 7, price_currency: "GBP", market_value: 35, market_value_currency: "GBP", as_of: "2026-01-15T12:00:00Z" },
  ]);
  await admin.from("broker_cash_balances").insert([
    { id: "75000000-0000-4000-8000-000000000001", user_id: scope.userId, account_id: scope.accountId, currency: "USD", amount: 100, as_of: "2026-01-15T12:00:00Z" },
    { id: "75000000-0000-4000-8000-000000000002", user_id: scope.userId, account_id: scope.accountId, currency: "GBP", amount: 25, as_of: "2026-01-15T12:00:00Z" },
  ]);
  await Promise.all([owner.auth.signOut(), other.auth.signOut()]);
}

console.log("Local broker sync queue, concurrent claim, owner isolation, last-good, rollback, replay and confirmed-empty proofs passed.");
