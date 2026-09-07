-- Forward validation repair only. Existing nullable legacy metadata is untouched.
-- NULL does not satisfy NOT IN in PostgreSQL; explicitly reject omitted enum values
-- just as normal Portfolio creation does. No financial facts or grants change.
create or replace function public.update_owned_portfolio_preferences(
  p_portfolio_id uuid,
  p_objective text,
  p_risk_tolerance text,
  p_time_horizon text
)
returns table (portfolio_id uuid, objective text, risk_tolerance text, time_horizon text)
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
  if p_objective is null or p_objective not in ('growth', 'income', 'balanced', 'capital_preservation', 'watchlist') then
    raise exception 'portfolio_objective_invalid' using errcode = '22023';
  end if;
  if p_risk_tolerance is null or p_risk_tolerance not in ('conservative', 'moderate', 'aggressive') then
    raise exception 'portfolio_risk_tolerance_invalid' using errcode = '22023';
  end if;
  if p_time_horizon is null or p_time_horizon not in ('short', 'medium', 'long') then
    raise exception 'portfolio_time_horizon_invalid' using errcode = '22023';
  end if;
  update public.user_portfolios p
  set objective = p_objective, risk_tolerance = p_risk_tolerance, time_horizon = p_time_horizon
  where p.id = p_portfolio_id and p.user_id = v_user_id and p.archived_at is null
  returning p.id, p.objective, p.risk_tolerance, p.time_horizon
  into portfolio_id, objective, risk_tolerance, time_horizon;
  if portfolio_id is null then
    raise exception 'portfolio_not_found' using errcode = 'P0002';
  end if;
  return next;
end;
$function$;
