-- Apply holding financial mutations through narrow exact-owner transaction boundaries.
-- These functions deliberately own cash, contribution and append-only ledger effects.

create function public.buy_portfolio_holding(
  p_portfolio_id uuid,
  p_ticker text,
  p_shares numeric,
  p_price numeric,
  p_purchase_date date default null,
  p_notes text default null
)
returns table (
  portfolio_id uuid,
  holding_id uuid,
  transaction_id uuid,
  ticker text,
  shares numeric,
  entry_price numeric,
  cash_balance numeric,
  cash_deposited_total numeric,
  updated_existing boolean
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_ticker text;
  v_shares numeric;
  v_price numeric;
  v_cost numeric;
  v_currency text;
  v_cash numeric;
  v_contributed numeric;
  v_existing public.portfolio_holdings%rowtype;
  v_next_shares numeric;
  v_next_entry numeric;
  v_holding_id uuid;
  v_transaction_id uuid;
  v_updated_existing boolean := false;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'not_authenticated';
  end if;
  if p_portfolio_id is null then
    raise exception using errcode = '22023', message = 'portfolio_id_required';
  end if;

  v_ticker := upper(trim(coalesce(p_ticker, '')));
  if v_ticker !~ '^[A-Z][A-Z0-9.\-]{0,11}$' then
    raise exception using errcode = '22023', message = 'holding_ticker_invalid';
  end if;
  if p_shares is null or p_shares::text in ('NaN', 'Infinity', '-Infinity') then
    raise exception using errcode = '22023', message = 'holding_shares_invalid';
  end if;
  if p_price is null or p_price::text in ('NaN', 'Infinity', '-Infinity') then
    raise exception using errcode = '22023', message = 'holding_price_invalid';
  end if;

  v_shares := round(p_shares, 6);
  v_price := round(p_price, 4);
  v_cost := round(v_shares * v_price, 2);
  if v_shares <= 0 then
    raise exception using errcode = '22023', message = 'holding_shares_invalid';
  end if;
  if v_price <= 0 or v_cost <= 0 then
    raise exception using errcode = '22023', message = 'holding_price_invalid';
  end if;

  select p.currency, p.cash_balance, p.cash_deposited_total
    into v_currency, v_cash, v_contributed
  from public.user_portfolios as p
  where p.id = p_portfolio_id
    and p.user_id = v_user_id
    and p.archived_at is null
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'portfolio_not_found';
  end if;
  if upper(trim(v_currency)) <> 'USD' then
    raise exception using errcode = 'P0001', message = 'portfolio_currency_unsupported';
  end if;
  if v_cash is null or v_contributed is null
    or v_cash::text in ('NaN', 'Infinity', '-Infinity')
    or v_contributed::text in ('NaN', 'Infinity', '-Infinity')
    or v_cash < 0 then
    raise exception using errcode = 'P0001', message = 'portfolio_financial_state_invalid';
  end if;
  if v_cost > v_cash then
    raise exception using errcode = 'P0001', message = 'insufficient_cash';
  end if;

  select h.* into v_existing
  from public.portfolio_holdings as h
  where h.portfolio_id = p_portfolio_id and h.ticker = v_ticker
  for update;

  if found then
    if v_existing.shares is null or v_existing.entry_price is null
      or v_existing.shares <= 0 or v_existing.entry_price <= 0 then
      raise exception using errcode = 'P0001', message = 'holding_financial_state_invalid';
    end if;
    v_updated_existing := true;
    v_next_shares := round(v_existing.shares + v_shares, 6);
    v_next_entry := round(
      ((v_existing.shares * v_existing.entry_price) + v_cost) / v_next_shares,
      4
    );
    update public.portfolio_holdings as h
      set shares = v_next_shares,
          entry_price = v_next_entry,
          allocation_pct = null,
          last_reviewed_at = now(),
          notes = coalesce(p_notes, h.notes)
      where h.id = v_existing.id
      returning h.id into v_holding_id;
  else
    v_next_shares := v_shares;
    v_next_entry := v_price;
    insert into public.portfolio_holdings as h (
      portfolio_id, ticker, entry_price, shares, allocation_pct,
      score_at_entry, rank_at_entry, purchase_date, source, notes
    )
    select
      p_portfolio_id, v_ticker, v_next_entry, v_next_shares, null,
      r.score, r.rank, p_purchase_date, 'cash', p_notes
    from (select 1) as seed
    left join public.stock_rankings as r on r.ticker = v_ticker
    returning h.id into v_holding_id;
  end if;

  update public.user_portfolios as p
    set cash_balance = round(v_cash - v_cost, 2), updated_at = now()
    where p.id = p_portfolio_id and p.user_id = v_user_id;

  insert into public.portfolio_transactions as t (
    portfolio_id, user_id, ticker, type, shares, price, amount,
    realised_pnl, currency, notes
  ) values (
    p_portfolio_id, v_user_id, v_ticker, 'buy', v_shares, v_price,
    v_cost, null, 'USD', 'Portfolio-cash purchase.'
  ) returning t.id into v_transaction_id;

  return query select p_portfolio_id, v_holding_id, v_transaction_id,
    v_ticker, v_next_shares, v_next_entry, round(v_cash - v_cost, 2),
    v_contributed, v_updated_existing;
end;
$function$;

create function public.log_existing_portfolio_holding(
  p_portfolio_id uuid,
  p_ticker text,
  p_shares numeric,
  p_entry_price numeric,
  p_purchase_date date default null,
  p_notes text default null
)
returns table (
  portfolio_id uuid,
  holding_id uuid,
  transaction_id uuid,
  ticker text,
  shares numeric,
  entry_price numeric,
  cash_balance numeric,
  cash_deposited_total numeric,
  updated_existing boolean
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_ticker text;
  v_shares numeric;
  v_price numeric;
  v_cost numeric;
  v_currency text;
  v_cash numeric;
  v_contributed numeric;
  v_existing public.portfolio_holdings%rowtype;
  v_next_shares numeric;
  v_next_entry numeric;
  v_holding_id uuid;
  v_transaction_id uuid;
  v_updated_existing boolean := false;
begin
  if v_user_id is null then raise exception using errcode = '42501', message = 'not_authenticated'; end if;
  if p_portfolio_id is null then raise exception using errcode = '22023', message = 'portfolio_id_required'; end if;
  v_ticker := upper(trim(coalesce(p_ticker, '')));
  if v_ticker !~ '^[A-Z][A-Z0-9.\-]{0,11}$' then raise exception using errcode = '22023', message = 'holding_ticker_invalid'; end if;
  if p_shares is null or p_shares::text in ('NaN', 'Infinity', '-Infinity') then raise exception using errcode = '22023', message = 'holding_shares_invalid'; end if;
  if p_entry_price is null or p_entry_price::text in ('NaN', 'Infinity', '-Infinity') then raise exception using errcode = '22023', message = 'holding_price_invalid'; end if;
  v_shares := round(p_shares, 6);
  v_price := round(p_entry_price, 4);
  v_cost := round(v_shares * v_price, 2);
  if v_shares <= 0 then raise exception using errcode = '22023', message = 'holding_shares_invalid'; end if;
  if v_price <= 0 or v_cost <= 0 then raise exception using errcode = '22023', message = 'holding_price_invalid'; end if;

  select p.currency, p.cash_balance, p.cash_deposited_total into v_currency, v_cash, v_contributed
  from public.user_portfolios as p
  where p.id = p_portfolio_id and p.user_id = v_user_id and p.archived_at is null
  for update;
  if not found then raise exception using errcode = 'P0001', message = 'portfolio_not_found'; end if;
  if upper(trim(v_currency)) <> 'USD' then raise exception using errcode = 'P0001', message = 'portfolio_currency_unsupported'; end if;
  if v_cash is null or v_contributed is null
    or v_cash::text in ('NaN', 'Infinity', '-Infinity')
    or v_contributed::text in ('NaN', 'Infinity', '-Infinity')
    or v_cash < 0 then
    raise exception using errcode = 'P0001', message = 'portfolio_financial_state_invalid';
  end if;

  select h.* into v_existing from public.portfolio_holdings as h
  where h.portfolio_id = p_portfolio_id and h.ticker = v_ticker for update;
  if found then
    if v_existing.shares is null or v_existing.entry_price is null
      or v_existing.shares <= 0 or v_existing.entry_price <= 0 then
      raise exception using errcode = 'P0001', message = 'holding_financial_state_invalid';
    end if;
    v_updated_existing := true;
    v_next_shares := round(v_existing.shares + v_shares, 6);
    v_next_entry := round(((v_existing.shares * v_existing.entry_price) + v_cost) / v_next_shares, 4);
    update public.portfolio_holdings as h
      set shares = v_next_shares, entry_price = v_next_entry,
          allocation_pct = null, last_reviewed_at = now(),
          purchase_date = coalesce(h.purchase_date, p_purchase_date),
          notes = coalesce(p_notes, h.notes)
      where h.id = v_existing.id returning h.id into v_holding_id;
  else
    v_next_shares := v_shares;
    v_next_entry := v_price;
    insert into public.portfolio_holdings as h (
      portfolio_id, ticker, entry_price, shares, allocation_pct,
      score_at_entry, rank_at_entry, purchase_date, source, notes
    )
    select p_portfolio_id, v_ticker, v_next_entry, v_next_shares, null,
      r.score, r.rank, p_purchase_date, 'manual', p_notes
    from (select 1) as seed
    left join public.stock_rankings as r on r.ticker = v_ticker
    returning h.id into v_holding_id;
  end if;

  update public.user_portfolios as p
    set cash_deposited_total = round(v_contributed + v_cost, 2), updated_at = now()
    where p.id = p_portfolio_id and p.user_id = v_user_id;
  insert into public.portfolio_transactions as t (
    portfolio_id, user_id, ticker, type, shares, price, amount,
    realised_pnl, currency, notes, occurred_at
  ) values (
    p_portfolio_id, v_user_id, v_ticker, 'log_existing', v_shares,
    v_price, v_cost, null, 'USD', 'External holding added.', null
  ) returning t.id into v_transaction_id;

  return query select p_portfolio_id, v_holding_id, v_transaction_id,
    v_ticker, v_next_shares, v_next_entry, v_cash,
    round(v_contributed + v_cost, 2), v_updated_existing;
end;
$function$;

create function public.sell_portfolio_holding(
  p_portfolio_id uuid,
  p_ticker text,
  p_shares numeric,
  p_price numeric
)
returns table (
  portfolio_id uuid,
  holding_id uuid,
  transaction_id uuid,
  ticker text,
  shares numeric,
  entry_price numeric,
  cash_balance numeric,
  cash_deposited_total numeric,
  realised_pnl numeric,
  closed boolean
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_ticker text;
  v_shares numeric;
  v_price numeric;
  v_proceeds numeric;
  v_realised numeric;
  v_currency text;
  v_cash numeric;
  v_contributed numeric;
  v_holding public.portfolio_holdings%rowtype;
  v_remaining numeric;
  v_holding_id uuid;
  v_transaction_id uuid;
  v_closed boolean;
begin
  if v_user_id is null then raise exception using errcode = '42501', message = 'not_authenticated'; end if;
  if p_portfolio_id is null then raise exception using errcode = '22023', message = 'portfolio_id_required'; end if;
  v_ticker := upper(trim(coalesce(p_ticker, '')));
  if v_ticker !~ '^[A-Z][A-Z0-9.\-]{0,11}$' then raise exception using errcode = '22023', message = 'holding_ticker_invalid'; end if;
  if p_shares is null or p_shares::text in ('NaN', 'Infinity', '-Infinity') then raise exception using errcode = '22023', message = 'holding_shares_invalid'; end if;
  if p_price is null or p_price::text in ('NaN', 'Infinity', '-Infinity') then raise exception using errcode = '22023', message = 'holding_price_invalid'; end if;
  v_shares := round(p_shares, 6);
  v_price := round(p_price, 4);
  if v_shares <= 0 then raise exception using errcode = '22023', message = 'holding_shares_invalid'; end if;
  if v_price <= 0 then raise exception using errcode = '22023', message = 'holding_price_invalid'; end if;

  select p.currency, p.cash_balance, p.cash_deposited_total into v_currency, v_cash, v_contributed
  from public.user_portfolios as p
  where p.id = p_portfolio_id and p.user_id = v_user_id and p.archived_at is null
  for update;
  if not found then raise exception using errcode = 'P0001', message = 'portfolio_not_found'; end if;
  if upper(trim(v_currency)) <> 'USD' then raise exception using errcode = 'P0001', message = 'portfolio_currency_unsupported'; end if;
  if v_cash is null or v_contributed is null
    or v_cash::text in ('NaN', 'Infinity', '-Infinity')
    or v_contributed::text in ('NaN', 'Infinity', '-Infinity')
    or v_cash < 0 then
    raise exception using errcode = 'P0001', message = 'portfolio_financial_state_invalid';
  end if;

  select h.* into v_holding from public.portfolio_holdings as h
  where h.portfolio_id = p_portfolio_id and h.ticker = v_ticker for update;
  if not found then raise exception using errcode = 'P0001', message = 'holding_not_found'; end if;
  if v_holding.shares is null or v_holding.entry_price is null
    or v_holding.shares <= 0 or v_holding.entry_price <= 0 then
    raise exception using errcode = 'P0001', message = 'holding_financial_state_invalid';
  end if;
  if v_shares > v_holding.shares then
    raise exception using errcode = 'P0001', message = 'holding_shares_exceeded';
  end if;

  v_remaining := round(v_holding.shares - v_shares, 6);
  v_proceeds := round(v_shares * v_price, 2);
  v_realised := round((v_price - v_holding.entry_price) * v_shares, 2);
  if v_proceeds <= 0 then raise exception using errcode = '22023', message = 'holding_price_invalid'; end if;
  v_closed := v_remaining = 0;
  if v_closed then
    delete from public.portfolio_holdings as h where h.id = v_holding.id;
    v_holding_id := null;
  else
    update public.portfolio_holdings as h
      set shares = v_remaining, allocation_pct = null, last_reviewed_at = now()
      where h.id = v_holding.id returning h.id into v_holding_id;
  end if;

  update public.user_portfolios as p
    set cash_balance = round(v_cash + v_proceeds, 2), updated_at = now()
    where p.id = p_portfolio_id and p.user_id = v_user_id;
  insert into public.portfolio_transactions as t (
    portfolio_id, user_id, ticker, type, shares, price, amount,
    realised_pnl, currency, notes
  ) values (
    p_portfolio_id, v_user_id, v_ticker, 'sell', v_shares, v_price,
    v_proceeds, v_realised, 'USD',
    case when v_closed then 'Full holding sale.' else 'Partial holding sale.' end
  ) returning t.id into v_transaction_id;

  return query select p_portfolio_id, v_holding_id, v_transaction_id,
    v_ticker, v_remaining, v_holding.entry_price, round(v_cash + v_proceeds, 2),
    v_contributed, v_realised, v_closed;
end;
$function$;

create function public.correct_portfolio_holding(
  p_portfolio_id uuid,
  p_ticker text,
  p_shares numeric,
  p_entry_price numeric,
  p_purchase_date date default null,
  p_notes text default null
)
returns table (
  portfolio_id uuid,
  holding_id uuid,
  transaction_id uuid,
  ticker text,
  shares numeric,
  entry_price numeric
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_ticker text;
  v_shares numeric;
  v_price numeric;
  v_currency text;
  v_holding_id uuid;
  v_transaction_id uuid;
begin
  if v_user_id is null then raise exception using errcode = '42501', message = 'not_authenticated'; end if;
  if p_portfolio_id is null then raise exception using errcode = '22023', message = 'portfolio_id_required'; end if;
  v_ticker := upper(trim(coalesce(p_ticker, '')));
  if v_ticker !~ '^[A-Z][A-Z0-9.\-]{0,11}$' then raise exception using errcode = '22023', message = 'holding_ticker_invalid'; end if;
  if p_shares is null or p_shares::text in ('NaN', 'Infinity', '-Infinity') then raise exception using errcode = '22023', message = 'holding_shares_invalid'; end if;
  if p_entry_price is null or p_entry_price::text in ('NaN', 'Infinity', '-Infinity') then raise exception using errcode = '22023', message = 'holding_price_invalid'; end if;
  v_shares := round(p_shares, 6);
  v_price := round(p_entry_price, 4);
  if v_shares <= 0 then raise exception using errcode = '22023', message = 'holding_shares_invalid'; end if;
  if v_price <= 0 then raise exception using errcode = '22023', message = 'holding_price_invalid'; end if;

  select p.currency into v_currency from public.user_portfolios as p
  where p.id = p_portfolio_id and p.user_id = v_user_id and p.archived_at is null for update;
  if not found then raise exception using errcode = 'P0001', message = 'portfolio_not_found'; end if;
  if upper(trim(v_currency)) <> 'USD' then raise exception using errcode = 'P0001', message = 'portfolio_currency_unsupported'; end if;

  perform 1 from public.portfolio_holdings as h
  where h.portfolio_id = p_portfolio_id and h.ticker = v_ticker
  for update;
  if not found then raise exception using errcode = 'P0001', message = 'holding_not_found'; end if;

  update public.portfolio_holdings as h
    set shares = v_shares, entry_price = v_price, purchase_date = p_purchase_date,
        notes = p_notes, allocation_pct = null, last_reviewed_at = now()
    where h.portfolio_id = p_portfolio_id and h.ticker = v_ticker
    returning h.id into v_holding_id;
  insert into public.portfolio_transactions as t (
    portfolio_id, user_id, ticker, type, shares, price, amount,
    realised_pnl, currency, notes
  ) values (
    p_portfolio_id, v_user_id, v_ticker, 'adjustment', v_shares, v_price,
    0, null, 'USD', 'Holding facts corrected.'
  ) returning t.id into v_transaction_id;

  return query select p_portfolio_id, v_holding_id, v_transaction_id,
    v_ticker, v_shares, v_price;
end;
$function$;

create function public.remove_portfolio_holding_tracking(
  p_portfolio_id uuid,
  p_ticker text
)
returns table (
  portfolio_id uuid,
  transaction_id uuid,
  ticker text,
  removed_shares numeric,
  cash_balance numeric,
  cash_deposited_total numeric
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_ticker text;
  v_currency text;
  v_cash numeric;
  v_contributed numeric;
  v_holding public.portfolio_holdings%rowtype;
  v_transaction_id uuid;
begin
  if v_user_id is null then raise exception using errcode = '42501', message = 'not_authenticated'; end if;
  if p_portfolio_id is null then raise exception using errcode = '22023', message = 'portfolio_id_required'; end if;
  v_ticker := upper(trim(coalesce(p_ticker, '')));
  if v_ticker !~ '^[A-Z][A-Z0-9.\-]{0,11}$' then raise exception using errcode = '22023', message = 'holding_ticker_invalid'; end if;

  select p.currency, p.cash_balance, p.cash_deposited_total into v_currency, v_cash, v_contributed
  from public.user_portfolios as p
  where p.id = p_portfolio_id and p.user_id = v_user_id and p.archived_at is null for update;
  if not found then raise exception using errcode = 'P0001', message = 'portfolio_not_found'; end if;
  if upper(trim(v_currency)) <> 'USD' then raise exception using errcode = 'P0001', message = 'portfolio_currency_unsupported'; end if;

  select h.* into v_holding from public.portfolio_holdings as h
  where h.portfolio_id = p_portfolio_id and h.ticker = v_ticker for update;
  if not found then raise exception using errcode = 'P0001', message = 'holding_not_found'; end if;
  delete from public.portfolio_holdings as h where h.id = v_holding.id;

  insert into public.portfolio_transactions as t (
    portfolio_id, user_id, ticker, type, shares, price, amount,
    realised_pnl, currency, notes
  ) values (
    p_portfolio_id, v_user_id, v_ticker, 'adjustment', v_holding.shares,
    null, 0, null, 'USD', 'Holding removed from tracking; no sale recorded.'
  ) returning t.id into v_transaction_id;

  return query select p_portfolio_id, v_transaction_id, v_ticker,
    v_holding.shares, v_cash, v_contributed;
end;
$function$;

comment on function public.buy_portfolio_holding(uuid, text, numeric, numeric, date, text) is
  'Atomically buys a USD holding with exact-owned Portfolio cash and appends one ledger row.';
comment on function public.log_existing_portfolio_holding(uuid, text, numeric, numeric, date, text) is
  'Atomically logs externally funded USD shares, increases net contributions and appends one unknown-occurrence ledger row.';
comment on function public.sell_portfolio_holding(uuid, text, numeric, numeric) is
  'Atomically sells exact owned USD shares, credits cash, calculates realised P&L and appends one ledger row.';
comment on function public.correct_portfolio_holding(uuid, text, numeric, numeric, date, text) is
  'Corrects tracked holding facts without cash/contribution/P&L effects and appends an adjustment ledger row.';
comment on function public.remove_portfolio_holding_tracking(uuid, text) is
  'Removes a holding from tracking without sale/cash/contribution/P&L effects and appends an adjustment ledger row.';

revoke execute on function public.buy_portfolio_holding(uuid, text, numeric, numeric, date, text) from public, anon;
revoke execute on function public.log_existing_portfolio_holding(uuid, text, numeric, numeric, date, text) from public, anon;
revoke execute on function public.sell_portfolio_holding(uuid, text, numeric, numeric) from public, anon;
revoke execute on function public.correct_portfolio_holding(uuid, text, numeric, numeric, date, text) from public, anon;
revoke execute on function public.remove_portfolio_holding_tracking(uuid, text) from public, anon;

grant execute on function public.buy_portfolio_holding(uuid, text, numeric, numeric, date, text) to authenticated, service_role;
grant execute on function public.log_existing_portfolio_holding(uuid, text, numeric, numeric, date, text) to authenticated, service_role;
grant execute on function public.sell_portfolio_holding(uuid, text, numeric, numeric) to authenticated, service_role;
grant execute on function public.correct_portfolio_holding(uuid, text, numeric, numeric, date, text) to authenticated, service_role;
grant execute on function public.remove_portfolio_holding_tracking(uuid, text) to authenticated, service_role;
