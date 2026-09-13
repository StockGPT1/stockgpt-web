create type public.instrument_coverage_status as enum (
  'ranked',
  'tracked_only',
  'unsupported'
);

create table public.instruments (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  exchange_mic text,
  trading_currency text,
  instrument_type text not null default 'unknown',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint instruments_display_name_check check (display_name = btrim(display_name) and display_name <> ''),
  constraint instruments_exchange_mic_check check (
    exchange_mic is null or exchange_mic ~ '^[A-Z0-9]{4}$'
  ),
  constraint instruments_trading_currency_check check (
    trading_currency is null or trading_currency ~ '^[A-Z]{3}$'
  ),
  constraint instruments_instrument_type_check check (
    instrument_type = btrim(instrument_type) and instrument_type <> ''
  )
);

comment on table public.instruments is
  'Permanent StockGPT identity for one specific tradable listing. Symbols and provider identifiers are aliases, never identity.';

create table public.instrument_aliases (
  id uuid primary key default gen_random_uuid(),
  instrument_id uuid not null references public.instruments(id) on delete cascade,
  namespace text not null,
  scope text not null default '',
  value text not null,
  valid_from timestamptz,
  valid_to timestamptz,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  constraint instrument_aliases_namespace_check check (
    namespace = lower(btrim(namespace)) and namespace ~ '^[a-z0-9][a-z0-9._:-]*$'
  ),
  constraint instrument_aliases_scope_check check (scope = btrim(scope)),
  constraint instrument_aliases_value_check check (value = btrim(value) and value <> ''),
  constraint instrument_aliases_validity_check check (valid_to is null or valid_from is null or valid_to > valid_from),
  constraint instrument_aliases_namespace_scope_value_key unique (namespace, scope, value)
);

comment on table public.instrument_aliases is
  'Namespaced ticker, listing and provider mappings. Alias changes do not change the permanent instrument UUID.';

create index instrument_aliases_instrument_id_idx
  on public.instrument_aliases (instrument_id);

create unique index instrument_aliases_one_current_primary_idx
  on public.instrument_aliases (instrument_id, namespace, scope)
  where is_primary and valid_to is null;

create table public.instrument_market_data (
  instrument_id uuid primary key references public.instruments(id) on delete cascade,
  coverage public.instrument_coverage_status not null,
  current_price numeric,
  price_currency text,
  price_as_of timestamptz,
  source_namespace text,
  limitation_code text,
  updated_at timestamptz not null default now(),
  constraint instrument_market_data_price_check check (
    current_price is null
    or (current_price::text not in ('NaN', 'Infinity', '-Infinity') and current_price > 0)
  ),
  constraint instrument_market_data_currency_check check (
    price_currency is null or price_currency ~ '^[A-Z]{3}$'
  ),
  constraint instrument_market_data_source_check check (
    source_namespace is null
    or (source_namespace = lower(btrim(source_namespace)) and source_namespace ~ '^[a-z0-9][a-z0-9._:-]*$')
  ),
  constraint instrument_market_data_price_provenance_check check (
    (current_price is null and price_currency is null and price_as_of is null)
    or (current_price is not null and price_currency is not null and price_as_of is not null and source_namespace is not null)
  ),
  constraint instrument_market_data_unsupported_price_check check (
    coverage <> 'unsupported' or current_price is null
  )
);

comment on table public.instrument_market_data is
  'StockGPT global market-data coverage and price provenance. Broker account prices remain account evidence and must not be promoted here implicitly.';

alter table public.stock_rankings
  add column instrument_id uuid references public.instruments(id) on delete set null;

create unique index stock_rankings_instrument_id_key
  on public.stock_rankings (instrument_id)
  where instrument_id is not null;

alter table public.instruments enable row level security;
alter table public.instrument_aliases enable row level security;
alter table public.instrument_market_data enable row level security;

create policy instruments_authenticated_read
  on public.instruments
  for select
  to authenticated
  using (true);

create policy instrument_aliases_authenticated_read
  on public.instrument_aliases
  for select
  to authenticated
  using (true);

create policy instrument_market_data_subscriber_read
  on public.instrument_market_data
  for select
  to authenticated
  using (public.is_active_subscriber((select auth.uid())));

revoke all on table public.instruments from public, anon, authenticated;
revoke all on table public.instrument_aliases from public, anon, authenticated;
revoke all on table public.instrument_market_data from public, anon, authenticated;
grant select on table public.instruments to authenticated;
grant select on table public.instrument_aliases to authenticated;
grant select on table public.instrument_market_data to authenticated;
grant all on table public.instruments to service_role;
grant all on table public.instrument_aliases to service_role;
grant all on table public.instrument_market_data to service_role;
