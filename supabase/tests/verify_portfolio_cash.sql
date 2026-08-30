-- LOCAL DEVELOPMENT ONLY.
-- Catalog assertions for the Stage 05D atomic cash mutation contract.

do $portfolio_cash_assertions$
declare
  function_definition text;
  function_config text[];
begin
  select pg_get_functiondef(p.oid), p.proconfig
  into function_definition, function_config
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'mutate_portfolio_cash'
    and pg_get_function_identity_arguments(p.oid) =
      'p_portfolio_id uuid, p_operation text, p_amount numeric';

  if function_definition is null then
    raise exception 'mutate_portfolio_cash(uuid, text, numeric) is missing';
  end if;

  if function_definition not like '%SECURITY DEFINER%'
    or function_config <> array['search_path=""']::text[]
    or lower(function_definition) not like '%for update%'
    or lower(function_definition) not like '%auth.uid()%'
    or lower(function_definition) not like '%public.user_portfolios%'
    or lower(function_definition) not like '%public.portfolio_transactions%'
    or lower(function_definition) like '%investment_amount =%' then
    raise exception 'Cash RPC security, locking or narrow-input contract is malformed';
  end if;

  if has_function_privilege(
      'anon',
      'public.mutate_portfolio_cash(uuid,text,numeric)',
      'execute'
    )
    or not has_function_privilege(
      'authenticated',
      'public.mutate_portfolio_cash(uuid,text,numeric)',
      'execute'
    ) then
    raise exception 'Cash RPC EXECUTE privileges are not restricted to authenticated callers';
  end if;

  if exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'portfolio_transactions'
        and cmd in ('UPDATE', 'DELETE')
    )
    or has_table_privilege('authenticated', 'public.portfolio_transactions', 'update')
    or has_table_privilege('authenticated', 'public.portfolio_transactions', 'delete') then
    raise exception '05C append-only ledger protection was weakened';
  end if;

  if not exists (
      select 1
      from pg_constraint
      where conrelid = 'public.portfolio_transactions'::regclass
        and conname = 'portfolio_transactions_portfolio_owner_fkey'
        and contype = 'f'
    ) then
    raise exception '05B parent/owner transaction constraint is missing';
  end if;
end;
$portfolio_cash_assertions$;
