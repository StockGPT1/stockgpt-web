-- LOCAL DEVELOPMENT ONLY.
-- Catalog assertions for Stage 05F atomic Portfolio creation/lifecycle functions.

do $portfolio_creation_assertions$
declare
  v_signature text;
  v_definition text;
  v_config text[];
  v_security_definer boolean;
begin
  foreach v_signature in array array[
    'create_manual_portfolio(text,text,text,text,numeric,jsonb)',
    'create_ai_portfolio_draft(text,text,text,jsonb)',
    'delete_owned_portfolio(uuid)'
  ] loop
    if to_regprocedure('public.' || v_signature) is null then
      raise exception 'Missing Stage 05F function %', v_signature;
    end if;
    if not has_function_privilege('authenticated', 'public.' || v_signature, 'EXECUTE')
      or has_function_privilege('anon', 'public.' || v_signature, 'EXECUTE') then
      raise exception 'Stage 05F function privileges are incorrect for %', v_signature;
    end if;
  end loop;

  for v_definition, v_config, v_security_definer in
    select pg_get_functiondef(p.oid), p.proconfig, p.prosecdef
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'create_manual_portfolio',
        'create_ai_portfolio_draft',
        'delete_owned_portfolio'
      )
  loop
    if not v_security_definer
      or v_config <> array['search_path=""']::text[]
      or position('auth.uid()' in lower(v_definition)) = 0
      or position('p_user_id' in lower(v_definition)) > 0 then
      raise exception 'Stage 05F security or owner contract is malformed: definer=%, config=%, auth=%, user_arg=%',
        v_security_definer,
        v_config,
        position('auth.uid()' in lower(v_definition)) > 0,
        position('p_user_id' in lower(v_definition)) > 0;
    end if;
  end loop;

  select pg_get_functiondef(to_regprocedure(
    'public.create_manual_portfolio(text,text,text,text,numeric,jsonb)'
  )) into v_definition;
  if lower(v_definition) not like '%public.user_portfolios%'
    or lower(v_definition) not like '%public.portfolio_holdings%'
    or lower(v_definition) not like '%public.portfolio_transactions%'
    or v_definition not like '%''USD''%'
    or lower(v_definition) like '%p_currency%'
    or lower(v_definition) like '%p_investment_amount%'
    or lower(v_definition) like '%p_cash_deposited_total%' then
    raise exception 'Manual creation is not a narrow USD database-derived operation';
  end if;

  select pg_get_functiondef(to_regprocedure(
    'public.create_ai_portfolio_draft(text,text,text,jsonb)'
  )) into v_definition;
  if lower(v_definition) not like '%public.user_portfolios%'
    or lower(v_definition) not like '%public.portfolio_holdings%'
    or lower(v_definition) not like '%public.portfolio_transactions%'
    or lower(v_definition) like '%totalinvested%'
    or lower(v_definition) like '%p_currency%'
    or lower(v_definition) like '%''buy''%' then
    raise exception 'AI creation financial or neutral-ledger contract is malformed';
  end if;

  select pg_get_functiondef(to_regprocedure(
    'public.delete_owned_portfolio(uuid)'
  )) into v_definition;
  if lower(v_definition) not like '%for update%'
    or lower(v_definition) not like '%p.id = p_portfolio_id%'
    or lower(v_definition) not like '%p.user_id = v_user_id%'
    or lower(v_definition) not like '%delete from public.user_portfolios%' then
    raise exception 'Exact-owner deletion contract is malformed';
  end if;
end;
$portfolio_creation_assertions$;
