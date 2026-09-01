-- Retire the temporary authenticated direct-write compatibility surface now
-- that all customer Portfolio mutations have narrow, owner-scoped RPCs.

create function public.rename_owned_portfolio(
  p_portfolio_id uuid,
  p_name text
)
returns table (
  portfolio_id uuid,
  portfolio_name text
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_name text := trim(coalesce(p_name, ''));
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if p_portfolio_id is null then
    raise exception 'portfolio_id_required' using errcode = '22023';
  end if;
  if v_name = '' or char_length(v_name) > 80 then
    raise exception 'portfolio_name_invalid' using errcode = '22023';
  end if;

  update public.user_portfolios p
  set name = v_name
  where p.id = p_portfolio_id
    and p.user_id = v_user_id
    and p.archived_at is null
  returning p.id, p.name into portfolio_id, portfolio_name;

  if portfolio_id is null then
    raise exception 'portfolio_not_found' using errcode = 'P0002';
  end if;
  return next;
end;
$function$;

create function public.update_owned_portfolio_preferences(
  p_portfolio_id uuid,
  p_objective text,
  p_risk_tolerance text,
  p_time_horizon text
)
returns table (
  portfolio_id uuid,
  objective text,
  risk_tolerance text,
  time_horizon text
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if p_portfolio_id is null then
    raise exception 'portfolio_id_required' using errcode = '22023';
  end if;
  if p_objective not in ('growth', 'income', 'balanced', 'capital_preservation', 'watchlist') then
    raise exception 'portfolio_objective_invalid' using errcode = '22023';
  end if;
  if p_risk_tolerance not in ('conservative', 'moderate', 'aggressive') then
    raise exception 'portfolio_risk_tolerance_invalid' using errcode = '22023';
  end if;
  if p_time_horizon not in ('short', 'medium', 'long') then
    raise exception 'portfolio_time_horizon_invalid' using errcode = '22023';
  end if;

  update public.user_portfolios p
  set objective = p_objective,
      risk_tolerance = p_risk_tolerance,
      time_horizon = p_time_horizon
  where p.id = p_portfolio_id
    and p.user_id = v_user_id
    and p.archived_at is null
  returning p.id, p.objective, p.risk_tolerance, p.time_horizon
  into portfolio_id, objective, risk_tolerance, time_horizon;

  if portfolio_id is null then
    raise exception 'portfolio_not_found' using errcode = 'P0002';
  end if;
  return next;
end;
$function$;

create function public.mark_portfolio_holding_reviewed(
  p_portfolio_id uuid,
  p_ticker text
)
returns table (
  portfolio_id uuid,
  ticker text,
  reviewed_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_ticker text := upper(trim(coalesce(p_ticker, '')));
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if p_portfolio_id is null then
    raise exception 'portfolio_id_required' using errcode = '22023';
  end if;
  if v_ticker = '' or char_length(v_ticker) > 20 or v_ticker !~ '^[A-Z0-9.-]+$' then
    raise exception 'holding_ticker_invalid' using errcode = '22023';
  end if;

  perform 1
  from public.user_portfolios p
  where p.id = p_portfolio_id
    and p.user_id = v_user_id
    and p.archived_at is null;
  if not found then
    raise exception 'portfolio_not_found' using errcode = 'P0002';
  end if;

  update public.portfolio_holdings h
  set last_reviewed_at = statement_timestamp()
  where h.portfolio_id = p_portfolio_id
    and upper(trim(h.ticker)) = v_ticker
  returning h.portfolio_id, h.ticker, h.last_reviewed_at
  into portfolio_id, ticker, reviewed_at;

  if portfolio_id is null then
    raise exception 'holding_not_found' using errcode = 'P0002';
  end if;
  return next;
end;
$function$;

comment on function public.rename_owned_portfolio(uuid, text) is
  'Renames one exact active Portfolio owned by auth.uid(); no financial state is writable.';
comment on function public.update_owned_portfolio_preferences(uuid, text, text, text) is
  'Updates only objective, risk tolerance and time horizon for one exact active Portfolio owned by auth.uid().';
comment on function public.mark_portfolio_holding_reviewed(uuid, text) is
  'Records a database-controlled review timestamp for one exact holding in one exact active Portfolio owned by auth.uid().';

revoke all on function public.rename_owned_portfolio(uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.update_owned_portfolio_preferences(uuid, text, text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.mark_portfolio_holding_reviewed(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.rename_owned_portfolio(uuid, text)
  to authenticated, service_role;
grant execute on function public.update_owned_portfolio_preferences(uuid, text, text, text)
  to authenticated, service_role;
grant execute on function public.mark_portfolio_holding_reviewed(uuid, text)
  to authenticated, service_role;

-- Remove table grants and any explicit column grants. The column loop matters
-- for the Stage 05C ledger INSERT allowlist, which is independent of the
-- table-level ACL.
do $block$
declare
  v_column record;
begin
  for v_column in
    select table_name, column_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name in ('user_portfolios', 'portfolio_holdings', 'portfolio_transactions')
  loop
    execute format(
      'revoke select (%I), insert (%I), update (%I), references (%I) on table public.%I from anon, authenticated',
      v_column.column_name,
      v_column.column_name,
      v_column.column_name,
      v_column.column_name,
      v_column.table_name
    );
  end loop;
end;
$block$;

revoke all on table public.user_portfolios from anon, authenticated;
revoke all on table public.portfolio_holdings from anon, authenticated;
revoke all on table public.portfolio_transactions from anon, authenticated;

grant select on table public.user_portfolios to authenticated;
grant select on table public.portfolio_holdings to authenticated;
grant select on table public.portfolio_transactions to authenticated;

-- Retain one owned SELECT policy per authoritative table. SECURITY DEFINER
-- mutation RPCs authorize auth.uid() internally and do not need customer DML
-- policies. Removing them prevents a future accidental GRANT from reopening
-- the old Data API write surface.
drop policy if exists "Users can delete own portfolios" on public.user_portfolios;
drop policy if exists "Users can insert own portfolios" on public.user_portfolios;
drop policy if exists "Users can update own portfolios" on public.user_portfolios;
drop policy if exists "Users can view own portfolios" on public.user_portfolios;
drop policy if exists user_portfolios_own_all on public.user_portfolios;
create policy user_portfolios_select_owned
on public.user_portfolios
for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists portfolio_holdings_insert_canonical_usd_parent on public.portfolio_holdings;
drop policy if exists portfolio_holdings_update_canonical_usd_parent on public.portfolio_holdings;
drop policy if exists portfolio_holdings_delete_canonical_usd_parent on public.portfolio_holdings;

drop policy if exists portfolio_transactions_insert_canonical_usd_parent on public.portfolio_transactions;
