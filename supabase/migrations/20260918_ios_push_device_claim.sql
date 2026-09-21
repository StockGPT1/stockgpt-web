create or replace function public.claim_ios_push_device(
  p_token text,
  p_environment text default 'sandbox'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_token text := lower(trim(coalesce(p_token, '')));
  v_environment text := case
    when p_environment = 'production' then 'production'
    else 'sandbox'
  end;
begin
  if v_user_id is null then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;

  if length(v_token) < 32 or length(v_token) > 256 or v_token !~ '^[a-f0-9]+

  insert into public.ios_push_devices (
    user_id,
    token,
    platform,
    environment,
    enabled,
    updated_at,
    last_seen_at
  )
  values (
    v_user_id,
    v_token,
    'ios',
    v_environment,
    true,
    now(),
    now()
  )
  on conflict (token) do update
  set
    user_id = excluded.user_id,
    platform = 'ios',
    environment = excluded.environment,
    enabled = true,
    updated_at = now(),
    last_seen_at = now();
end;
$$;

revoke all on function public.claim_ios_push_device(text, text) from public;
grant execute on function public.claim_ios_push_device(text, text) to authenticated;
 then
    raise exception 'Invalid device token' using errcode = '22023';
  end if;

  insert into public.ios_push_devices (
    user_id,
    token,
    platform,
    environment,
    enabled,
    updated_at,
    last_seen_at
  )
  values (
    v_user_id,
    v_token,
    'ios',
    v_environment,
    true,
    now(),
    now()
  )
  on conflict (token) do update
  set
    user_id = excluded.user_id,
    platform = 'ios',
    environment = excluded.environment,
    enabled = true,
    updated_at = now(),
    last_seen_at = now();
end;
$$;

revoke all on function public.claim_ios_push_device(text, text) from public;
grant execute on function public.claim_ios_push_device(text, text) to authenticated;
