-- Saves buy-time stop-loss / take-profit levels at the moment StockGPT adds a holding.
-- Manual and Trading 212 imported holdings are intentionally excluded.

alter table if exists portfolio_holdings
  add column if not exists risk_level_at_entry numeric null;

alter table if exists portfolio_holdings
  add column if not exists target_level_at_entry numeric null;

create or replace function public.stockgpt_entry_trade_level_confidence(
  p_score numeric,
  p_rank numeric,
  p_max_score numeric
) returns numeric
language sql
stable
as $$
  select least(
    1,
    greatest(
      0.15,
      (least(greatest(coalesce(p_score, 0) / greatest(coalesce(p_max_score, 10000), 1), 0), 1) * 0.7)
      +
      (case
        when p_rank is null or p_rank <= 0 then 0.15
        else least(greatest(1 - ((p_rank - 1) / 499.0), 0), 1) * 0.3
      end)
    )
  );
$$;

create or replace function public.stockgpt_set_entry_trade_levels()
returns trigger
language plpgsql
as $$
declare
  v_source text := lower(coalesce(new.source, ''));
  v_score numeric;
  v_rank numeric;
  v_sector text;
  v_max_score numeric;
  v_confidence numeric;
  v_sector_vol numeric := 1.0;
  v_stop_pct numeric;
  v_risk_reward numeric;
begin
  if new.entry_price is null or new.entry_price <= 0 then
    return new;
  end if;

  -- Manual/imported holdings do not get fabricated SL/TP levels.
  if v_source in ('manual', 'trading212') then
    return new;
  end if;

  -- Never overwrite levels that were already saved at the real buy/add moment.
  if new.risk_level_at_entry is not null and new.target_level_at_entry is not null then
    return new;
  end if;

  select sr.score::numeric, sr.rank::numeric, sr.sector
    into v_score, v_rank, v_sector
  from public.stock_rankings sr
  where upper(sr.ticker) = upper(new.ticker)
  limit 1;

  select greatest(coalesce(max(score::numeric), 10000), 1)
    into v_max_score
  from public.stock_rankings;

  v_confidence := public.stockgpt_entry_trade_level_confidence(v_score, v_rank, v_max_score);

  v_sector_vol := case coalesce(v_sector, '')
    when 'Energy' then 1.4
    when 'Information Technology' then 1.25
    when 'Technology' then 1.25
    when 'Consumer Discretionary' then 1.2
    when 'Materials' then 1.15
    when 'Communication Services' then 1.1
    when 'Financials' then 1.05
    when 'Health Care' then 1.0
    when 'Healthcare' then 1.0
    when 'Industrials' then 0.95
    when 'Real Estate' then 0.95
    when 'Consumer Staples' then 0.75
    when 'Utilities' then 0.65
    else 1.0
  end;

  v_stop_pct := case
    when v_confidence >= 0.78 then 0.11
    when v_confidence >= 0.58 then 0.09
    when v_confidence >= 0.38 then 0.075
    else 0.06
  end;

  v_stop_pct := least(0.16, greatest(0.05, v_stop_pct * v_sector_vol));

  v_risk_reward := case
    when v_confidence >= 0.78 then 3.8
    when v_confidence >= 0.58 then 3.0
    when v_confidence >= 0.38 then 2.4
    else 1.8
  end;

  if new.risk_level_at_entry is null then
    new.risk_level_at_entry := round((new.entry_price * (1 - v_stop_pct))::numeric, 2);
  end if;

  if new.target_level_at_entry is null then
    new.target_level_at_entry := round((new.entry_price * (1 + (v_stop_pct * v_risk_reward)))::numeric, 2);
  end if;

  return new;
end;
$$;

drop trigger if exists stockgpt_set_entry_trade_levels_before_write on public.portfolio_holdings;

create trigger stockgpt_set_entry_trade_levels_before_write
before insert or update of entry_price, source, risk_level_at_entry, target_level_at_entry, ticker
on public.portfolio_holdings
for each row
execute function public.stockgpt_set_entry_trade_levels();

comment on function public.stockgpt_set_entry_trade_levels() is
  'Sets entry-time stop-loss and take-profit levels only when StockGPT writes a holding. Manual and Trading 212 imported holdings are excluded.';
