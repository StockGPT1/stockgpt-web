create table public.broker_account_value_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null,
  value_at timestamptz not null,
  total_value numeric not null,
  cash_value numeric not null,
  currency text not null,
  source text not null,
  quality text not null,
  recorded_at timestamptz not null default now(),
  constraint broker_account_value_history_account_owner_fkey
    foreign key (account_id, user_id)
    references public.broker_accounts(id, user_id)
    on delete cascade,
  constraint broker_account_value_history_currency_check
    check (currency ~ '^[A-Z]{3}$'),
  constraint broker_account_value_history_total_check
    check (total_value::text not in ('NaN', 'Infinity', '-Infinity')),
  constraint broker_account_value_history_cash_check
    check (cash_value::text not in ('NaN', 'Infinity', '-Infinity')),
  constraint broker_account_value_history_source_check
    check (source in ('sync_promotion', 'provider_history')),
  constraint broker_account_value_history_quality_check
    check (quality in ('provider_evidence', 'provider_reported')),
  constraint broker_account_value_history_idempotency_key
    unique (account_id, value_at, source)
);

create index broker_account_value_history_account_time_idx
  on public.broker_account_value_history (account_id, value_at desc, id);

alter table public.broker_account_value_history enable row level security;
create policy broker_account_value_history_owner_read
  on public.broker_account_value_history for select to authenticated
  using ((select auth.uid()) = user_id);
revoke all on table public.broker_account_value_history from public, anon, authenticated;
grant select on table public.broker_account_value_history to authenticated;
grant all on table public.broker_account_value_history to service_role;

create table public.historical_fx_rates (
  id uuid primary key default gen_random_uuid(),
  base_currency text not null,
  quote_currency text not null,
  effective_date date not null,
  rate numeric not null,
  source text not null,
  quality text not null,
  recorded_at timestamptz not null default now(),
  constraint historical_fx_rates_base_check check (base_currency ~ '^[A-Z]{3}$'),
  constraint historical_fx_rates_quote_check check (quote_currency ~ '^[A-Z]{3}$'),
  constraint historical_fx_rates_distinct_currency_check check (base_currency <> quote_currency),
  constraint historical_fx_rates_rate_check check (
    rate::text not in ('NaN', 'Infinity', '-Infinity') and rate > 0
  ),
  constraint historical_fx_rates_source_check check (
    source = btrim(source) and source <> ''
  ),
  constraint historical_fx_rates_quality_check check (
    quality in ('exact_daily_close', 'provider_reported')
  ),
  constraint historical_fx_rates_identity_key
    unique (base_currency, quote_currency, effective_date, source)
);

create index historical_fx_rates_lookup_idx
  on public.historical_fx_rates (base_currency, quote_currency, effective_date desc);

alter table public.historical_fx_rates enable row level security;
create policy historical_fx_rates_authenticated_read
  on public.historical_fx_rates for select to authenticated using (true);
revoke all on table public.historical_fx_rates from public, anon, authenticated;
grant select on table public.historical_fx_rates to authenticated;
grant all on table public.historical_fx_rates to service_role;

create table public.portfolio_context_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  context_kind text not null,
  portfolio_id uuid,
  updated_at timestamptz not null default now(),
  constraint portfolio_context_preferences_kind_check
    check (context_kind in ('portfolio', 'all_investments')),
  constraint portfolio_context_preferences_shape_check check (
    (context_kind = 'portfolio' and portfolio_id is not null)
    or (context_kind = 'all_investments' and portfolio_id is null)
  ),
  constraint portfolio_context_preferences_owned_portfolio_fkey
    foreign key (portfolio_id, user_id)
    references public.user_portfolios(id, user_id)
    on delete cascade
);

alter table public.portfolio_context_preferences enable row level security;
create policy portfolio_context_preferences_owner_read
  on public.portfolio_context_preferences for select to authenticated
  using ((select auth.uid()) = user_id);
revoke all on table public.portfolio_context_preferences from public, anon, authenticated;
grant select on table public.portfolio_context_preferences to authenticated;
grant all on table public.portfolio_context_preferences to service_role;

create function public.set_default_portfolio_context(
  p_context_kind text,
  p_portfolio_id uuid default null
)
returns table (context_kind text, portfolio_id uuid)
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

  if p_context_kind = 'portfolio' then
    if p_portfolio_id is null or not exists (
      select 1 from public.user_portfolios p
      where p.id = p_portfolio_id
        and p.user_id = v_user_id
        and p.archived_at is null
    ) then
      raise exception using errcode = 'P0001', message = 'portfolio_context_not_found';
    end if;
  elsif p_context_kind = 'all_investments' then
    if p_portfolio_id is not null then
      raise exception using errcode = '22023', message = 'all_investments_portfolio_must_be_null';
    end if;
  else
    raise exception using errcode = '22023', message = 'invalid_portfolio_context_kind';
  end if;

  insert into public.portfolio_context_preferences (user_id, context_kind, portfolio_id, updated_at)
  values (v_user_id, p_context_kind, p_portfolio_id, now())
  on conflict (user_id) do update
    set context_kind = excluded.context_kind,
        portfolio_id = excluded.portfolio_id,
        updated_at = now();

  return query select p_context_kind, p_portfolio_id;
end;
$function$;

revoke all on function public.set_default_portfolio_context(text, uuid) from public, anon;
grant execute on function public.set_default_portfolio_context(text, uuid) to authenticated, service_role;

create function public.clear_default_portfolio_context()
returns void
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
  delete from public.portfolio_context_preferences where user_id = v_user_id;
end;
$function$;

revoke all on function public.clear_default_portfolio_context() from public, anon;
grant execute on function public.clear_default_portfolio_context() to authenticated, service_role;

create function public.capture_promoted_broker_account_values()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_account public.broker_accounts%rowtype;
  v_position_value numeric;
  v_cash_value numeric;
begin
  if new.status <> 'succeeded'
     or new.provider_freshness_at is null
     or old.status = 'succeeded' then
    return new;
  end if;

  for v_account in
    select a.*
    from public.broker_accounts a
    where a.connection_id = new.connection_id
      and a.user_id = new.user_id
      and a.last_successful_sync_at = new.provider_freshness_at
  loop
    if v_account.base_currency is null
       or v_account.base_currency !~ '^[A-Z]{3}$'
       or exists (
         select 1 from public.broker_positions p
         where p.account_id = v_account.id
           and not (
             (p.market_value is not null and p.market_value_currency = v_account.base_currency)
             or (p.price is not null and p.price_currency = v_account.base_currency)
           )
       )
       or exists (
         select 1 from public.broker_cash_balances c
         where c.account_id = v_account.id
           and c.currency <> v_account.base_currency
       ) then
      continue;
    end if;

    select coalesce(sum(
      case
        when p.market_value is not null then p.market_value
        else p.quantity * p.price
      end
    ), 0)
    into v_position_value
    from public.broker_positions p
    where p.account_id = v_account.id;

    select coalesce(sum(c.amount), 0)
    into v_cash_value
    from public.broker_cash_balances c
    where c.account_id = v_account.id;

    insert into public.broker_account_value_history (
      user_id, account_id, value_at, total_value, cash_value,
      currency, source, quality
    ) values (
      new.user_id, v_account.id, new.provider_freshness_at,
      v_position_value + v_cash_value, v_cash_value,
      v_account.base_currency, 'sync_promotion', 'provider_evidence'
    )
    on conflict (account_id, value_at, source) do nothing;
  end loop;

  return new;
end;
$function$;

create trigger capture_promoted_broker_account_values
after update of status on public.broker_sync_jobs
for each row execute function public.capture_promoted_broker_account_values();

comment on table public.broker_account_value_history is
  'Immutable provider-evidence account valuation points. No row is synthesized when currency or valuation evidence is incomplete.';
comment on table public.historical_fx_rates is
  'Historical conversion evidence keyed to the value date. Current display FX must never be substituted for missing historical rates.';
comment on table public.portfolio_context_preferences is
  'Exact owner-scoped saved Portfolio context. All Investments is a derived context and never a synthetic Portfolio row.';
