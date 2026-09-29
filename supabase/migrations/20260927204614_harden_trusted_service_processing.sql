create table public.stripe_webhook_events (
  event_id text primary key,
  event_type text not null,
  customer_id text,
  subscription_id text,
  status text not null check (status in ('processing', 'processed', 'failed')),
  attempts integer not null default 1 check (attempts > 0),
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  processed_at timestamptz
);

alter table public.stripe_webhook_events enable row level security;
revoke all on table public.stripe_webhook_events from public, anon, authenticated;
grant all on table public.stripe_webhook_events to service_role;

create or replace function public.process_stripe_entitlement_event(
  p_event_id text,
  p_event_type text,
  p_action text,
  p_user_id uuid default null,
  p_customer_id text default null,
  p_subscription_id text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_affected integer;
begin
  if coalesce(btrim(p_event_id), '') = '' or coalesce(btrim(p_event_type), '') = '' then
    raise exception using errcode = '22023', message = 'invalid_stripe_event_identity';
  end if;

  if p_action not in ('activate_basic', 'ensure_basic', 'end_access', 'observe_only', 'ignore') then
    raise exception using errcode = '22023', message = 'invalid_stripe_event_action';
  end if;

  insert into public.stripe_webhook_events (
    event_id, event_type, customer_id, subscription_id, status
  ) values (
    p_event_id, p_event_type, p_customer_id, p_subscription_id, 'processing'
  )
  on conflict (event_id) do nothing;

  select status
  into v_status
  from public.stripe_webhook_events
  where event_id = p_event_id
  for update;

  if v_status = 'processed' then
    return false;
  end if;

  update public.stripe_webhook_events
  set event_type = p_event_type,
      customer_id = p_customer_id,
      subscription_id = p_subscription_id,
      status = 'processing',
      attempts = case when v_status = 'failed' then attempts + 1 else attempts end,
      last_error_code = null,
      updated_at = now()
  where event_id = p_event_id;

  if p_action = 'activate_basic' then
    if p_user_id is null then
      raise exception using errcode = '22023', message = 'stripe_user_missing';
    end if;

    update public.profiles
    set subscription_status = 'basic',
        stripe_customer_id = p_customer_id
    where id = p_user_id;
    get diagnostics v_affected = row_count;
    if v_affected <> 1 then
      raise exception using errcode = 'P0001', message = 'stripe_profile_not_found';
    end if;
  elsif p_action = 'ensure_basic' then
    if coalesce(btrim(p_customer_id), '') = '' then
      raise exception using errcode = '22023', message = 'stripe_customer_missing';
    end if;

    if not exists (
      select 1 from public.profiles where stripe_customer_id = p_customer_id
    ) then
      raise exception using errcode = 'P0001', message = 'stripe_profile_not_found';
    end if;

    update public.profiles
    set subscription_status = 'basic'
    where stripe_customer_id = p_customer_id
      and lower(coalesce(subscription_status, '')) not in (
        'basic', 'core', 'premium', 'executive', 'max', 'alpha', 'trialing', 'active'
      );
  elsif p_action = 'end_access' then
    if coalesce(btrim(p_customer_id), '') = '' then
      raise exception using errcode = '22023', message = 'stripe_customer_missing';
    end if;

    update public.profiles
    set subscription_status = 'none'
    where stripe_customer_id = p_customer_id;
    get diagnostics v_affected = row_count;
    if v_affected < 1 then
      raise exception using errcode = 'P0001', message = 'stripe_profile_not_found';
    end if;
  end if;

  update public.stripe_webhook_events
  set status = 'processed',
      processed_at = now(),
      updated_at = now(),
      last_error_code = null
  where event_id = p_event_id;

  return true;
end;
$$;

create or replace function public.record_stripe_webhook_failure(
  p_event_id text,
  p_event_type text,
  p_error_code text,
  p_customer_id text default null,
  p_subscription_id text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.stripe_webhook_events (
    event_id, event_type, customer_id, subscription_id, status, last_error_code
  ) values (
    p_event_id, p_event_type, p_customer_id, p_subscription_id, 'failed', left(p_error_code, 100)
  )
  on conflict (event_id) do update
  set event_type = excluded.event_type,
      customer_id = excluded.customer_id,
      subscription_id = excluded.subscription_id,
      status = case
        when public.stripe_webhook_events.status = 'processed' then 'processed'
        else 'failed'
      end,
      attempts = case
        when public.stripe_webhook_events.status = 'processed' then public.stripe_webhook_events.attempts
        else public.stripe_webhook_events.attempts + 1
      end,
      last_error_code = case
        when public.stripe_webhook_events.status = 'processed' then public.stripe_webhook_events.last_error_code
        else excluded.last_error_code
      end,
      updated_at = now();
end;
$$;

revoke all on function public.process_stripe_entitlement_event(text, text, text, uuid, text, text) from public, anon, authenticated;
revoke all on function public.record_stripe_webhook_failure(text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.process_stripe_entitlement_event(text, text, text, uuid, text, text) to service_role;
grant execute on function public.record_stripe_webhook_failure(text, text, text, text, text) to service_role;

create table public.email_digest_deliveries (
  digest_key text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null check (status in ('processing', 'sent', 'failed')),
  attempts integer not null default 1 check (attempts > 0),
  provider_message_id text,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz,
  primary key (digest_key, user_id)
);

alter table public.email_digest_deliveries enable row level security;
revoke all on table public.email_digest_deliveries from public, anon, authenticated;
grant all on table public.email_digest_deliveries to service_role;

create or replace function public.claim_email_digest_delivery(p_digest_key text, p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_inserted integer;
  v_updated_at timestamptz;
begin
  insert into public.email_digest_deliveries (digest_key, user_id, status)
  values (p_digest_key, p_user_id, 'processing')
  on conflict (digest_key, user_id) do nothing;
  get diagnostics v_inserted = row_count;

  select status, updated_at into v_status, v_updated_at
  from public.email_digest_deliveries
  where digest_key = p_digest_key and user_id = p_user_id
  for update;

  if v_status = 'sent' then return false; end if;
  if v_status = 'processing' and v_inserted = 0 and v_updated_at > now() - interval '30 minutes' then
    return false;
  end if;

  if v_status = 'failed' or (v_status = 'processing' and v_inserted = 0) then
    update public.email_digest_deliveries
    set status = 'processing', attempts = attempts + 1, updated_at = now(), last_error_code = null
    where digest_key = p_digest_key and user_id = p_user_id;
  end if;
  return true;
end;
$$;

create or replace function public.complete_email_digest_delivery(
  p_digest_key text, p_user_id uuid, p_provider_message_id text default null
)
returns void language sql security definer set search_path = '' as $$
  update public.email_digest_deliveries
  set status = 'sent', provider_message_id = p_provider_message_id,
      sent_at = now(), updated_at = now(), last_error_code = null
  where digest_key = p_digest_key and user_id = p_user_id;
$$;

create or replace function public.fail_email_digest_delivery(
  p_digest_key text, p_user_id uuid, p_error_code text
)
returns void language sql security definer set search_path = '' as $$
  update public.email_digest_deliveries
  set status = 'failed', last_error_code = left(p_error_code, 100), updated_at = now()
  where digest_key = p_digest_key and user_id = p_user_id and status <> 'sent';
$$;

revoke all on function public.claim_email_digest_delivery(text, uuid) from public, anon, authenticated;
revoke all on function public.complete_email_digest_delivery(text, uuid, text) from public, anon, authenticated;
revoke all on function public.fail_email_digest_delivery(text, uuid, text) from public, anon, authenticated;
grant execute on function public.claim_email_digest_delivery(text, uuid) to service_role;
grant execute on function public.complete_email_digest_delivery(text, uuid, text) to service_role;
grant execute on function public.fail_email_digest_delivery(text, uuid, text) to service_role;
