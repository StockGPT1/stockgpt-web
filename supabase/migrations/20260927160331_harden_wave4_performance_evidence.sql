alter table public.broker_activities
  add column occurred_at_precision text not null default 'unknown';

alter table public.broker_activities
  add constraint broker_activities_occurred_at_precision_check
  check (occurred_at_precision in ('exact', 'date_only', 'unknown'));

comment on column public.broker_activities.occurred_at_precision is
  'Provider-neutral precision of occurred_at. Historical rows remain unknown; date_only timestamps retain their calendar date without claiming intraday precision.';

alter function public.promote_broker_sync_candidate(uuid, text, jsonb)
  rename to promote_broker_sync_candidate_without_activity_precision;

alter function public.promote_broker_sync_candidate_without_activity_precision(uuid, text, jsonb)
  set schema broker_private;

revoke all on function broker_private.promote_broker_sync_candidate_without_activity_precision(uuid, text, jsonb)
  from public, anon, authenticated, service_role;

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
  v_job record;
  v_account jsonb;
  v_activity jsonb;
  v_account_id uuid;
  v_precision text;
begin
  select j.user_id, j.connection_id
  into v_job
  from public.broker_sync_jobs j
  where j.id = p_job_id;

  perform broker_private.promote_broker_sync_candidate_without_activity_precision(
    p_job_id,
    p_worker_id,
    p_candidate
  );

  for v_account in
    select value from jsonb_array_elements(p_candidate->'accounts')
  loop
    select a.id
    into v_account_id
    from public.broker_accounts a
    where a.user_id = v_job.user_id
      and a.connection_id = v_job.connection_id
      and a.external_account_id = v_account->>'externalAccountId';

    for v_activity in
      select value from jsonb_array_elements(v_account->'activities'->'items')
    loop
      v_precision := coalesce(
        nullif(v_activity->>'occurredAtPrecision', ''),
        'unknown'
      );

      if v_precision not in ('exact', 'date_only', 'unknown') then
        raise exception 'invalid_broker_activity_timing_precision';
      end if;

      update public.broker_activities
      set occurred_at_precision = v_precision
      where account_id = v_account_id
        and fingerprint = v_activity->>'fingerprint';
    end loop;
  end loop;
end;
$function$;

revoke all on function public.promote_broker_sync_candidate(uuid, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.promote_broker_sync_candidate(uuid, text, jsonb)
  to service_role;
