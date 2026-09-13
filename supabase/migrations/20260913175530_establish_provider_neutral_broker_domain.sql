create type public.broker_connection_status as enum (
  'pending',
  'active',
  'error',
  'revoked',
  'disconnected'
);

create type public.broker_account_status as enum (
  'active',
  'closed',
  'inaccessible'
);

create table public.broker_providers (
  id uuid primary key default gen_random_uuid(),
  provider_key text not null unique,
  display_name text not null,
  created_at timestamptz not null default now(),
  constraint broker_providers_key_check check (
    provider_key = lower(btrim(provider_key)) and provider_key ~ '^[a-z0-9][a-z0-9_-]*$'
  ),
  constraint broker_providers_name_check check (display_name = btrim(display_name) and display_name <> '')
);

create table public.brokerage_institutions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  country_code text,
  created_at timestamptz not null default now(),
  constraint brokerage_institutions_name_check check (name = btrim(name) and name <> ''),
  constraint brokerage_institutions_country_check check (
    country_code is null or country_code ~ '^[A-Z]{2}$'
  )
);

create table public.broker_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider_id uuid not null references public.broker_providers(id),
  institution_id uuid not null references public.brokerage_institutions(id),
  external_connection_id text not null,
  status public.broker_connection_status not null default 'pending',
  connected_at timestamptz,
  disconnected_at timestamptz,
  last_attempted_sync_at timestamptz,
  last_successful_sync_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint broker_connections_external_id_check check (
    external_connection_id = btrim(external_connection_id) and external_connection_id <> ''
  ),
  constraint broker_connections_disconnect_check check (
    status = 'disconnected' or disconnected_at is null
  ),
  constraint broker_connections_sync_order_check check (
    last_successful_sync_at is null
    or last_attempted_sync_at is null
    or last_successful_sync_at <= last_attempted_sync_at
  ),
  constraint broker_connections_provider_external_key unique (provider_id, external_connection_id),
  constraint broker_connections_id_user_institution_key unique (id, user_id, institution_id),
  constraint broker_connections_id_user_key unique (id, user_id)
);

create table public.broker_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  connection_id uuid not null,
  institution_id uuid not null references public.brokerage_institutions(id),
  external_account_id text not null,
  name text not null,
  account_type text,
  base_currency text,
  status public.broker_account_status not null default 'active',
  last_successful_sync_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint broker_accounts_connection_owner_fkey
    foreign key (connection_id, user_id, institution_id)
    references public.broker_connections(id, user_id, institution_id)
    on delete cascade,
  constraint broker_accounts_external_id_check check (
    external_account_id = btrim(external_account_id) and external_account_id <> ''
  ),
  constraint broker_accounts_name_check check (name = btrim(name) and name <> ''),
  constraint broker_accounts_currency_check check (
    base_currency is null or base_currency ~ '^[A-Z]{3}$'
  ),
  constraint broker_accounts_connection_external_key unique (connection_id, external_account_id),
  constraint broker_accounts_id_user_key unique (id, user_id)
);

create table public.broker_positions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null,
  position_key text not null,
  external_position_id text,
  external_instrument_id text,
  instrument_id uuid references public.instruments(id) on delete set null,
  symbol text,
  description text,
  asset_type text,
  quantity numeric not null,
  price numeric,
  price_currency text,
  market_value numeric,
  market_value_currency text,
  as_of timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint broker_positions_account_owner_fkey
    foreign key (account_id, user_id)
    references public.broker_accounts(id, user_id)
    on delete cascade,
  constraint broker_positions_position_key_check check (position_key = btrim(position_key) and position_key <> ''),
  constraint broker_positions_identity_evidence_check check (
    instrument_id is not null
    or nullif(btrim(external_instrument_id), '') is not null
    or nullif(btrim(symbol), '') is not null
  ),
  constraint broker_positions_quantity_check check (
    quantity::text not in ('NaN', 'Infinity', '-Infinity') and quantity <> 0
  ),
  constraint broker_positions_price_check check (
    price is null or (price::text not in ('NaN', 'Infinity', '-Infinity') and price > 0)
  ),
  constraint broker_positions_market_value_check check (
    market_value is null or market_value::text not in ('NaN', 'Infinity', '-Infinity')
  ),
  constraint broker_positions_price_currency_check check (
    price_currency is null or price_currency ~ '^[A-Z]{3}$'
  ),
  constraint broker_positions_value_currency_check check (
    market_value_currency is null or market_value_currency ~ '^[A-Z]{3}$'
  ),
  constraint broker_positions_account_position_key unique (account_id, position_key)
);

create unique index broker_positions_external_position_key
  on public.broker_positions (account_id, external_position_id)
  where external_position_id is not null;

create index broker_positions_instrument_id_idx
  on public.broker_positions (instrument_id)
  where instrument_id is not null;

create table public.broker_cash_balances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null,
  currency text not null,
  amount numeric not null,
  as_of timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint broker_cash_balances_account_owner_fkey
    foreign key (account_id, user_id)
    references public.broker_accounts(id, user_id)
    on delete cascade,
  constraint broker_cash_balances_currency_check check (currency ~ '^[A-Z]{3}$'),
  constraint broker_cash_balances_amount_check check (
    amount::text not in ('NaN', 'Infinity', '-Infinity')
  ),
  constraint broker_cash_balances_account_currency_key unique (account_id, currency)
);

create table public.broker_activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null,
  instrument_id uuid references public.instruments(id) on delete set null,
  external_activity_id text,
  fingerprint text not null,
  fingerprint_version text not null default 'sha256-v1',
  activity_type text not null,
  occurred_at timestamptz,
  recorded_at timestamptz not null default now(),
  quantity numeric,
  price numeric,
  gross_amount numeric,
  net_amount numeric,
  currency text,
  description text,
  constraint broker_activities_account_owner_fkey
    foreign key (account_id, user_id)
    references public.broker_accounts(id, user_id)
    on delete cascade,
  constraint broker_activities_fingerprint_check check (fingerprint ~ '^[0-9a-f]{64}$'),
  constraint broker_activities_fingerprint_version_check check (
    fingerprint_version = btrim(fingerprint_version) and fingerprint_version <> ''
  ),
  constraint broker_activities_type_check check (activity_type = btrim(activity_type) and activity_type <> ''),
  constraint broker_activities_quantity_check check (
    quantity is null or quantity::text not in ('NaN', 'Infinity', '-Infinity')
  ),
  constraint broker_activities_price_check check (
    price is null or (price::text not in ('NaN', 'Infinity', '-Infinity') and price > 0)
  ),
  constraint broker_activities_gross_check check (
    gross_amount is null or gross_amount::text not in ('NaN', 'Infinity', '-Infinity')
  ),
  constraint broker_activities_net_check check (
    net_amount is null or net_amount::text not in ('NaN', 'Infinity', '-Infinity')
  ),
  constraint broker_activities_currency_check check (
    currency is null or currency ~ '^[A-Z]{3}$'
  ),
  constraint broker_activities_account_fingerprint_key unique (account_id, fingerprint)
);

create unique index broker_activities_external_activity_key
  on public.broker_activities (account_id, external_activity_id)
  where external_activity_id is not null;

create index broker_activities_account_occurred_idx
  on public.broker_activities (account_id, occurred_at desc, recorded_at desc, id);

create index broker_connections_user_id_idx on public.broker_connections (user_id);
create index broker_accounts_user_id_idx on public.broker_accounts (user_id);
create index broker_positions_user_id_account_idx on public.broker_positions (user_id, account_id);
create index broker_cash_balances_user_id_account_idx on public.broker_cash_balances (user_id, account_id);
create index broker_activities_user_id_account_idx on public.broker_activities (user_id, account_id);

alter table public.broker_providers enable row level security;
alter table public.brokerage_institutions enable row level security;
alter table public.broker_connections enable row level security;
alter table public.broker_accounts enable row level security;
alter table public.broker_positions enable row level security;
alter table public.broker_cash_balances enable row level security;
alter table public.broker_activities enable row level security;

create policy broker_providers_authenticated_read
  on public.broker_providers for select to authenticated using (true);
create policy brokerage_institutions_authenticated_read
  on public.brokerage_institutions for select to authenticated using (true);
create policy broker_connections_owner_read
  on public.broker_connections for select to authenticated
  using ((select auth.uid()) = user_id);
create policy broker_accounts_owner_read
  on public.broker_accounts for select to authenticated
  using ((select auth.uid()) = user_id);
create policy broker_positions_owner_read
  on public.broker_positions for select to authenticated
  using ((select auth.uid()) = user_id);
create policy broker_cash_balances_owner_read
  on public.broker_cash_balances for select to authenticated
  using ((select auth.uid()) = user_id);
create policy broker_activities_owner_read
  on public.broker_activities for select to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.broker_providers from public, anon, authenticated;
revoke all on table public.brokerage_institutions from public, anon, authenticated;
revoke all on table public.broker_connections from public, anon, authenticated;
revoke all on table public.broker_accounts from public, anon, authenticated;
revoke all on table public.broker_positions from public, anon, authenticated;
revoke all on table public.broker_cash_balances from public, anon, authenticated;
revoke all on table public.broker_activities from public, anon, authenticated;

grant select on table public.broker_providers to authenticated;
grant select on table public.brokerage_institutions to authenticated;
grant select on table public.broker_connections to authenticated;
grant select on table public.broker_accounts to authenticated;
grant select on table public.broker_positions to authenticated;
grant select on table public.broker_cash_balances to authenticated;
grant select on table public.broker_activities to authenticated;

grant all on table public.broker_providers to service_role;
grant all on table public.brokerage_institutions to service_role;
grant all on table public.broker_connections to service_role;
grant all on table public.broker_accounts to service_role;
grant all on table public.broker_positions to service_role;
grant all on table public.broker_cash_balances to service_role;
grant all on table public.broker_activities to service_role;

comment on table public.broker_connections is
  'Provider authorization lifecycle. Disconnecting changes status; it does not delete normalized account history.';
comment on table public.broker_positions is
  'Provider-reported account position state. Price facts are account evidence and are not global StockGPT market prices.';
comment on table public.broker_activities is
  'Provider-neutral durable activities with provider ID and deterministic fingerprint idempotency boundaries.';
