import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { NextRequest } from "next/server";
import { APPROVED_STAGE22B_PROOFS, STAGE22B_SCOPE, prepareStage22bProof, stage22bJobEligibility, type Stage22bApproval } from "../lib/brokerage/stage22b-proof";

async function main() {
  // No .env loader, real credentials, database, provider or worker execution.
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("stage22b_test_network_forbidden"); };
  const now = Date.parse("2026-10-15T07:17:00Z");
  const id = (n: number) => `11111111-1111-4111-8111-${String(n).padStart(12, "0")}`;
  const env = {
    NODE_ENV: "production" as const, VERCEL: "1", VERCEL_PROJECT_ID: STAGE22B_SCOPE.projectId, VERCEL_ENV: "production", VERCEL_TARGET_ENV: "production",
    VERCEL_GIT_COMMIT_REF: STAGE22B_SCOPE.branch, STOCKGPT_STAGE22B_TEAM_ID: STAGE22B_SCOPE.teamId,
    NEXT_PUBLIC_SUPABASE_URL: STAGE22B_SCOPE.supabaseUrl, STOCKGPT_STAGE22B_PROOF_ENABLED: "true",
    STOCKGPT_ALLOW_SNAPTRADE_SANDBOX: "true", STOCKGPT_STAGE22B_KEY_CLASSIFICATION: "commercial_test", STOCKGPT_STAGE22B_BROKER: "SANDBOX",
    STOCKGPT_STAGE22B_NOT_BEFORE: "2026-10-15T07:00:00Z", STOCKGPT_STAGE22B_EXPIRES_AT: "2026-10-15T08:00:00Z", STOCKGPT_STAGE22B_JOB_ID: id(1),
    // Entirely synthetic strings, not valid credentials.
    SUPABASE_SERVICE_ROLE_KEY: "synthetic-not-a-key", SNAPTRADE_CLIENT_ID: "synthetic-client", SNAPTRADE_CONSUMER_KEY: "synthetic-consumer", CRON_SECRET: "synthetic-cron",
  };
  const approval: Stage22bApproval = { jobId: id(1), userId: id(2), connectionId: id(3), providerId: id(4), institutionId: id(5), externalConnectionId: "synthetic-connection", externalInstitutionId: "synthetic-sandbox", externalAccountIds: [id(7), id(8)], broker: "SANDBOX", permission: "read", keyClassification: "commercial_test", credentialPairSha256: createHash("sha256").update(JSON.stringify([env.SNAPTRADE_CLIENT_ID, env.SNAPTRADE_CONSUMER_KEY])).digest("hex") };
  const check = (overrides: Record<string, string | undefined> = {}) => prepareStage22bProof({ ...env, ...overrides }, [approval], now);
  assert(check().ok);
  assert.deepEqual(APPROVED_STAGE22B_PROOFS, [], "Preparation cannot activate an actual job or key pair");
  assert.equal(prepareStage22bProof(env, APPROVED_STAGE22B_PROOFS, now).ok, false);
  assert.equal(prepareStage22bProof(env, [approval, approval], now).ok, false);
  for (const [key, value] of Object.entries(env)) {
    assert.equal(check({ [key]: undefined }).ok, key === "CRON_SECRET", `Missing ${key} must fail (cron auth checked separately)`);
    assert(value);
  }
  for (const changes of [
    { VERCEL_PROJECT_ID: "prj_QzlZVgUZ5qIC5SwYz5k3ThQKkQNo" }, { VERCEL_ENV: "preview" }, { VERCEL_TARGET_ENV: "staging" },
    { VERCEL: "0" }, { STOCKGPT_STAGE22B_TEAM_ID: "other-team" }, { VERCEL_GIT_COMMIT_REF: "main" },
    { NEXT_PUBLIC_SUPABASE_URL: "https://rfloxmydpbgyyaesysbv.supabase.co" }, { SUPABASE_URL: "https://rfloxmydpbgyyaesysbv.supabase.co" },
    { STOCKGPT_ALLOW_SNAPTRADE_SANDBOX: "false" }, { STOCKGPT_STAGE22B_KEY_CLASSIFICATION: "commercial_production" },
    { STOCKGPT_STAGE22B_BROKER: "REAL_BROKER" }, { SNAPTRADE_CONSUMER_KEY: "different-pair" },
    { STOCKGPT_STAGE22B_NOT_BEFORE: "invalid" }, { STOCKGPT_STAGE22B_EXPIRES_AT: "2026-10-15T07:17:00Z" },
    { STOCKGPT_STAGE22B_NOT_BEFORE: "2026-10-15T09:00:00Z" }, { STOCKGPT_STAGE22B_EXPIRES_AT: "2026-10-16T08:00:00Z" },
  ]) assert.equal(check(changes).ok, false);
  for (const changes of [{ permission: "trade" }, { broker: "REAL" }, { keyClassification: "production" }, { userId: "not-a-uuid" }]) {
    assert.equal(prepareStage22bProof(env, [{ ...approval, ...changes } as Stage22bApproval], now).ok, false);
  }

  const job = { id: approval.jobId, user_id: approval.userId, connection_id: approval.connectionId, status: "queued", attempt_count: 0, available_at: "2026-10-15T07:00:00Z", leased_by: null, lease_expires_at: null, started_at: null };
  const connection = { id: approval.connectionId, userId: approval.userId, providerId: approval.providerId, providerKey: "snaptrade", status: "pending", externalConnectionId: approval.externalConnectionId, institutionId: approval.institutionId, externalInstitutionId: approval.externalInstitutionId };
  const snapshot = JSON.stringify({ job, connection });
  assert(stage22bJobEligibility(approval, [job], connection, now).ok);
  assert.equal(stage22bJobEligibility(approval, [], connection, now).ok, false);
  assert.equal(stage22bJobEligibility(approval, [job, { ...job, id: id(6) }], connection, now).ok, false);
  for (const changes of [{ id: id(6) }, { user_id: id(6) }, { connection_id: id(6) }, { status: "running" }, { status: "retryable_failure" }, { attempt_count: 1 }, { available_at: "invalid" }, { available_at: "2026-10-15T08:00:00Z" }, { started_at: "2026-10-15T07:00:00Z" }, { leased_by: "other" }]) {
    assert.equal(stage22bJobEligibility(approval, [{ ...job, ...changes }], connection, now).ok, false);
  }
  for (const key of Object.keys(connection)) {
    assert.equal(stage22bJobEligibility(approval, [job], { ...connection, [key]: "wrong" }, now).ok, false);
  }
  assert.equal(JSON.stringify({ job, connection }), snapshot);

  const originalEnv = process.env;
  const originalNow = Date.now;
  Date.now = () => now;
  const logs: unknown[][] = [];
  const warn = console.warn; const error = console.error;
  console.warn = (...args) => { logs.push(args); }; console.error = (...args) => { logs.push(args); };
  try {
    process.env = { ...env };
    const { GET } = await import("../app/api/cron/broker-sync-proof/route");
    for (const authorization of [null, "Bearer wrong"]) {
      const response = await GET(new NextRequest("https://synthetic.invalid/api/cron/broker-sync-proof", { headers: authorization ? { authorization } : {} }));
      assert.equal(response.status, 401);
    }
    process.env = { ...env, CRON_SECRET: "" };
    assert.equal((await GET(new NextRequest("https://synthetic.invalid/api/cron/broker-sync-proof", { headers: { authorization: "Bearer synthetic-cron" } }))).status, 401);
    process.env = { ...env };
    const blocked = await GET(new NextRequest("https://synthetic.invalid/api/cron/broker-sync-proof?jobId=untrusted&broker=REAL", { headers: { authorization: "Bearer synthetic-cron" } }));
    assert.equal(blocked.status, 503);
    assert.equal((await blocked.json()).code, "proof_identity_not_approved");
    assert.equal(blocked.headers.get("cache-control"), "no-store");
    for (const secret of [env.CRON_SECRET, env.SUPABASE_SERVICE_ROLE_KEY, env.SNAPTRADE_CLIENT_ID, env.SNAPTRADE_CONSUMER_KEY]) {
      assert(!JSON.stringify(logs).includes(secret));
    }
    assert(!JSON.stringify(logs).includes(approval.userId));
  } finally { process.env = originalEnv; Date.now = originalNow; console.warn = warn; console.error = error; globalThis.fetch = previousFetch; }

  const read = (file: string) => readFileSync(file, "utf8");
  const root = read("vercel.json");
  assert.equal(createHash("sha256").update(root).digest("hex"), "029aab74a8f285c0bbf601d4651c346732dd48b18555fc512a8b6acfbf0f4e69");
  assert.equal(JSON.parse(root).crons.length, 10);
  const config = JSON.parse(read("config/vercel.stage22b-proof.json"));
  assert.deepEqual(config.crons, [{ path: "/api/cron/broker-sync-proof", schedule: "17 7 * * *" }]);
  assert.deepEqual(JSON.parse(read("config/vercel.stage22b-stopped.json")).crons, []);
  assert(config.buildCommand.startsWith("node scripts/stage22b-build-guard.mjs &&"));
  const guard = await import("./stage22b-build-guard.mjs");
  assert(guard.stagingProofBuildAllowed(env));
  assert.equal(guard.stagingProofBuildAllowed({ ...env, VERCEL_PROJECT_ID: "prj_QzlZVgUZ5qIC5SwYz5k3ThQKkQNo" }), false);
  assert.equal(guard.stagingProofBuildAllowed({ ...env, VERCEL_ENV: "preview" }), false);
  const wrongBuild = spawnSync(process.execPath, ["scripts/stage22b-build-guard.mjs"], { env: { NODE_ENV: "test" }, encoding: "utf8" });
  assert.equal(wrongBuild.status, 1); assert.equal(wrongBuild.stderr.trim(), "stage22b_build_scope_rejected");
  const route = read("app/api/cron/broker-sync-proof/route.ts");
  assert(!/from\s+["'][^"']*(?:sync-worker|sync-runner|providers|supabase)/u.test(route));
  assert(!/\.rpc\(|\.from\(|fetch\(|createAdminClient/u.test(route));
  assert(route.indexOf('if (!readiness.ok)') < route.indexOf('await import('));
  assert(route.includes("maxDuration = 240"));
  console.log("Stage 22B preparation: authorization, scope, TEST receipts, queue eligibility, disabled execution, log sanitization and config isolation passed (synthetic only).");
}
void main();
