do $verify$
declare
  v_trigger_count integer;
begin
  select count(*) into v_trigger_count
  from pg_trigger
  where tgrelid = 'public.user_portfolios'::regclass
    and tgname = 'enforce_authenticated_portfolio_accounting_basis'
    and not tgisinternal;

  if v_trigger_count <> 1 then
    raise exception 'portfolio accounting-basis trigger is missing';
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'portfolio_holdings'
      and policyname in (
        'Users can delete own holdings',
        'Users can insert own holdings',
        'Users can update own holdings',
        'Users can view own holdings',
        'portfolio_holdings_own_all'
      )
  ) then
    raise exception 'overlapping historical holding policies remain active';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'portfolio_holdings'
      and policyname = 'portfolio_holdings_insert_canonical_usd_parent'
      and with_check ilike '%currency%USD%'
  ) then
    raise exception 'canonical USD holding insert policy is missing';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'portfolio_transactions'
      and policyname = 'portfolio_transactions_insert_canonical_usd_parent'
      and with_check ilike '%currency%'
      and with_check ilike '%USD%'
  ) then
    raise exception 'canonical USD transaction insert policy is missing';
  end if;
end
$verify$;
