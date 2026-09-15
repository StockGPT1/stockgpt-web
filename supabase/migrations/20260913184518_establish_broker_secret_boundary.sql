create schema broker_private;

create table broker_private.user_provider_credentials (
  user_id uuid not null references auth.users(id) on delete cascade,
  provider_id uuid not null references public.broker_providers(id) on delete cascade,
  provider_user_id text not null,
  vault_secret_id uuid not null unique,
  created_at timestamptz not null default now(),
  rotated_at timestamptz,
  primary key (user_id, provider_id),
  constraint user_provider_credentials_provider_user_check check (
    provider_user_id = btrim(provider_user_id) and provider_user_id <> ''
  )
);

alter table broker_private.user_provider_credentials enable row level security;

create function broker_private.delete_vault_secret_for_credential()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  delete from vault.secrets where id = old.vault_secret_id;
  return old;
end;
$function$;

create trigger delete_vault_secret_after_credential_delete
after delete on broker_private.user_provider_credentials
for each row execute function broker_private.delete_vault_secret_for_credential();

create function public.store_broker_user_secret(
  p_user_id uuid,
  p_provider_id uuid,
  p_provider_user_id text,
  p_user_secret text
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_existing broker_private.user_provider_credentials%rowtype;
  v_secret_id uuid;
begin
  if p_user_id is null
     or p_provider_id is null
     or nullif(btrim(p_provider_user_id), '') is null
     or nullif(p_user_secret, '') is null then
    raise exception 'invalid_broker_credential';
  end if;

  perform 1 from auth.users where id = p_user_id;
  if not found then raise exception 'broker_user_not_found'; end if;
  perform 1 from public.broker_providers where id = p_provider_id;
  if not found then raise exception 'broker_provider_not_found'; end if;

  select * into v_existing
  from broker_private.user_provider_credentials
  where user_id = p_user_id and provider_id = p_provider_id
  for update;

  if found then
    perform vault.update_secret(
      v_existing.vault_secret_id,
      p_user_secret,
      format('broker-user/%s/%s', p_provider_id, p_user_id),
      'StockGPT per-user provider credential'
    );
    update broker_private.user_provider_credentials
    set provider_user_id = btrim(p_provider_user_id), rotated_at = now()
    where user_id = p_user_id and provider_id = p_provider_id;
  else
    v_secret_id := vault.create_secret(
      p_user_secret,
      format('broker-user/%s/%s', p_provider_id, p_user_id),
      'StockGPT per-user provider credential'
    );
    insert into broker_private.user_provider_credentials (
      user_id, provider_id, provider_user_id, vault_secret_id
    ) values (
      p_user_id, p_provider_id, btrim(p_provider_user_id), v_secret_id
    );
  end if;
end;
$function$;

create function public.get_broker_user_secret(
  p_user_id uuid,
  p_provider_id uuid
)
returns table (provider_user_id text, user_secret text)
language sql
security definer
set search_path = ''
stable
as $function$
  select c.provider_user_id, s.decrypted_secret
  from broker_private.user_provider_credentials c
  join vault.decrypted_secrets s on s.id = c.vault_secret_id
  where c.user_id = p_user_id and c.provider_id = p_provider_id;
$function$;

create function public.revoke_broker_user_secret(
  p_user_id uuid,
  p_provider_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_deleted boolean;
begin
  delete from broker_private.user_provider_credentials
  where user_id = p_user_id and provider_id = p_provider_id;
  v_deleted := found;
  return v_deleted;
end;
$function$;

revoke all on schema broker_private from public, anon, authenticated, service_role;
revoke all on all tables in schema broker_private from public, anon, authenticated, service_role;
revoke all on all functions in schema broker_private from public, anon, authenticated, service_role;

revoke all on function public.store_broker_user_secret(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.get_broker_user_secret(uuid, uuid) from public, anon, authenticated;
revoke all on function public.revoke_broker_user_secret(uuid, uuid) from public, anon, authenticated;

grant execute on function public.store_broker_user_secret(uuid, uuid, text, text) to service_role;
grant execute on function public.get_broker_user_secret(uuid, uuid) to service_role;
grant execute on function public.revoke_broker_user_secret(uuid, uuid) to service_role;

comment on schema broker_private is
  'Non-exposed broker credential metadata. Secret values remain in Supabase Vault.';
comment on function public.get_broker_user_secret(uuid, uuid) is
  'Backend-only exact user/provider retrieve-use-discard boundary. Never expose its result to a client.';
