import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { evaluateBrokerRollout, type BrokerCohortApproval, type BrokerRolloutOperation } from "../lib/brokerage/rollout-policy";
import { summarizeBrokerSyncHealth, BROKER_SYNC_SUMMARY_LIMIT } from "../lib/brokerage/sync-observability";
import { hasActiveSubscription } from "../lib/subscription";

const now = new Date("2026-10-21T12:00:00Z");
const approved: BrokerCohortApproval = {
  userId: "synthetic-owner", approvalReference: "synthetic-only-review",
  validFrom: "2026-10-21T11:00:00Z", validUntil: "2026-10-21T13:00:00Z",
  operations: ["connect", "discover", "project"],
};
const input = { enabled: "true", mode: "cohort", stopped: undefined, userId: approved.userId, subscriptionStatus: "core", operation: "connect" as BrokerRolloutOperation, approvals: [approved], asOf: now };
assert.equal(evaluateBrokerRollout(input).allowed, true);
for (const change of [
  { enabled: undefined }, { enabled: "TRUE" }, { mode: undefined }, { mode: "public" },
  { stopped: "true" }, { stopped: "FALSE" }, { userId: null }, { userId: "other-owner" },
  { subscriptionStatus: "free" }, { subscriptionStatus: undefined }, { approvals: [] },
  { approvals: [approved, approved] }, { approvals: [{ ...approved, approvalReference: " " }] },
  { approvals: [{ ...approved, validUntil: now.toISOString() }] },
  { approvals: [{ ...approved, validFrom: "invalid" }] },
  { approvals: [{ ...approved, operations: [] }] }, { asOf: new Date("invalid") },
]) assert.equal(evaluateBrokerRollout({ ...input, ...change }).allowed, false);
for (const status of ["basic", "core", "premium", "executive", "max", "alpha", "trialing", "active"]) {
  assert.equal(evaluateBrokerRollout({ ...input, subscriptionStatus: status }).allowed, hasActiveSubscription(status));
}
const capability = readFileSync("lib/brokerage/capability.ts", "utf8");
assert.match(capability, /^import "server-only";/);
assert.match(capability, /APPROVED_BROKER_COHORTS[^=]*= Object\.freeze\(\[\]\)/);
assert.doesNotMatch(capability.split("export function brokerConnectionsEnabled")[0].replace(/\/\/[^\n]*/g, ""), /NEXT_PUBLIC_|user_metadata|JSON\.parse|request\./);

/** Execute actual route functions with all I/O boundaries mocked. No provider or database transport is loaded. */
async function checkRoute(path: string, method: "GET" | "POST", operation: BrokerRolloutOperation) {
  for (const scenario of ["denied", "wrong_owner", "free", "profile_error", "anonymous", "auth_error", "allowed"] as const) {
    const calls = { admin: 0, registration: 0, discovery: 0, portal: 0, projection: 0 };
    const profileStatus = scenario === "free" ? "free" : "core";
    const userId = scenario === "anonymous" ? null : scenario === "wrong_owner" ? "other-owner" : approved.userId;
    const decision = evaluateBrokerRollout({ ...input, userId, subscriptionStatus: profileStatus, operation, approvals: scenario === "denied" ? [] : [approved] });
    const selected: string[] = [];
    const query = {
      select: (columns: string) => { selected.push(columns); return query; },
      eq: () => query,
      maybeSingle: async () => ({ data: { subscription_status: profileStatus }, error: scenario === "profile_error" ? { message: "not logged" } : null }),
      single: async () => ({ data: { id: "synthetic-provider" }, error: null }),
    };
    const session = {
      auth: { getUser: async () => ({ data: { user: userId ? { id: userId, user_metadata: { cohort: true, userId: approved.userId } } : null }, error: scenario === "auth_error" ? { message: "not logged" } : null }) },
      from: () => query,
      rpc: async () => { calls.projection += 1; return { data: [{ portfolio_id: "synthetic-portfolio" }], error: null }; },
    };
    const modules: Record<string, unknown> = {
      "next/server": { NextResponse: { json: (value: unknown, options: ResponseInit) => Response.json(value, options), redirect: (url: string | URL, status = 307) => Response.redirect(url, status) } },
      "@/utils/supabase/server": { createClient: async () => session },
      "@/utils/supabase/admin": { createAdminClient: () => { calls.admin += 1; return { from: () => query }; } },
      "@/lib/subscription": { hasActiveSubscription },
      "@/lib/brokerage/capability": {
        brokerConnectionsEnabled: () => true,
        brokerRolloutAccess: (actual: { userId: string; subscriptionStatus: string; operation: BrokerRolloutOperation }) => {
          assert.equal(actual.userId, userId);
          assert.equal(actual.subscriptionStatus, profileStatus);
          assert.equal(actual.operation, operation);
          return decision;
        },
        brokerPortalSandboxRestriction: () => "SANDBOX",
        brokerReturnUrl: () => "https://synthetic.invalid/return",
      },
      "@/lib/brokerage/connection-service": {
        ensureSnapTradeRegistration: async () => { calls.registration += 1; },
        discoverSnapTradeConnections: async () => { calls.discovery += 1; },
      },
      "@/lib/brokerage/providers/snaptrade/service": { createReadOnlySnapTradePortalLink: async () => { calls.portal += 1; return "https://synthetic.invalid/portal"; } },
    };
    const output = ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
    const exports: Record<string, (request: Request) => Promise<Response>> = {};
    vm.runInNewContext(output, { exports, URL, require: (name: string) => {
      assert.ok(name in modules, `Unexpected dependency ${name}`);
      return modules[name];
    } });
    const form = new FormData();
    form.set("accountId", "synthetic-account");
    form.set("userId", approved.userId);
    form.set("cohort", "approved");
    const response = await exports[method](new Request("https://synthetic.invalid/route?cohort=approved", method === "POST" ? { method, body: form } : undefined));
    if (scenario === "allowed") {
      assert.equal(response.status, method === "POST" ? 303 : 307);
      assert.equal(calls.registration, operation === "connect" ? 1 : 0);
      assert.equal(calls.portal, operation === "connect" ? 1 : 0);
      assert.equal(calls.discovery, operation === "discover" ? 1 : 0);
      assert.equal(calls.projection, operation === "project" ? 1 : 0);
    } else {
      assert.deepEqual(calls, { admin: 0, registration: 0, discovery: 0, portal: 0, projection: 0 });
    }
    if (scenario !== "anonymous" && scenario !== "auth_error") assert.ok(selected.includes("subscription_status"));
  }
}

async function main() {
  await checkRoute("app/api/broker/connections/start/route.ts", "POST", "connect");
  await checkRoute("app/portfolio/connections/return/route.ts", "GET", "discover");
  await checkRoute("app/api/broker/portfolios/route.ts", "POST", "project");
  const marker = "private-provider-error-and-financial-secret";
  const rows = [
    { status: "succeeded", lastSuccessfulSyncAt: "2026-10-21T11:00:00Z", userId: marker, error: marker, amount: marker },
    { status: "retryable_failure", lastSuccessfulSyncAt: "2026-10-19T11:00:00Z" },
    { status: marker, lastSuccessfulSyncAt: null },
    { status: "queued", lastSuccessfulSyncAt: "2026-10-22T00:00:00Z" },
  ];
  const snapshot = JSON.stringify(rows);
  const summary = summarizeBrokerSyncHealth({ rows, asOf: now, complete: true });
  assert.equal(summary.availability, "available");
  assert.doesNotMatch(JSON.stringify(summary), new RegExp(marker));
  assert.deepEqual("freshness" in summary ? summary.freshness : null, { within_day: 1, older: 1, unknown: 2 });
  assert.equal(JSON.stringify(rows), snapshot);
  assert.equal(summarizeBrokerSyncHealth({ rows, asOf: now, complete: false }).availability, "partial");
  assert.equal(summarizeBrokerSyncHealth({ rows: Array.from({ length: BROKER_SYNC_SUMMARY_LIMIT }, () => rows[0]), asOf: now, complete: true }).availability, "available");
  assert.equal(summarizeBrokerSyncHealth({ rows: Array.from({ length: BROKER_SYNC_SUMMARY_LIMIT + 1 }, () => rows[0]), asOf: now, complete: true }).availability, "unavailable");
  const page = readFileSync("app/portfolio/connections/page.tsx", "utf8");
  assert.match(page, /Existing account information remains visible/);
  assert.match(page, /canConnect && connection\.status/);
  assert.match(page, /canProject && account\.last_successful_sync_at/);
  assert.match(page, /jobs\.error \? "Sync status unavailable" : presentation\.label/);
  assert.match(page, /!connections\.error &&/);
  console.log("Broker rollout policy, 21 actual route mock scenarios, kill switch, privacy-safe bounded health and preserved read-view checks passed.");
}
main().catch(() => { console.error("Broker rollout checks failed"); process.exitCode = 1; });
