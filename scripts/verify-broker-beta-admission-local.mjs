// Explicitly approved LOCAL Docker tests only. Every test write rolls back.
// No environment credentials, hosted URL, reset, seed, migration or provider call.
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { buildLocalConnectedProjectionSql, parseLocalProjectionResult, verifyLocalProjectionDockerMetadata } from "./local-connected-projection-fixture.mjs";

if (!process.argv.includes("--allow-local-db-writes")) throw new Error("local_db_write_approval_required");
assert.match(readFileSync("supabase/config.toml", "utf8"), /^project_id = "stockgpt-web-local"$/mu);
for (const key of ["DOCKER_HOST", "DOCKER_CONTEXT", "DOCKER_TLS_VERIFY", "DOCKER_CERT_PATH"]) {
  assert(!process.env[key], "local_docker_override_rejected");
}
const CONTAINER = "supabase_db_stockgpt-web-local";
const psqlArgs = ["exec", "-i", CONTAINER, "psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"];
const local = (args, input) => {
  try { return execFileSync("docker", args, { input, encoding: "utf8", timeout: 30000, stdio: ["pipe", "pipe", "pipe"], maxBuffer: 2_000_000 }); }
  catch { throw new Error("beta_local_operation_failed"); }
};
let context; let container;
try {
  context = JSON.parse(local(["context", "inspect"]));
  container = JSON.parse(local(["inspect", "--format", '{"name":{{json .Name}},"running":{{json .State.Running}},"image":{{json .Config.Image}},"labels":{{json .Config.Labels}},"mounts":{{json .Mounts}}}', CONTAINER]));
} catch { throw new Error("beta_local_metadata_invalid"); }
verifyLocalProjectionDockerMetadata(context, container);
const query = (sql) => local(psqlArgs, sql + "\n").trim();
const OWNER = "11111111-1111-4111-8111-111111111111";
const OTHER = "33333333-3333-4333-8333-333333333333";
const FREE = "22222222-2222-4222-8222-222222222222";
const ACCOUNT = "73000000-0000-4000-8000-000000000001";
const OTHER_ACCOUNT = "73000000-0000-4000-8000-000000000002";
const claims = (owner = OWNER) => `set local role authenticated; do $jwt$ begin perform pg_catalog.set_config('request.jwt.claim.sub','${owner}',true); end; $jwt$;`;
const rpc = `perform * from public.create_connected_portfolio('${ACCOUNT}');`;
const denied = (statement, message = "beta_projection_unavailable") => `do $denied$
declare v_rejected boolean := false;
begin
  begin ${statement}
  exception when others then
    if position('${message}' in sqlerrm) = 0 then raise exception 'beta_local_unexpected_error'; end if;
    v_rejected := true;
  end;
  if not v_rejected then raise exception 'beta_local_denial_missing'; end if;
end; $denied$;`;
const assertion = (condition, code) => `do $assert$ begin if not (${condition}) then raise exception '${code}'; end if; end; $assert$;`;
const approval = (owner = OWNER, account = ACCOUNT, from = "clock_timestamp()-interval '1 minute'", until = "clock_timestamp()+interval '1 hour'", revoked = "null") =>
  `insert into broker_rollout_private.projection_approvals(user_id,account_id,approval_reference,valid_from,valid_until,revoked_at)
   values('${owner}','${account}','local-beta-admission-test',${from},${until},${revoked});`;
const enabled = "update broker_rollout_private.projection_control set enabled=true where singleton;";
const preflight = query(`select (
  (select count(*)=3 from auth.users where (id='${OWNER}' and email='active-subscriber@stockgpt.invalid')
    or (id='${OTHER}' and email='isolation-user@stockgpt.invalid') or (id='${FREE}' and email='free-user@stockgpt.invalid'))
  and (select count(*)=2 from public.broker_accounts where (id='${ACCOUNT}' and user_id='${OWNER}' and external_account_id='alpha-account-local-001')
    or (id='${OTHER_ACCOUNT}' and user_id='${OTHER}' and external_account_id='beta-account-local-002'))
  and not exists(select 1 from public.user_portfolios where broker_account_id in ('${ACCOUNT}','${OTHER_ACCOUNT}'))
  and (select count(*)=1 and bool_and(enabled=false) from broker_rollout_private.projection_control)
  and not exists(select 1 from broker_rollout_private.projection_approvals)
  and not exists(select 1 from public.broker_sync_jobs where status in ('queued','running','retryable_failure'))
  and current_database()='postgres' and current_setting('server_version_num')::integer between 170000 and 179999
)::text;`);
assert.equal(preflight, "true", "beta_local_fixture_preflight_failed");
const snapshot = () => query(`select md5(jsonb_build_array(
  (select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from public.user_portfolios t),
  (select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from public.portfolio_holdings t),
  (select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from public.portfolio_transactions t),
  (select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from public.broker_accounts t),
  (select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from public.broker_positions t),
  (select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from public.broker_cash_balances t),
  (select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from public.broker_activities t),
  (select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from public.broker_account_value_history t),
  (select coalesce(jsonb_agg(to_jsonb(t) order by user_id,account_id),'[]') from broker_rollout_private.projection_approvals t),
  (select coalesce(jsonb_agg(to_jsonb(t) order by singleton),'[]') from broker_rollout_private.projection_control t)
)::text);`);
const before = snapshot();
let cases = 0;
// Execute the exact browser/Auth-suite fixture SQL but roll back its final commit.
// No connected fixture or temporary enrollment is retained by this rehearsal.
const fixtureResult = parseLocalProjectionResult(query(buildLocalConnectedProjectionSql().replace(/commit;$/u, "rollback;")));
assert.equal(fixtureResult.created, true, "beta_local_compatibility_fixture_failed");
assert.equal(snapshot(), before, "beta_local_compatibility_fixture_changed_records");
cases += 1;
const runCase = (setup, test, cleanup = "") => {
  query(`begin; set local statement_timeout='10s'; set local lock_timeout='2s'; ${setup} ${test} ${cleanup} rollback;`);
  assert.equal(snapshot(), before, "beta_local_financial_state_changed");
  cases += 1;
};

// No public/client authority over enrollment. Service role is trusted backend only.
for (const role of ["anon", "authenticated"]) {
  runCase(`set local role ${role};`, denied("perform enabled from broker_rollout_private.projection_control;", "permission denied"));
  runCase(`set local role ${role};`, denied("update broker_rollout_private.projection_control set enabled=true;", "permission denied"));
  runCase(`set local role ${role};`, denied(approval(), "permission denied"));
  runCase(`set local role ${role};`, denied("perform broker_rollout_private.guard_connected_projection_admission();", "permission denied"));
}
runCase("set local role service_role;", assertion("(select not enabled from broker_rollout_private.projection_control where singleton)", "beta_local_stop_not_visible"));
runCase(claims(), denied(rpc)); // Default stopped.
runCase(enabled + claims(), denied(rpc)); // Non-cohort, even enabled.
runCase(enabled + claims() + `select set_config('request.jwt.claims','{"user_metadata":{"beta_approved":true}}',true);`, denied(rpc));
runCase(enabled, denied(approval(OTHER, ACCOUNT), "violates foreign key constraint"));
runCase(enabled + approval(OTHER, OTHER_ACCOUNT) + claims(), denied(rpc)); // Other exact account approval.
runCase(enabled + approval() + claims(OTHER), denied(rpc, "broker_account_not_found"));
runCase(enabled + approval() + claims(FREE), denied(rpc, "subscription_required"));
for (const [from, until, revoked] of [
  ["clock_timestamp()-interval '2 hours'", "clock_timestamp()-interval '1 hour'", "null"],
  ["clock_timestamp()+interval '1 hour'", "clock_timestamp()+interval '2 hours'", "null"],
  ["clock_timestamp()-interval '1 minute'", "clock_timestamp()+interval '1 hour'", "clock_timestamp()"],
]) runCase(enabled + approval(OWNER, ACCOUNT, from, until, revoked) + claims(), denied(rpc));
runCase(enabled + approval(), denied(rpc, "not_authenticated")); // Bare service/admin cannot fabricate owner.
runCase(enabled + approval() + "set local role service_role;", denied(`insert into public.user_portfolios(user_id,name,risk_tolerance,time_horizon,management_source,broker_account_id,currency,cash_balance,cash_deposited_total,investment_amount)
  values('${OWNER}','Synthetic denied','moderate','long','connected','${ACCOUNT}','USD',0,0,0);`));
runCase(enabled + approval() + claims(), `
  create temporary table result as select * from public.create_connected_portfolio('${ACCOUNT}');
  grant select on pg_temp.result to service_role;
  ${assertion("(select count(*)=1 and bool_and(created) from pg_temp.result)", "beta_local_projection_missing")}
  reset role;
  update broker_rollout_private.projection_control set enabled=false where singleton;
  delete from broker_rollout_private.projection_approvals;
  ${claims()}
  ${assertion(`(select count(*)=1 and bool_and(not created) from public.create_connected_portfolio('${ACCOUNT}'))`, "beta_local_existing_lookup_blocked")}
  ${denied(`perform * from public.mutate_portfolio_cash((select portfolio_id from pg_temp.result),'deposit',1);`, "connected_portfolio_read_only")}
  select public.rename_owned_portfolio((select portfolio_id from pg_temp.result),'Synthetic renamed while stopped');
  select public.update_owned_portfolio_preferences((select portfolio_id from pg_temp.result),'balanced','moderate','long');
  reset role; set local role service_role;
  ${denied(`update public.user_portfolios set management_source='manual',broker_account_id=null where id=(select portfolio_id from pg_temp.result);`, "connected_portfolio_read_only")}
`);
runCase("set local role service_role;", denied(`update public.user_portfolios set management_source='connected',broker_account_id='${ACCOUNT}',cash_balance=0,cash_deposited_total=0,investment_amount=0
  where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';`, "portfolio_source_transition_forbidden"));
runCase(enabled + approval() + `update public.broker_accounts set status='closed' where id='${ACCOUNT}';` + claims(), denied(rpc, "broker_account_unavailable"));
runCase(claims(), `
  create temporary table manual_before as select cash_balance, cash_deposited_total from public.user_portfolios where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
  select * from public.mutate_portfolio_cash('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','deposit',1);
  ${assertion("(select p.cash_balance=b.cash_balance+1 and p.cash_deposited_total=b.cash_deposited_total+1 from public.user_portfolios p cross join pg_temp.manual_before b where p.id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1')", "beta_local_manual_cash_changed")}
  create temporary table manual_new as select * from public.create_manual_portfolio('Synthetic admission regression','balanced','moderate','long',10,'[]'::jsonb);
  select public.rename_owned_portfolio((select portfolio_id from pg_temp.manual_new),'Synthetic manual rename');
  select public.delete_owned_portfolio((select portfolio_id from pg_temp.manual_new));
`);

// Real lock contention: control stays false throughout; no committed enrollment.
function sqlSession() {
  const child = spawn("docker", psqlArgs, { stdio: ["pipe", "pipe", "pipe"] });
  let out = "";
  child.stdout.on("data", (data) => { out += data; });
  child.stderr.on("data", () => {}); // Never print raw SQL or account rows.
  const done = new Promise((resolve, reject) => {
    child.once("error", () => reject(new Error("beta_local_session_failed")));
    child.once("close", (code) => resolve({ code, out }));
  });
  const timer = setTimeout(() => child.kill(), 15000);
  done.finally(() => clearTimeout(timer)).catch(() => {});
  return { child, done, output: () => out };
}
const held = sqlSession();
try {
  held.child.stdin.write("begin; select singleton from broker_rollout_private.projection_control where singleton for update; select 'beta_lock_ready';\n");
  const deadline = Date.now() + 5000;
  while (!held.output().includes("beta_lock_ready") && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 25));
  assert(held.output().includes("beta_lock_ready"), "beta_local_lock_barrier_failed");
  // A second session's admission must wait for the stop-row lock, not bypass it.
  const contender = sqlSession();
  contender.child.stdin.end(`begin; set local lock_timeout='150ms'; ${claims()}
    ${denied(rpc, "lock timeout")} rollback;`);
  const waited = await contender.done;
  assert.equal(waited.code, 0, "beta_local_stop_lock_bypassed");
  held.child.stdin.end("rollback;\n");
  assert.equal((await held.done).code, 0, "beta_local_lock_cleanup_failed");
  assert.equal(snapshot(), before, "beta_local_concurrency_changed_records");
  cases += 1;
} finally {
  if (!held.child.stdin.destroyed) held.child.stdin.end("rollback;\n");
  await held.done;
}
assert.equal(query("select (not enabled and not exists(select 1 from broker_rollout_private.projection_approvals))::text from broker_rollout_private.projection_control where singleton;"), "true", "beta_local_final_stop_failed");
console.log(`Broker beta admission LOCAL PostgreSQL checks passed (${cases} rollback cases, including independent-session stop-lock contention).`);
