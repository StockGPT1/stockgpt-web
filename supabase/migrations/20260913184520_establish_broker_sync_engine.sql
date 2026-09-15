create type public.broker_sync_job_status as enum (
  'queued',
  'running',
  'succeeded',
  'retryable_failure',
  'terminal_failure'
);

create table public.broker_sync_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  connection_id uuid not null,
  status public.broker_sync_job_status not null default 'queued',
  attempt_count integer not null default 0,
  available_at timestamptz not null default now(),
  lease_expires_at timestamptz,
  leased_by text,
  started_at timestamptz,
  completed_at timestamptz,
  error_code text,
  provider_freshness_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint broker_sync_jobs_connection_owner_fkey
    foreign key (connection_id, user_id)
    references public.broker_connections(id, user_id)
    on delete cascade,
  constraint broker_sync_jobs_attempt_check check (attempt_count >= 0),
  constraint broker_sync_jobs_lease_check check (
    (status = 'running' and leased_by is not null and lease_expires_at is not null)
    or (status <> 'running' and leased_by is null and lease_expires_at is null)
  ),
  constraint broker_sync_jobs_error_check check (
    error_code is null or (
      error_code = lower(btrim(error_code))
      and error_code ~ '^[a-z0-9][a-z0-9_.:-]{0,95}$'
    )
  ),
  constraint broker_sync_jobs_id_connection_user_key unique (id, connection_id, user_id)
);

create unique index broker_sync_jobs_one_active_per_connection_idx
  on public.broker_sync_jobs (connection_id)
  where status in ('queued', 'running', 'retryable_failure');

create index broker_sync_jobs_claim_idx
  on public.broker_sync_jobs (available_at, created_at, id)
  where status in ('queued', 'running', 'retryable_failure');

alter table public.broker_sync_jobs enable row level security;

create policy broker_sync_jobs_owner_read
  on public.broker_sync_jobs for select to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.broker_sync_jobs from public, anon, authenticated;
grant select on table public.broker_sync_jobs to authenticated;
grant all on table public.broker_sync_jobs to service_role;

create function public.enqueue_broker_sync(
  p_user_id uuid,
  p_connection_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_job_id uuid;
begin
  perform 1
  from public.broker_connections
  where id = p_connection_id and user_id = p_user_id;
  if not found then raise exception 'broker_connection_not_found'; end if;

  select id into v_job_id
  from public.broker_sync_jobs
  where connection_id = p_connection_id
    and status in ('queued', 'running', 'retryable_failure')
  order by created_at, id
  limit 1;

  if v_job_id is not null then return v_job_id; end if;

  insert into public.broker_sync_jobs (user_id, connection_id)
  values (p_user_id, p_connection_id)
  returning id into v_job_id;
  return v_job_id;
exception
  when unique_violation then
    select id into v_job_id
    from public.broker_sync_jobs
    where connection_id = p_connection_id
      and status in ('queued', 'running', 'retryable_failure')
    order by created_at, id
    limit 1;
    return v_job_id;
end;
$function$;

create function public.claim_broker_sync_jobs(
  p_worker_id text,
  p_limit integer default 5,
  p_lease_seconds integer default 120
)
returns setof public.broker_sync_jobs
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if nullif(btrim(p_worker_id), '') is null
     or length(p_worker_id) > 100
     or p_limit is null or p_limit < 1 or p_limit > 25
     or p_lease_seconds is null or p_lease_seconds < 30 or p_lease_seconds > 900 then
    raise exception 'invalid_broker_sync_claim';
  end if;

  return query
  with claimable as (
    select j.id
    from public.broker_sync_jobs j
    where j.available_at <= now()
      and (
        j.status in ('queued', 'retryable_failure')
        or (j.status = 'running' and j.lease_expires_at < now())
      )
    order by j.available_at, j.created_at, j.id
    for update skip locked
    limit p_limit
  )
  update public.broker_sync_jobs j
  set status = 'running',
      attempt_count = j.attempt_count + 1,
      leased_by = btrim(p_worker_id),
      lease_expires_at = now() + make_interval(secs => p_lease_seconds),
      started_at = coalesce(j.started_at, now()),
      completed_at = null,
      error_code = null,
      updated_at = now()
  from claimable c
  where j.id = c.id
  returning j.*;
end;
$function$;

create function public.fail_broker_sync_job(
  p_job_id uuid,
  p_worker_id text,
  p_error_code text,
  p_retryable boolean,
  p_retry_after_seconds integer default 60
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if p_error_code is null
     or p_error_code <> lower(btrim(p_error_code))
     or p_error_code !~ '^[a-z0-9][a-z0-9_.:-]{0,95}$'
     or p_retryable is null
     or p_retry_after_seconds is null or p_retry_after_seconds < 1
     or p_retry_after_seconds > 86400 then
    raise exception 'invalid_broker_sync_failure';
  end if;

  update public.broker_sync_jobs
  set status = case when p_retryable then 'retryable_failure'::public.broker_sync_job_status
                    else 'terminal_failure'::public.broker_sync_job_status end,
      available_at = case when p_retryable then now() + make_interval(secs => p_retry_after_seconds)
                          else available_at end,
      leased_by = null,
      lease_expires_at = null,
      completed_at = case when p_retryable then null else now() end,
      error_code = p_error_code,
      updated_at = now()
  where id = p_job_id and status = 'running' and leased_by = p_worker_id;
  if not found then raise exception 'broker_sync_lease_not_owned'; end if;
end;
$function$;

create function public.promote_broker_sync_candidate(
  p_job_id uuid,
  p_worker_id text,
  p_candidate jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_job public.broker_sync_jobs%rowtype;
  v_connection public.broker_connections%rowtype;
  v_account jsonb;
  v_position jsonb;
  v_balance jsonb;
  v_activity jsonb;
  v_account_id uuid;
  v_fetched_at timestamptz;
  v_provider_freshness_at timestamptz;
  v_positions_state text;
  v_balances_state text;
  v_activities_state text;
  v_seen_accounts text[] := array[]::text[];
begin
  if jsonb_typeof(p_candidate) is distinct from 'object'
     or jsonb_typeof(p_candidate->'accounts') is distinct from 'array'
     or jsonb_array_length(p_candidate->'accounts') < 1
     or jsonb_array_length(p_candidate->'accounts') > 25 then
    raise exception 'invalid_broker_sync_candidate';
  end if;

  select * into v_job
  from public.broker_sync_jobs
  where id = p_job_id
  for update;
  if not found or v_job.status is distinct from 'running'
     or v_job.leased_by is distinct from p_worker_id
     or v_job.lease_expires_at <= now() then
    raise exception 'broker_sync_lease_not_owned';
  end if;

  select * into v_connection
  from public.broker_connections
  where id = v_job.connection_id and user_id = v_job.user_id
  for update;
  if not found then raise exception 'broker_connection_not_found'; end if;
  if v_connection.status in ('revoked', 'disconnected') then
    raise exception 'broker_connection_inactive';
  end if;

  v_fetched_at := (p_candidate->>'fetchedAt')::timestamptz;
  v_provider_freshness_at := (p_candidate->>'providerFreshnessAt')::timestamptz;
  if v_fetched_at is null or v_provider_freshness_at is null
     or v_provider_freshness_at > v_fetched_at
     or (v_connection.last_successful_sync_at is not null
         and v_provider_freshness_at < v_connection.last_successful_sync_at) then
    raise exception 'invalid_broker_sync_freshness';
  end if;

  for v_account in select value from jsonb_array_elements(p_candidate->'accounts') loop
    if nullif(btrim(v_account->>'externalAccountId'), '') is null
       or nullif(btrim(v_account->>'name'), '') is null then
      raise exception 'invalid_broker_account_candidate';
    end if;
    if v_account->>'externalAccountId' = any(v_seen_accounts) then
      raise exception 'duplicate_broker_account_candidate';
    end if;
    v_seen_accounts := array_append(v_seen_accounts, v_account->>'externalAccountId');

    insert into public.broker_accounts (
      user_id, connection_id, institution_id, external_account_id,
      name, account_type, base_currency, status, updated_at
    ) values (
      v_job.user_id, v_connection.id, v_connection.institution_id,
      btrim(v_account->>'externalAccountId'), btrim(v_account->>'name'),
      nullif(btrim(v_account->>'accountType'), ''),
      nullif(upper(btrim(v_account->>'baseCurrency')), ''),
      coalesce(nullif(v_account->>'status', '')::public.broker_account_status, 'active'),
      now()
    )
    on conflict (connection_id, external_account_id) do update
      set name = excluded.name,
          account_type = excluded.account_type,
          base_currency = excluded.base_currency,
          status = excluded.status,
          updated_at = now()
    returning id into v_account_id;

    v_positions_state := v_account->'positions'->>'state';
    v_balances_state := v_account->'balances'->>'state';
    v_activities_state := v_account->'activities'->>'state';
    if v_positions_state is distinct from 'complete'
       or v_balances_state is distinct from 'complete'
       or v_activities_state is distinct from 'complete' then
      raise exception 'invalid_broker_candidate_availability';
    end if;

    if v_positions_state = 'complete' then
      if jsonb_typeof(v_account->'positions'->'items') is distinct from 'array' then
        raise exception 'invalid_broker_positions_candidate';
      end if;
      if jsonb_array_length(v_account->'positions'->'items') > 5000 then
        raise exception 'broker_positions_window_exceeded';
      end if;
      for v_position in select value from jsonb_array_elements(v_account->'positions'->'items') loop
        insert into public.broker_positions (
          user_id, account_id, position_key, external_position_id, external_instrument_id,
          instrument_id, symbol, description, asset_type, quantity, price,
          price_currency, market_value, market_value_currency, as_of
        ) values (
          v_job.user_id, v_account_id, v_position->>'positionKey',
          nullif(v_position->>'externalPositionId', ''), nullif(v_position->>'externalInstrumentId', ''),
          nullif(v_position->>'instrumentId', '')::uuid, nullif(v_position->>'symbol', ''),
          nullif(v_position->>'description', ''), nullif(v_position->>'assetType', ''),
          (v_position->>'quantity')::numeric, nullif(v_position->>'price', '')::numeric,
          nullif(upper(v_position->>'priceCurrency'), ''), nullif(v_position->>'marketValue', '')::numeric,
          nullif(upper(v_position->>'marketValueCurrency'), ''),
          coalesce(nullif(v_position->>'asOf', '')::timestamptz, v_fetched_at)
        )
        on conflict (account_id, position_key) do update
          set external_position_id = excluded.external_position_id,
              external_instrument_id = excluded.external_instrument_id,
              instrument_id = excluded.instrument_id,
              symbol = excluded.symbol,
              description = excluded.description,
              asset_type = excluded.asset_type,
              quantity = excluded.quantity,
              price = excluded.price,
              price_currency = excluded.price_currency,
              market_value = excluded.market_value,
              market_value_currency = excluded.market_value_currency,
              as_of = excluded.as_of,
              updated_at = now();
      end loop;
      delete from public.broker_positions p
      where p.account_id = v_account_id
        and not exists (
          select 1
          from jsonb_array_elements(v_account->'positions'->'items') item
          where item->>'positionKey' = p.position_key
        );
    end if;

    if v_balances_state = 'complete' then
      if jsonb_typeof(v_account->'balances'->'items') is distinct from 'array' then
        raise exception 'invalid_broker_balances_candidate';
      end if;
      if jsonb_array_length(v_account->'balances'->'items') > 100 then
        raise exception 'broker_balances_window_exceeded';
      end if;
      for v_balance in select value from jsonb_array_elements(v_account->'balances'->'items') loop
        insert into public.broker_cash_balances (user_id, account_id, currency, amount, as_of)
        values (
          v_job.user_id, v_account_id, upper(v_balance->>'currency'),
          (v_balance->>'amount')::numeric,
          coalesce(nullif(v_balance->>'asOf', '')::timestamptz, v_fetched_at)
        )
        on conflict (account_id, currency) do update
          set amount = excluded.amount,
              as_of = excluded.as_of,
              updated_at = now();
      end loop;
      delete from public.broker_cash_balances b
      where b.account_id = v_account_id
        and not exists (
          select 1
          from jsonb_array_elements(v_account->'balances'->'items') item
          where upper(item->>'currency') = b.currency
        );
    end if;

    if v_activities_state in ('complete', 'incomplete') then
      if jsonb_typeof(v_account->'activities'->'items') is distinct from 'array' then
        raise exception 'invalid_broker_activities_candidate';
      end if;
      if jsonb_array_length(v_account->'activities'->'items') > 10000 then
        raise exception 'broker_activities_window_exceeded';
      end if;
      for v_activity in select value from jsonb_array_elements(v_account->'activities'->'items') loop
        insert into public.broker_activities (
          user_id, account_id, instrument_id, external_activity_id, fingerprint,
          fingerprint_version, activity_type, occurred_at, quantity, price,
          gross_amount, net_amount, currency, description
        ) values (
          v_job.user_id, v_account_id, nullif(v_activity->>'instrumentId', '')::uuid,
          nullif(v_activity->>'externalActivityId', ''), v_activity->>'fingerprint',
          coalesce(nullif(v_activity->>'fingerprintVersion', ''), 'sha256-v1'),
          v_activity->>'activityType', nullif(v_activity->>'occurredAt', '')::timestamptz,
          nullif(v_activity->>'quantity', '')::numeric, nullif(v_activity->>'price', '')::numeric,
          nullif(v_activity->>'grossAmount', '')::numeric, nullif(v_activity->>'netAmount', '')::numeric,
          nullif(upper(v_activity->>'currency'), ''), nullif(v_activity->>'description', '')
        )
        on conflict (account_id, fingerprint) do nothing;
      end loop;
    end if;

    if v_positions_state = 'complete' and v_balances_state = 'complete' then
      update public.broker_accounts
      set last_successful_sync_at = v_provider_freshness_at, updated_at = now()
      where id = v_account_id;
    end if;
  end loop;

  update public.broker_connections
  set status = case when status in ('revoked', 'disconnected') then status else 'active' end,
      last_attempted_sync_at = now(),
      last_successful_sync_at = v_provider_freshness_at,
      updated_at = now()
  where id = v_connection.id;

  update public.broker_sync_jobs
  set status = 'succeeded',
      leased_by = null,
      lease_expires_at = null,
      completed_at = now(),
      provider_freshness_at = v_provider_freshness_at,
      error_code = null,
      updated_at = now()
  where id = v_job.id;
end;
$function$;

revoke all on function public.enqueue_broker_sync(uuid, uuid) from public, anon, authenticated;
revoke all on function public.claim_broker_sync_jobs(text, integer, integer) from public, anon, authenticated;
revoke all on function public.fail_broker_sync_job(uuid, text, text, boolean, integer) from public, anon, authenticated;
revoke all on function public.promote_broker_sync_candidate(uuid, text, jsonb) from public, anon, authenticated;

grant execute on function public.enqueue_broker_sync(uuid, uuid) to service_role;
grant execute on function public.claim_broker_sync_jobs(text, integer, integer) to service_role;
grant execute on function public.fail_broker_sync_job(uuid, text, text, boolean, integer) to service_role;
grant execute on function public.promote_broker_sync_candidate(uuid, text, jsonb) to service_role;

comment on table public.broker_sync_jobs is
  'Durable bounded broker reconciliation queue. Jobs contain status/freshness only, never credentials or raw provider payloads.';
comment on function public.promote_broker_sync_candidate(uuid, text, jsonb) is
  'Trusted atomic promotion boundary. Complete facts replace last-good state; unavailable/incomplete facts are preserved.';
