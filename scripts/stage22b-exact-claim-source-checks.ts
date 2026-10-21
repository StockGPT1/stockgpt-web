import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

// Source contracts only. These do not prove PostgreSQL locking or privileges.
const migrations = readdirSync("supabase/migrations").filter((name) => name.endsWith("_claim_exact_broker_sync_proof_job.sql"));
assert.equal(migrations.length, 1);
const sql = readFileSync(`supabase/migrations/${migrations[0]}`, "utf8");
const executable = sql.replace(/--[^\n]*/g, "");
for (const contract of [
  "security definer", "set search_path = ''", "for update skip locked", "for share of p, a, i",
  "v_job.user_id is distinct from p_user_id", "v_job.connection_id is distinct from p_connection_id",
  "c.id = p_connection_id and c.user_id = p_user_id", "v_connection.provider_id is distinct from p_provider_id",
  "v_connection.institution_id is distinct from p_institution_id", "v_connection.external_connection_id is distinct from p_external_connection_id",
  "p.provider_key = 'snaptrade'", "a.external_institution_id = p_external_institution_id", "a.institution_id = p_institution_id",
  "v_job.status <> 'queued'", "v_job.attempt_count <> 0", "v_job.started_at is not null",
  "v_job.leased_by is not null", "v_job.lease_expires_at is not null", "v_job.completed_at is not null",
  "v_job.error_code is not null", "v_job.provider_freshness_at is not null",
  "not pg_catalog.isfinite(v_job.available_at)", "v_job.available_at > v_now",
  "j.id <> p_job_id", "broker_sync_proof_queue_not_single", "where j.id = v_job.id",
  "attempt_count = 1", "interval '300 seconds'", "pg_catalog.clock_timestamp()",
  "from public, anon, authenticated", "to service_role",
]) assert(executable.includes(contract), `Missing contract: ${contract}`);
assert.equal((executable.match(/create function /g) ?? []).length, 1);
assert.equal((executable.match(/update public\./g) ?? []).length, 1);
assert(!/insert into|delete from|claim_broker_sync_jobs\(|advisory|lock table|execute\s+/i.test(executable.replace(/grant execute/g, "grant_permission")));
const route = readFileSync("app/api/cron/broker-sync-proof/route.ts", "utf8");
assert(!/claim_exact|\.rpc\(|createAdmin|sync-runner|providers\//.test(route));
const execution = readFileSync("lib/brokerage/stage22b-execution.ts", "utf8");
assert(!/claim_broker_sync_jobs|runBoundedBrokerSyncWorker|sync-runner|sync-worker/.test(execution));
for (const contract of ["claim_exact_broker_sync_proof_job", "promote_broker_sync_candidate", "validateBrokerSyncCandidate", "p_retryable: false", "prepareStage22bProof"]) assert(execution.includes(contract));
const local = readFileSync("scripts/verify-stage22b-exact-claim-local.mjs", "utf8");
for (const contract of ["--allow-local-db-writes", "supabase_db_stockgpt-web-local", "lock_held", "retryable_failure", "permission denied", "global-snapshot-race", "financialSnapshot"]) assert(local.includes(contract));
// Guard against an unrelated queued fixture masking the post-COMMIT duplicate.
const isolatedDuplicate = local.indexOf('"duplicate_claim_queue_not_isolated"');
const duplicate = local.indexOf('"duplicate_invocation_claimed"');
assert(isolatedDuplicate > local.indexOf('held.child.stdin.end("commit;'));
assert(duplicate > isolatedDuplicate);
assert(local.includes('"initial_exact_claim_not_received"'));
assert(local.indexOf('"duplicate_claim_changed_job"') > duplicate);
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
assert(pkg.scripts["test:acceptance:static"].includes("npm run test:stage22b-proof"));
assert(pkg.scripts["test:stage22b-proof"].includes("stage22b-exact-claim-source-checks.ts"));
console.log("Stage 22B exact-claim source contracts passed (source-only; PostgreSQL execution is a separate local suite).");
