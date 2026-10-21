// LOCAL SYNTHETIC TEST FIXTURE ONLY. No URL, credentials, .env or remote target.
// Approval and enabled=true are transaction-local and never commit as enabled.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

export const LOCAL_PROJECTION_OWNER = "11111111-1111-4111-8111-111111111111";
export const LOCAL_PROJECTION_ACCOUNT = "73000000-0000-4000-8000-000000000001";
const CONTAINER = "supabase_db_stockgpt-web-local";
const PROJECT = "stockgpt-web-local";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const fail = (code) => { throw new Error(code); };

export function buildLocalConnectedProjectionSql({ userId = LOCAL_PROJECTION_OWNER, accountId = LOCAL_PROJECTION_ACCOUNT } = {}) {
  if (!UUID.test(userId) || !UUID.test(accountId)
      || userId !== LOCAL_PROJECTION_OWNER || accountId !== LOCAL_PROJECTION_ACCOUNT) {
    fail("local_projection_fixture_identity_invalid");
  }
  return `begin;
set local statement_timeout = '15s';
set local lock_timeout = '5s';
create temporary table fixture_projection_result(portfolio_id uuid, created boolean) on commit drop;
grant select, insert on table pg_temp.fixture_projection_result to authenticated;
create temporary table fixture_projection_control(updated_at timestamptz) on commit drop;
do $fixture$
declare v_enabled boolean; v_updated_at timestamptz;
begin
  select c.enabled, c.updated_at into strict v_enabled, v_updated_at
    from broker_rollout_private.projection_control c where c.singleton = true for update;
  if v_enabled is distinct from false or exists(select 1 from broker_rollout_private.projection_approvals) then
    raise exception 'local_projection_fixture_not_quiescent';
  end if;
  if not exists (
    select 1 from auth.users u
    join public.broker_accounts a on a.user_id = u.id
    join public.broker_connections c on c.id = a.connection_id and c.user_id = u.id
    join public.broker_providers p on p.id = c.provider_id
    where u.id = '${userId}' and u.email = 'active-subscriber@stockgpt.invalid'
      and a.id = '${accountId}' and a.status = 'active' and a.last_successful_sync_at is not null
      and a.external_account_id = 'alpha-account-local-001'
      and c.id = '72000000-0000-4000-8000-000000000001' and c.status = 'active'
      and c.external_connection_id = 'alpha-connection-local-001'
      and a.institution_id = c.institution_id
      and c.institution_id = '71000000-0000-4000-8000-000000000001'
      and p.id = '70000000-0000-4000-8000-000000000001' and p.provider_key = 'synthetic_alpha'
  ) then raise exception 'local_projection_fixture_identity_rejected'; end if;
  insert into pg_temp.fixture_projection_control values (v_updated_at);
  insert into broker_rollout_private.projection_approvals
    (user_id, account_id, approval_reference, valid_from, valid_until, revoked_at)
    values ('${userId}', '${accountId}', 'local-connected-projection-fixture',
      now() - interval '1 second', now() + interval '1 minute', null);
  update broker_rollout_private.projection_control set enabled = true, updated_at = now() where singleton = true;
end;
$fixture$;
set local role authenticated;
do $claims$ begin perform pg_catalog.set_config('request.jwt.claim.sub', '${userId}', true); end; $claims$;
insert into pg_temp.fixture_projection_result select portfolio_id, created from public.create_connected_portfolio('${accountId}');
reset role;
do $cleanup$
declare v_count integer;
begin
  if (select count(*) from pg_temp.fixture_projection_result) <> 1 then raise exception 'local_projection_fixture_result_invalid'; end if;
  delete from broker_rollout_private.projection_approvals where user_id = '${userId}' and account_id = '${accountId}'
    and approval_reference = 'local-connected-projection-fixture';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'local_projection_fixture_cleanup_invalid'; end if;
  update broker_rollout_private.projection_control set enabled = false,
    updated_at = (select updated_at from pg_temp.fixture_projection_control) where singleton = true;
  if exists(select 1 from broker_rollout_private.projection_approvals)
    or exists(select 1 from broker_rollout_private.projection_control where enabled) then
    raise exception 'local_projection_fixture_cleanup_invalid';
  end if;
end;
$cleanup$;
select 'LOCAL_PROJECTION_RESULT:' || row_to_json(r)::text from pg_temp.fixture_projection_result r;
commit;`;
}

export function verifyLocalProjectionDockerMetadata(contexts, container) {
  const endpoint = contexts?.[0]?.Endpoints?.docker?.Host;
  if (typeof endpoint !== "string" || !/^(?:npipe:\/\/\/\/\.\/pipe\/|unix:\/\/\/)/u.test(endpoint)) {
    fail("local_projection_fixture_docker_not_local");
  }
  if (container?.name !== `/${CONTAINER}` || container?.running !== true
      || !/^(?:public\.ecr\.aws\/supabase\/postgres|supabase\/postgres):17\./u.test(container?.image ?? "")
      || container?.labels?.["com.supabase.cli.project"] !== PROJECT
      || !container?.mounts?.some((mount) => mount.Type === "volume" && mount.Name === CONTAINER && mount.Destination === "/var/lib/postgresql/data")) {
    fail("local_projection_fixture_container_rejected");
  }
}

export function parseLocalProjectionResult(output) {
  const records = output.split(/\r?\n/u).filter((line) => line.startsWith("LOCAL_PROJECTION_RESULT:"));
  if (records.length !== 1) fail("local_projection_fixture_result_invalid");
  let result;
  try { result = JSON.parse(records[0].slice("LOCAL_PROJECTION_RESULT:".length)); }
  catch { fail("local_projection_fixture_result_invalid"); }
  if (!result || !UUID.test(result.portfolio_id ?? "") || typeof result.created !== "boolean"
      || Object.keys(result).sort().join(",") !== "created,portfolio_id") fail("local_projection_fixture_result_invalid");
  return result;
}

export function createLocalConnectedProjectionFixture(options = {}) {
  const sql = buildLocalConnectedProjectionSql(options);
  if (!/^project_id = "stockgpt-web-local"$/mu.test(readFileSync("supabase/config.toml", "utf8"))) {
    fail("local_projection_fixture_project_rejected");
  }
  if (process.env.DOCKER_HOST || process.env.DOCKER_CONTEXT || process.env.DOCKER_TLS_VERIFY || process.env.DOCKER_CERT_PATH) {
    fail("local_projection_fixture_docker_override_rejected");
  }
  const docker = (args, input) => {
    try { return execFileSync("docker", args, { input, encoding: "utf8", timeout: 25000, maxBuffer: 1_000_000, stdio: ["pipe", "pipe", "pipe"] }); }
    catch { fail("local_projection_fixture_docker_operation_failed"); }
  };
  let contexts; let container;
  try {
    contexts = JSON.parse(docker(["context", "inspect"]));
    // Deliberately excludes container Env: it can contain database credentials.
    container = JSON.parse(docker(["inspect", "--format", '{"name":{{json .Name}},"running":{{json .State.Running}},"image":{{json .Config.Image}},"labels":{{json .Config.Labels}},"mounts":{{json .Mounts}}}', CONTAINER]));
  } catch { fail("local_projection_fixture_docker_metadata_invalid"); }
  verifyLocalProjectionDockerMetadata(contexts, container);
  return parseLocalProjectionResult(docker(["exec", "-i", CONTAINER, "psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"], sql));
}
