create function public.create_manual_portfolio(
  p_name text,
  p_objective text,
  p_risk_tolerance text,
  p_time_horizon text,
  p_starting_cash numeric,
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
  v_cash numeric;
  v_holdings_basis numeric := 0;
  v_portfolio_id uuid;
  v_holding jsonb;
  v_ticker text;
  v_seen_tickers text[] := array[]::text[];
  v_shares numeric;
  v_entry_price numeric;
  v_holding_basis numeric;
  v_purchase_date date;
  v_notes text;
  v_score numeric;
  v_rank integer;
  v_allocation numeric;
  v_count integer;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'not_authenticated';
  end if;
  if v_name = '' or char_length(v_name) > 80 then
    raise exception using errcode = '22023', message = 'portfolio_name_invalid';
  end if;
  if p_objective is null or p_objective not in ('growth', 'income', 'balanced', 'capital_preservation', 'watchlist') then
    raise exception using errcode = '22023', message = 'portfolio_objective_invalid';
  end if;
  if p_risk_tolerance is null or p_risk_tolerance not in ('conservative', 'moderate', 'aggressive') then
    raise exception using errcode = '22023', message = 'portfolio_risk_tolerance_invalid';
  end if;
  if p_time_horizon is null or p_time_horizon not in ('short', 'medium', 'long') then
    raise exception using errcode = '22023', message = 'portfolio_time_horizon_invalid';
  end if;
  if p_starting_cash is null or p_starting_cash::text in ('NaN', 'Infinity', '-Infinity') then
    raise exception using errcode = '22023', message = 'portfolio_starting_cash_invalid';
  end if;
  v_cash := round(p_starting_cash, 2);
  if v_cash < 0 then
    raise exception using errcode = '22023', message = 'portfolio_starting_cash_invalid';
  end if;
  if p_holdings is null or jsonb_typeof(p_holdings) <> 'array' then
    raise exception using errcode = '22023', message = 'portfolio_holdings_invalid';
  end if;
  v_count := jsonb_array_length(p_holdings);
  if v_count > 100 then
    raise exception using errcode = '22023', message = 'portfolio_holdings_limit_exceeded';
  end if;

  for v_holding in select value from jsonb_array_elements(p_holdings) loop
    if jsonb_typeof(v_holding) <> 'object' then
      raise exception using errcode = '22023', message = 'portfolio_holding_invalid';
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
    v_holding_basis := round(v_shares * v_entry_price, 2);
    v_holdings_basis := v_holdings_basis + v_holding_basis;
  end loop;

  v_holdings_basis := round(v_holdings_basis, 2);
  if v_cash = 0 and v_holdings_basis = 0 then
    raise exception using errcode = '22023', message = 'portfolio_initial_state_required';
  end if;

  insert into public.user_portfolios as p (
    user_id, name, objective, risk_tolerance, time_horizon,
    investment_amount, cash_balance, cash_deposited_total, currency
  ) values (
    v_user_id, v_name, p_objective, p_risk_tolerance, p_time_horizon,
    v_holdings_basis, v_cash, round(v_cash + v_holdings_basis, 2), 'USD'
  ) returning p.id into v_portfolio_id;

  if v_cash > 0 then
    insert into public.portfolio_transactions (
      portfolio_id, user_id, type, amount, currency, notes, occurred_at
    ) values (
      v_portfolio_id, v_user_id, 'deposit', v_cash, 'USD',
      'Starting cash recorded during Portfolio creation; original contribution time not separately known.',
      null
    );
  end if;

  for v_holding in select value from jsonb_array_elements(p_holdings) loop
    v_ticker := upper(trim(v_holding ->> 'ticker'));
    v_shares := round((v_holding ->> 'shares')::numeric, 6);
    v_entry_price := round((v_holding ->> 'entry_price')::numeric, 4);
    v_holding_basis := round(v_shares * v_entry_price, 2);
    v_purchase_date := nullif(trim(coalesce(v_holding ->> 'purchase_date', '')), '')::date;
    v_notes := nullif(left(trim(coalesce(v_holding ->> 'notes', '')), 500), '');
    v_score := nullif(trim(coalesce(v_holding ->> 'score_at_entry', '')), '')::numeric;
    v_rank := nullif(trim(coalesce(v_holding ->> 'rank_at_entry', '')), '')::integer;
    v_allocation := nullif(trim(coalesce(v_holding ->> 'allocation_pct', '')), '')::numeric;

    insert into public.portfolio_holdings (
      portfolio_id, ticker, entry_price, allocation_pct, score_at_entry,
      rank_at_entry, shares, purchase_date, source, notes
    ) values (
      v_portfolio_id, v_ticker, v_entry_price, v_allocation, v_score,
      v_rank, v_shares, v_purchase_date, 'manual_builder', v_notes
    );

    insert into public.portfolio_transactions (
      portfolio_id, user_id, ticker, type, shares, price, amount,
      currency, notes, occurred_at
    ) values (
      v_portfolio_id, v_user_id, v_ticker, 'log_existing', v_shares,
      v_entry_price, v_holding_basis, 'USD',
      coalesce(v_notes, 'Existing holding recorded during Portfolio creation; original transaction time not separately known.'),
      null
    );
  end loop;

  return query select v_portfolio_id, v_count, v_holdings_basis, v_cash,
    round(v_cash + v_holdings_basis, 2);
end;
$function$;

create function public.create_ai_portfolio_draft(
  p_name text,
  p_risk_tolerance text,
  p_time_horizon text,
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
  v_holdings_basis numeric := 0;
  v_portfolio_id uuid;
  v_holding jsonb;
  v_ticker text;
  v_seen_tickers text[] := array[]::text[];
  v_shares numeric;
  v_entry_price numeric;
  v_holding_basis numeric;
  v_score numeric;
  v_rank integer;
  v_allocation numeric;
  v_count integer;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'not_authenticated';
  end if;
  if v_name = '' or char_length(v_name) > 80 then
    raise exception using errcode = '22023', message = 'portfolio_name_invalid';
  end if;
  if p_risk_tolerance is null or p_risk_tolerance not in ('conservative', 'moderate', 'aggressive') then
    raise exception using errcode = '22023', message = 'portfolio_risk_tolerance_invalid';
  end if;
  if p_time_horizon is null or p_time_horizon not in ('short', 'medium', 'long') then
    raise exception using errcode = '22023', message = 'portfolio_time_horizon_invalid';
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
      raise exception using errcode = '22023', message = 'portfolio_holding_invalid';
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
    v_holdings_basis := v_holdings_basis + round(v_shares * v_entry_price, 2);
  end loop;
  v_holdings_basis := round(v_holdings_basis, 2);

  insert into public.user_portfolios as p (
    user_id, name, objective, risk_tolerance, time_horizon,
    investment_amount, cash_balance, cash_deposited_total, currency
  ) values (
    v_user_id, v_name, 'balanced', p_risk_tolerance, p_time_horizon,
    v_holdings_basis, 0, v_holdings_basis, 'USD'
  ) returning p.id into v_portfolio_id;

  for v_holding in select value from jsonb_array_elements(p_holdings) loop
    v_ticker := upper(trim(v_holding ->> 'ticker'));
    v_shares := round((v_holding ->> 'shares')::numeric, 6);
    v_entry_price := round((v_holding ->> 'entry_price')::numeric, 4);
    v_score := nullif(trim(coalesce(v_holding ->> 'score_at_entry', '')), '')::numeric;
    v_rank := nullif(trim(coalesce(v_holding ->> 'rank_at_entry', '')), '')::integer;
    v_allocation := nullif(trim(coalesce(v_holding ->> 'allocation_pct', '')), '')::numeric;
    insert into public.portfolio_holdings (
      portfolio_id, ticker, entry_price, allocation_pct, score_at_entry,
      rank_at_entry, shares, purchase_date, source, notes
    ) values (
      v_portfolio_id, v_ticker, v_entry_price, v_allocation, v_score,
      v_rank, v_shares, null, 'ai_builder', 'Saved from a StockGPT AI Portfolio Draft.'
    );
  end loop;

  insert into public.portfolio_transactions (
    portfolio_id, user_id, type, amount, currency, notes, occurred_at
  ) values (
    v_portfolio_id, v_user_id, 'import', v_holdings_basis, 'USD',
    'AI Portfolio Draft state initialized; no buy execution is represented.', null
  );

  return query select v_portfolio_id, v_count, v_holdings_basis, 0::numeric,
    v_holdings_basis;
end;
$function$;

create function public.delete_owned_portfolio(p_portfolio_id uuid)
returns table (portfolio_id uuid)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'not_authenticated';
  end if;
  if p_portfolio_id is null then
    raise exception using errcode = '22023', message = 'portfolio_id_required';
  end if;
  perform 1
  from public.user_portfolios as p
  where p.id = p_portfolio_id and p.user_id = v_user_id
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'portfolio_not_found';
  end if;
  delete from public.user_portfolios as p
  where p.id = p_portfolio_id and p.user_id = v_user_id;
  return query select p_portfolio_id;
end;
$function$;

comment on function public.create_manual_portfolio(text, text, text, text, numeric, jsonb) is
  'Atomically creates an exact-owned USD manual Portfolio, its initial holdings and unknown-occurrence ledger representation.';
comment on function public.create_ai_portfolio_draft(text, text, text, jsonb) is
  'Atomically saves an exact-owned USD AI Portfolio Draft using persisted holding basis rather than caller totals.';
comment on function public.delete_owned_portfolio(uuid) is
  'Deletes one exact owned Portfolio as an explicit lifecycle operation; child rows follow existing FK cascades.';

revoke execute on function public.create_manual_portfolio(text, text, text, text, numeric, jsonb) from public, anon;
revoke execute on function public.create_ai_portfolio_draft(text, text, text, jsonb) from public, anon;
revoke execute on function public.delete_owned_portfolio(uuid) from public, anon;

grant execute on function public.create_manual_portfolio(text, text, text, text, numeric, jsonb) to authenticated, service_role;
grant execute on function public.create_ai_portfolio_draft(text, text, text, jsonb) to authenticated, service_role;
grant execute on function public.delete_owned_portfolio(uuid) to authenticated, service_role;
