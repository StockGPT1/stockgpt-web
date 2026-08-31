-- New customer-managed portfolios use USD as their stored accounting basis.
-- Existing legacy rows are deliberately not rewritten: authenticated callers
-- may maintain nonfinancial metadata or delete the whole portfolio, but cannot
-- change its currency or financial values.
create or replace function public.enforce_authenticated_portfolio_accounting_basis()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if upper(trim(coalesce(new.currency, ''))) <> 'USD' then
      raise exception 'new_portfolio_accounting_currency_must_be_usd'
        using errcode = '22023';
    end if;
    return new;
  end if;

  if upper(trim(coalesce(old.currency, ''))) <> 'USD' then
    if new.currency is distinct from old.currency
      or new.cash_balance is distinct from old.cash_balance
      or new.cash_deposited_total is distinct from old.cash_deposited_total
      or new.investment_amount is distinct from old.investment_amount then
      raise exception 'legacy_portfolio_financial_state_is_read_only'
        using errcode = '22023';
    end if;
  elsif upper(trim(coalesce(new.currency, ''))) <> 'USD' then
    raise exception 'portfolio_accounting_currency_is_immutable'
      using errcode = '22023';
  end if;

  return new;
end;
$function$;

drop trigger if exists enforce_authenticated_portfolio_accounting_basis
  on public.user_portfolios;
create trigger enforce_authenticated_portfolio_accounting_basis
before insert or update on public.user_portfolios
for each row execute function public.enforce_authenticated_portfolio_accounting_basis();

revoke all on function public.enforce_authenticated_portfolio_accounting_basis()
  from public, anon, authenticated;

-- Remove the overlapping permissive holding policies before recreating one
-- policy per operation. Reads remain available for owned legacy rows; direct
-- financial child writes require an owned canonical-USD parent.
drop policy if exists "Users can delete own holdings" on public.portfolio_holdings;
drop policy if exists "Users can insert own holdings" on public.portfolio_holdings;
drop policy if exists "Users can update own holdings" on public.portfolio_holdings;
drop policy if exists "Users can view own holdings" on public.portfolio_holdings;
drop policy if exists portfolio_holdings_own_all on public.portfolio_holdings;

create policy portfolio_holdings_select_owned_parent
on public.portfolio_holdings
for select to authenticated
using (
  exists (
    select 1
    from public.user_portfolios p
    where p.id = portfolio_holdings.portfolio_id
      and p.user_id = (select auth.uid())
  )
);

create policy portfolio_holdings_insert_canonical_usd_parent
on public.portfolio_holdings
for insert to authenticated
with check (
  exists (
    select 1
    from public.user_portfolios p
    where p.id = portfolio_holdings.portfolio_id
      and p.user_id = (select auth.uid())
      and upper(trim(coalesce(p.currency, ''))) = 'USD'
  )
);

create policy portfolio_holdings_update_canonical_usd_parent
on public.portfolio_holdings
for update to authenticated
using (
  exists (
    select 1
    from public.user_portfolios p
    where p.id = portfolio_holdings.portfolio_id
      and p.user_id = (select auth.uid())
      and upper(trim(coalesce(p.currency, ''))) = 'USD'
  )
)
with check (
  exists (
    select 1
    from public.user_portfolios p
    where p.id = portfolio_holdings.portfolio_id
      and p.user_id = (select auth.uid())
      and upper(trim(coalesce(p.currency, ''))) = 'USD'
  )
);

create policy portfolio_holdings_delete_canonical_usd_parent
on public.portfolio_holdings
for delete to authenticated
using (
  exists (
    select 1
    from public.user_portfolios p
    where p.id = portfolio_holdings.portfolio_id
      and p.user_id = (select auth.uid())
      and upper(trim(coalesce(p.currency, ''))) = 'USD'
  )
);

drop policy if exists portfolio_transactions_insert_owned_parent
  on public.portfolio_transactions;
create policy portfolio_transactions_insert_canonical_usd_parent
on public.portfolio_transactions
for insert to authenticated
with check (
  portfolio_transactions.user_id = (select auth.uid())
  and upper(trim(coalesce(portfolio_transactions.currency, ''))) = 'USD'
  and exists (
    select 1
    from public.user_portfolios p
    where p.id = portfolio_transactions.portfolio_id
      and p.user_id = (select auth.uid())
      and upper(trim(coalesce(p.currency, ''))) = 'USD'
  )
);
