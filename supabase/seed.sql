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

-- Permanent listing identities and namespaced aliases. These UUIDs are local
-- fixture identities, not copied provider or production identifiers.
insert into public.instruments (
  id, display_name, exchange_mic, trading_currency, instrument_type,
  created_at, updated_at
)
values
  ('60000000-0000-4000-8000-000000000001', 'Synthetic Apple Listing', 'XNAS', 'USD', 'equity', '2026-01-01T08:00:00Z', '2026-01-01T08:00:00Z'),
  ('60000000-0000-4000-8000-000000000002', 'Synthetic Microsoft Listing', 'XNAS', 'USD', 'equity', '2026-01-01T08:00:00Z', '2026-01-01T08:00:00Z'),
  ('60000000-0000-4000-8000-000000000003', 'Synthetic Nvidia Listing', 'XNAS', 'USD', 'equity', '2026-01-01T08:00:00Z', '2026-01-01T08:00:00Z'),
  ('60000000-0000-4000-8000-000000000004', 'Synthetic Amazon Listing', 'XNAS', 'USD', 'equity', '2026-01-01T08:00:00Z', '2026-01-01T08:00:00Z'),
  ('60000000-0000-4000-8000-000000000005', 'Synthetic Tracked Listing', 'XNYS', 'USD', 'equity', '2026-01-01T08:00:00Z', '2026-01-01T08:00:00Z'),
  ('60000000-0000-4000-8000-000000000006', 'Synthetic Unsupported Listing', 'XLON', 'GBP', 'fund', '2026-01-01T08:00:00Z', '2026-01-01T08:00:00Z'),
  ('60000000-0000-4000-8000-000000000007', 'Synthetic Duplicate Name Listing', 'XNAS', 'USD', 'equity', '2026-01-01T08:00:00Z', '2026-01-01T08:00:00Z'),
  ('60000000-0000-4000-8000-000000000008', 'Synthetic Duplicate Name Listing', 'XLON', 'GBP', 'equity', '2026-01-01T08:00:00Z', '2026-01-01T08:00:00Z');

insert into public.instrument_aliases (
  id, instrument_id, namespace, scope, value, valid_from, valid_to, is_primary, created_at
)
values
  ('61000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000001', 'stockgpt.ticker', 'XNAS', 'AAPL', '2026-01-01T00:00:00Z', null, true, '2026-01-01T08:00:00Z'),
  ('61000000-0000-4000-8000-000000000002', '60000000-0000-4000-8000-000000000001', 'stockgpt.ticker', 'XNAS', 'AAPLX', '2025-01-01T00:00:00Z', '2026-01-01T00:00:00Z', false, '2026-01-01T08:00:00Z'),
  ('61000000-0000-4000-8000-000000000003', '60000000-0000-4000-8000-000000000001', 'broker.synthetic_alpha.instrument', '', 'alpha-aapl-001', null, null, false, '2026-01-01T08:00:00Z'),
  ('61000000-0000-4000-8000-000000000004', '60000000-0000-4000-8000-000000000001', 'broker.synthetic_beta.instrument', '', 'beta-aapl-901', null, null, false, '2026-01-01T08:00:00Z'),
  ('61000000-0000-4000-8000-000000000005', '60000000-0000-4000-8000-000000000002', 'stockgpt.ticker', 'XNAS', 'MSFT', null, null, true, '2026-01-01T08:00:00Z'),
  ('61000000-0000-4000-8000-000000000006', '60000000-0000-4000-8000-000000000003', 'stockgpt.ticker', 'XNAS', 'NVDA', null, null, true, '2026-01-01T08:00:00Z'),
  ('61000000-0000-4000-8000-000000000007', '60000000-0000-4000-8000-000000000004', 'stockgpt.ticker', 'XNAS', 'AMZN', null, null, true, '2026-01-01T08:00:00Z'),
  ('61000000-0000-4000-8000-000000000008', '60000000-0000-4000-8000-000000000005', 'market.synthetic.symbol', 'XNYS', 'ZZTR', null, null, true, '2026-01-01T08:00:00Z'),
  ('61000000-0000-4000-8000-000000000009', '60000000-0000-4000-8000-000000000006', 'broker.synthetic_alpha.instrument', '', 'unmapped-capable-asset', null, null, true, '2026-01-01T08:00:00Z'),
  ('61000000-0000-4000-8000-000000000010', '60000000-0000-4000-8000-000000000007', 'market.synthetic.symbol', 'XNAS', 'DUPL', null, null, true, '2026-01-01T08:00:00Z'),
  ('61000000-0000-4000-8000-000000000011', '60000000-0000-4000-8000-000000000008', 'market.synthetic.symbol', 'XLON', 'DUPL', null, null, true, '2026-01-01T08:00:00Z');

-- Fixed, synthetic market/reference fixtures. Values are intentionally simple
-- test data and are not statements about the named securities.
insert into public.stock_rankings (
  id, instrument_id, rank, ticker, company, sector, price, score, momentum, pe, risk,
  updated_at, last_price_update, last_ranking_update,
  last_fundamentals_update, previous_rank
)
overriding system value
values
  (101, '60000000-0000-4000-8000-000000000001', 1, 'AAPL', 'Synthetic Apple Research', 'Technology', 120, 88, 82, 20, 18, '2026-01-15T12:00:00Z', '2026-01-15T12:00:00Z', '2026-01-15T12:00:00Z', '2026-01-15T12:00:00Z', 2),
  (102, '60000000-0000-4000-8000-000000000002', 2, 'MSFT', 'Synthetic Microsoft Research', 'Technology', 220, 84, 79, 24, 16, '2026-01-15T12:00:00Z', '2026-01-15T12:00:00Z', '2026-01-15T12:00:00Z', '2026-01-15T12:00:00Z', 1),
  (103, '60000000-0000-4000-8000-000000000003', 3, 'NVDA', 'Synthetic Nvidia Research', 'Technology', 110, 80, 86, 30, 28, '2026-01-15T12:00:00Z', '2026-01-15T12:00:00Z', '2026-01-15T12:00:00Z', '2026-01-15T12:00:00Z', 4),
  (104, '60000000-0000-4000-8000-000000000004', 4, 'AMZN', 'Synthetic Amazon Research', 'Consumer', 95, 76, 70, 26, 22, '2026-01-15T12:00:00Z', '2026-01-15T12:00:00Z', '2026-01-15T12:00:00Z', '2026-01-15T12:00:00Z', 3);

insert into public.instrument_market_data (
  instrument_id, coverage, current_price, price_currency, price_as_of,
  source_namespace, limitation_code, updated_at
)
values
  ('60000000-0000-4000-8000-000000000001', 'ranked', 120, 'USD', '2026-01-15T12:00:00Z', 'market.synthetic', null, '2026-01-15T12:00:00Z'),
  ('60000000-0000-4000-8000-000000000002', 'ranked', 220, 'USD', '2026-01-15T12:00:00Z', 'market.synthetic', null, '2026-01-15T12:00:00Z'),
  ('60000000-0000-4000-8000-000000000003', 'ranked', 110, 'USD', '2026-01-15T12:00:00Z', 'market.synthetic', null, '2026-01-15T12:00:00Z'),
  ('60000000-0000-4000-8000-000000000004', 'ranked', 95, 'USD', '2026-01-15T12:00:00Z', 'market.synthetic', null, '2026-01-15T12:00:00Z'),
  ('60000000-0000-4000-8000-000000000005', 'tracked_only', 42, 'USD', '2026-01-15T12:00:00Z', 'market.synthetic', 'ranking_unavailable', '2026-01-15T12:00:00Z'),
  ('60000000-0000-4000-8000-000000000006', 'unsupported', null, null, null, null, 'market_data_unsupported', '2026-01-15T12:00:00Z');

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

-- Provider-neutral broker fixtures. These contain synthetic external
-- references only and deliberately keep connection, institution, account and
-- StockGPT Portfolio identities separate.
insert into public.broker_providers (id, provider_key, display_name, created_at)
values
  ('70000000-0000-4000-8000-000000000001', 'synthetic_alpha', 'Synthetic Connector Alpha', '2026-01-01T08:00:00Z'),
  ('70000000-0000-4000-8000-000000000002', 'synthetic_beta', 'Synthetic Connector Beta', '2026-01-01T08:00:00Z');

insert into public.brokerage_institutions (id, name, country_code, created_at)
values
  ('71000000-0000-4000-8000-000000000001', 'Synthetic Brokerage One', 'GB', '2026-01-01T08:00:00Z'),
  ('71000000-0000-4000-8000-000000000002', 'Synthetic Brokerage Two', 'US', '2026-01-01T08:00:00Z');

insert into public.broker_connections (
  id, user_id, provider_id, institution_id, external_connection_id, status,
  connected_at, last_attempted_sync_at, last_successful_sync_at, created_at, updated_at
)
values
  ('72000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', '70000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000001', 'alpha-connection-local-001', 'active', '2026-01-10T09:00:00Z', '2026-01-15T12:00:00Z', '2026-01-15T12:00:00Z', '2026-01-10T09:00:00Z', '2026-01-15T12:00:00Z'),
  ('72000000-0000-4000-8000-000000000002', '33333333-3333-4333-8333-333333333333', '70000000-0000-4000-8000-000000000002', '71000000-0000-4000-8000-000000000002', 'beta-connection-local-002', 'active', '2026-01-10T10:00:00Z', '2026-01-15T12:00:00Z', '2026-01-15T12:00:00Z', '2026-01-10T10:00:00Z', '2026-01-15T12:00:00Z');

insert into public.broker_accounts (
  id, user_id, connection_id, institution_id, external_account_id, name,
  account_type, base_currency, status, last_successful_sync_at, created_at, updated_at
)
values
  ('73000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', '72000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000001', 'alpha-account-local-001', 'Synthetic Alpha Account', 'general', 'USD', 'active', '2026-01-15T12:00:00Z', '2026-01-10T09:00:00Z', '2026-01-15T12:00:00Z'),
  ('73000000-0000-4000-8000-000000000002', '33333333-3333-4333-8333-333333333333', '72000000-0000-4000-8000-000000000002', '71000000-0000-4000-8000-000000000002', 'beta-account-local-002', 'Synthetic Beta Account', 'retirement', 'EUR', 'active', '2026-01-15T12:00:00Z', '2026-01-10T10:00:00Z', '2026-01-15T12:00:00Z');

insert into public.broker_positions (
  id, user_id, account_id, position_key, external_position_id,
  external_instrument_id, instrument_id, symbol, description, asset_type,
  quantity, price, price_currency, market_value, market_value_currency,
  as_of, created_at, updated_at
)
values
  ('74000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', '73000000-0000-4000-8000-000000000001', 'alpha-position-aapl', 'alpha-position-local-001', 'alpha-aapl-001', '60000000-0000-4000-8000-000000000001', 'AAPL', 'Synthetic mapped position', 'equity', 3, 121, 'USD', 363, 'USD', '2026-01-15T12:00:00Z', '2026-01-15T12:00:00Z', '2026-01-15T12:00:00Z'),
  ('74000000-0000-4000-8000-000000000002', '33333333-3333-4333-8333-333333333333', '73000000-0000-4000-8000-000000000002', 'beta-position-aapl', 'beta-position-local-002', 'beta-aapl-901', '60000000-0000-4000-8000-000000000001', 'AAPL', 'Synthetic cross-provider mapped position', 'equity', 2, 119, 'USD', 238, 'USD', '2026-01-15T12:00:00Z', '2026-01-15T12:00:00Z', '2026-01-15T12:00:00Z'),
  ('74000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', '73000000-0000-4000-8000-000000000001', 'alpha-position-unmapped', 'alpha-position-local-003', 'alpha-unmapped-003', null, 'LOCAL.UNMAPPED', 'Synthetic unmapped provider asset', 'other', 5, 7, 'GBP', 35, 'GBP', '2026-01-15T12:00:00Z', '2026-01-15T12:00:00Z', '2026-01-15T12:00:00Z');

insert into public.broker_cash_balances (
  id, user_id, account_id, currency, amount, as_of, created_at, updated_at
)
values
  ('75000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', '73000000-0000-4000-8000-000000000001', 'USD', 100, '2026-01-15T12:00:00Z', '2026-01-15T12:00:00Z', '2026-01-15T12:00:00Z'),
  ('75000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', '73000000-0000-4000-8000-000000000001', 'GBP', 25, '2026-01-15T12:00:00Z', '2026-01-15T12:00:00Z', '2026-01-15T12:00:00Z'),
  ('75000000-0000-4000-8000-000000000003', '33333333-3333-4333-8333-333333333333', '73000000-0000-4000-8000-000000000002', 'EUR', 80, '2026-01-15T12:00:00Z', '2026-01-15T12:00:00Z', '2026-01-15T12:00:00Z');

insert into public.broker_activities (
  id, user_id, account_id, instrument_id, external_activity_id, fingerprint,
  activity_type, occurred_at, recorded_at, quantity, price, gross_amount,
  net_amount, currency, description
)
values
  ('76000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', '73000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000001', 'alpha-activity-local-001', repeat('a', 64), 'trade', '2026-01-12T10:00:00Z', '2026-01-15T12:00:00Z', 1, 118, 118, 118, 'USD', 'Synthetic provider-reported activity'),
  ('76000000-0000-4000-8000-000000000002', '33333333-3333-4333-8333-333333333333', '73000000-0000-4000-8000-000000000002', '60000000-0000-4000-8000-000000000001', null, repeat('b', 64), 'trade', '2026-01-13T10:00:00Z', '2026-01-15T12:00:00Z', 1, 117, 117, 117, 'USD', 'Synthetic fingerprint-only provider activity');

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
  currency, notes, occurred_at, created_at
)
values
  ('b1111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '11111111-1111-4111-8111-111111111111', null, 'deposit', null, null, 5000, 'USD', 'Synthetic opening deposit.', '2026-01-02T09:00:00Z', '2026-01-02T09:00:00Z'),
  ('b2222222-2222-4222-8222-222222222222', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '11111111-1111-4111-8111-111111111111', 'AAPL', 'buy', 20, 100, 2000, 'USD', 'Synthetic AAPL purchase.', '2026-01-03T09:00:00Z', '2026-01-03T09:00:00Z'),
  ('b3333333-3333-4333-8333-333333333333', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '11111111-1111-4111-8111-111111111111', 'MSFT', 'buy', 10, 200, 2000, 'USD', 'Synthetic MSFT purchase.', '2026-01-03T09:05:00Z', '2026-01-03T09:05:00Z');

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
