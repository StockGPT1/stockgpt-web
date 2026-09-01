-- LOCAL DEVELOPMENT ONLY.
-- Final Stage 05I catalog boundary for authoritative Portfolio state.

do $verify$
declare
  v_table text;
  v_signature text;
  v_policy_count integer;
begin
  foreach v_table in array array[
    'user_portfolios', 'portfolio_holdings', 'portfolio_transactions'
  ] loop
    if exists (
      select 1 from information_schema.table_privileges
      where table_schema = 'public' and table_name = v_table and grantee = 'anon'
    ) or exists (
      select 1 from information_schema.column_privileges
      where table_schema = 'public' and table_name = v_table and grantee = 'anon'
    ) then
      raise exception 'anon retains direct privileges on %', v_table;
    end if;

    if (select array_agg(privilege_type::text order by privilege_type::text)
        from information_schema.table_privileges
        where table_schema = 'public' and table_name = v_table and grantee = 'authenticated')
       is distinct from array['SELECT']::text[] then
      raise exception 'authenticated is not SELECT-only on %', v_table;
    end if;

    if exists (
      select 1 from information_schema.column_privileges
      where table_schema = 'public' and table_name = v_table
        and grantee = 'authenticated' and privilege_type in ('INSERT', 'UPDATE', 'REFERENCES')
    ) then
      raise exception 'authenticated retains column DML privileges on %', v_table;
    end if;

    if not has_table_privilege('service_role', format('public.%I', v_table),
      'select,insert,update,delete,truncate,references,trigger') then
      raise exception 'service_role trusted table capability changed on %', v_table;
    end if;
  end loop;

  select count(*) into v_policy_count
  from pg_policies
  where schemaname = 'public'
    and tablename in ('user_portfolios', 'portfolio_holdings', 'portfolio_transactions');
  if v_policy_count <> 3 then
    raise exception 'Expected exactly three authoritative SELECT policies, found %', v_policy_count;
  end if;
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename in ('user_portfolios', 'portfolio_holdings', 'portfolio_transactions')
      and cmd <> 'SELECT'
  ) then
    raise exception 'Authoritative mutation RLS policy remains active';
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='user_portfolios' and policyname='user_portfolios_select_owned' and roles=array['authenticated']::name[])
    or not exists (select 1 from pg_policies where schemaname='public' and tablename='portfolio_holdings' and policyname='portfolio_holdings_select_owned_parent' and roles=array['authenticated']::name[])
    or not exists (select 1 from pg_policies where schemaname='public' and tablename='portfolio_transactions' and policyname='portfolio_transactions_select_owned_parent' and roles=array['authenticated']::name[]) then
    raise exception 'One or more final owned SELECT policies is missing';
  end if;

  foreach v_signature in array array[
    'mutate_portfolio_cash(uuid,text,numeric)',
    'buy_portfolio_holding(uuid,text,numeric,numeric,date,text)',
    'log_existing_portfolio_holding(uuid,text,numeric,numeric,date,text)',
    'sell_portfolio_holding(uuid,text,numeric,numeric)',
    'correct_portfolio_holding(uuid,text,numeric,numeric,date,text)',
    'remove_portfolio_holding_tracking(uuid,text)',
    'create_manual_portfolio(text,text,text,text,numeric,jsonb)',
    'create_ai_portfolio_draft(text,text,text,jsonb)',
    'delete_owned_portfolio(uuid)',
    'create_trading212_portfolio(text,jsonb)',
    'replace_portfolio_holdings_from_trading212(uuid,jsonb)',
    'rename_owned_portfolio(uuid,text)',
    'update_owned_portfolio_preferences(uuid,text,text,text)',
    'mark_portfolio_holding_reviewed(uuid,text)'
  ] loop
    if to_regprocedure('public.' || v_signature) is null
      or not has_function_privilege('authenticated', 'public.' || v_signature, 'execute')
      or (
        v_signature in (
          'rename_owned_portfolio(uuid,text)',
          'update_owned_portfolio_preferences(uuid,text,text,text)',
          'mark_portfolio_holding_reviewed(uuid,text)'
        )
        and not has_function_privilege('service_role', 'public.' || v_signature, 'execute')
      )
      or has_function_privilege('anon', 'public.' || v_signature, 'execute')
      or has_function_privilege('public', 'public.' || v_signature, 'execute') then
      raise exception 'Portfolio mutation RPC privilege contract is wrong for %', v_signature;
    end if;
  end loop;

  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('rename_owned_portfolio','update_owned_portfolio_preferences','mark_portfolio_holding_reviewed')
      and (
        not p.prosecdef
        or coalesce(array_to_string(p.proconfig, ','), '') not like '%search_path=""%'
        or lower(pg_get_functiondef(p.oid)) not like '%auth.uid()%'
        or lower(pg_get_function_arguments(p.oid)) like '%p_user_id%'
      )
  ) then
    raise exception 'Metadata RPC security-definer contract is malformed';
  end if;
end;
$verify$;
