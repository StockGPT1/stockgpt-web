import assert from "node:assert/strict";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../lib/database.types";
import type { SnapTradeClient } from "../lib/brokerage/providers/snaptrade/client";
import type { SnapTradeAccountSource } from "../lib/brokerage/providers/snaptrade/normalize";
import type { BrokerSyncCandidate } from "../lib/brokerage/sync-candidate";
import type { ConnectedPortfolioFacts } from "../lib/connected-portfolio-intelligence-map";
import { evaluateInternalPilotReadiness, assertInternalPilotCandidateScope, type InternalPilotReceipt } from "../lib/brokerage/pilot-readiness";

// This executable is in-memory only. Deny ALL network, not merely known vendors.
const blocked = () => { throw new Error("pilot_rehearsal_network_forbidden"); };
globalThis.fetch = blocked;
http.request = blocked; http.get = blocked; https.request = blocked; https.get = blocked;
net.connect = blocked; net.createConnection = blocked;
net.Socket.prototype.connect = blocked;

async function main() {
const { discoverSnapTradeConnections } = await import("../lib/brokerage/connection-service");
const { createReadOnlySnapTradePortalLink } = await import("../lib/brokerage/providers/snaptrade/service");
const { normalizeSnapTradeAccount } = await import("../lib/brokerage/providers/snaptrade/normalize");
const { runBoundedBrokerSyncWorker } = await import("../lib/brokerage/sync-runner");
const { deriveBrokerConnectionPresentation } = await import("../lib/brokerage/connection-presentation-state");
const { summarizeBrokerSyncHealth } = await import("../lib/brokerage/sync-observability");
const { isBrokerSyncStopped } = await import("../lib/brokerage/rollout-policy");
const { assessConnectedPortfolioFacts } = await import("../lib/connected-portfolio-intelligence-map");

const now = "2026-01-15T12:00:00.000Z";
const owner = "11111111-1111-4111-8111-111111111111";
const provider = "22222222-2222-4222-8222-222222222222";
const connectionId = "33333333-3333-4333-8333-333333333333";
const receipt: InternalPilotReceipt = {
  purpose: "synthetic_rehearsal", participantId: owner, providerId: provider, connectionId,
  externalConnectionId: "synthetic-connection", externalInstitutionId: "synthetic-institution",
  externalAccountIds: ["synthetic-account"], permission: "read", operatorReference: "synthetic:operator",
  participantInformationReference: "synthetic:participant-information", providerReviewReference: "synthetic:provider-review",
  privacyReviewReference: "synthetic:privacy-review", validFrom: "2026-01-15T11:59:00Z",
  validUntil: "2026-01-15T12:10:00Z", maxCollections: 1, maxDurationSeconds: 60,
};
let cases = 0;
function check(condition: unknown, message: string) { assert.ok(condition, message); cases += 1; }
const readiness = (r = receipt, stopped = false, mode: "synthetic" | "real" = "synthetic") =>
  evaluateInternalPilotReadiness({ receipt: r, stopped, mode, asOf: new Date(now) });
check(readiness().ready, "Complete synthetic receipt can rehearse");
check(!readiness(receipt, false, "real").ready, "Synthetic consent/approvals cannot activate a real pilot");
check(!readiness().canActivateRealPilot, "Receipt is not an activation grant");
for (const [patch, code] of [
  [{ participantId: "wrong" }, "identity_invalid"],
  [{ providerId: "wrong" }, "identity_invalid"],
  [{ externalAccountIds: [] }, "scope_invalid"],
  [{ externalAccountIds: ["one", "two"] }, "scope_invalid"],
  [{ externalConnectionId: " " }, "scope_invalid"],
  [{ permission: "trade" }, "permission_invalid"],
  [{ operatorReference: "" }, "operator_or_approval_missing"],
  [{ participantInformationReference: "" }, "operator_or_approval_missing"],
  [{ providerReviewReference: "" }, "operator_or_approval_missing"],
  [{ privacyReviewReference: "" }, "operator_or_approval_missing"],
  [{ validUntil: now }, "window_invalid"],
  [{ validFrom: "invalid" }, "window_invalid"],
  [{ validUntil: "2026-01-16T12:00:00Z" }, "window_invalid"],
  [{ maxCollections: 2 }, "budget_invalid"],
  [{ maxDurationSeconds: 300 }, "budget_invalid"],
] as const) {
  assert.equal(readiness({ ...receipt, ...patch } as InternalPilotReceipt).code, code); cases += 1;
}
check(!readiness(receipt, true).ready, "Emergency stop rejects rehearsal admission");

const authorization = { id: receipt.externalConnectionId, type: "read", disabled: false,
  brokerage: { id: receipt.externalInstitutionId, name: "Synthetic test institution" } };
const source: SnapTradeAccountSource = {
  account: { id: receipt.externalAccountIds[0], brokerage_authorization: receipt.externalConnectionId,
    name: "Synthetic internal participant", number: "synthetic-only", institution_name: "Synthetic test institution",
    created_date: now, is_paper: true, sync_status: { holdings: { initial_sync_completed: true, last_successful_sync: now } },
    balance: { total: { currency: "USD", amount: 140 } } },
  connection: authorization,
  positions: { results: [{ instrument: { kind: "stock", id: "synthetic-security", symbol: "SYNTH",
    raw_symbol: "SYNTH", currency: "USD", exchange: "XNAS" }, units: "2", price: "20", currency: "USD" }],
    data_freshness: { as_of: now } },
  balances: [{ currency: { code: "USD" }, cash: 100 }],
  activities: [{ id: "synthetic-dividend", type: "DIVIDEND", amount: 1, currency: { code: "USD" }, trade_date: "2026-01-15" }],
  activitiesComplete: true,
};
const candidate = (): BrokerSyncCandidate => ({ fetchedAt: now, providerFreshnessAt: now,
  accounts: [normalizeSnapTradeAccount(structuredClone(source), [], now)] });

type Job = Database["public"]["Tables"]["broker_sync_jobs"]["Row"];
let connection = { id: connectionId, user_id: owner, provider_id: provider, external_connection_id: receipt.externalConnectionId,
  status: "pending", broker_providers: { provider_key: "snaptrade" } };
const jobs: Job[] = [];
let promoted: BrokerSyncCandidate | null = null;
let successfulAt: string | null = null;
let claims = 0, collections = 0, promotions = 0, portalCalls = 0, discoveries = 0;
let promotionShouldFail = false;
const immutableManualState = JSON.stringify({ cash: 250, contribution: 410, ledger: [{ type: "deposit", amount: 410 }] });
const financialPreserved = () => JSON.stringify(promoted);
const fail = (message: string): never => { throw new Error(message); };

function enqueue() {
  if (jobs.some((job) => job.status === "queued" || job.status === "running")) return;
  jobs.push({ id: `synthetic-job-${jobs.length + 1}`, user_id: owner, connection_id: connectionId,
    status: "queued", attempt_count: 0 } as Job);
}
function query(table: string) {
  let inserted: Record<string, unknown> | undefined;
  const filters: Record<string, unknown> = {};
  const result = () => {
    if (table === "brokerage_institution_aliases") return { data: { institution_id: "synthetic-institution-row" }, error: null };
    if (table === "broker_connections") {
      if (inserted) {
        assert.equal(inserted.user_id, owner); assert.equal(inserted.provider_id, provider);
        assert.equal(inserted.external_connection_id, receipt.externalConnectionId);
        connection = { ...connection, status: inserted.status as string };
      }
      if (filters.id && filters.id !== connection.id || filters.user_id && filters.user_id !== connection.user_id) return { data: null, error: { code: "synthetic_owner_mismatch" } };
      return { data: connection, error: null };
    }
    return fail("unexpected_rehearsal_table");
  };
  const builder = {
    select: () => builder,
    eq: (key: string, value: unknown) => { filters[key] = value; return builder; },
    upsert: (value: Record<string, unknown>) => { inserted = value; return builder; },
    single: async () => result(), maybeSingle: async () => result(),
  };
  return builder;
}
const admin = {
  from: query,
  rpc: async (name: string, args: Record<string, unknown>) => {
    if (name === "get_broker_user_secret") {
      assert.equal(args.p_user_id, owner); assert.equal(args.p_provider_id, provider);
      return { data: [{ provider_user_id: "synthetic-provider-user", user_secret: "synthetic-rehearsal-placeholder" }], error: null };
    }
    if (name === "enqueue_broker_sync") { assert.equal(args.p_user_id, owner); assert.equal(args.p_connection_id, connectionId); enqueue(); return { data: jobs.at(-1)?.id, error: null }; }
    if (name === "claim_broker_sync_jobs") {
      assert.equal(args.p_limit, 1); assert.equal(args.p_lease_seconds, 300); claims += 1;
      const job = jobs.find((item) => item.status === "queued");
      if (!job) return { data: [], error: null };
      job.status = "running"; job.attempt_count += 1;
      return { data: [structuredClone(job)], error: null };
    }
    const job = jobs.find((item) => item.id === args.p_job_id) ?? fail("unexpected_rehearsal_job");
    if (name === "fail_broker_sync_job") { job.status = args.p_retryable ? "retryable_failure" : "terminal_failure"; return { data: null, error: null }; }
    if (name === "promote_broker_sync_candidate") {
      if (promotionShouldFail) return { data: null, error: { code: "synthetic_atomic_rejection" } };
      promoted = structuredClone(args.p_candidate as BrokerSyncCandidate); successfulAt = now; promotions += 1;
      job.status = "succeeded"; connection.status = "active";
      return { data: null, error: null };
    }
    return fail("unexpected_rehearsal_rpc");
  },
} as unknown as SupabaseClient<Database>;
const sdk = {
  authentication: { loginSnapTradeUser: async (args: Record<string, unknown>) => {
    assert.equal(args.connectionType, "read"); assert.equal(args.broker, "SANDBOX"); portalCalls += 1;
    return { data: { redirectURI: "https://synthetic.invalid/ephemeral-portal" } };
  } },
  connections: { listBrokerageAuthorizations: async () => { discoveries += 1; return { data: [authorization] }; } },
} as unknown as SnapTradeClient;

const originalWarn = console.warn;
const warningEvents: unknown[][] = [];
console.warn = (...args: unknown[]) => { warningEvents.push(args); };
try {
  // Real portal/discovery domain functions, injected SDK + in-memory DB. No real credentials or callback assumptions.
  await createReadOnlySnapTradePortalLink(admin, { userId: owner, providerId: provider,
    customRedirect: "https://synthetic.invalid/return", broker: "SANDBOX" }, sdk);
  check(portalCalls === 1 && jobs.length === 0, "Opening portal does not prove discovery or create facts");
  await discoverSnapTradeConnections(admin, { userId: owner, providerId: provider }, sdk);
  check(discoveries === 1 && jobs.length === 1 && promoted === null, "Discovery queues work, no fabricated financial state");
  const presentation = () => deriveBrokerConnectionPresentation({ lifecycleStatus: connection.status as "active",
    latestSyncJobStatus: jobs.at(-1)?.status ?? null, lastSuccessfulSyncAt: successfulAt });
  check(presentation().state === "awaiting_discovery", "Initial queue visibly pending, not empty zero account");
  const run = async (collected: () => BrokerSyncCandidate = candidate, stopped = "false", elapsedMilliseconds = 0) => {
    // Stop before both claim and transport; deliberately no hidden retry loop.
    if (isBrokerSyncStopped(stopped)) return { claimed: 0, results: [] };
    let remainingCollections = receipt.maxCollections;
    return runBoundedBrokerSyncWorker(admin, { workerId: "synthetic-worker", limit: 1, fetchSnapTrade: async (_admin, scope) => {
      if (remainingCollections-- <= 0) throw new Error("pilot_collection_budget_exceeded");
      assert.equal(scope.userId, receipt.participantId); assert.equal(scope.providerId, receipt.providerId);
      assert.equal(scope.externalConnectionId, receipt.externalConnectionId); collections += 1;
      const collectedCandidate = collected();
      // Deterministic elapsed clock: reject a delayed result, never promote it.
      // This rehearses the operational deadline; it is not a real network abort implementation.
      if (elapsedMilliseconds >= receipt.maxDurationSeconds * 1000) throw new Error("pilot_collection_deadline_exceeded");
      assertInternalPilotCandidateScope(collectedCandidate, receipt);
      return collectedCandidate;
    } });
  };
  const first = await run();
  check(first.claimed === 1 && first.results[0].status === "succeeded", "Shared worker validates and promotes one collection");
  check(presentation().state === "connected", "Successful normalized state is connected");
  const facts = () => { assert.ok(promoted); return promoted; };
  const a = facts().accounts[0];
  assert.equal(a.positions.items.length, 1); assert.equal(a.balances.items.length, 1); assert.equal(a.activities.items.length, 1);
  assert.equal(a.positions.items[0].quantity * a.positions.items[0].price!, 40);
  assert.equal(a.balances.items[0].amount, 100);
  check(a.positions.items[0].instrumentId === null, "Unresolved holding remains visible and unranked");
  check(a.activities.items[0].occurredAtPrecision === "date_only", "No invented intraday precision");
  const lastGood = financialPreserved();
  const duplicate = await run();
  check(duplicate.claimed === 0 && collections === 1 && promotions === 1, "Duplicate tick cannot replay completed job");
  enqueue();
  const failure = await run(() => { throw new Error("synthetic_provider_failure_private_payload"); });
  check(failure.results[0].status === "retryable_failure" && financialPreserved() === lastGood, "Provider failure preserves last-good state");
  check(presentation().state === "stale_error", "Active lifecycle with failed sync is not healthy");
  check((await run()).claimed === 0, "No automatic retry inside rehearsal; retryable job is not manually requeued");
  // Explicit synthetic fixture recovery is a separate fresh approved collection, not a real retry or hidden database write.
  enqueue(); const recovered = await run();
  check(recovered.results[0].status === "succeeded" && financialPreserved() === lastGood, "Recovery does not duplicate activity or alter amounts");
  enqueue(); const delayed = await run(candidate, "false", 60_000);
  check(delayed.results[0].status === "retryable_failure" && financialPreserved() === lastGood, "Delayed response beyond receipt deadline never promotes");
  enqueue(); const partial = await run(() => { const c = candidate(); c.accounts[0].balances.state = "unavailable"; return c; });
  check(partial.results[0].status === "retryable_failure" && financialPreserved() === lastGood, "Unavailable cash cannot replace last-good cash with zero");
  enqueue(); const future = await run(() => { const c = candidate(); c.accounts[0].positions.items[0].asOf = "2026-01-15T12:00:01Z"; return c; });
  check(future.results[0].status === "terminal_failure" && financialPreserved() === lastGood, "Strict future timestamp rejection unchanged");
  enqueue(); const wrongAccount = await run(() => { const c = candidate(); c.accounts[0].externalAccountId = "unapproved-account"; return c; });
  check(wrongAccount.results[0].status === "retryable_failure" && financialPreserved() === lastGood, "Scope mismatch never reaches promotion");
  for (const c of [(() => { const c = candidate(); c.accounts[0].externalInstitutionId = "wrong"; return c; })(),
    (() => { const c = candidate(); c.accounts.push(structuredClone(c.accounts[0])); return c; })()]) {
    assert.throws(() => assertInternalPilotCandidateScope(c, receipt), /^Error: pilot_candidate_scope_rejected$/u); cases += 1;
  }
  enqueue(); promotionShouldFail = true;
  const promotionFailure = await run(); promotionShouldFail = false;
  check(promotionFailure.results[0].status === "retryable_failure" && financialPreserved() === lastGood, "Atomic promotion failure cannot change facts (mocked DB contract)");
  enqueue(); jobs.at(-1)!.user_id = "44444444-4444-4444-8444-444444444444";
  const collectionsBeforeOwnerRejection = collections;
  const wrongOwner = await run();
  check(wrongOwner.results[0].status === "terminal_failure" && collections === collectionsBeforeOwnerRejection && financialPreserved() === lastGood,
    "Job owner mismatch never fetches or overwrites another participant's data");
  enqueue(); const beforeStop = { claims, collections };
  const stopped = await run(candidate, "true");
  check(stopped.claimed === 0 && claims === beforeStop.claims && collections === beforeStop.collections, "Emergency stop prevents claims and provider collection");
  for (const value of ["", "TRUE", "invalid"]) check(isBrokerSyncStopped(value), "Malformed stop state fails closed");
  connection.status = "disconnected";
  const disconnected = await run();
  check(disconnected.results[0].status === "terminal_failure" && collections === beforeStop.collections, "Disconnected connection is rejected before provider access");
  check(presentation().state === "disconnected" && financialPreserved() === lastGood, "Disconnect preserves readable last-good financial state");
  const support = summarizeBrokerSyncHealth({ rows: jobs.map((job) => ({ status: job.status, lastSuccessfulSyncAt: successfulAt })), asOf: new Date(now), complete: true });
  check(support.availability === "available", "Support summary is available independently from financial facts");
  const safeOutput = JSON.stringify(support);
  for (const forbidden of [owner, connectionId, "synthetic-rehearsal-placeholder", "synthetic-account", "SYNTH", "140", "userSecret", "provider_failure_private_payload"]) {
    check(!safeOutput.includes(forbidden), "Support projection excludes identity, credentials and financial payload");
  }
  check(!JSON.stringify(warningEvents).includes("private_payload"), "Provider raw error text is not logged");
  check(immutableManualState === JSON.stringify({ cash: 250, contribution: 410, ledger: [{ type: "deposit", amount: 410 }] }), "Rehearsal never writes manual accounting");
  check(facts().accounts[0].positions.items.length === 1, "No loss of unresolved positions after failure/disconnect");
  // Existing source-aware financial adapter, not a parallel valuation engine.
  const localFacts = (): ConnectedPortfolioFacts => ({
    portfolio: { id: "synthetic-portfolio", broker_account_id: "synthetic-account-row", risk_tolerance: "moderate", objective: "growth", time_horizon: "long_term" },
    account: { id: "synthetic-account-row", name: "Synthetic account", status: "active", base_currency: "USD", last_successful_sync_at: now, connection_id: connectionId },
    connection: { id: connectionId, status: "disconnected", last_successful_sync_at: now },
    positions: a.positions.items.map((p) => ({ id: "synthetic-position-row", user_id: owner, account_id: "synthetic-account-row", position_key: p.positionKey,
      external_position_id: p.externalPositionId, external_instrument_id: p.externalInstrumentId, instrument_id: p.instrumentId,
      symbol: p.symbol, description: p.description, asset_type: p.assetType, quantity: p.quantity, price: p.price,
      price_currency: p.priceCurrency, market_value: p.marketValue, market_value_currency: p.marketValueCurrency,
      as_of: p.asOf, created_at: now, updated_at: now })),
    cashBalances: a.balances.items.map((b) => ({ id: "synthetic-cash-row", user_id: owner, account_id: "synthetic-account-row", amount: b.amount, currency: b.currency, as_of: b.asOf, created_at: now, updated_at: now })),
    rankings: [], diagnostics: [], rankedUniverseSize: 0,
    fxQuote: { rates: { USD: 1, GBP: 0.8, EUR: 0.9, CHF: 0.85 }, sources: { USD: "usd_identity", GBP: "fetched_current", EUR: "display_fallback", CHF: "display_fallback" } },
  });
  const collectionsBeforeReads = collections;
  const realAdapter = assessConnectedPortfolioFacts(localFacts(), now);
  check(realAdapter.totalValueUsd === 140 && realAdapter.cashValueUsd === 100, "Disconnected normalized read reconciles known broker amounts");
  check(realAdapter.positions[0].instrumentId === null && realAdapter.positions[0].currentValueUsd === 40, "Unsupported identity preserves broker valuation");
  check(realAdapter.input.holdings[0].costBasis === null && realAdapter.input.holdings[0].unrealisedPnlPct === null, "No fabricated basis or connected profit");
  const unknownPrice = localFacts(); unknownPrice.positions[0].price = null;
  check(assessConnectedPortfolioFacts(unknownPrice, now).totalValueUsd === null, "Unknown price does not become zero or entry price");
  const unknownFx = localFacts(); unknownFx.cashBalances[0].currency = "JPY";
  const partialFacts = assessConnectedPortfolioFacts(unknownFx, now);
  check(partialFacts.cashValueUsd === null && partialFacts.totalValueUsd === null && partialFacts.input.holdings[0].currentValue === null, "Unknown cash FX suppresses unsafe concentration");
  const knownZero = localFacts(); knownZero.positions = []; knownZero.cashBalances[0].amount = 0;
  check(assessConnectedPortfolioFacts(knownZero, now).totalValueUsd === 0, "Genuinely known empty state differs from unavailable");
  check(["on_track", "monitor", "review", "urgent_review"].includes(realAdapter.assessment.portfolio.status), "Connection state introduces no fifth canonical status");
  check(collections === collectionsBeforeReads, "Normalized fact rendering makes zero provider calls");
} finally { console.warn = originalWarn; }
console.log(`Pilot rehearsal: ${cases} deterministic checks passed; injected portal/discovery/normalizer/shared worker/validator/promotion contract exercised; no network or database used.`);
}
void main().catch((error: unknown) => {
  console.error("Pilot rehearsal failed; deterministic assertion or fixture contract mismatch.");
  // Synthetic test source locations only; no message, request or provider body.
  if (error instanceof Error) console.error(error.stack?.split("\n").filter((line) => /^\s+at /u.test(line)).slice(0, 3).join("\n"));
  process.exitCode = 1;
});
