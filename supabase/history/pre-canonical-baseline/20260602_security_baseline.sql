-- 20260602_security_baseline.sql
-- StockGPT security baseline
-- Apply in Supabase SQL editor first, then commit this file to GitHub.

begin;

-- 1) Helper function: active subscriber check
create or replace function public.is_active_subscriber(user_uuid uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = user_uuid
      and lower(coalesce(p.subscription_status, '')) in (
        'basic',
        'core',
        'premium',
        'executive',
        'max',
        'alpha',
        'trialing',
        'active'
      )
  );
$$;

revoke all on function public.is_active_subscriber(uuid) from public;
grant execute on function public.is_active_subscriber(uuid) to authenticated;

-- 2) Fix function search paths
alter function public.handle_new_user() set search_path = public;
alter function public.set_previous_rank_before_stock_rankings_update() set search_path = public;
alter function public.sync_profile_email_from_auth() set search_path = public;

-- These trigger/helper functions should not be callable from the public API.
revoke execute on function public.handle_new_user() from anon, authenticated;
revoke execute on function public.sync_profile_email_from_auth() from anon, authenticated;
revoke execute on function public.set_previous_rank_before_stock_rankings_update() from anon, authenticated;

-- 3) Enable RLS everywhere public
alter table public.profiles enable row level security;
alter table public.stock_rankings enable row level security;
alter table public.news_articles enable row level security;
alter table public.pro_waitlist enable row level security;
alter table public.alpha_waitlist enable row level security;
alter table public.premium_waitlist enable row level security;
alter table public.affiliate_applications enable row level security;
alter table public.stock_factor_diagnostics_history enable row level security;
alter table public.stock_factor_diagnostics enable row level security;
alter table public.watchlist enable row level security;
alter table public.user_portfolios enable row level security;
alter table public.portfolio_holdings enable row level security;
alter table public.notification_dismissals enable row level security;
alter table public.executive_waitlist enable row level security;
alter table public.ask_stockgpt_messages enable row level security;
alter table public.stock_rank_snapshots enable row level security;

-- 4) Drop older policies safely where names may overlap
drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;
drop policy if exists watchlist_select_own on public.watchlist;
drop policy if exists watchlist_insert_own on public.watchlist;
drop policy if exists watchlist_update_own on public.watchlist;
drop policy if exists watchlist_delete_own on public.watchlist;
drop policy if exists user_portfolios_own_all on public.user_portfolios;
drop policy if exists portfolio_holdings_own_all on public.portfolio_holdings;
drop policy if exists notification_dismissals_own_all on public.notification_dismissals;
drop policy if exists executive_waitlist_own_all on public.executive_waitlist;
drop policy if exists ask_stockgpt_messages_own_all on public.ask_stockgpt_messages;
drop policy if exists stock_rankings_subscriber_select on public.stock_rankings;
drop policy if exists news_articles_subscriber_select on public.news_articles;
drop policy if exists stock_factor_diagnostics_subscriber_select on public.stock_factor_diagnostics;
drop policy if exists stock_rank_snapshots_subscriber_select on public.stock_rank_snapshots;

-- 5) Private user profile policies
create policy profiles_select_own
on public.profiles
for select
to authenticated
using (id = auth.uid());

create policy profiles_update_own
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- 6) Watchlist policies
create policy watchlist_select_own
on public.watchlist
for select
to authenticated
using (user_id = auth.uid());

create policy watchlist_insert_own
on public.watchlist
for insert
to authenticated
with check (user_id = auth.uid());

create policy watchlist_update_own
on public.watchlist
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy watchlist_delete_own
on public.watchlist
for delete
to authenticated
using (user_id = auth.uid());

-- 7) Portfolio policies
create policy user_portfolios_own_all
on public.user_portfolios
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy portfolio_holdings_own_all
on public.portfolio_holdings
for all
to authenticated
using (
  exists (
    select 1
    from public.user_portfolios p
    where p.id = portfolio_holdings.portfolio_id
      and p.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.user_portfolios p
    where p.id = portfolio_holdings.portfolio_id
      and p.user_id = auth.uid()
  )
);

-- 8) Notification/chat policies
create policy notification_dismissals_own_all
on public.notification_dismissals
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy executive_waitlist_own_all
on public.executive_waitlist
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy ask_stockgpt_messages_own_all
on public.ask_stockgpt_messages
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- 9) Paid subscriber-only market data.
-- This prevents free/anon users from using the public anon key to pull the database directly.
create policy stock_rankings_subscriber_select
on public.stock_rankings
for select
to authenticated
using (public.is_active_subscriber(auth.uid()));

create policy news_articles_subscriber_select
on public.news_articles
for select
to authenticated
using (public.is_active_subscriber(auth.uid()));

create policy stock_factor_diagnostics_subscriber_select
on public.stock_factor_diagnostics
for select
to authenticated
using (public.is_active_subscriber(auth.uid()));

create policy stock_rank_snapshots_subscriber_select
on public.stock_rank_snapshots
for select
to authenticated
using (public.is_active_subscriber(auth.uid()));

-- 10) No direct client access to waitlist/application tables.
-- Server routes use SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS.
-- This means anonymous users cannot use the exposed anon key to dump these tables.
-- No select/insert policies are intentionally created for:
-- pro_waitlist, alpha_waitlist, premium_waitlist, affiliate_applications,
-- stock_factor_diagnostics_history.

-- 11) Data validity constraints
alter table public.profiles
drop constraint if exists profiles_min_age_18;

alter table public.profiles
add constraint profiles_min_age_18
check (
  date_of_birth is null
  or date_of_birth <= (current_date - interval '18 years')
);

alter table public.profiles
drop constraint if exists profiles_first_name_len;

alter table public.profiles
add constraint profiles_first_name_len
check (first_name is null or char_length(first_name) <= 60);

alter table public.profiles
drop constraint if exists profiles_last_name_len;

alter table public.profiles
add constraint profiles_last_name_len
check (last_name is null or char_length(last_name) <= 60);

alter table public.watchlist
drop constraint if exists watchlist_ticker_format;

alter table public.watchlist
add constraint watchlist_ticker_format
check (ticker ~ '^[A-Z][A-Z0-9.\-]{0,11}$');

alter table public.portfolio_holdings
drop constraint if exists portfolio_holdings_ticker_format;

alter table public.portfolio_holdings
add constraint portfolio_holdings_ticker_format
check (ticker ~ '^[A-Z][A-Z0-9.\-]{0,11}$');

-- 12) Rate-limit table
create table if not exists public.security_rate_limits (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  action text not null,
  success boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists security_rate_limits_key_action_created_idx
on public.security_rate_limits (key, action, created_at desc);

alter table public.security_rate_limits enable row level security;

-- No client policies. Server-only via service role.

-- 13) Security audit table
create table if not exists public.security_audit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null,
  event_type text not null,
  ip_hash text null,
  user_agent_hash text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists security_audit_events_type_created_idx
on public.security_audit_events (event_type, created_at desc);

alter table public.security_audit_events enable row level security;

-- No client policies. Server-only via service role.

-- 14) Delete existing under-13 profile rows from profiles only.
-- This does NOT delete auth.users automatically. Check the SELECT below first manually before uncommenting deletes.
-- select id, email, date_of_birth from public.profiles where date_of_birth > (current_date - interval '13 years');

commit;
