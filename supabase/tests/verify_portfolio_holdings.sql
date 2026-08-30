do $test$
declare
  v_function text;
begin
  foreach v_function in array array[
    'buy_portfolio_holding(uuid,text,numeric,numeric,date,text)',
    'log_existing_portfolio_holding(uuid,text,numeric,numeric,date,text)',
    'sell_portfolio_holding(uuid,text,numeric,numeric)',
    'correct_portfolio_holding(uuid,text,numeric,numeric,date,text)',
    'remove_portfolio_holding_tracking(uuid,text)'
  ] loop
    if to_regprocedure('public.' || v_function) is null then
      raise exception 'Missing Stage 05E function %', v_function;
    end if;
    if not has_function_privilege('authenticated', 'public.' || v_function, 'EXECUTE') then
      raise exception 'authenticated lacks EXECUTE on %', v_function;
    end if;
    if has_function_privilege('anon', 'public.' || v_function, 'EXECUTE') then
      raise exception 'anon unexpectedly has EXECUTE on %', v_function;
    end if;
  end loop;

  if exists (
    select 1
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'buy_portfolio_holding', 'log_existing_portfolio_holding',
        'sell_portfolio_holding', 'correct_portfolio_holding',
        'remove_portfolio_holding_tracking'
      )
      and (not p.prosecdef or coalesce(array_to_string(p.proconfig, ','), '') not like '%search_path=""%')
  ) then
    raise exception 'Stage 05E functions must be SECURITY DEFINER with empty search_path';
  end if;
end;
$test$;
