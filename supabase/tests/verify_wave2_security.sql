do $wave2_security$
begin
  if to_regnamespace('broker_private') is null
     or to_regclass('broker_private.user_provider_credentials') is null
     or to_regclass('public.broker_sync_jobs') is null then
    raise exception 'Wave 2 broker security/sync catalog incomplete';
  end if;

  if has_schema_privilege('anon', 'broker_private', 'USAGE')
     or has_schema_privilege('authenticated', 'broker_private', 'USAGE')
     or has_schema_privilege('service_role', 'broker_private', 'USAGE')
     or has_schema_privilege('anon', 'vault', 'USAGE')
     or has_schema_privilege('authenticated', 'vault', 'USAGE') then
    raise exception 'Broker private/Vault schema exposed to a Data API client role';
  end if;

  if has_function_privilege('anon', 'public.get_broker_user_secret(uuid,uuid)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.get_broker_user_secret(uuid,uuid)', 'EXECUTE')
     or has_function_privilege('anon', 'public.store_broker_user_secret(uuid,uuid,text,text)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.store_broker_user_secret(uuid,uuid,text,text)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.promote_broker_sync_candidate(uuid,text,jsonb)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.claim_broker_sync_jobs(text,integer,integer)', 'EXECUTE') then
    raise exception 'Browser role can invoke backend-only broker operation';
  end if;

  if not has_function_privilege('service_role', 'public.get_broker_user_secret(uuid,uuid)', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.promote_broker_sync_candidate(uuid,text,jsonb)', 'EXECUTE') then
    raise exception 'Backend-only broker operation grant missing';
  end if;

  if not (select relrowsecurity from pg_class where oid = 'public.broker_sync_jobs'::regclass)
     or not (select relrowsecurity from pg_class where oid = 'broker_private.user_provider_credentials'::regclass)
     or has_table_privilege('authenticated', 'public.broker_sync_jobs', 'INSERT,UPDATE,DELETE')
     or has_table_privilege('anon', 'public.broker_sync_jobs', 'SELECT,INSERT,UPDATE,DELETE') then
    raise exception 'Broker queue RLS/privilege boundary incomplete';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name in ('broker_sync_jobs', 'broker_connections', 'broker_accounts', 'broker_positions', 'broker_cash_balances', 'broker_activities')
      and column_name ~ '(secret|credential|token|raw_payload)'
  ) then
    raise exception 'Raw credential/payload column appeared in broker domain';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.broker_sync_jobs'::regclass
      and conname = 'broker_sync_jobs_connection_owner_fkey'
  ) then
    raise exception 'Broker queue parent/owner constraint missing';
  end if;
end;
$wave2_security$;
