-- LOCAL DEVELOPMENT ONLY.
--
-- Deterministic synthetic StockGPT fixtures. These rows contain no production
-- data, credentials, provider identifiers or retrievable secrets. The Auth
-- users use one clearly documented local-only password so verification can
-- obtain genuine local Auth sessions without weakening any policy. The fixture
-- password is LocalStockGPT!2026 and must never be reused outside this seed.

-- The insert order intentionally allows public.handle_new_user() to create the
-- matching profiles before the fixture updates their synthetic product state.
insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '11111111-1111-4111-8111-111111111111',
    'authenticated',
    'authenticated',
    'active-subscriber@stockgpt.invalid',
    extensions.crypt('LocalStockGPT!2026', extensions.gen_salt('bf')),
    '2026-01-01T09:00:00Z',
    '',
    '',
    '',
    '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Avery Active","date_of_birth":"1990-01-01"}'::jsonb,
    '2026-01-01T09:00:00Z',
    '2026-01-01T09:00:00Z'
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '22222222-2222-4222-8222-222222222222',
    'authenticated',
    'authenticated',
    'free-user@stockgpt.invalid',
    extensions.crypt('LocalStockGPT!2026', extensions.gen_salt('bf')),
    '2026-01-01T09:05:00Z',
    '',
    '',
    '',
    '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Finley Free","date_of_birth":"1992-02-02"}'::jsonb,
    '2026-01-01T09:05:00Z',
    '2026-01-01T09:05:00Z'
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '33333333-3333-4333-8333-333333333333',
    'authenticated',
    'authenticated',
    'isolation-user@stockgpt.invalid',
    extensions.crypt('LocalStockGPT!2026', extensions.gen_salt('bf')),
    '2026-01-01T09:10:00Z',
    '',
    '',
    '',
    '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Indigo Isolation","date_of_birth":"1988-03-03"}'::jsonb,
    '2026-01-01T09:10:00Z',
    '2026-01-01T09:10:00Z'
  );

insert into auth.identities (
  id, provider_id, user_id, identity_data, provider,
  last_sign_in_at, created_at, updated_at
)
values
  (
    '11111111-1111-4111-9111-111111111111',
    '11111111-1111-4111-8111-111111111111',
    '11111111-1111-4111-8111-111111111111',
    '{"sub":"11111111-1111-4111-8111-111111111111","email":"active-subscriber@stockgpt.invalid","email_verified":true}'::jsonb,
    'email',
    '2026-01-01T09:00:00Z',
    '2026-01-01T09:00:00Z',
    '2026-01-01T09:00:00Z'
  ),
  (
    '22222222-2222-4222-9222-222222222222',
    '22222222-2222-4222-8222-222222222222',
    '22222222-2222-4222-8222-222222222222',
    '{"sub":"22222222-2222-4222-8222-222222222222","email":"free-user@stockgpt.invalid","email_verified":true}'::jsonb,
    'email',
    '2026-01-01T09:05:00Z',
    '2026-01-01T09:05:00Z',
    '2026-01-01T09:05:00Z'
  ),
  (
    '33333333-3333-4333-9333-333333333333',
    '33333333-3333-4333-8333-333333333333',
    '33333333-3333-4333-8333-333333333333',
    '{"sub":"33333333-3333-4333-8333-333333333333","email":"isolation-user@stockgpt.invalid","email_verified":true}'::jsonb,
    'email',
    '2026-01-01T09:10:00Z',
    '2026-01-01T09:10:00Z',
    '2026-01-01T09:10:00Z'
  );

update public.profiles
set
  first_name = 'Avery',
  last_name = 'Active',
  subscription_status = 'active',
  terms_accepted = true,
  email_consent = true,
  preferred_currency = 'USD',
  consent_captured_at = '2026-01-01T09:00:00Z'
where id = '11111111-1111-4111-8111-111111111111';

update public.profiles
set
  first_name = 'Finley',
  last_name = 'Free',
  subscription_status = 'free',
  terms_accepted = true,
  preferred_currency = 'GBP',
  consent_captured_at = '2026-01-01T09:05:00Z'
where id = '22222222-2222-4222-8222-222222222222';

update public.profiles
set
  first_name = 'Indigo',
  last_name = 'Isolation',
  subscription_status = 'active',
  terms_accepted = true,
  preferred_currency = 'EUR',
  consent_captured_at = '2026-01-01T09:10:00Z'
where id = '33333333-3333-4333-8333-333333333333';

-- Fixed, synthetic market/reference fixtures. Values are intentionally simple
-- test data and are not statements about the named securities.
insert into public.stock_rankings (
  id, rank, ticker, company, sector, price, score, momentum, pe, risk,
  updated_at, last_price_update, last_ranking_update,
  last_fundamentals_update, previous_rank
)
overriding system value
values
  (101, 1, 'AAPL', 'Synthetic Apple Research', 'Technology', 120, 88, 82, 20, 18, '2026-01-15T12:00:00Z', '2026-01-15T12:00:00Z', '2026-01-15T12:00:00Z', '2026-01-15T12:00:00Z', 2),
  (102, 2, 'MSFT', 'Synthetic Microsoft Research', 'Technology', 220, 84, 79, 24, 16, '2026-01-15T12:00:00Z', '2026-01-15T12:00:00Z', '2026-01-15T12:00:00Z', '2026-01-15T12:00:00Z', 1),
  (103, 3, 'NVDA', 'Synthetic Nvidia Research', 'Technology', 110, 80, 86, 30, 28, '2026-01-15T12:00:00Z', '2026-01-15T12:00:00Z', '2026-01-15T12:00:00Z', '2026-01-15T12:00:00Z', 4),
  (104, 4, 'AMZN', 'Synthetic Amazon Research', 'Consumer', 95, 76, 70, 26, 22, '2026-01-15T12:00:00Z', '2026-01-15T12:00:00Z', '2026-01-15T12:00:00Z', '2026-01-15T12:00:00Z', 3);

insert into public.stock_factor_diagnostics (
  ticker, updated_at, raw_score, current_score, smoothed_score,
  previous_score, factor_coverage, quality_score, growth_score, value_score,
  momentum_score, risk_score, income_score, factor_contributions,
  top_negative_factors, top_positive_factors, run_id,
  previous_factor_coverage, factor_coverage_change, missing_factors, diagnosis
)
values
  ('AAPL', '2026-01-15T12:00:00Z', 88, 88, 87, 86, 1, 90, 84, 70, 82, 82, 30, '{"quality":2,"momentum":1}'::jsonb, '["valuation"]'::jsonb, '["quality","momentum"]'::jsonb, 'synthetic-run-001', 1, 0, '[]'::jsonb, 'Synthetic stable factor profile.'),
  ('MSFT', '2026-01-15T12:00:00Z', 84, 84, 83, 82, 1, 88, 80, 72, 79, 84, 32, '{"quality":2,"growth":1}'::jsonb, '["valuation"]'::jsonb, '["quality","growth"]'::jsonb, 'synthetic-run-001', 1, 0, '[]'::jsonb, 'Synthetic balanced factor profile.'),
  ('NVDA', '2026-01-15T12:00:00Z', 80, 80, 79, 78, 1, 82, 90, 55, 86, 72, 20, '{"growth":2,"momentum":2}'::jsonb, '["risk"]'::jsonb, '["growth","momentum"]'::jsonb, 'synthetic-run-001', 1, 0, '[]'::jsonb, 'Synthetic growth-led factor profile.'),
  ('AMZN', '2026-01-15T12:00:00Z', 76, 76, 75, 74, 1, 78, 76, 68, 70, 78, 10, '{"growth":1,"quality":1}'::jsonb, '["income"]'::jsonb, '["growth","quality"]'::jsonb, 'synthetic-run-001', 1, 0, '[]'::jsonb, 'Synthetic mixed factor profile.');

insert into public.stock_rank_snapshots (
  id, snapshot_at, ticker, rank, score, price, company, sector, created_at
)
overriding system value
values
  (201, '2026-01-15T12:00:00Z', 'AAPL', 1, 88, 120, 'Synthetic Apple Research', 'Technology', '2026-01-15T12:00:00Z'),
  (202, '2026-01-15T12:00:00Z', 'MSFT', 2, 84, 220, 'Synthetic Microsoft Research', 'Technology', '2026-01-15T12:00:00Z'),
  (203, '2026-01-15T12:00:00Z', 'NVDA', 3, 80, 110, 'Synthetic Nvidia Research', 'Technology', '2026-01-15T12:00:00Z'),
  (204, '2026-01-15T12:00:00Z', 'AMZN', 4, 76, 95, 'Synthetic Amazon Research', 'Consumer', '2026-01-15T12:00:00Z');

insert into public.market_snapshots (ticker, current_price, change_pct_1d, source, updated_at)
values
  ('AAPL', 120, 1.25, 'synthetic', '2026-01-15T12:00:00Z'),
  ('MSFT', 220, -0.50, 'synthetic', '2026-01-15T12:00:00Z'),
  ('NVDA', 110, 2.00, 'synthetic', '2026-01-15T12:00:00Z'),
  ('AMZN', 95, 0.75, 'synthetic', '2026-01-15T12:00:00Z');

insert into public.stock_chart_cache (ticker, range, points, source, fetched_at)
values
  ('AAPL', '1M', '[{"date":"2026-01-02","close":115},{"date":"2026-01-15","close":120}]'::jsonb, 'synthetic', '2026-01-15T12:00:00Z'),
  ('MSFT', '1M', '[{"date":"2026-01-02","close":215},{"date":"2026-01-15","close":220}]'::jsonb, 'synthetic', '2026-01-15T12:00:00Z'),
  ('NVDA', '1M', '[{"date":"2026-01-02","close":100},{"date":"2026-01-15","close":110}]'::jsonb, 'synthetic', '2026-01-15T12:00:00Z'),
  ('AMZN', '1M', '[{"date":"2026-01-02","close":90},{"date":"2026-01-15","close":95}]'::jsonb, 'synthetic', '2026-01-15T12:00:00Z');

insert into public.technical_level_cache (ticker, current_price, levels, fetched_at)
values
  ('AAPL', 120, '{"support":105,"resistance":135,"source":"synthetic"}'::jsonb, '2026-01-15T12:00:00Z'),
  ('MSFT', 220, '{"support":195,"resistance":245,"source":"synthetic"}'::jsonb, '2026-01-15T12:00:00Z'),
  ('NVDA', 110, '{"support":90,"resistance":130,"source":"synthetic"}'::jsonb, '2026-01-15T12:00:00Z'),
  ('AMZN', 95, '{"support":85,"resistance":110,"source":"synthetic"}'::jsonb, '2026-01-15T12:00:00Z');

insert into public.news_articles (
  id, title, summary, source, url, affected_tickers, impact,
  impact_reason, published_at, created_at
)
overriding system value
values (
  301,
  'Synthetic quarterly research update',
  'Deterministic local-only news fixture for StockGPT development.',
  'Synthetic Research Wire',
  'https://news.stockgpt.invalid/synthetic-quarterly-update',
  array['AAPL', 'MSFT'],
  'monitor',
  'Synthetic fixture with no market meaning.',
  '2026-01-14T10:00:00Z',
  '2026-01-14T10:00:00Z'
);

-- Active subscriber portfolio: 5,000 deposited, 4,000 invested, 1,000 cash.
-- At the seeded market prices its current value is 5,600 and P/L is 600.
insert into public.user_portfolios (
  id, user_id, name, risk_tolerance, time_horizon, investment_amount,
  created_at, updated_at, cash_balance, cash_deposited_total, currency, objective
)
values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  '11111111-1111-4111-8111-111111111111',
  'Synthetic Growth Portfolio',
  'moderate',
  'long_term',
  5000,
  '2026-01-02T09:00:00Z',
  '2026-02-01T09:00:00Z',
  1000,
  5000,
  'USD',
  'growth'
);

insert into public.portfolio_holdings (
  id, portfolio_id, ticker, entry_price, allocation_pct, score_at_entry,
  rank_at_entry, added_at, last_reviewed_at, shares, purchase_date, source,
  notes, risk_level_at_entry, target_level_at_entry
)
values
  ('a1111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'AAPL', 100, 50, 86, 2, '2026-01-03T09:00:00Z', '2026-01-15T09:00:00Z', 20, '2026-01-03', 'manual', 'Synthetic local holding.', 90, 130),
  ('a2222222-2222-4222-8222-222222222222', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'MSFT', 200, 50, 82, 1, '2026-01-03T09:05:00Z', '2026-01-15T09:00:00Z', 10, '2026-01-03', 'manual', 'Synthetic local holding.', 180, 250);

insert into public.portfolio_transactions (
  id, portfolio_id, user_id, ticker, type, shares, price, amount,
  currency, notes, created_at
)
values
  ('b1111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '11111111-1111-4111-8111-111111111111', null, 'deposit', null, null, 5000, 'USD', 'Synthetic opening deposit.', '2026-01-02T09:00:00Z'),
  ('b2222222-2222-4222-8222-222222222222', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '11111111-1111-4111-8111-111111111111', 'AAPL', 'buy', 20, 100, 2000, 'USD', 'Synthetic AAPL purchase.', '2026-01-03T09:00:00Z'),
  ('b3333333-3333-4333-8333-333333333333', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '11111111-1111-4111-8111-111111111111', 'MSFT', 'buy', 10, 200, 2000, 'USD', 'Synthetic MSFT purchase.', '2026-01-03T09:05:00Z');

insert into public.portfolio_snapshots (
  id, portfolio_id, user_id, snapshot_at, value, cash, basis, pnl, pnl_pct,
  source, created_at
)
values
  ('c1111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '11111111-1111-4111-8111-111111111111', '2026-01-05T16:00:00Z', 5000, 1000, 5000, 0, 0, 'system', '2026-01-05T16:00:00Z'),
  ('c2222222-2222-4222-8222-222222222222', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '11111111-1111-4111-8111-111111111111', '2026-02-01T16:00:00Z', 5600, 1000, 5000, 600, 12, 'system', '2026-02-01T16:00:00Z');

insert into public.watchlist (id, user_id, ticker, created_at)
values ('d1111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', 'NVDA', '2026-01-04T09:00:00Z');

-- The free user intentionally has no portfolio for customer empty-state testing.

-- Isolation user owns a separate portfolio, holding and watchlist row.
insert into public.user_portfolios (
  id, user_id, name, risk_tolerance, time_horizon, investment_amount,
  created_at, updated_at, cash_balance, cash_deposited_total, currency, objective
)
values (
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
  '33333333-3333-4333-8333-333333333333',
  'Synthetic Isolation Portfolio',
  'conservative',
  'medium_term',
  1000,
  '2026-01-06T09:00:00Z',
  '2026-01-15T09:00:00Z',
  500,
  1000,
  'EUR',
  'balanced'
);

insert into public.portfolio_holdings (
  id, portfolio_id, ticker, entry_price, allocation_pct, score_at_entry,
  rank_at_entry, added_at, last_reviewed_at, shares, purchase_date, source, notes
)
values (
  'a3333333-3333-4333-8333-333333333333',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
  'NVDA',
  100,
  100,
  78,
  4,
  '2026-01-07T09:00:00Z',
  '2026-01-15T09:00:00Z',
  5,
  '2026-01-07',
  'manual',
  'Synthetic isolation holding.'
);

insert into public.watchlist (id, user_id, ticker, created_at)
values ('d3333333-3333-4333-8333-333333333333', '33333333-3333-4333-8333-333333333333', 'AMZN', '2026-01-08T09:00:00Z');

-- Small user-owned fixtures for notifications and Ask StockGPT surfaces.
insert into public.notification_dismissals (id, user_id, alert_key, dismissed_at)
values ('e1111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', 'synthetic:AAPL:review', '2026-01-16T09:00:00Z');

insert into public.user_notification_summaries (user_id, unread_count, updated_at)
values ('11111111-1111-4111-8111-111111111111', 1, '2026-01-16T09:00:00Z');

insert into public.ask_stockgpt_messages (id, user_id, role, content, created_at)
values
  ('f1111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', 'user', 'Summarise my synthetic local portfolio.', '2026-01-16T10:00:00Z'),
  ('f2222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 'assistant', 'This is a deterministic local-only fixture response.', '2026-01-16T10:00:01Z');
