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
end;
$wave1_catalog$;
