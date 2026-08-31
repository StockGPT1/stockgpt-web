create function public.create_trading212_portfolio(
  p_name text,
  p_holdings jsonb
)
returns table (
  portfolio_id uuid,
  holdings_count integer,
  holdings_basis numeric,
  cash_balance numeric,
  cash_deposited_total numeric
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_name text := trim(coalesce(p_name, ''));
  v_portfolio_id uuid;
  v_holdings_basis numeric := 0;
  v_holding jsonb;
  v_ticker text;
  v_seen_tickers text[] := array[]::text[];
  v_shares numeric;
  v_entry_price numeric;
  v_purchase_date date;
  v_score numeric;
  v_rank integer;
  v_count integer;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'not_authenticated';
  end if;
  if v_name = '' or char_length(v_name) > 80 then
    raise exception using errcode = '22023', message = 'portfolio_name_invalid';
  end if;
  if p_holdings is null or jsonb_typeof(p_holdings) <> 'array' then
    raise exception using errcode = '22023', message = 'portfolio_holdings_invalid';
  end if;
  v_count := jsonb_array_length(p_holdings);
  if v_count = 0 then
    raise exception using errcode = '22023', message = 'portfolio_initial_state_required';
  end if;
  if v_count > 100 then
    raise exception using errcode = '22023', message = 'portfolio_holdings_limit_exceeded';
  end if;

  for v_holding in select value from jsonb_array_elements(p_holdings) loop
    if jsonb_typeof(v_holding) <> 'object' then
      raise exception using errcode = '22023', message = 'portfolio_holdings_invalid';
    end if;
    v_ticker := upper(trim(coalesce(v_holding ->> 'ticker', '')));
    if v_ticker !~ '^[A-Z][A-Z0-9.\-]{0,11}$' then
      raise exception using errcode = '22023', message = 'holding_ticker_invalid';
    end if;
    if v_ticker = any(v_seen_tickers) then
      raise exception using errcode = '22023', message = 'portfolio_duplicate_ticker';
    end if;
    v_seen_tickers := array_append(v_seen_tickers, v_ticker);
    v_shares := round((v_holding ->> 'shares')::numeric, 6);
    v_entry_price := round((v_holding ->> 'entry_price')::numeric, 4);
    if v_shares is null or v_shares::text in ('NaN', 'Infinity', '-Infinity') or v_shares <= 0 then
      raise exception using errcode = '22023', message = 'holding_shares_invalid';
    end if;
    if v_entry_price is null or v_entry_price::text in ('NaN', 'Infinity', '-Infinity') or v_entry_price <= 0 then
      raise exception using errcode = '22023', message = 'holding_price_invalid';
    end if;
    if nullif(trim(coalesce(v_holding ->> 'purchase_date', '')), '') is not null
      and (v_holding ->> 'purchase_date') !~ '^\d{4}-\d{2}-\d{2}$' then
      raise exception using errcode = '22023', message = 'holding_purchase_date_invalid';
    end if;
    v_holdings_basis := v_holdings_basis + round(v_shares * v_entry_price, 2);
  end loop;
  v_holdings_basis := round(v_holdings_basis, 2);

  insert into public.user_portfolios as p (
    user_id, name, objective, risk_tolerance, time_horizon,
    investment_amount, cash_balance, cash_deposited_total, currency
  ) values (
    v_user_id, v_name, 'balanced', 'moderate', 'medium',
    v_holdings_basis, 0, v_holdings_basis, 'USD'
  ) returning p.id into v_portfolio_id;

  for v_holding in select value from jsonb_array_elements(p_holdings) loop
    v_ticker := upper(trim(v_holding ->> 'ticker'));
    v_shares := round((v_holding ->> 'shares')::numeric, 6);
    v_entry_price := round((v_holding ->> 'entry_price')::numeric, 4);
    v_purchase_date := nullif(trim(coalesce(v_holding ->> 'purchase_date', '')), '')::date;
    v_score := nullif(trim(coalesce(v_holding ->> 'score_at_entry', '')), '')::numeric;
    v_rank := nullif(trim(coalesce(v_holding ->> 'rank_at_entry', '')), '')::integer;
    insert into public.portfolio_holdings (
      portfolio_id, ticker, entry_price, allocation_pct, score_at_entry,
      rank_at_entry, shares, purchase_date, source, notes
    ) values (
      v_portfolio_id, v_ticker, v_entry_price, null, v_score,
      v_rank, v_shares, v_purchase_date, 'trading212',
      'Imported from Trading 212 CSV as current holdings state.'
    );
  end loop;

  insert into public.portfolio_transactions (
    portfolio_id, user_id, type, amount, currency, notes, occurred_at
  ) values (
    v_portfolio_id, v_user_id, 'import', v_holdings_basis, 'USD',
    'Trading 212 current holdings state initialized; cash and historical executions were not imported.',
    null
  );

  return query select v_portfolio_id, v_count, v_holdings_basis, 0::numeric,
    v_holdings_basis;
end;
$function$;

create function public.replace_portfolio_holdings_from_trading212(
  p_portfolio_id uuid,
  p_holdings jsonb
)
returns table (
  portfolio_id uuid,
  holdings_count integer,
  holdings_basis numeric,
  cash_balance numeric,
  cash_deposited_total numeric
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_portfolio public.user_portfolios%rowtype;
  v_holdings_basis numeric := 0;
  v_holding jsonb;
  v_ticker text;
  v_seen_tickers text[] := array[]::text[];
  v_shares numeric;
  v_entry_price numeric;
  v_purchase_date date;
  v_score numeric;
  v_rank integer;
  v_count integer;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'not_authenticated';
  end if;
  if p_portfolio_id is null then
    raise exception using errcode = '22023', message = 'portfolio_not_found';
  end if;
  if p_holdings is null or jsonb_typeof(p_holdings) <> 'array' then
    raise exception using errcode = '22023', message = 'portfolio_holdings_invalid';
  end if;
  v_count := jsonb_array_length(p_holdings);
  if v_count = 0 then
    raise exception using errcode = '22023', message = 'portfolio_initial_state_required';
  end if;
  if v_count > 100 then
    raise exception using errcode = '22023', message = 'portfolio_holdings_limit_exceeded';
  end if;

  select p.* into v_portfolio
  from public.user_portfolios as p
  where p.id = p_portfolio_id
    and p.user_id = v_user_id
    and p.archived_at is null
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'portfolio_not_found';
  end if;
  if upper(trim(coalesce(v_portfolio.currency, ''))) <> 'USD' then
    raise exception using errcode = 'P0001', message = 'portfolio_currency_unsupported';
  end if;

  for v_holding in select value from jsonb_array_elements(p_holdings) loop
    if jsonb_typeof(v_holding) <> 'object' then
      raise exception using errcode = '22023', message = 'portfolio_holdings_invalid';
    end if;
    v_ticker := upper(trim(coalesce(v_holding ->> 'ticker', '')));
    if v_ticker !~ '^[A-Z][A-Z0-9.\-]{0,11}$' then
      raise exception using errcode = '22023', message = 'holding_ticker_invalid';
    end if;
    if v_ticker = any(v_seen_tickers) then
      raise exception using errcode = '22023', message = 'portfolio_duplicate_ticker';
    end if;
    v_seen_tickers := array_append(v_seen_tickers, v_ticker);
    v_shares := round((v_holding ->> 'shares')::numeric, 6);
    v_entry_price := round((v_holding ->> 'entry_price')::numeric, 4);
    if v_shares is null or v_shares::text in ('NaN', 'Infinity', '-Infinity') or v_shares <= 0 then
      raise exception using errcode = '22023', message = 'holding_shares_invalid';
    end if;
    if v_entry_price is null or v_entry_price::text in ('NaN', 'Infinity', '-Infinity') or v_entry_price <= 0 then
      raise exception using errcode = '22023', message = 'holding_price_invalid';
    end if;
    if nullif(trim(coalesce(v_holding ->> 'purchase_date', '')), '') is not null
      and (v_holding ->> 'purchase_date') !~ '^\d{4}-\d{2}-\d{2}$' then
      raise exception using errcode = '22023', message = 'holding_purchase_date_invalid';
    end if;
    v_holdings_basis := v_holdings_basis + round(v_shares * v_entry_price, 2);
  end loop;
  v_holdings_basis := round(v_holdings_basis, 2);

  perform 1
  from public.portfolio_holdings as h
  where h.portfolio_id = p_portfolio_id
  for update;

  delete from public.portfolio_holdings as h
  where h.portfolio_id = p_portfolio_id;

  for v_holding in select value from jsonb_array_elements(p_holdings) loop
    v_ticker := upper(trim(v_holding ->> 'ticker'));
    v_shares := round((v_holding ->> 'shares')::numeric, 6);
    v_entry_price := round((v_holding ->> 'entry_price')::numeric, 4);
    v_purchase_date := nullif(trim(coalesce(v_holding ->> 'purchase_date', '')), '')::date;
    v_score := nullif(trim(coalesce(v_holding ->> 'score_at_entry', '')), '')::numeric;
    v_rank := nullif(trim(coalesce(v_holding ->> 'rank_at_entry', '')), '')::integer;
    insert into public.portfolio_holdings (
      portfolio_id, ticker, entry_price, allocation_pct, score_at_entry,
      rank_at_entry, shares, purchase_date, source, notes
    ) values (
      p_portfolio_id, v_ticker, v_entry_price, null, v_score,
      v_rank, v_shares, v_purchase_date, 'trading212',
      'Imported from Trading 212 CSV as current holdings state.'
    );
  end loop;

  update public.user_portfolios as p
  set investment_amount = v_holdings_basis,
      updated_at = now()
  where p.id = p_portfolio_id and p.user_id = v_user_id;

  insert into public.portfolio_transactions (
    portfolio_id, user_id, type, amount, currency, notes, occurred_at
  ) values (
    p_portfolio_id, v_user_id, 'import', 0, 'USD',
    'Tracked holdings replaced from Trading 212 CSV; cash, net contribution and prior ledger history were preserved.',
    null
  );

  return query select p_portfolio_id, v_count, v_holdings_basis,
    v_portfolio.cash_balance, v_portfolio.cash_deposited_total;
end;
$function$;

comment on function public.create_trading212_portfolio(text, jsonb) is
  'Atomically creates an exact-owned USD Portfolio from a validated Trading 212 current-holdings snapshot without importing cash or executions.';
comment on function public.replace_portfolio_holdings_from_trading212(uuid, jsonb) is
  'Atomically replaces one exact-owned USD Portfolio holding set while preserving cash, net contribution and prior ledger history.';

revoke execute on function public.create_trading212_portfolio(text, jsonb) from public, anon;
revoke execute on function public.replace_portfolio_holdings_from_trading212(uuid, jsonb) from public, anon;

grant execute on function public.create_trading212_portfolio(text, jsonb) to authenticated, service_role;
grant execute on function public.replace_portfolio_holdings_from_trading212(uuid, jsonb) to authenticated, service_role;
