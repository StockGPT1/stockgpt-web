create type public.portfolio_management_source as enum ('manual', 'connected');

insert into public.broker_providers (provider_key, display_name)
values ('snaptrade', 'SnapTrade')
on conflict (provider_key) do update set display_name = excluded.display_name;

create table public.brokerage_institution_aliases (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.broker_providers(id) on delete cascade,
  external_institution_id text not null,
  institution_id uuid not null references public.brokerage_institutions(id),
  created_at timestamptz not null default now(),
  constraint brokerage_institution_aliases_external_id_check
    check (external_institution_id = btrim(external_institution_id) and external_institution_id <> ''),
  constraint brokerage_institution_aliases_provider_external_key
    unique (provider_id, external_institution_id)
);

alter table public.brokerage_institution_aliases enable row level security;
create policy brokerage_institution_aliases_authenticated_read
  on public.brokerage_institution_aliases for select to authenticated using (true);
revoke all on table public.brokerage_institution_aliases from public, anon, authenticated;
grant select on table public.brokerage_institution_aliases to authenticated;
grant all on table public.brokerage_institution_aliases to service_role;

alter table public.user_portfolios
  add column management_source public.portfolio_management_source not null default 'manual',
  add column broker_account_id uuid;

alter table public.user_portfolios
  add constraint user_portfolios_broker_account_owner_fkey
    foreign key (broker_account_id, user_id)
    references public.broker_accounts(id, user_id),
  add constraint user_portfolios_source_account_check check (
    (management_source = 'manual' and broker_account_id is null)
    or (management_source = 'connected' and broker_account_id is not null)
  ),
  add constraint user_portfolios_connected_financial_state_check check (
    management_source = 'manual'
    or (
      coalesce(cash_balance, 0) = 0
      and coalesce(cash_deposited_total, 0) = 0
      and coalesce(investment_amount, 0) = 0
      and upper(currency) = 'USD'
    )
  );

create unique index user_portfolios_connected_account_key
  on public.user_portfolios (broker_account_id)
  where broker_account_id is not null;

create or replace function public.guard_connected_portfolio_financial_state()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_source public.portfolio_management_source;
begin
  if tg_table_name = 'user_portfolios' then
    if old.management_source = 'connected' and (
      new.management_source is distinct from old.management_source
      or new.broker_account_id is distinct from old.broker_account_id
      or new.cash_balance is distinct from old.cash_balance
      or new.cash_deposited_total is distinct from old.cash_deposited_total
      or new.investment_amount is distinct from old.investment_amount
      or new.currency is distinct from old.currency
    ) then
      raise exception using errcode = 'P0001', message = 'connected_portfolio_read_only';
    end if;
    return new;
  end if;

  select p.management_source into v_source
  from public.user_portfolios as p
  where p.id = case when tg_op = 'DELETE' then old.portfolio_id else new.portfolio_id end;

  if v_source = 'connected' then
    raise exception using errcode = 'P0001', message = 'connected_portfolio_read_only';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$function$;

create trigger guard_connected_portfolio_financial_update
before update on public.user_portfolios
for each row execute function public.guard_connected_portfolio_financial_state();

create trigger guard_connected_portfolio_holdings
before insert or update or delete on public.portfolio_holdings
for each row execute function public.guard_connected_portfolio_financial_state();

create trigger guard_connected_portfolio_transactions
before insert or update or delete on public.portfolio_transactions
for each row execute function public.guard_connected_portfolio_financial_state();

create function public.create_connected_portfolio(p_account_id uuid)
returns table (portfolio_id uuid, created boolean)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_account public.broker_accounts%rowtype;
  v_portfolio_id uuid;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'not_authenticated';
  end if;
  if p_account_id is null then
    raise exception using errcode = '22023', message = 'account_id_required';
  end if;
  if not public.is_active_subscriber(v_user_id) then
    raise exception using errcode = '42501', message = 'subscription_required';
  end if;

  select a.* into v_account
  from public.broker_accounts as a
  where a.id = p_account_id and a.user_id = v_user_id
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'broker_account_not_found';
  end if;

  if v_account.last_successful_sync_at is null then
    raise exception using errcode = 'P0001', message = 'broker_account_sync_pending';
  end if;
  if v_account.status <> 'active' then
    raise exception using errcode = 'P0001', message = 'broker_account_unavailable';
  end if;

  select p.id into v_portfolio_id
  from public.user_portfolios as p
  where p.broker_account_id = p_account_id and p.user_id = v_user_id;
  if found then
    return query select v_portfolio_id, false;
    return;
  end if;

  insert into public.user_portfolios (
    user_id, name, risk_tolerance, time_horizon, investment_amount,
    cash_balance, cash_deposited_total, currency, objective,
    management_source, broker_account_id
  ) values (
    v_user_id, v_account.name, 'moderate', 'long', 0,
    0, 0, 'USD', 'growth', 'connected', v_account.id
  )
  returning id into v_portfolio_id;

  return query select v_portfolio_id, true;
end;
$function$;

revoke execute on function public.create_connected_portfolio(uuid) from public, anon;
grant execute on function public.create_connected_portfolio(uuid) to authenticated, service_role;

comment on column public.user_portfolios.management_source is
  'Financial management source. Connected Portfolios project broker-domain facts and never store them in manual financial tables.';
comment on function public.create_connected_portfolio(uuid) is
  'Idempotently projects one exact-owned, successfully normalized broker account as a read-only connected Portfolio.';
