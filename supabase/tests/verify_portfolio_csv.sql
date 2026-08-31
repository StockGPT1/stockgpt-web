do $test$
declare
  v_create regprocedure := to_regprocedure('public.create_trading212_portfolio(text,jsonb)');
  v_replace regprocedure := to_regprocedure('public.replace_portfolio_holdings_from_trading212(uuid,jsonb)');
begin
  if v_create is null or v_replace is null then
    raise exception '05G Trading 212 mutation functions are missing';
  end if;
  if not exists (
    select 1 from pg_proc p
    where p.oid in (v_create::oid, v_replace::oid)
      and p.prosecdef
      and p.proconfig = array['search_path=""']::text[]
  ) then
    raise exception '05G functions are not security-definer functions with an empty search_path';
  end if;
  if exists (
    select 1 from pg_proc p
    where p.oid in (v_create::oid, v_replace::oid)
      and (not p.prosecdef or p.proconfig <> array['search_path=""']::text[])
  ) then
    raise exception 'A 05G function has unsafe execution configuration';
  end if;
  if has_function_privilege('anon', v_create, 'EXECUTE')
    or has_function_privilege('anon', v_replace, 'EXECUTE')
    or has_function_privilege('public', v_create, 'EXECUTE')
    or has_function_privilege('public', v_replace, 'EXECUTE') then
    raise exception 'anon/PUBLIC can execute a 05G financial mutation';
  end if;
  if not has_function_privilege('authenticated', v_create, 'EXECUTE')
    or not has_function_privilege('authenticated', v_replace, 'EXECUTE')
    or not has_function_privilege('service_role', v_create, 'EXECUTE')
    or not has_function_privilege('service_role', v_replace, 'EXECUTE') then
    raise exception 'required trusted/authenticated 05G EXECUTE grant is missing';
  end if;
end;
$test$;
