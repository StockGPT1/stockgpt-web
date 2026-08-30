-- Apply a manual cash deposit or withdrawal as one exact-owner transaction.
-- This function is intentionally narrow: the caller cannot supply an owner,
-- ledger payload or timestamps, and it cannot select/create a fallback portfolio.
create function public.mutate_portfolio_cash(
  p_portfolio_id uuid,
  p_operation text,
  p_amount numeric
)
returns table (
  portfolio_id uuid,
  transaction_id uuid,
  operation text,
  amount numeric,
  cash_balance numeric,
  cash_deposited_total numeric,
  occurred_at timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_amount numeric;
  v_currency text;
  v_cash numeric;
  v_contributed numeric;
  v_next_cash numeric;
  v_next_contributed numeric;
  v_transaction_id uuid;
  v_occurred_at timestamptz;
  v_created_at timestamptz;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'not_authenticated';
  end if;

  if p_portfolio_id is null then
    raise exception using errcode = '22023', message = 'portfolio_id_required';
  end if;

  if p_operation is null or p_operation not in ('deposit', 'withdrawal') then
    raise exception using errcode = '22023', message = 'cash_operation_invalid';
  end if;

  if p_amount is null
    or p_amount::text in ('NaN', 'Infinity', '-Infinity') then
    raise exception using errcode = '22023', message = 'cash_amount_invalid';
  end if;

  v_amount := round(p_amount, 2);
  if v_amount <= 0 then
    raise exception using errcode = '22023', message = 'cash_amount_invalid';
  end if;

  select
    p.currency,
    p.cash_balance,
    p.cash_deposited_total
  into
    v_currency,
    v_cash,
    v_contributed
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

  if v_cash is null
    or v_contributed is null
    or v_cash::text in ('NaN', 'Infinity', '-Infinity')
    or v_contributed::text in ('NaN', 'Infinity', '-Infinity')
    or v_cash < 0 then
    raise exception using errcode = 'P0001', message = 'portfolio_cash_state_invalid';
  end if;

  if p_operation = 'deposit' then
    v_next_cash := round(v_cash + v_amount, 2);
    v_next_contributed := round(v_contributed + v_amount, 2);
  else
    if v_amount > v_cash then
      raise exception using errcode = 'P0001', message = 'insufficient_cash';
    end if;

    v_next_cash := round(v_cash - v_amount, 2);
    v_next_contributed := round(v_contributed - v_amount, 2);
  end if;

  update public.user_portfolios as p
  set
    cash_balance = v_next_cash,
    cash_deposited_total = v_next_contributed,
    updated_at = now()
  where p.id = p_portfolio_id
    and p.user_id = v_user_id;

  insert into public.portfolio_transactions as t (
    portfolio_id,
    user_id,
    ticker,
    type,
    shares,
    price,
    amount,
    realised_pnl,
    currency,
    notes
  ) values (
    p_portfolio_id,
    v_user_id,
    null,
    p_operation,
    null,
    null,
    v_amount,
    null,
    'USD',
    case p_operation
      when 'deposit' then 'Manual cash deposit.'
      else 'Manual cash withdrawal.'
    end
  )
  returning t.id, t.occurred_at, t.created_at
  into v_transaction_id, v_occurred_at, v_created_at;

  return query
  select
    p_portfolio_id,
    v_transaction_id,
    p_operation,
    v_amount,
    v_next_cash,
    v_next_contributed,
    v_occurred_at,
    v_created_at;
end;
$function$;

comment on function public.mutate_portfolio_cash(uuid, text, numeric) is
  'Atomically applies an exact-owned USD cash deposit or withdrawal and appends its ledger row.';

revoke execute on function public.mutate_portfolio_cash(uuid, text, numeric)
  from public, anon;
grant execute on function public.mutate_portfolio_cash(uuid, text, numeric)
  to authenticated;
