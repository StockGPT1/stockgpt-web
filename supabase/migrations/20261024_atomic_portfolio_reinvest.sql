-- Atomic implementation of the portfolio trim/reinvest workflow.
-- Apply this migration BEFORE deploying the route that invokes it.
-- Invoked only by the trusted service-role client after server-side user auth.
BEGIN;

CREATE OR REPLACE FUNCTION public.trim_and_reinvest_portfolio_atomic(
  p_portfolio_id uuid,
  p_user_id uuid,
  p_source_ticker text,
  p_target_ticker text,
  p_percentage numeric,
  p_sell_price numeric,
  p_buy_price numeric,
  p_target_score numeric,
  p_target_rank numeric,
  p_risk_level numeric,
  p_target_level numeric
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cash numeric;
  v_deposited numeric;
  v_currency text;
  v_source_shares numeric;
  v_source_entry numeric;
  v_target_shares numeric := 0;
  v_target_entry numeric := 0;
  v_target_purchase_date date;
  v_target_notes text;
  v_has_target boolean := false;
  v_sold numeric;
  v_remaining numeric;
  v_proceeds numeric;
  v_pnl numeric;
  v_bought numeric;
  v_new_target_shares numeric;
  v_new_target_entry numeric;
  v_holdings_cost numeric;
  v_now timestamptz := clock_timestamp();
BEGIN
  IF p_portfolio_id IS NULL OR p_user_id IS NULL
     OR p_source_ticker IS NULL OR p_target_ticker IS NULL
     OR p_source_ticker !~ '^[A-Z][A-Z0-9.\\-]{0,11}$'
     OR p_target_ticker !~ '^[A-Z][A-Z0-9.\\-]{0,11}$'
     OR p_source_ticker = p_target_ticker
     OR p_percentage IS NULL OR p_percentage <= 0 OR p_percentage > 100
     OR p_sell_price IS NULL OR p_sell_price <= 0
     OR p_buy_price IS NULL OR p_buy_price <= 0 THEN
    RAISE EXCEPTION 'Invalid portfolio reinvestment parameters'
      USING ERRCODE = '22023';
  END IF;

  -- Lock the owning portfolio to serialize simultaneous trim/reinvest calls.
  SELECT up.cash_balance, up.cash_deposited_total, up.currency
    INTO v_cash, v_deposited, v_currency
  FROM public.user_portfolios up
  WHERE up.id = p_portfolio_id AND up.user_id = p_user_id
    AND up.archived_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Portfolio not found or not owned by user'
      USING ERRCODE = '42501';
  END IF;

  SELECT h.shares, h.entry_price INTO v_source_shares, v_source_entry
  FROM public.portfolio_holdings h
  WHERE h.portfolio_id = p_portfolio_id AND h.ticker = p_source_ticker
  FOR UPDATE;
  IF NOT FOUND OR v_source_shares IS NULL OR v_source_shares <= 0 THEN
    RAISE EXCEPTION 'Source holding not found'
      USING ERRCODE = '22023';
  END IF;

  SELECT h.shares, h.entry_price, h.purchase_date, h.notes
    INTO v_target_shares, v_target_entry, v_target_purchase_date, v_target_notes
  FROM public.portfolio_holdings h
  WHERE h.portfolio_id = p_portfolio_id AND h.ticker = p_target_ticker
  FOR UPDATE;
  v_has_target := FOUND;
  v_target_shares := COALESCE(v_target_shares, 0);
  v_target_entry := COALESCE(v_target_entry, 0);

  v_sold := CASE WHEN p_percentage = 100 THEN v_source_shares
                 ELSE round(v_source_shares * p_percentage / 100, 6) END;
  v_remaining := round(v_source_shares - v_sold, 6);
  v_proceeds := round(v_sold * p_sell_price, 2);
  v_pnl := round((p_sell_price - COALESCE(v_source_entry, 0)) * v_sold, 2);
  v_bought := round(v_proceeds / p_buy_price, 6);

  IF v_sold <= 0 OR v_sold > v_source_shares
     OR v_proceeds <= 0 OR v_bought <= 0 THEN
    RAISE EXCEPTION 'Trim amount too small to reinvest'
      USING ERRCODE = '22023';
  END IF;

  v_new_target_shares := round(v_target_shares + v_bought, 6);
  v_new_target_entry := round(
    (v_target_shares * v_target_entry + v_proceeds) / v_new_target_shares,
    4
  );

  IF v_remaining <= 0.000001 THEN
    DELETE FROM public.portfolio_holdings
    WHERE portfolio_id = p_portfolio_id AND ticker = p_source_ticker;
  ELSE
    UPDATE public.portfolio_holdings
    SET shares = v_remaining
    WHERE portfolio_id = p_portfolio_id AND ticker = p_source_ticker;
  END IF;

  INSERT INTO public.portfolio_holdings (
    portfolio_id, ticker, entry_price, shares, allocation_pct,
    score_at_entry, rank_at_entry, risk_level_at_entry,
    target_level_at_entry, last_reviewed_at, purchase_date, source, notes
  ) VALUES (
    p_portfolio_id, p_target_ticker, v_new_target_entry,
    v_new_target_shares, NULL, p_target_score, p_target_rank,
    p_risk_level, p_target_level, v_now,
    COALESCE(v_target_purchase_date, v_now::date), 'reinvest',
    CASE WHEN v_has_target THEN v_target_notes
         ELSE 'Reinvested from ' || p_source_ticker || ' trim.' END
  )
  ON CONFLICT (portfolio_id,ticker) DO UPDATE SET
    entry_price = EXCLUDED.entry_price,
    shares = EXCLUDED.shares,
    allocation_pct = EXCLUDED.allocation_pct,
    score_at_entry = EXCLUDED.score_at_entry,
    rank_at_entry = EXCLUDED.rank_at_entry,
    risk_level_at_entry = EXCLUDED.risk_level_at_entry,
    target_level_at_entry = EXCLUDED.target_level_at_entry,
    last_reviewed_at = EXCLUDED.last_reviewed_at,
    purchase_date = EXCLUDED.purchase_date,
    source = EXCLUDED.source,
    notes = EXCLUDED.notes;

  INSERT INTO public.portfolio_transactions (
    portfolio_id, user_id, ticker, type, shares, price,
    amount, realised_pnl, currency, notes
  ) VALUES (
    p_portfolio_id, p_user_id, p_source_ticker, 'sell',
    v_sold, p_sell_price, v_proceeds, v_pnl, COALESCE(v_currency, 'USD'),
    'Trimmed ' || round(p_percentage, 0)::text || '% of ' || p_source_ticker
      || ' and reinvested into ' || p_target_ticker || '.'
  ), (
    p_portfolio_id, p_user_id, p_target_ticker, 'buy',
    v_bought, p_buy_price, v_proceeds, NULL, COALESCE(v_currency, 'USD'),
    'Reinvested ' || p_source_ticker || ' trim proceeds into ' || p_target_ticker || '.'
  );

  SELECT COALESCE(sum(COALESCE(h.entry_price, 0) * COALESCE(h.shares, 0)), 0)
    INTO v_holdings_cost
  FROM public.portfolio_holdings h
  WHERE h.portfolio_id = p_portfolio_id;

  UPDATE public.user_portfolios
  SET investment_amount = round(v_holdings_cost, 2),
      cash_balance = round(COALESCE(v_cash, 0), 2),
      cash_deposited_total = round(
        GREATEST(COALESCE(v_deposited, 0),
                 COALESCE(v_cash, 0) + v_holdings_cost), 2
      )
  WHERE id = p_portfolio_id AND user_id = p_user_id;

  -- Every statement above is in the same PostgreSQL transaction: any
  -- exception rolls back holdings, ledger and totals together.
  RETURN jsonb_build_object(
    'success', true,
    'soldTicker', p_source_ticker,
    'boughtTicker', p_target_ticker,
    'soldShares', v_sold,
    'boughtShares', v_bought,
    'amount', v_proceeds
  );
END;
$$;

REVOKE ALL ON FUNCTION public.trim_and_reinvest_portfolio_atomic(
  uuid, uuid, text, text, numeric, numeric, numeric,
  numeric, numeric, numeric, numeric
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trim_and_reinvest_portfolio_atomic(
  uuid, uuid, text, text, numeric, numeric, numeric,
  numeric, numeric, numeric, numeric
) TO service_role;

COMMIT;
