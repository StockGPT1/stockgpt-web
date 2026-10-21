import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import {
  buildLocalConnectedProjectionSql, parseLocalProjectionResult, verifyLocalProjectionDockerMetadata,
} from "./local-connected-projection-fixture.mjs";

const names = readdirSync("supabase/migrations").filter((name) => name.endsWith("_protect_connected_portfolio_beta_admission.sql"));
assert.equal(names.length, 1, "beta_admission_migration_missing");
const sql = readFileSync(`supabase/migrations/${names[0]}`, "utf8").replace(/--[^\n]*/gu, "");
for (const contract of [
  "create schema broker_rollout_private", "enabled boolean not null default false",
  "primary key (user_id, account_id)", "references public.broker_accounts(id, user_id)",
  "enable row level security", "security definer set search_path = ''",
  "v_user_id <> new.user_id", "public.is_active_subscriber(v_user_id)",
  "a.status = 'active' and a.last_successful_sync_at is not null for share",
  "where c.singleton for share", "v_enabled is distinct from true",
  "where a.user_id = v_user_id and a.account_id = new.broker_account_id for share",
  "v_approval.revoked_at is not null", "clock_timestamp() < v_approval.valid_from",
  "clock_timestamp() >= v_approval.valid_until", "portfolio_source_transition_forbidden",
  "new.broker_account_id is distinct from old.broker_account_id",
  "before insert or update of management_source, broker_account_id on public.user_portfolios",
  "revoke all on function broker_rollout_private.guard_connected_projection_admission() from public, anon, authenticated, service_role",
]) assert(sql.includes(contract), `Missing beta admission contract: ${contract}`);
assert(!/insert into broker_rollout_private\.projection_approvals|enabled\s*=\s*true/iu.test(sql), "migration_activates_cohort");
assert(!/drop |create or replace |alter function public\.|portfolio_holdings|portfolio_transactions/iu.test(sql), "migration_changes_financial_boundary");
assert.equal((sql.match(/create trigger /gu) ?? []).length, 1);
const fixture = buildLocalConnectedProjectionSql();
assert(fixture.includes("for update"));
assert(fixture.includes("set local role authenticated"));
assert(fixture.indexOf("set enabled = false") < fixture.indexOf("commit;"));
assert(fixture.includes("active-subscriber@stockgpt.invalid"));
assert.throws(() => buildLocalConnectedProjectionSql({ userId: "bad" }), /identity_invalid/u);
assert.throws(() => buildLocalConnectedProjectionSql({ accountId: "73000000-0000-4000-8000-000000000002" }), /identity_invalid/u);
const metadata = { name: "/supabase_db_stockgpt-web-local", running: true,
  image: "public.ecr.aws/supabase/postgres:17.6.1.159", labels: { "com.supabase.cli.project": "stockgpt-web-local" },
  mounts: [{ Type: "volume", Name: "supabase_db_stockgpt-web-local", Destination: "/var/lib/postgresql/data" }] };
for (const Host of ["unix:///var/run/docker.sock", "npipe:////./pipe/dockerDesktopLinuxEngine"]) {
  verifyLocalProjectionDockerMetadata([{ Endpoints: { docker: { Host } } }], metadata);
}
assert.throws(() => verifyLocalProjectionDockerMetadata([{ Endpoints: { docker: { Host: "tcp://remote:2375" } } }], metadata), /not_local/u);
assert.throws(() => verifyLocalProjectionDockerMetadata([{ Endpoints: { docker: { Host: "unix:///var/run/docker.sock" } } }], { ...metadata, running: false }), /container_rejected/u);
assert.throws(() => parseLocalProjectionResult("LOCAL_PROJECTION_RESULT:{}"), /result_invalid/u);
const expected = { portfolio_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1", created: true };
assert.deepEqual(parseLocalProjectionResult("LOCAL_PROJECTION_RESULT:" + JSON.stringify(expected)), expected);
const localTest = readFileSync("scripts/verify-broker-beta-admission-local.mjs", "utf8");
for (const contract of ["--allow-local-db-writes", "snapshot()", "rollback;", "beta_local_financial_state_changed", "beta_local_stop_lock_bypassed"]) assert(localTest.includes(contract));
console.log("Broker beta admission source and local-fixture pure contracts passed (no Docker or database execution).");
