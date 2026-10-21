import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { mock } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../lib/database.types";
import { runStage22bProof, PROOF_EXECUTION_MS } from "../lib/brokerage/stage22b-execution";
import { APPROVED_STAGE22B_PROOFS, STAGE22B_SCOPE, type Stage22bApproval } from "../lib/brokerage/stage22b-proof";
import { createProofSnapTradeClient, PROOF_PROVIDER_LIMITS } from "../lib/brokerage/providers/snaptrade/proof-transport";
import { snapTradeProviderUserId } from "../lib/brokerage/providers/snaptrade/normalize";
import { fetchSnapTradeSyncCandidate } from "../lib/brokerage/providers/snaptrade/service";
import { validateBrokerSyncCandidate } from "../lib/brokerage/sync-candidate";

const id = (n: number) => `11111111-1111-4111-8111-${String(n).padStart(12, "0")}`;
const now = Date.parse("2026-10-16T07:17:00Z");
const env = {
  NODE_ENV: "production", VERCEL: "1", VERCEL_PROJECT_ID: STAGE22B_SCOPE.projectId,
  VERCEL_ENV: "production", VERCEL_TARGET_ENV: "production", VERCEL_GIT_COMMIT_REF: STAGE22B_SCOPE.branch,
  STOCKGPT_STAGE22B_TEAM_ID: STAGE22B_SCOPE.teamId, NEXT_PUBLIC_SUPABASE_URL: STAGE22B_SCOPE.supabaseUrl,
  STOCKGPT_STAGE22B_PROOF_ENABLED: "true", STOCKGPT_ALLOW_SNAPTRADE_SANDBOX: "true",
  STOCKGPT_STAGE22B_KEY_CLASSIFICATION: "commercial_test", STOCKGPT_STAGE22B_BROKER: "SANDBOX",
  STOCKGPT_STAGE22B_NOT_BEFORE: "2026-10-16T07:00:00Z", STOCKGPT_STAGE22B_EXPIRES_AT: "2026-10-16T08:00:00Z",
  STOCKGPT_STAGE22B_JOB_ID: id(1), SUPABASE_SERVICE_ROLE_KEY: "synthetic-db-secret",
  SNAPTRADE_CLIENT_ID: "synthetic-client", SNAPTRADE_CONSUMER_KEY: "synthetic-consumer",
};
const approval: Stage22bApproval = {
  jobId: id(1), userId: id(2), connectionId: id(3), providerId: id(4), institutionId: id(5),
  externalConnectionId: id(6), externalInstitutionId: id(7), externalAccountIds: [id(8), id(9)],
  broker: "SANDBOX", permission: "read", keyClassification: "commercial_test",
  credentialPairSha256: createHash("sha256").update(JSON.stringify([env.SNAPTRADE_CLIENT_ID, env.SNAPTRADE_CONSUMER_KEY])).digest("hex"),
};
const auth = { userId: snapTradeProviderUserId(approval.userId), userSecret: "synthetic-user-secret" };
const connection = { id: approval.externalConnectionId, type: "read", disabled: false,
  brokerage: { id: approval.externalInstitutionId, slug: "SANDBOX" } };
const accounts = approval.externalAccountIds.map((accountId) => ({ id: accountId, brokerage_authorization: approval.externalConnectionId,
  name: "Synthetic", institution_name: "Synthetic", number: "synthetic", created_date: new Date(now).toISOString(),
  sync_status: { holdings: { initial_sync_completed: true, last_successful_sync: new Date(now).toISOString() } },
}));
const positions = { results: [{ instrument: { kind: "stock", id: "synthetic-instrument", symbol: "SYNTH", currency: "USD" }, units: "2", price: "10", currency: "USD" }], data_freshness: { as_of: new Date(now).toISOString() } };
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
let providerCalls = 0;
const fixtureFetch: typeof fetch = async (url, init) => {
  providerCalls++;
  assert.equal(init?.redirect, "manual"); assert.equal(init?.method, "GET"); assert(init?.signal);
  const path = new URL(String(url)).pathname;
  if (path === "/authorizations") return json([connection]);
  if (path === "/accounts") return json(accounts);
  if (path.endsWith("/positions/all")) return json(positions);
  if (path.endsWith("/balances")) return json([{ currency: { code: "USD" }, cash: 25 }]);
  if (path.endsWith("/activities")) return json({ data: [], pagination: { total: 0 } });
  throw new Error("test_unexpected_path");
};
function fakeAdmin(fail?: "claim" | "promotion", aliases: Database["public"]["Tables"]["instrument_aliases"]["Row"][] = []) {
  const calls: string[] = []; let used = false;
  const financial = { positions: structuredClone(positions), cash: 25 }; const before = JSON.stringify(financial);
  const client = {
    from: (table: string) => {
      assert.equal(table, "instrument_aliases"); const q = { select: () => q, eq: () => q, in: async () => ({ data: aliases, error: null }) }; return q;
    },
    rpc: async (name: string, input: Record<string, unknown>) => {
      calls.push(name);
      if (name === "get_broker_user_secret") return { data: [{ provider_user_id: auth.userId, user_secret: auth.userSecret }], error: null };
      if (name === "claim_exact_broker_sync_proof_job") {
        if (fail === "claim") return { data: null, error: {} };
        if (used) return { data: [], error: null }; used = true;
        assert.equal(input.p_job_id, approval.jobId); assert.equal(input.p_connection_id, approval.connectionId);
        return { data: [{ id: approval.jobId, user_id: approval.userId, connection_id: approval.connectionId, status: "running", attempt_count: 1, leased_by: input.p_worker_id }], error: null };
      }
      if (name === "promote_broker_sync_candidate") return { data: null, error: fail === "promotion" ? {} : null };
      if (name === "fail_broker_sync_job") { assert.equal(input.p_retryable, false); assert.equal(input.p_error_code, "proof_sync_failed"); return { data: null, error: null }; }
      throw new Error("test_unexpected_rpc");
    },
  } as unknown as SupabaseClient<Database>;
  return { client, calls, unchanged: () => assert.equal(JSON.stringify(financial), before) };
}
async function main() {
  const originalFetch = globalThis.fetch;
  const logs: unknown[][] = []; const log = console.log; const info = console.info; const warn = console.warn; const error = console.error;
  console.log = console.info = console.warn = console.error = (...items) => { logs.push(items); };
  mock.timers.enable({ apis: ["Date"], now });
  globalThis.fetch = fixtureFetch; // Only injected synthetic HTTP responses, never network.
  try {
    assert.deepEqual(APPROVED_STAGE22B_PROOFS, []);
    let created = 0;
    const createAdmin = () => { created++; throw new Error("must_not_create_admin"); };
    for (const bad of [
      { STOCKGPT_STAGE22B_PROOF_ENABLED: "false" }, { VERCEL_PROJECT_ID: "customer" }, { VERCEL_ENV: "preview" },
      { NEXT_PUBLIC_SUPABASE_URL: "https://rfloxmydpbgyyaesysbv.supabase.co" }, { STOCKGPT_STAGE22B_KEY_CLASSIFICATION: "" },
      { STOCKGPT_ALLOW_SNAPTRADE_SANDBOX: "false" }, { SNAPTRADE_CONSUMER_KEY: "wrong" },
    ]) assert.equal((await runStage22bProof({ ...env, ...bad }, [approval], { createAdmin })).status, "blocked");
    assert.equal((await runStage22bProof(env, [], { createAdmin })).status, "blocked");
    for (const ids of [[], [id(8), id(8)], ["invalid"], [id(8), id(9), id(10)]]) assert.equal((await runStage22bProof(env, [{ ...approval, externalAccountIds: ids }], { createAdmin })).status, "blocked");
    assert.equal(created, 0); assert.equal(providerCalls, 0);

    const good = fakeAdmin();
    assert.deepEqual(await runStage22bProof(env, [approval], { createAdmin: () => good.client }), { status: "succeeded", claimed: 1 });
    assert.equal(providerCalls, 8); good.unchanged();
    assert.deepEqual(await runStage22bProof(env, [approval], { createAdmin: () => good.client }), { status: "not_claimed", claimed: 0 });
    assert.equal(providerCalls, 8, "Duplicate scheduled request repeated provider work");
    assert.equal(good.calls.filter((c) => c === "promote_broker_sync_candidate").length, 1);

    // Real collector + normal alias resolution + restricted SDK transport, all
    // backed by synthetic HTTP. Temporal windows isolate each rejection branch.
    for (const target of ["position", "activity"] as const) {
      const activityTime = "2026-10-15T12:00:00.000Z";
      const db = fakeAdmin(undefined, [{
        id: id(30), instrument_id: id(31), namespace: "snaptrade.instrument", scope: "", value: "synthetic-instrument",
        valid_from: target === "position" ? new Date(now).toISOString() : activityTime,
        valid_to: target === "activity" ? new Date(now).toISOString() : null,
        created_at: activityTime, is_primary: false,
      }]);
      globalThis.fetch = async (url, init) => new URL(String(url)).pathname.endsWith("/activities")
        ? json({ data: [{ id: id(32), symbol: { id: "synthetic-instrument" }, type: "BUY", trade_date: activityTime,
          units: 2, price: 10, amount: 20, currency: { code: "USD" } }], pagination: { total: 1 } })
        : fixtureFetch(url, init);
      let collected = false;
      assert.deepEqual(await runStage22bProof(env, [approval], { createAdmin: () => db.client,
        collect: async (admin, receipt, values, signal, deadline) => {
          const candidate = await fetchSnapTradeSyncCandidate(admin, {
            userId: receipt.userId, providerId: receipt.providerId, externalConnectionId: receipt.externalConnectionId,
          }, createProofSnapTradeClient({ approval: receipt, clientId: values.SNAPTRADE_CLIENT_ID!, consumerKey: values.SNAPTRADE_CONSUMER_KEY!, signal, deadline }));
          assert.equal(validateBrokerSyncCandidate(candidate).ok, true, "Alias fixture must otherwise be valid");
          for (const account of candidate.accounts) {
            assert.equal(account.positions.items[0].instrumentId, target === "position" ? id(31) : null);
            assert.equal(account.activities.items[0].instrumentId, target === "activity" ? id(31) : null);
          }
          collected = true;
          return candidate;
        },
      }), { status: "terminal_failure", claimed: 1 });
      assert(collected, "Ordinary collector must resolve the non-empty alias fixture before rejection");
      assert(!db.calls.includes("promote_broker_sync_candidate"));
      assert.equal(db.calls.filter((c) => c === "fail_broker_sync_job").length, 1);
      db.unchanged();
    }
    globalThis.fetch = fixtureFetch;

    // Use the actual Supabase client + proof DB fetch wrapper, but all HTTP is
    // mocked. Assert its exact destination, redirects, no Auth fallback/retry,
    // and that alias unavailability cannot reach promotion.
    for (const aliasesFail of [false, true]) {
      const dbPaths: string[] = [];
      globalThis.fetch = async (url, init) => {
        const target = new URL(String(url));
        if (target.origin === "https://api.snaptrade.com") return fixtureFetch(url, init);
        assert.equal(target.origin, STAGE22B_SCOPE.supabaseUrl); assert.equal(init?.redirect, "error"); assert(init?.signal);
        dbPaths.push(target.pathname);
        if (target.pathname.endsWith("/claim_exact_broker_sync_proof_job")) {
          const input = JSON.parse(String(init?.body));
          return json([{ id: approval.jobId, user_id: approval.userId, connection_id: approval.connectionId, status: "running", attempt_count: 1, leased_by: input.p_worker_id }]);
        }
        if (target.pathname.endsWith("/get_broker_user_secret")) return json([{ provider_user_id: auth.userId, user_secret: auth.userSecret }]);
        if (target.pathname === "/rest/v1/instrument_aliases") return aliasesFail ? json({ private: "sensitive-db-error" }, 503) : json([]);
        if (target.pathname.endsWith("/fail_broker_sync_job")) { assert.equal(JSON.parse(String(init?.body)).p_retryable, false); return json(null); }
        if (target.pathname.endsWith("/promote_broker_sync_candidate")) return json(null);
        throw new Error("test_unapproved_database_path");
      };
      assert.equal((await runStage22bProof(env, [approval])).status, aliasesFail ? "terminal_failure" : "succeeded");
      assert.equal(dbPaths.filter((p) => p === "/rest/v1/instrument_aliases").length, 1, "Alias HTTP failure retried");
      assert.equal(dbPaths.some((p) => p.endsWith("/promote_broker_sync_candidate")), !aliasesFail);
      assert(!dbPaths.some((p) => p.includes("/auth/")));
    }
    globalThis.fetch = fixtureFetch;

    for (const failure of ["wrong_account", "wrong_connection", "wrong_institution", "trade", "real_broker", "disabled", "provider", "redirect"] as const) {
      const db = fakeAdmin(); const count: number = providerCalls;
      globalThis.fetch = async (url, init) => {
        const path = new URL(String(url)).pathname;
        if (path === "/authorizations") {
          if (failure === "provider") return json({ private: "do-not-log" }, 429);
          if (failure === "redirect") return new Response(null, { status: 302, headers: { location: "https://unapproved.invalid" } });
          return json([{ ...connection, id: failure === "wrong_connection" ? id(20) : connection.id,
            type: failure === "trade" ? "trade" : "read", disabled: failure === "disabled",
            brokerage: { ...connection.brokerage, id: failure === "wrong_institution" ? id(20) : approval.externalInstitutionId, slug: failure === "real_broker" ? "REAL" : "SANDBOX" } }]);
        }
        if (path === "/accounts" && failure === "wrong_account") return json([{ ...accounts[0], id: id(20) }]);
        return fixtureFetch(url, init);
      };
      assert.equal((await runStage22bProof(env, [approval], { createAdmin: () => db.client })).status, "terminal_failure");
      assert(!db.calls.includes("promote_broker_sync_candidate")); db.unchanged();
      assert.equal(providerCalls, count, "Forbidden account data was fetched");
    }
    globalThis.fetch = fixtureFetch;
    const uncertain = fakeAdmin("promotion");
    assert.equal((await runStage22bProof(env, [approval], { createAdmin: () => uncertain.client })).status, "indeterminate");
    assert(!uncertain.calls.includes("fail_broker_sync_job"), "Promotion ambiguity caused a compensating write");
    const claimFailure = fakeAdmin("claim");
    assert.equal((await runStage22bProof(env, [approval], { createAdmin: () => claimFailure.client })).status, "indeterminate");
    assert.deepEqual(claimFailure.calls, ["claim_exact_broker_sync_proof_job"]);

    // Exercise the real pinned SDK + custom adapter. HTTP 429, network errors and
    // redirects each reject after ONE transport send, with no retry/delay/log.
    for (const outcome of ["429", "network", "redirect"]) {
      let sends = 0;
      const sdk = createProofSnapTradeClient({ approval, clientId: env.SNAPTRADE_CLIENT_ID, consumerKey: env.SNAPTRADE_CONSUMER_KEY,
        signal: new AbortController().signal, deadline: now + 120000, fetcher: async () => {
          sends++; if (outcome === "network") throw new Error("sensitive-network-error");
          return new Response("sensitive-provider-body", { status: outcome === "429" ? 429 : 302 });
        } });
      await assert.rejects(() => sdk.connections.listBrokerageAuthorizations(auth), { message: "proof_provider_rejected" });
      assert.equal(sends, 1);
    }
    let sends = 0;
    let clock = now;
    const sdk = createProofSnapTradeClient({ approval, clientId: env.SNAPTRADE_CLIENT_ID, consumerKey: env.SNAPTRADE_CONSUMER_KEY,
      signal: new AbortController().signal, deadline: now + 120000, now: () => clock, fetcher: async (url, init) => { sends++; return fixtureFetch(url, init); } });
    await sdk.connections.listBrokerageAuthorizations(auth);
    await sdk.accountInformation.listUserAccounts(auth);
    // Check account/path denial BEFORE exhausting the budget, so the budget
    // cannot mask an unsafe endpoint/identity implementation.
    await assert.rejects(() => sdk.accountInformation.getUserAccountBalance({ ...auth, accountId: id(20) }));
    await assert.rejects(() => sdk.accountInformation.getUserAccountOrders({ ...auth, accountId: id(8) }));
    await assert.rejects(() => sdk.connections.refreshBrokerageAuthorization({ ...auth, authorizationId: approval.externalConnectionId }));
    assert.equal(sends, 2);
    for (let i = 2; i < PROOF_PROVIDER_LIMITS.requests; i++) await sdk.accountInformation.getUserAccountBalance({ ...auth, accountId: id(8) });
    await assert.rejects(() => sdk.accountInformation.getUserAccountBalance({ ...auth, accountId: id(8) }));
    assert.equal(sends, 32);
    await assert.rejects(() => sdk.accountInformation.getUserAccountBalance({ ...auth, accountId: id(20) }));
    const expired = createProofSnapTradeClient({ approval, clientId: env.SNAPTRADE_CLIENT_ID, consumerKey: env.SNAPTRADE_CONSUMER_KEY,
      signal: new AbortController().signal, deadline: now + 100, now: () => clock, fetcher: async () => { throw new Error("must_not_send"); } });
    clock += 101; await assert.rejects(() => expired.connections.listBrokerageAuthorizations(auth), { message: "proof_provider_rejected" });
    const aborted = new AbortController(); aborted.abort();
    const cancelled = createProofSnapTradeClient({ approval, clientId: env.SNAPTRADE_CLIENT_ID, consumerKey: env.SNAPTRADE_CONSUMER_KEY,
      signal: aborted.signal, deadline: now + 120000, fetcher: async () => { throw new Error("must_not_send"); } });
    await assert.rejects(() => cancelled.connections.listBrokerageAuthorizations(auth), { message: "proof_provider_rejected" });
    const abortPending = new AbortController();
    let started!: () => void;
    const startBarrier = new Promise<void>((resolve) => { started = resolve; });
    const pending = createProofSnapTradeClient({ approval, clientId: env.SNAPTRADE_CLIENT_ID, consumerKey: env.SNAPTRADE_CONSUMER_KEY,
      signal: abortPending.signal, deadline: now + 120000, fetcher: async (_url, init) => new Promise<Response>((_resolve, reject) => {
        init!.signal!.addEventListener("abort", () => reject(new Error("sensitive-timeout")), { once: true }); started();
      }) });
    const waiting = pending.connections.listBrokerageAuthorizations(auth);
    const rejection = assert.rejects(waiting, { message: "proof_provider_rejected" });
    await startBarrier; abortPending.abort(); await rejection;
    const oversized = createProofSnapTradeClient({ approval, clientId: env.SNAPTRADE_CLIENT_ID, consumerKey: env.SNAPTRADE_CONSUMER_KEY,
      signal: new AbortController().signal, deadline: now + 120000,
      fetcher: async () => new Response(new Uint8Array(PROOF_PROVIDER_LIMITS.responseBytes + 1)) });
    await assert.rejects(() => oversized.connections.listBrokerageAuthorizations(auth), { message: "proof_provider_rejected" });
    let largeSends = 0;
    const largeBalance = [{ currency: { code: "USD" }, cash: 25, padding: "x".repeat(2 * 1024 * 1024) }];
    const cumulative = createProofSnapTradeClient({ approval, clientId: env.SNAPTRADE_CLIENT_ID, consumerKey: env.SNAPTRADE_CONSUMER_KEY,
      signal: new AbortController().signal, deadline: now + 120000, fetcher: async (url, init) => {
        largeSends++;
        return new URL(String(url)).pathname.endsWith("/balances") ? json(largeBalance) : fixtureFetch(url, init);
      } });
    await cumulative.connections.listBrokerageAuthorizations(auth); await cumulative.accountInformation.listUserAccounts(auth);
    for (let i = 0; i < 7; i++) await cumulative.accountInformation.getUserAccountBalance({ ...auth, accountId: id(8) });
    await assert.rejects(() => cumulative.accountInformation.getUserAccountBalance({ ...auth, accountId: id(8) }), { message: "proof_provider_rejected" });
    assert.equal(largeSends, 10, "16 MiB cumulative bound not enforced");
    const incomplete = fakeAdmin();
    globalThis.fetch = async (url, init) => new URL(String(url)).pathname.endsWith("/balances") ? json(null) : fixtureFetch(url, init);
    assert.equal((await runStage22bProof(env, [approval], { createAdmin: () => incomplete.client })).status, "terminal_failure");
    assert(!incomplete.calls.includes("promote_broker_sync_candidate")); incomplete.unchanged();
    globalThis.fetch = fixtureFetch;
    const late = fakeAdmin(); let executionClock = now;
    assert.equal((await runStage22bProof(env, [approval], { createAdmin: () => late.client, now: () => executionClock,
      collect: async () => { executionClock += PROOF_EXECUTION_MS + 1; throw new Error("sensitive-timeout"); } })).status, "indeterminate");
    assert(!late.calls.includes("promote_broker_sync_candidate")); late.unchanged();
    const logged = JSON.stringify(logs);
    for (const forbidden of [env.SUPABASE_SERVICE_ROLE_KEY, env.SNAPTRADE_CLIENT_ID, env.SNAPTRADE_CONSUMER_KEY, auth.userSecret, auth.userId, "sensitive", "do-not-log", "api.snaptrade.com"]) assert(!logged.includes(forbidden));
    assert.equal(logs.length, 0, "Execution/transport must not log provider or credential detail");
    const transport = readFileSync("lib/brokerage/providers/snaptrade/proof-transport.ts", "utf8");
    assert(transport.includes('redirect: "manual"')); assert(transport.includes('sdkPackage.version !== "12.2.7"'));
  } finally {
    globalThis.fetch = originalFetch; mock.timers.reset();
    console.log = log; console.info = info; console.warn = warn; console.error = error;
  }
  console.log("Stage 22B mocked exact-job execution, receipt isolation, pinned SDK no-retry transport, budgets, deadlines, unknown acknowledgements and last-good checks passed. No real provider called.");
}
void main();
