do $wave1_catalog$
declare
  v_table_name text;
begin
  foreach v_table_name in array array[
    'instruments', 'instrument_aliases', 'instrument_market_data',
    'broker_providers', 'brokerage_institutions', 'broker_connections',
    'broker_accounts', 'broker_positions', 'broker_cash_balances', 'broker_activities'
  ] loop
    if to_regclass('public.' || v_table_name) is null then
      raise exception 'Missing Wave 1 table: %', v_table_name;
    end if;
    if not (select c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = v_table_name) then
      raise exception 'RLS is not enabled on Wave 1 table: %', v_table_name;
    end if;
    if has_table_privilege('anon', 'public.' || v_table_name, 'SELECT,INSERT,UPDATE,DELETE') then
      raise exception 'anon unexpectedly has Wave 1 table privilege: %', v_table_name;
    end if;
    if has_table_privilege('authenticated', 'public.' || v_table_name, 'INSERT,UPDATE,DELETE') then
      raise exception 'authenticated unexpectedly has Wave 1 mutation privilege: %', v_table_name;
    end if;
  end loop;

  if not has_table_privilege('authenticated', 'public.instruments', 'SELECT')
    or not has_table_privilege('authenticated', 'public.broker_accounts', 'SELECT') then
    raise exception 'Expected authenticated Wave 1 read grants';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'stock_rankings'
      and column_name = 'instrument_id' and is_nullable = 'YES'
  ) then
    raise exception 'stock_rankings compatibility instrument link is missing';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name in ('broker_connections', 'broker_accounts', 'broker_positions', 'broker_cash_balances', 'broker_activities')
      and column_name ~ '(raw|payload|credential|secret|token)'
  ) then
    raise exception 'Broker domain contains forbidden raw payload or credential storage';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'broker_accounts_connection_owner_fkey' and contype = 'f'
  ) or not exists (
    select 1 from pg_constraint
    where conname = 'broker_positions_account_owner_fkey' and contype = 'f'
  ) or not exists (
    select 1 from pg_constraint
    where conname = 'broker_cash_balances_account_owner_fkey' and contype = 'f'
  ) or not exists (
    select 1 from pg_constraint
    where conname = 'broker_activities_account_owner_fkey' and contype = 'f'
  ) then
    raise exception 'Broker owner-chain foreign keys are incomplete';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.instrument_aliases'::regclass
      and conname = 'instrument_aliases_no_overlapping_validity'
      and contype = 'x'
  ) or exists (
    select 1
    from pg_constraint
    where conrelid = 'public.instrument_aliases'::regclass
      and conname = 'instrument_aliases_namespace_scope_value_key'
  ) then
    raise exception 'Temporal alias reuse constraint is not installed correctly';
  end if;

  if not exists (
    select 1
    from pg_constraint c
    where c.conrelid = 'public.broker_connections'::regclass
      and c.conname = 'broker_connections_owner_provider_external_key'
      and c.contype = 'u'
      and (
        select array_agg(a.attname order by k.ordinality)
        from unnest(c.conkey) with ordinality as k(attnum, ordinality)
        join pg_attribute a
          on a.attrelid = c.conrelid and a.attnum = k.attnum
      ) = array['user_id', 'provider_id', 'external_connection_id']::name[]
  ) or exists (
    select 1
    from pg_constraint
    where conrelid = 'public.broker_connections'::regclass
      and conname = 'broker_connections_provider_external_key'
  ) then
    raise exception 'Broker connection external identity is not owner/provider scoped';
  end if;
end;
$wave1_catalog$;
