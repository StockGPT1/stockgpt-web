drop function public.process_stripe_entitlement_event(text, text, text, uuid, text, text);

create function public.process_stripe_entitlement_event(
  p_event_id text,
  p_event_type text,
  p_action text,
  p_user_id uuid default null,
  p_customer_id text default null,
  p_subscription_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_status text;
  v_profile_id uuid;
  v_profile_count integer;
  v_previous_customer_id text;
  v_previous_subscription_status text;
  v_customer_linked boolean := false;
  v_entitlement_changed boolean := false;
  v_affected integer;
begin
  if coalesce(btrim(p_event_id), '') = '' or coalesce(btrim(p_event_type), '') = '' then
    raise exception using errcode = '22023', message = 'invalid_stripe_event_identity';
  end if;

  if p_action not in (
    'activate_basic', 'ensure_basic', 'end_access', 'link_customer', 'observe_only', 'ignore'
  ) then
    raise exception using errcode = '22023', message = 'invalid_stripe_event_action';
  end if;

  insert into public.stripe_webhook_events (
    event_id, event_type, customer_id, subscription_id, status
  ) values (
    p_event_id, p_event_type, p_customer_id, p_subscription_id, 'processing'
  )
  on conflict (event_id) do nothing;

  select status
  into v_event_status
  from public.stripe_webhook_events
  where event_id = p_event_id
  for update;

  if v_event_status = 'processed' then
    return jsonb_build_object(
      'processed', false,
      'entitlementChanged', false,
      'customerLinked', false
    );
  end if;

  update public.stripe_webhook_events
  set event_type = p_event_type,
      customer_id = p_customer_id,
      subscription_id = p_subscription_id,
      status = 'processing',
      attempts = case when v_event_status = 'failed' then attempts + 1 else attempts end,
      last_error_code = null,
      updated_at = now()
  where event_id = p_event_id;

  if p_action in ('activate_basic', 'ensure_basic', 'end_access', 'link_customer') then
    if coalesce(btrim(p_customer_id), '') = '' then
      raise exception using errcode = '22023', message = 'stripe_customer_missing';
    end if;

    if p_user_id is not null then
      select stripe_customer_id, subscription_status
      into v_previous_customer_id, v_previous_subscription_status
      from public.profiles
      where id = p_user_id
      for update;
      if not found then
        raise exception using errcode = 'P0001', message = 'stripe_profile_not_found';
      end if;

      if exists (
        select 1
        from public.profiles
        where stripe_customer_id = p_customer_id
          and id <> p_user_id
      ) then
        raise exception using errcode = '23505', message = 'stripe_customer_already_linked';
      end if;

      if v_previous_customer_id is not null and v_previous_customer_id <> p_customer_id then
        raise exception using errcode = 'P0001', message = 'stripe_customer_conflict';
      end if;

      v_profile_id := p_user_id;
      if v_previous_customer_id is null then
        update public.profiles
        set stripe_customer_id = p_customer_id
        where id = v_profile_id;
        v_customer_linked := true;
      end if;
    else
      select count(*), (array_agg(id order by id))[1]
      into v_profile_count, v_profile_id
      from public.profiles
      where stripe_customer_id = p_customer_id;

      if v_profile_count <> 1 then
        raise exception using errcode = 'P0001', message = 'stripe_profile_not_found';
      end if;

      select stripe_customer_id, subscription_status
      into v_previous_customer_id, v_previous_subscription_status
      from public.profiles
      where id = v_profile_id
      for update;
    end if;
  end if;

  if p_action = 'link_customer' then
    if p_user_id is null then
      raise exception using errcode = '22023', message = 'stripe_user_missing';
    end if;
  elsif p_action = 'activate_basic' then
    update public.profiles
    set subscription_status = 'basic'
    where id = v_profile_id
      and lower(coalesce(subscription_status, '')) not in (
        'basic', 'core', 'premium', 'executive', 'max', 'alpha', 'trialing', 'active'
      );
    get diagnostics v_affected = row_count;
    v_entitlement_changed := v_affected = 1;
  elsif p_action = 'ensure_basic' then
    update public.profiles
    set subscription_status = 'basic'
    where id = v_profile_id
      and lower(coalesce(subscription_status, '')) not in (
        'basic', 'core', 'premium', 'executive', 'max', 'alpha', 'trialing', 'active'
      );
    get diagnostics v_affected = row_count;
    v_entitlement_changed := v_affected = 1;
  elsif p_action = 'end_access' then
    update public.profiles
    set subscription_status = 'none'
    where id = v_profile_id;
    get diagnostics v_affected = row_count;
    if v_affected <> 1 then
      raise exception using errcode = 'P0001', message = 'stripe_profile_not_found';
    end if;
    v_entitlement_changed := lower(coalesce(v_previous_subscription_status, '')) <> 'none';
  end if;

  update public.stripe_webhook_events
  set status = 'processed',
      processed_at = now(),
      updated_at = now(),
      last_error_code = null
  where event_id = p_event_id;

  return jsonb_build_object(
    'processed', true,
    'entitlementChanged', v_entitlement_changed,
    'customerLinked', v_customer_linked
  );
end;
$$;

revoke all on function public.process_stripe_entitlement_event(text, text, text, uuid, text, text)
from public, anon, authenticated;
grant execute on function public.process_stripe_entitlement_event(text, text, text, uuid, text, text)
to service_role;

comment on function public.process_stripe_entitlement_event(text, text, text, uuid, text, text)
is 'Atomically records a trusted Stripe event and applies only a server-resolved entitlement/customer-link action.';
