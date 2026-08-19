-- SQUASHED CURRENT-STATE BASELINE.
--
-- This is not the original SQL historically executed in production under this
-- timestamp. The original migration bodies are unavailable. The preceding
-- no-op files align local timestamps with the verified production migration
-- history; this final migration reconstructs the verified current structure
-- for deterministic local resets. It contains no production data.

begin;

-- Extensions. Supabase now installs the current supported extension version,
-- so version clauses are intentionally omitted. pg_trgm remains in public to
-- reproduce production; moving it is later security-cleanup work.
create schema if not exists extensions;
create schema if not exists vault;
create extension if not exists pg_trgm with schema public;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists pg_stat_statements with schema extensions;
create extension if not exists supabase_vault with schema vault;

-- Explicit non-identity sequences.
create sequence public.alpha_waitlist_id_seq
  as bigint start with 1 increment by 1 minvalue 1 maxvalue 9223372036854775807
  no cycle cache 1;

create sequence public.premium_waitlist_id_seq
  as bigint start with 1 increment by 1 minvalue 1 maxvalue 9223372036854775807
  no cycle cache 1;

create sequence public.stock_factor_diagnostics_history_id_seq
  as bigint start with 1 increment by 1 minvalue 1 maxvalue 9223372036854775807
  no cycle cache 1;

-- Parent and independent tables.
create table public.profiles (
  id uuid not null,
  email text,
  subscription_status text default 'free',
  stripe_customer_id text,
  created_at timestamptz default now(),
  full_name text,
  date_of_birth date,
  phone text,
  email_news_digests boolean not null default false,
  email_digest_last_sent_on date,
  email_digest_last_sent_at timestamptz,
  first_name text,
  last_name text,
  marketing_consent boolean not null default false,
  email_consent boolean not null default false,
  terms_accepted boolean not null default false,
  newsletter_digest_consent boolean not null default false,
  consent_captured_at timestamptz,
  email_portfolio_alerts boolean not null default true,
  email_watchlist_alerts boolean not null default true,
  preferred_currency text not null default 'USD',
  constraint profiles_pkey primary key (id),
  constraint profiles_id_fkey foreign key (id) references auth.users(id) on delete cascade,
  constraint profiles_first_name_len check (first_name is null or char_length(first_name) <= 60),
  constraint profiles_last_name_len check (last_name is null or char_length(last_name) <= 60),
  constraint profiles_min_age_18 check (date_of_birth is null or date_of_birth <= (current_date - '18 years'::interval)),
  constraint profiles_preferred_currency_check check (preferred_currency = any (array['USD'::text, 'GBP'::text, 'EUR'::text, 'CHF'::text]))
);

create table public.affiliate_applications (
  id uuid not null default gen_random_uuid(),
  full_name text not null,
  email text not null,
  platform text not null,
  audience_size text,
  audience text,
  message text,
  status text not null default 'new',
  source text not null default 'affiliate_page',
  created_at timestamptz not null default now(),
  constraint affiliate_applications_pkey primary key (id)
);

create table public.alpha_waitlist (
  id bigint not null default nextval('public.alpha_waitlist_id_seq'::regclass),
  user_id uuid,
  email text not null,
  source text not null default 'pricing_page',
  created_at timestamptz not null default now(),
  constraint alpha_waitlist_pkey primary key (id),
  constraint alpha_waitlist_user_id_fkey foreign key (user_id) references auth.users(id) on delete set null
);

create table public.ask_stockgpt_messages (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  role text not null,
  content text not null,
  created_at timestamptz not null default now(),
  constraint ask_stockgpt_messages_pkey primary key (id),
  constraint ask_stockgpt_messages_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade,
  constraint ask_stockgpt_messages_role_check check (role = any (array['user'::text, 'assistant'::text])),
  constraint ask_stockgpt_messages_content_check check (char_length(content) <= 6000)
);

create table public.executive_waitlist (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  email text,
  status text not null default 'joined',
  joined_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint executive_waitlist_pkey primary key (id),
  constraint executive_waitlist_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade,
  constraint executive_waitlist_user_id_key unique (user_id)
);

create table public.market_snapshots (
  ticker text not null,
  current_price numeric,
  change_pct_1d numeric,
  source text not null default 'yahoo',
  updated_at timestamptz not null default now(),
  constraint market_snapshots_pkey primary key (ticker)
);

create table public.news_articles (
  id bigint generated always as identity not null,
  title text,
  summary text,
  source text,
  url text,
  image_url text,
  affected_tickers text[],
  impact text,
  impact_reason text,
  published_at timestamptz,
  created_at timestamptz default now(),
  constraint news_articles_pkey primary key (id)
);

create table public.notification_dismissals (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  alert_key text not null,
  dismissed_at timestamptz not null default now(),
  constraint notification_dismissals_pkey primary key (id),
  constraint notification_dismissals_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade,
  constraint notification_dismissals_user_id_alert_key_key unique (user_id, alert_key)
);

create table public.premium_waitlist (
  id bigint not null default nextval('public.premium_waitlist_id_seq'::regclass),
  user_id uuid,
  email text not null,
  source text not null default 'pricing_page',
  created_at timestamptz not null default now(),
  constraint premium_waitlist_pkey primary key (id),
  constraint premium_waitlist_email_key unique (email),
  constraint premium_waitlist_user_id_fkey foreign key (user_id) references auth.users(id) on delete set null
);

create table public.pro_waitlist (
  id bigint generated always as identity not null,
  email text not null,
  created_at timestamptz default now(),
  name text,
  constraint pro_waitlist_pkey primary key (id)
);

create table public.security_audit_events (
  id uuid not null default gen_random_uuid(),
  user_id uuid,
  event_type text not null,
  ip_hash text,
  user_agent_hash text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint security_audit_events_pkey primary key (id)
);

create table public.security_rate_limits (
  id uuid not null default gen_random_uuid(),
  key text not null,
  action text not null,
  success boolean not null default false,
  created_at timestamptz not null default now(),
  constraint security_rate_limits_pkey primary key (id)
);

create table public.stock_chart_cache (
  ticker text not null,
  range text not null,
  points jsonb not null,
  source text not null default 'yahoo',
  fetched_at timestamptz not null default now(),
  constraint stock_chart_cache_pkey primary key (ticker, range)
);

create table public.stock_factor_diagnostics (
  ticker text not null,
  updated_at timestamptz,
  raw_score numeric,
  current_score numeric,
  smoothed_score numeric,
  previous_score numeric,
  factor_coverage numeric,
  quality_score numeric,
  growth_score numeric,
  value_score numeric,
  momentum_score numeric,
  risk_score numeric,
  income_score numeric,
  quality_change numeric,
  growth_change numeric,
  value_change numeric,
  momentum_change numeric,
  risk_change numeric,
  income_change numeric,
  factor_contributions jsonb,
  top_negative_factors jsonb,
  top_positive_factors jsonb,
  run_id text,
  previous_factor_coverage numeric,
  factor_coverage_change numeric,
  missing_factors jsonb,
  diagnosis text,
  constraint stock_factor_diagnostics_pkey primary key (ticker)
);

create table public.stock_factor_diagnostics_history (
  id bigint not null default nextval('public.stock_factor_diagnostics_history_id_seq'::regclass),
  ticker text not null,
  run_id text,
  updated_at timestamptz,
  raw_score numeric,
  current_score numeric,
  smoothed_score numeric,
  previous_score numeric,
  factor_coverage numeric,
  previous_factor_coverage numeric,
  factor_coverage_change numeric,
  quality_score numeric,
  growth_score numeric,
  value_score numeric,
  momentum_score numeric,
  risk_score numeric,
  income_score numeric,
  quality_change numeric,
  growth_change numeric,
  value_change numeric,
  momentum_change numeric,
  risk_change numeric,
  income_change numeric,
  factor_contributions jsonb,
  top_negative_factors jsonb,
  top_positive_factors jsonb,
  missing_factors jsonb,
  diagnosis text,
  constraint stock_factor_diagnostics_history_pkey primary key (id)
);

create table public.stock_rankings (
  id bigint generated always as identity not null,
  rank integer,
  ticker text,
  company text,
  sector text,
  price numeric,
  score numeric,
  momentum numeric,
  pe numeric,
  risk numeric,
  updated_at timestamptz default now(),
  last_price_update timestamptz,
  last_ranking_update timestamptz,
  last_fundamentals_update timestamptz,
  previous_rank integer,
  constraint stock_rankings_pkey primary key (id)
);

create table public.stock_rank_snapshots (
  id bigint generated always as identity not null,
  snapshot_at timestamptz not null,
  ticker text not null,
  rank integer,
  score numeric,
  price numeric,
  company text,
  sector text,
  created_at timestamptz not null default now(),
  constraint stock_rank_snapshots_pkey primary key (id),
  constraint stock_rank_snapshots_snapshot_at_ticker_key unique (snapshot_at, ticker)
);

create table public.support_feedback (
  id uuid not null default gen_random_uuid(),
  user_id uuid,
  email text,
  category text not null,
  message text not null,
  page_path text,
  user_agent text,
  status text not null default 'new',
  created_at timestamptz not null default now(),
  constraint support_feedback_pkey primary key (id),
  constraint support_feedback_user_id_fkey foreign key (user_id) references auth.users(id) on delete set null,
  constraint support_feedback_category_check check (category = any (array['wrong_data'::text, 'confusing_ai_answer'::text, 'billing_issue'::text, 'bug'::text, 'feature_request'::text, 'other'::text]))
);

create table public.technical_level_cache (
  ticker text not null,
  current_price numeric,
  levels jsonb not null,
  fetched_at timestamptz not null default now(),
  constraint technical_level_cache_pkey primary key (ticker)
);

create table public.user_notification_summaries (
  user_id uuid not null,
  unread_count integer not null default 0,
  updated_at timestamptz not null default now(),
  constraint user_notification_summaries_pkey primary key (user_id)
);

create table public.user_portfolios (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  name text not null default 'My Portfolio',
  risk_tolerance text,
  time_horizon text,
  investment_amount numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cash_balance numeric not null default 0,
  cash_deposited_total numeric not null default 0,
  currency text not null default 'USD',
  archived_at timestamptz,
  objective text,
  constraint user_portfolios_pkey primary key (id),
  constraint user_portfolios_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade,
  constraint user_portfolios_objective_check check (objective is null or objective = any (array['growth'::text, 'income'::text, 'balanced'::text, 'capital_preservation'::text, 'watchlist'::text]))
);

create table public.watchlist (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  ticker text not null,
  created_at timestamptz not null default now(),
  constraint watchlist_pkey primary key (id),
  constraint watchlist_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade,
  constraint watchlist_user_id_ticker_key unique (user_id, ticker),
  constraint watchlist_ticker_format check (ticker ~ '^[A-Z][A-Z0-9.\-]{0,11}$'::text)
);

-- Portfolio child tables.
create table public.portfolio_holdings (
  id uuid not null default gen_random_uuid(),
  portfolio_id uuid not null,
  ticker text not null,
  entry_price numeric,
  allocation_pct numeric,
  score_at_entry numeric,
  rank_at_entry integer,
  added_at timestamptz not null default now(),
  last_reviewed_at timestamptz not null default now(),
  shares numeric,
  purchase_date date,
  source text not null default 'manual',
  notes text,
  risk_level_at_entry numeric,
  target_level_at_entry numeric,
  constraint portfolio_holdings_pkey primary key (id),
  constraint portfolio_holdings_portfolio_id_fkey foreign key (portfolio_id) references public.user_portfolios(id) on delete cascade,
  constraint portfolio_holdings_portfolio_id_ticker_key unique (portfolio_id, ticker),
  constraint portfolio_holdings_ticker_format check (ticker ~ '^[A-Z][A-Z0-9.\-]{0,11}$'::text)
);

create table public.portfolio_page_snapshots (
  portfolio_id uuid not null,
  owner_id uuid not null,
  input_hash text not null,
  snapshot jsonb not null,
  updated_at timestamptz not null default now(),
  constraint portfolio_page_snapshots_pkey primary key (portfolio_id)
);

create table public.portfolio_snapshots (
  id uuid not null default gen_random_uuid(),
  portfolio_id uuid not null,
  user_id uuid not null,
  snapshot_at timestamptz not null default now(),
  value numeric(14,2) not null,
  cash numeric(14,2) not null default 0,
  basis numeric(14,2) not null default 0,
  pnl numeric(14,2) not null default 0,
  pnl_pct numeric(12,4) not null default 0,
  source text not null default 'system',
  created_at timestamptz not null default now(),
  constraint portfolio_snapshots_pkey primary key (id),
  constraint portfolio_snapshots_portfolio_id_fkey foreign key (portfolio_id) references public.user_portfolios(id) on delete cascade,
  constraint portfolio_snapshots_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade,
  constraint portfolio_snapshots_portfolio_id_snapshot_at_key unique (portfolio_id, snapshot_at),
  constraint portfolio_snapshots_value_check check (value >= 0::numeric)
);

create table public.portfolio_transactions (
  id uuid not null default gen_random_uuid(),
  portfolio_id uuid not null,
  user_id uuid not null,
  ticker text,
  type text not null,
  shares numeric,
  price numeric,
  amount numeric not null default 0,
  realised_pnl numeric,
  currency text not null default 'USD',
  notes text,
  created_at timestamptz not null default now(),
  constraint portfolio_transactions_pkey primary key (id),
  constraint portfolio_transactions_portfolio_id_fkey foreign key (portfolio_id) references public.user_portfolios(id) on delete cascade,
  constraint portfolio_transactions_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade,
  constraint portfolio_transactions_type_check check (type = any (array['deposit'::text, 'withdrawal'::text, 'buy'::text, 'sell'::text, 'import'::text, 'log_existing'::text, 'adjustment'::text, 'cash_adjustment'::text]))
);

alter sequence public.alpha_waitlist_id_seq owned by public.alpha_waitlist.id;
alter sequence public.premium_waitlist_id_seq owned by public.premium_waitlist.id;
alter sequence public.stock_factor_diagnostics_history_id_seq owned by public.stock_factor_diagnostics_history.id;

-- Custom functions reconstructed verbatim from verified production metadata.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  insert into public.profiles (
    id,email,full_name,date_of_birth,phone,subscription_status
  )
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    nullif(new.raw_user_meta_data->>'date_of_birth', '')::date,
    new.raw_user_meta_data->>'phone',
    'none'
  )
  on conflict (id) do nothing;
  return new;
end;
$function$;

create or replace function public.is_active_subscriber(user_uuid uuid)
returns boolean
language sql
set search_path to 'public'
as $function$
  select exists (
    select 1
    from public.profiles p
    where p.id = user_uuid
      and p.id = auth.uid()
      and lower(coalesce(p.subscription_status, '')) in (
        'basic','core','premium','executive','max','alpha','trialing','active'
      )
  );
$function$;

create or replace function public.set_previous_rank_before_stock_rankings_update()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  new.previous_rank := old.rank;
  return new;
end;
$function$;

create or replace function public.sync_profile_email_from_auth()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  update public.profiles
  set email = new.email
  where id = new.id;
  return new;
end;
$function$;

-- Non-constraint indexes, including verified production redundancies.
create index affiliate_applications_created_at_idx on public.affiliate_applications using btree (created_at desc);
create index affiliate_applications_email_idx on public.affiliate_applications using btree (email);
create unique index alpha_waitlist_email_key on public.alpha_waitlist using btree (lower(email));
create index alpha_waitlist_user_id_idx on public.alpha_waitlist using btree (user_id);
create index alpha_waitlist_user_idx on public.alpha_waitlist using btree (user_id);
create index ask_stockgpt_messages_user_created_idx on public.ask_stockgpt_messages using btree (user_id, created_at desc);
create index market_snapshots_updated_at_idx on public.market_snapshots using btree (updated_at desc);
create index news_articles_affected_tickers_gin_idx on public.news_articles using gin (affected_tickers);
create index news_articles_published_at_idx on public.news_articles using btree (published_at desc);
create index news_published_idx on public.news_articles using btree (published_at);
create index news_tickers_gin_idx on public.news_articles using gin (affected_tickers);
create index notification_dismissals_user_alert_idx on public.notification_dismissals using btree (user_id, alert_key);
create index notification_dismissals_user_idx on public.notification_dismissals using btree (user_id);
create index portfolio_holdings_portfolio_id_ticker_idx on public.portfolio_holdings using btree (portfolio_id, ticker);
create index portfolio_holdings_portfolio_idx on public.portfolio_holdings using btree (portfolio_id);
create index portfolio_holdings_portfolio_ticker_idx on public.portfolio_holdings using btree (portfolio_id, ticker);
create index idx_portfolio_page_snapshots_portfolio_owner_updated on public.portfolio_page_snapshots using btree (portfolio_id, owner_id, updated_at desc);
create index portfolio_page_snapshots_owner_updated_idx on public.portfolio_page_snapshots using btree (owner_id, updated_at desc);
create index idx_portfolio_snapshots_portfolio_source_at on public.portfolio_snapshots using btree (portfolio_id, source, snapshot_at);
create index idx_portfolio_snapshots_user_portfolio_source_at on public.portfolio_snapshots using btree (user_id, portfolio_id, source, snapshot_at);
create index portfolio_snapshots_portfolio_time_idx on public.portfolio_snapshots using btree (portfolio_id, snapshot_at desc);
create index portfolio_snapshots_user_portfolio_idx on public.portfolio_snapshots using btree (user_id, portfolio_id);
create index idx_portfolio_transactions_portfolio_created_at on public.portfolio_transactions using btree (portfolio_id, created_at);
create index portfolio_transactions_portfolio_id_created_at_idx on public.portfolio_transactions using btree (portfolio_id, created_at desc);
create index portfolio_transactions_user_id_created_at_idx on public.portfolio_transactions using btree (user_id, created_at desc);
create index premium_waitlist_user_id_idx on public.premium_waitlist using btree (user_id);
create index premium_waitlist_user_idx on public.premium_waitlist using btree (user_id);
create index security_audit_events_type_created_idx on public.security_audit_events using btree (event_type, created_at desc);
create index security_rate_limits_key_action_created_idx on public.security_rate_limits using btree (key, action, created_at desc);
create index stock_chart_cache_fetched_at_idx on public.stock_chart_cache using btree (fetched_at desc);
create index stock_factor_diagnostics_ticker_idx on public.stock_factor_diagnostics using btree (ticker);
create index stock_factor_diagnostics_history_ticker_updated_idx on public.stock_factor_diagnostics_history using btree (ticker, updated_at desc);
create index stock_rank_snapshots_rank_snapshot_at_idx on public.stock_rank_snapshots using btree (rank, snapshot_at desc);
create index stock_rank_snapshots_snapshot_at_idx on public.stock_rank_snapshots using btree (snapshot_at desc);
create index stock_rank_snapshots_ticker_snapshot_at_idx on public.stock_rank_snapshots using btree (ticker, snapshot_at desc);
create index sr_score_index on public.stock_rankings using btree (score);
create index sr_sector_rank_idx on public.stock_rankings using btree (sector, rank);
create index stock_rankings_company_trgm_idx on public.stock_rankings using gin (company gin_trgm_ops);
create index stock_rankings_rank_idx on public.stock_rankings using btree (rank);
create index stock_rankings_score_idx on public.stock_rankings using btree (score desc);
create index stock_rankings_sector_rank_idx on public.stock_rankings using btree (sector, rank);
create index stock_rankings_sector_trgm_idx on public.stock_rankings using gin (sector gin_trgm_ops);
create index stock_rankings_ticker_idx on public.stock_rankings using btree (ticker);
create unique index stock_rankings_ticker_key on public.stock_rankings using btree (ticker);
create index stock_rankings_ticker_trgm_idx on public.stock_rankings using gin (ticker gin_trgm_ops);
create index support_feedback_status_created_idx on public.support_feedback using btree (status, created_at desc);
create index support_feedback_user_created_idx on public.support_feedback using btree (user_id, created_at desc);
create index technical_level_cache_fetched_at_idx on public.technical_level_cache using btree (fetched_at desc);
create index user_notification_summaries_updated_idx on public.user_notification_summaries using btree (updated_at desc);
create index user_portfolios_active_user_idx on public.user_portfolios using btree (user_id, created_at) where archived_at is null;
create index user_portfolios_user_id_created_at_idx on public.user_portfolios using btree (user_id, created_at desc);
create index user_portfolios_user_idx on public.user_portfolios using btree (user_id);
create index watchlist_user_id_idx on public.watchlist using btree (user_id);

-- RLS is enabled on every application table. FORCE RLS is intentionally absent.
alter table public.affiliate_applications enable row level security;
alter table public.alpha_waitlist enable row level security;
alter table public.ask_stockgpt_messages enable row level security;
alter table public.executive_waitlist enable row level security;
alter table public.market_snapshots enable row level security;
alter table public.news_articles enable row level security;
alter table public.notification_dismissals enable row level security;
alter table public.portfolio_holdings enable row level security;
alter table public.portfolio_page_snapshots enable row level security;
alter table public.portfolio_snapshots enable row level security;
alter table public.portfolio_transactions enable row level security;
alter table public.premium_waitlist enable row level security;
alter table public.pro_waitlist enable row level security;
alter table public.profiles enable row level security;
alter table public.security_audit_events enable row level security;
alter table public.security_rate_limits enable row level security;
alter table public.stock_chart_cache enable row level security;
alter table public.stock_factor_diagnostics enable row level security;
alter table public.stock_factor_diagnostics_history enable row level security;
alter table public.stock_rank_snapshots enable row level security;
alter table public.stock_rankings enable row level security;
alter table public.support_feedback enable row level security;
alter table public.technical_level_cache enable row level security;
alter table public.user_notification_summaries enable row level security;
alter table public.user_portfolios enable row level security;
alter table public.watchlist enable row level security;

-- Exact current production policy inventory, including overlapping policies.
create policy affiliate_applications_no_client_access on public.affiliate_applications
  as permissive for all to anon, authenticated using (false) with check (false);
create policy alpha_waitlist_no_client_access on public.alpha_waitlist
  as permissive for all to anon, authenticated using (false) with check (false);

create policy "Users can create their own Ask StockGPT messages" on public.ask_stockgpt_messages
  as permissive for insert to public with check ((select auth.uid()) = user_id);
create policy "Users can delete their own Ask StockGPT messages" on public.ask_stockgpt_messages
  as permissive for delete to public using ((select auth.uid()) = user_id);
create policy "Users can read their own Ask StockGPT messages" on public.ask_stockgpt_messages
  as permissive for select to public using ((select auth.uid()) = user_id);
create policy ask_stockgpt_messages_own_all on public.ask_stockgpt_messages
  as permissive for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "Users can join the executive waitlist" on public.executive_waitlist
  as permissive for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update their own executive waitlist entry" on public.executive_waitlist
  as permissive for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can view their own executive waitlist entry" on public.executive_waitlist
  as permissive for select to authenticated using ((select auth.uid()) = user_id);
create policy executive_waitlist_own_all on public.executive_waitlist
  as permissive for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "Public can read market snapshots" on public.market_snapshots
  as permissive for select to anon, authenticated using (true);
create policy news_articles_subscriber_select on public.news_articles
  as permissive for select to authenticated using (is_active_subscriber((select auth.uid())));

create policy "Users can delete own dismissals" on public.notification_dismissals
  as permissive for delete to public using ((select auth.uid()) = user_id);
create policy "Users can insert own dismissals" on public.notification_dismissals
  as permissive for insert to public with check ((select auth.uid()) = user_id);
create policy "Users can view own dismissals" on public.notification_dismissals
  as permissive for select to public using ((select auth.uid()) = user_id);
create policy notification_dismissals_own_all on public.notification_dismissals
  as permissive for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "Users can delete own holdings" on public.portfolio_holdings
  as permissive for delete to public using (portfolio_id in (select user_portfolios.id from public.user_portfolios where user_portfolios.user_id = (select auth.uid())));
create policy "Users can insert own holdings" on public.portfolio_holdings
  as permissive for insert to public with check (portfolio_id in (select user_portfolios.id from public.user_portfolios where user_portfolios.user_id = (select auth.uid())));
create policy "Users can update own holdings" on public.portfolio_holdings
  as permissive for update to public using (portfolio_id in (select user_portfolios.id from public.user_portfolios where user_portfolios.user_id = (select auth.uid())));
create policy "Users can view own holdings" on public.portfolio_holdings
  as permissive for select to public using (portfolio_id in (select user_portfolios.id from public.user_portfolios where user_portfolios.user_id = (select auth.uid())));
create policy portfolio_holdings_own_all on public.portfolio_holdings
  as permissive for all to authenticated
  using (exists (select 1 from public.user_portfolios p where p.id = portfolio_holdings.portfolio_id and p.user_id = (select auth.uid())))
  with check (exists (select 1 from public.user_portfolios p where p.id = portfolio_holdings.portfolio_id and p.user_id = (select auth.uid())));

create policy "Users can read own portfolio page snapshots" on public.portfolio_page_snapshots
  as permissive for select to authenticated using ((select auth.uid()) = owner_id);

create policy portfolio_snapshots_insert_own on public.portfolio_snapshots
  as permissive for insert to public with check (auth.uid() = user_id);
create policy portfolio_snapshots_select_own on public.portfolio_snapshots
  as permissive for select to public using (auth.uid() = user_id);
create policy portfolio_snapshots_update_own on public.portfolio_snapshots
  as permissive for update to public using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users can delete their own portfolio transactions" on public.portfolio_transactions
  as permissive for delete to authenticated using (user_id = (select auth.uid()));
create policy "Users can insert their own portfolio transactions" on public.portfolio_transactions
  as permissive for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.user_portfolios p where p.id = portfolio_transactions.portfolio_id and p.user_id = (select auth.uid())));
create policy "Users can read their own portfolio transactions" on public.portfolio_transactions
  as permissive for select to authenticated using (user_id = (select auth.uid()));
create policy "Users can update their own portfolio transactions" on public.portfolio_transactions
  as permissive for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy premium_waitlist_no_client_access on public.premium_waitlist
  as permissive for all to anon, authenticated using (false) with check (false);
create policy pro_waitlist_no_client_access on public.pro_waitlist
  as permissive for all to anon, authenticated using (false) with check (false);
create policy profiles_select_own on public.profiles
  as permissive for select to authenticated using (id = (select auth.uid()));
create policy profiles_update_own on public.profiles
  as permissive for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy security_audit_events_no_client_access on public.security_audit_events
  as permissive for all to anon, authenticated using (false) with check (false);
create policy security_rate_limits_no_client_access on public.security_rate_limits
  as permissive for all to anon, authenticated using (false) with check (false);
create policy "Public can read stock chart cache" on public.stock_chart_cache
  as permissive for select to anon, authenticated using (true);
create policy stock_factor_diagnostics_subscriber_select on public.stock_factor_diagnostics
  as permissive for select to authenticated using (is_active_subscriber((select auth.uid())));
create policy stock_factor_diagnostics_history_no_client_access on public.stock_factor_diagnostics_history
  as permissive for all to anon, authenticated using (false) with check (false);
create policy "Allow public read stock rank snapshots" on public.stock_rank_snapshots
  as permissive for select to anon, authenticated using (true);
create policy stock_rank_snapshots_subscriber_select on public.stock_rank_snapshots
  as permissive for select to authenticated using (is_active_subscriber((select auth.uid())));
create policy stock_rankings_subscriber_select on public.stock_rankings
  as permissive for select to authenticated using (is_active_subscriber((select auth.uid())));
create policy "Users can insert own feedback" on public.support_feedback
  as permissive for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can read own feedback" on public.support_feedback
  as permissive for select to authenticated using ((select auth.uid()) = user_id);
create policy "Public can read technical level cache" on public.technical_level_cache
  as permissive for select to anon, authenticated using (true);
create policy "Users can insert own notification summary" on public.user_notification_summaries
  as permissive for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can read own notification summary" on public.user_notification_summaries
  as permissive for select to authenticated using ((select auth.uid()) = user_id);

create policy "Users can delete own portfolios" on public.user_portfolios
  as permissive for delete to public using ((select auth.uid()) = user_id);
create policy "Users can insert own portfolios" on public.user_portfolios
  as permissive for insert to public with check ((select auth.uid()) = user_id);
create policy "Users can update own portfolios" on public.user_portfolios
  as permissive for update to public using ((select auth.uid()) = user_id);
create policy "Users can view own portfolios" on public.user_portfolios
  as permissive for select to public using ((select auth.uid()) = user_id);
create policy user_portfolios_own_all on public.user_portfolios
  as permissive for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "Users can delete own watchlist" on public.watchlist
  as permissive for delete to public using ((select auth.uid()) = user_id);
create policy "Users can insert own watchlist" on public.watchlist
  as permissive for insert to public with check ((select auth.uid()) = user_id);
create policy "Users can view own watchlist" on public.watchlist
  as permissive for select to public using ((select auth.uid()) = user_id);
create policy watchlist_delete_own on public.watchlist
  as permissive for delete to authenticated using (user_id = (select auth.uid()));
create policy watchlist_insert_own on public.watchlist
  as permissive for insert to authenticated with check (user_id = (select auth.uid()));
create policy watchlist_select_own on public.watchlist
  as permissive for select to authenticated using (user_id = (select auth.uid()));
create policy watchlist_update_own on public.watchlist
  as permissive for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Effective Data API grants. RLS remains the row-access boundary.
grant select, insert, update, delete, truncate, references, trigger
  on all tables in schema public to anon, authenticated, service_role;

grant usage on sequence public.alpha_waitlist_id_seq to anon, authenticated, service_role;
grant usage on sequence public.news_articles_id_seq to anon, authenticated, service_role;
grant usage on sequence public.premium_waitlist_id_seq to anon, authenticated, service_role;
grant usage on sequence public.pro_waitlist_id_seq to anon, authenticated, service_role;
grant usage on sequence public.stock_factor_diagnostics_history_id_seq to anon, authenticated, service_role;
grant usage on sequence public.stock_rank_snapshots_id_seq to anon, authenticated, service_role;
grant usage on sequence public.stock_rankings_id_seq to anon, authenticated, service_role;

revoke all on function public.handle_new_user() from public, anon, authenticated, service_role;
grant execute on function public.handle_new_user() to service_role;

revoke all on function public.is_active_subscriber(uuid) from public, anon, authenticated, service_role;
grant execute on function public.is_active_subscriber(uuid) to authenticated, service_role;

revoke all on function public.set_previous_rank_before_stock_rankings_update() from public, anon, authenticated, service_role;
grant execute on function public.set_previous_rank_before_stock_rankings_update() to public, service_role;

revoke all on function public.sync_profile_email_from_auth() from public, anon, authenticated, service_role;
grant execute on function public.sync_profile_email_from_auth() to service_role;

comment on column public.user_portfolios.cash_balance is
  'Available uninvested cash. Added deposits are not counted as portfolio profit/loss.';

-- Auth/profile and ranking triggers.
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create trigger sync_profile_email_from_auth_update
  after update of email on auth.users
  for each row execute function public.sync_profile_email_from_auth();

create trigger set_previous_rank_before_stock_rankings_update
  before update on public.stock_rankings
  for each row execute function public.set_previous_rank_before_stock_rankings_update();

commit;
