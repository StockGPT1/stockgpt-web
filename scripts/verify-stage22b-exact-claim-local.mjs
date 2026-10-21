// PREPARED ONLY. Requires separate approval and an already migrated LOCAL DB.
// No .env, network/provider client, credentials, reset or migration application.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

if (!process.argv.includes("--allow-local-db-writes")) throw new Error("local_db_write_approval_required");
assert.match(readFileSync("supabase/config.toml", "utf8"), /^project_id = "stockgpt-web-local"$/m);
const container = "supabase_db_stockgpt-web-local";
// Fixed local Docker container only; cannot accept a URL/DSN/remote host.
const args = ["exec", "-i", container, "psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"];
function session() {
  const child = spawn("docker", args, { stdio: ["pipe", "pipe", "pipe"] });
  let out = ""; let err = "";
  child.stdout.on("data", (data) => { out += data; });
  child.stderr.on("data", (data) => { err += data; });
  // No raw SQL errors, rows, credentials or financial output in console.
  const done = new Promise((resolve, reject) => {
    child.once("error", () => reject(new Error("local_psql_unavailable")));
    child.once("close", (code) => resolve({ code, out, err }));
  });
  const timer = setTimeout(() => child.kill(), 15000);
  done.finally(() => clearTimeout(timer)).catch(() => {});
  return { child, done, output: () => out };
}
async function query(sql, expectedError) {
  const s = session(); s.child.stdin.end(sql + "\n");
  const r = await s.done;
  if (expectedError) { assert.notEqual(r.code, 0); assert(r.err.includes(expectedError), "unexpected_local_error_code"); }
  else assert.equal(r.code, 0, "local_sql_failed");
  return r.out.trim();
}
const [user, otherUser, connection, otherConnection, provider, otherProvider, institution, otherInstitution, alias, job, otherJob, account] = Array.from({ length: 12 }, randomUUID);
const external = `proof-${connection}`;
const externalInstitution = `proof-${institution}`;
const claim = (overrides = {}) => {
  const v = { job, user, connection, provider, external, institution, externalInstitution, worker: "proof-worker", ...overrides };
  return `select count(*) from public.claim_exact_broker_sync_proof_job('${v.job}','${v.user}','${v.connection}','${v.provider}','${v.external}','${v.institution}','${v.externalInstitution}','${v.worker}');`;
};
const service = (sql) => `begin; set local role service_role; ${sql} commit;`;
const financialSnapshot = () => query(`select jsonb_build_array(
  (select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from public.broker_accounts t),
  (select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from public.broker_positions t),
  (select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from public.broker_cash_balances t),
  (select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from public.broker_activities t),
  (select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from public.broker_connections t));`);
let setup = false;
try {
  // An isolated/quiescent synthetic DB is necessary for tests of the unchanged
  // global claim. Never clear unknown jobs to force this prerequisite to pass.
  assert.equal(await query("select count(*) from public.broker_sync_jobs where status in ('queued','running','retryable_failure');"), "0", "local_queue_not_quiescent");
  await query(`begin;
    insert into auth.users(id,email) values ('${user}','${user}@stockgpt.invalid'),('${otherUser}','${otherUser}@stockgpt.invalid');
    insert into public.broker_providers(id,provider_key,display_name) values ('${provider}','snaptrade','Synthetic proof')
      on conflict(provider_key) do nothing;
    commit;`);
  setup = true;
  // Reuse the canonical provider key if seed already created it. No production ID.
  const actualProvider = await query("select id from public.broker_providers where provider_key='snaptrade';");
  const baseClaim = (overrides = {}) => claim({ provider: actualProvider, ...overrides });
  await query(`begin;
    insert into public.broker_providers(id,provider_key,display_name) values ('${otherProvider}','proof_${otherProvider.replaceAll("-", "")}','Other synthetic provider');
    insert into public.brokerage_institutions(id,name) values ('${institution}','Synthetic proof institution'),('${otherInstitution}','Other synthetic institution');
    insert into public.brokerage_institution_aliases(id,provider_id,institution_id,external_institution_id) values ('${alias}','${actualProvider}','${institution}','${externalInstitution}');
    insert into public.broker_connections(id,user_id,provider_id,institution_id,external_connection_id,status) values
      ('${connection}','${user}','${actualProvider}','${institution}','${external}','active'),
      ('${otherConnection}','${otherUser}','${actualProvider}','${institution}','other-${external}','active');
    insert into public.broker_accounts(id,user_id,connection_id,institution_id,external_account_id,name) values ('${account}','${user}','${connection}','${institution}','proof-account','Synthetic');
    insert into public.broker_cash_balances(user_id,account_id,currency,amount,as_of) values ('${user}','${account}','USD',25,now());
    insert into public.broker_positions(user_id,account_id,position_key,symbol,quantity,price,price_currency,as_of) values ('${user}','${account}','proof','SYNTH',2,3,'USD',now());
    insert into public.broker_sync_jobs(id,user_id,connection_id) values ('${job}','${user}','${connection}'); commit;`);
  const before = await financialSnapshot();
  for (const worker of ["", " ", "x".repeat(101)]) await query(service(baseClaim({ worker })), "invalid_broker_sync_proof_claim");
  for (const role of ["anon", "authenticated"]) {
    await query(`begin; set local role ${role}; ${baseClaim()} rollback;`, "permission denied");
  }
  const signature = "public.claim_exact_broker_sync_proof_job(uuid,uuid,uuid,uuid,text,uuid,text,text)";
  assert.equal(await query(`select count(*) from pg_proc p, lateral aclexplode(p.proacl) a where p.oid='${signature}'::regprocedure and a.grantee=0 and a.privilege_type='EXECUTE';`), "0");
  for (const overrides of [{ user: otherUser }, { connection: otherConnection }, { provider: otherProvider }, { external: "wrong" }, { institution: otherInstitution }, { externalInstitution: "wrong" }]) {
    await query(service(baseClaim(overrides)), "broker_sync_proof_identity_rejected");
  }
  assert.equal(await query(service(baseClaim({ job: randomUUID() }))), "0");
  for (const patch of [
    "status='retryable_failure',attempt_count=1", "status='succeeded',attempt_count=1", "status='terminal_failure',attempt_count=1",
    "status='running',attempt_count=1,leased_by='old',lease_expires_at=now()-interval '1 second'",
    "status='running',attempt_count=1,leased_by='old',lease_expires_at=now()+interval '1 hour'",
    "attempt_count=1", "started_at=now()", "completed_at=now()", "error_code='old_error'",
    "provider_freshness_at=now()", "available_at=now()+interval '1 day'", "available_at='infinity'", "available_at='-infinity'",
  ]) assert.equal(await query(`begin; update public.broker_sync_jobs set ${patch} where id='${job}'; set local role service_role; ${baseClaim()} rollback;`), "0");
  for (const patch of ["status='disconnected',disconnected_at=now()", "status='revoked'"]) {
    await query(`begin; update public.broker_connections set ${patch} where id='${connection}'; set local role service_role; ${baseClaim()} rollback;`, "broker_sync_proof_identity_rejected");
  }
  await query(`begin; update public.broker_connections set provider_id='${otherProvider}' where id='${connection}'; set local role service_role; ${baseClaim({ provider: otherProvider })} rollback;`, "broker_sync_proof_identity_rejected");
  await query(`begin; update public.brokerage_institution_aliases set institution_id='${otherInstitution}' where id='${alias}'; set local role service_role; ${baseClaim()} rollback;`, "broker_sync_proof_identity_rejected");
  await query(`begin; delete from public.brokerage_institution_aliases where id='${alias}'; set local role service_role; ${baseClaim()} rollback;`, "broker_sync_proof_identity_rejected");
  await query(`insert into public.broker_sync_jobs(id,user_id,connection_id) values ('${otherJob}','${otherUser}','${otherConnection}');`);
  await query(service(baseClaim()), "broker_sync_proof_queue_not_single");
  assert.equal(await query(`select attempt_count from public.broker_sync_jobs where id='${otherJob}';`), "0");
  for (const patch of [
    "status='retryable_failure',attempt_count=1,available_at=now()+interval '1 day'",
    "status='running',attempt_count=1,leased_by='other',lease_expires_at=now()-interval '1 second'",
  ]) await query(`begin; update public.broker_sync_jobs set ${patch} where id='${otherJob}'; set local role service_role; ${baseClaim()} rollback;`, "broker_sync_proof_queue_not_single");
  // Terminal history does not block and is not rewritten by the claim.
  assert.equal(await query(`begin; update public.broker_sync_jobs set status='terminal_failure',attempt_count=3,error_code='synthetic_failure',completed_at=now() where id='${otherJob}'; set local role service_role; ${baseClaim()} select attempt_count from public.broker_sync_jobs where id='${otherJob}'; rollback;`), "1\n3");
  await query(`delete from public.broker_sync_jobs where id='${otherJob}';`);

  // Normal worker wins first: proof sees the resulting attempted/running state
  // and cannot steal it. Roll back this test transaction to restore freshness.
  assert.equal(await query(`begin; set local role service_role;
    select count(*) from public.claim_broker_sync_jobs('normal-first',1,300);
    ${baseClaim()} rollback;`), "1\n0");

  // Deterministic lock barrier: keep first transaction open until competitors
  // finish, rather than depending on a timed Promise.all race.
  const held = session();
  held.child.stdin.write(`begin; set local role service_role; ${baseClaim()} select 'lock_held';\n`);
  try {
    const deadline = Date.now() + 10000;
    while (!held.output().includes("lock_held") && Date.now() < deadline) await new Promise((r) => setTimeout(r, 10));
    assert(held.output().includes("lock_held"), "lock_barrier_failed");
    assert.match(held.output(), /^1\r?\nlock_held/, "initial_exact_claim_not_received");
    assert.equal(await query(service(baseClaim({ worker: "competing-proof" }))), "0");
    assert.equal(await query(service("select count(*) from public.claim_broker_sync_jobs('competing-normal',1,300);")), "0");
    // global-snapshot-race: no predicate/table lock prevents a later enqueue.
    // Insert concurrently while the exact claim is still uncommitted.
    await query(`insert into public.broker_sync_jobs(id,user_id,connection_id) values ('${otherJob}','${otherUser}','${otherConnection}');`);
    assert.equal(await query(`select attempt_count from public.broker_sync_jobs where id='${otherJob}';`), "0");
    held.child.stdin.end("commit;\n");
    assert.equal((await held.done).code, 0);
  } finally { if (!held.child.stdin.writableEnded) held.child.stdin.end("rollback;\n"); await held.done; }
  // Independently test the post-COMMIT duplicate with no unrelated active job
  // left over from the global-snapshot-race demonstration.
  await query(`delete from public.broker_sync_jobs where id='${otherJob}';`);
  assert.equal(await query(`select count(*) from public.broker_sync_jobs where id<>'${job}' and status in ('queued','running','retryable_failure');`), "0", "duplicate_claim_queue_not_isolated");
  assert.equal(await query(`select (status='running' and attempt_count=1 and leased_by='proof-worker' and lease_expires_at-started_at=interval '300 seconds') from public.broker_sync_jobs where id='${job}';`), "t");
  const committedClaim = await query(`select to_jsonb(j) from public.broker_sync_jobs j where id='${job}';`);
  assert.equal(await query(service(baseClaim())), "0", "duplicate_invocation_claimed");
  assert.equal(await query(`select to_jsonb(j) from public.broker_sync_jobs j where id='${job}';`), committedClaim, "duplicate_claim_changed_job");
  await query(service(`select public.fail_broker_sync_job('${job}','wrong-worker','test',true,60);`), "broker_sync_lease_not_owned");
  await query(service(`select public.fail_broker_sync_job('${job}','proof-worker','test',true,60);`));
  assert.equal(await query(service(baseClaim())), "0", "retry_reclaimed_by_proof");
  // Existing normal-worker recovery remains available; proof never recovers it.
  await query(`update public.broker_sync_jobs set status='running',leased_by='old',lease_expires_at=now()-interval '1 second' where id='${job}';`);
  assert.equal(await query(service(baseClaim())), "0");
  assert.equal(await query(service("select count(*) from public.claim_broker_sync_jobs('normal-recovery',1,300);")), "0"); // available_at still in future
  await query(`update public.broker_sync_jobs set available_at=now()-interval '1 second' where id='${job}';`);
  assert.equal(await query(service("select count(*) from public.claim_broker_sync_jobs('normal-recovery',1,300);")), "1");
  assert.equal(await financialSnapshot(), before, "financial_or_connection_records_changed");

  console.log("Local PostgreSQL exact-job claim, ownership, concurrency, lease and last-good checks passed; no provider used.");
} finally {
  if (setup) await query(`begin;
    delete from public.broker_connections where id in ('${connection}','${otherConnection}');
    delete from public.brokerage_institution_aliases where id='${alias}';
    delete from public.brokerage_institutions where id in ('${institution}','${otherInstitution}');
    delete from public.broker_providers where id in ('${provider}','${otherProvider}');
    delete from auth.users where id in ('${user}','${otherUser}'); commit;`);
}
