-- Preparation only: not wired to any route. Expected identities come from a
-- separately approved backend receipt, NEVER browser input. This verifies DB
-- relationships, not deployment identity, key classification or broker permission
-- (the current schema does not store authoritative TEST/read-only evidence).
create function public.claim_exact_broker_sync_proof_job(
  p_job_id uuid,
  p_user_id uuid,
  p_connection_id uuid,
  p_provider_id uuid,
  p_external_connection_id text,
  p_institution_id uuid,
  p_external_institution_id text,
  p_worker_id text
)
returns setof public.broker_sync_jobs
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_job public.broker_sync_jobs%rowtype;
  v_connection public.broker_connections%rowtype;
  v_now timestamptz;
begin
  if p_job_id is null or p_user_id is null or p_connection_id is null
     or p_provider_id is null or p_institution_id is null
     or nullif(pg_catalog.btrim(p_external_connection_id), '') is null
     or p_external_connection_id <> pg_catalog.btrim(p_external_connection_id)
     or nullif(pg_catalog.btrim(p_external_institution_id), '') is null
     or p_external_institution_id <> pg_catalog.btrim(p_external_institution_id)
     or nullif(pg_catalog.btrim(p_worker_id), '') is null
     or pg_catalog.length(p_worker_id) > 100 then
    raise exception using errcode = 'P0001', message = 'invalid_broker_sync_proof_claim';
  end if;

  -- Same job -> connection lock order as promotion. SKIP LOCKED returns zero
  -- rows to a competing caller; it can never select a different job.
  select j.* into v_job
  from public.broker_sync_jobs as j
  where j.id = p_job_id
  for update skip locked;
  if not found then return; end if;
  if v_job.user_id is distinct from p_user_id
     or v_job.connection_id is distinct from p_connection_id then
    raise exception using errcode = 'P0001', message = 'broker_sync_proof_identity_rejected';
  end if;

  v_now := pg_catalog.clock_timestamp();
  if v_job.status <> 'queued' or v_job.attempt_count <> 0
     or v_job.started_at is not null or v_job.leased_by is not null
     or v_job.lease_expires_at is not null or v_job.completed_at is not null
     or v_job.error_code is not null or v_job.provider_freshness_at is not null
     or not pg_catalog.isfinite(v_job.available_at)
     or v_job.available_at > v_now then
    return;
  end if;

  select c.* into v_connection
  from public.broker_connections as c
  where c.id = p_connection_id and c.user_id = p_user_id
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'broker_sync_proof_identity_rejected';
  end if;
  if v_connection.provider_id is distinct from p_provider_id
     or v_connection.institution_id is distinct from p_institution_id
     or v_connection.external_connection_id is distinct from p_external_connection_id
     or v_connection.status not in ('pending', 'active') then
    raise exception using errcode = 'P0001', message = 'broker_sync_proof_identity_rejected';
  end if;

  -- Lock identity evidence against replacement until the lease commits. Do not
  -- infer provider/institution identity from display names or symbol matching.
  perform 1
  from public.broker_providers as p
  join public.brokerage_institution_aliases as a on a.provider_id = p.id
  join public.brokerage_institutions as i on i.id = a.institution_id
  where p.id = p_provider_id and p.provider_key = 'snaptrade'
    and a.external_institution_id = p_external_institution_id
    and a.institution_id = p_institution_id
  for share of p, a, i;
  if not found then
    raise exception using errcode = 'P0001', message = 'broker_sync_proof_identity_rejected';
  end if;

  -- Conservative snapshot veto, NOT a serializable global queue assertion.
  -- Concurrent inserts can be invisible under READ COMMITTED. Exact UUID
  -- selection still prevents claiming unrelated work. No queue-wide locks.
  if exists (
    select 1 from public.broker_sync_jobs as j
    where j.id <> p_job_id
      and j.status in ('queued', 'running', 'retryable_failure')
  ) then
    raise exception using errcode = 'P0001', message = 'broker_sync_proof_queue_not_single';
  end if;

  -- Use completion-of-check DB time, not transaction-start time, for the fixed
  -- 300-second lease expected by the shared worker. No configurable retry.
  v_now := pg_catalog.clock_timestamp();
  return query
  update public.broker_sync_jobs as j
  set status = 'running', attempt_count = 1,
      leased_by = pg_catalog.btrim(p_worker_id),
      lease_expires_at = v_now + interval '300 seconds',
      started_at = v_now, updated_at = v_now
  where j.id = v_job.id
  returning j.*;
end;
$function$;

revoke all on function public.claim_exact_broker_sync_proof_job(uuid, uuid, uuid, uuid, text, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.claim_exact_broker_sync_proof_job(uuid, uuid, uuid, uuid, text, uuid, text, text)
  to service_role;
