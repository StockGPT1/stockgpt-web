-- Portfolio page speed indexes.
-- Run once in Supabase SQL editor if these indexes do not already exist.
-- These are concurrent/idempotent and do not change UI or product features.

create index concurrently if not exists idx_user_portfolios_user_active_created
  on public.user_portfolios (user_id, created_at)
  where archived_at is null;

create index concurrently if not exists idx_portfolio_holdings_portfolio_added
  on public.portfolio_holdings (portfolio_id, added_at desc);

create index concurrently if not exists idx_portfolio_holdings_portfolio_ticker
  on public.portfolio_holdings (portfolio_id, ticker);

create index concurrently if not exists idx_portfolio_transactions_portfolio_created
  on public.portfolio_transactions (portfolio_id, created_at);

create index concurrently if not exists idx_stock_rankings_ticker
  on public.stock_rankings (ticker);

create index concurrently if not exists idx_stock_rankings_rank
  on public.stock_rankings (rank);

create index concurrently if not exists idx_stock_factor_diagnostics_ticker
  on public.stock_factor_diagnostics (ticker);

create index concurrently if not exists idx_news_articles_published_at
  on public.news_articles (published_at desc);
