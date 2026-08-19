-- LOCAL DEVELOPMENT ONLY.
-- Invoked by scripts/verify-local-supabase-fixtures.mjs.
-- This single statement validates privileged fixture/schema invariants. The
-- companion Node script proves RLS through genuine local Auth sessions.

do $fixture_assertions$
declare
  expected_tables text[] := array[
    'affiliate_applications', 'alpha_waitlist', 'ask_stockgpt_messages',
    'executive_waitlist', 'market_snapshots', 'news_articles',
    'notification_dismissals', 'portfolio_holdings',
    'portfolio_page_snapshots', 'portfolio_snapshots',
    'portfolio_transactions', 'premium_waitlist', 'pro_waitlist', 'profiles',
    'security_audit_events', 'security_rate_limits', 'stock_chart_cache',
    'stock_factor_diagnostics', 'stock_factor_diagnostics_history',
    'stock_rank_snapshots', 'stock_rankings', 'support_feedback',
    'technical_level_cache', 'user_notification_summaries',
    'user_portfolios', 'watchlist'
  ];
  actual_tables text[];
begin
  select array_agg(c.relname order by c.relname)
  into actual_tables
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r';

  if actual_tables <> expected_tables then
    raise exception 'Canonical public table set does not match the expected 26 tables';
  end if;

  if (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity) <> 26 then
    raise exception 'Expected RLS on all 26 public tables';
  end if;

  if to_regclass('public.watchlist') is null or to_regclass('public.user_watchlist') is not null then
    raise exception 'Watchlist schema guard failed';
  end if;

  if (select count(*) from auth.users where id in (
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222222',
    '33333333-3333-4333-8333-333333333333'
  )) <> 3 then
    raise exception 'Expected all three deterministic Auth users';
  end if;

  if exists (select 1 from auth.users where email !~ '^[a-z0-9-]+@stockgpt[.]invalid$') then
    raise exception 'All seeded Auth emails must use the reserved .invalid domain';
  end if;

  if (select count(*) from public.profiles where id in (
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222222',
    '33333333-3333-4333-8333-333333333333'
  )) <> 3 then
    raise exception 'Auth trigger did not create all matching profiles';
  end if;

  if (select count(*) from public.stock_rankings) <> 4
    or (select count(*) from public.stock_factor_diagnostics) <> 4
    or (select count(*) from public.stock_rank_snapshots) <> 4
    or (select count(*) from public.market_snapshots) <> 4
    or (select count(*) from public.stock_chart_cache) <> 4
    or (select count(*) from public.technical_level_cache) <> 4
    or (select count(*) from public.news_articles) <> 1 then
    raise exception 'Market/reference fixture counts do not match';
  end if;

  if not exists (select 1 from public.user_portfolios where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1')
    or (select count(*) from public.portfolio_holdings where portfolio_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1') <> 2
    or (select count(*) from public.portfolio_transactions where portfolio_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1') <> 3
    or (select count(*) from public.portfolio_snapshots where portfolio_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1') <> 2
    or (select count(*) from public.watchlist where user_id = '11111111-1111-4111-8111-111111111111') <> 1 then
    raise exception 'Active-user portfolio fixture is incomplete';
  end if;

  if exists (select 1 from public.user_portfolios where user_id = '22222222-2222-4222-8222-222222222222') then
    raise exception 'Free user must retain the intentional no-portfolio empty state';
  end if;

  if not exists (select 1 from public.user_portfolios where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2')
    or (select count(*) from public.portfolio_holdings where portfolio_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2') <> 1
    or (select count(*) from public.watchlist where user_id = '33333333-3333-4333-8333-333333333333') <> 1 then
    raise exception 'Isolation-user fixture is incomplete';
  end if;
end;
$fixture_assertions$;
