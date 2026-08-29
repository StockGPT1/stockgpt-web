-- Keep event chronology distinct from StockGPT's recorded/change time.
-- Adding the nullable column before its default deliberately leaves historical
-- rows null: their exact occurrence time was never stored.
alter table public.portfolio_transactions
  add column occurred_at timestamptz;

alter table public.portfolio_transactions
  alter column occurred_at set default now();

comment on column public.portfolio_transactions.occurred_at is
  'When the underlying activity occurred; null means the exact occurrence time was not separately stored.';

comment on column public.portfolio_transactions.created_at is
  'When StockGPT recorded the ledger row.';

create index portfolio_transactions_portfolio_occurred_recorded_idx
  on public.portfolio_transactions (
    portfolio_id,
    occurred_at desc nulls last,
    created_at desc,
    id
  );

-- Normal authenticated ledger access is append-only. Parent/account lifecycle
-- deletion can still cascade through the existing foreign keys.
drop policy portfolio_transactions_update_owned_parent
  on public.portfolio_transactions;
drop policy portfolio_transactions_delete_owned_parent
  on public.portfolio_transactions;

revoke insert, update, delete
  on table public.portfolio_transactions
  from anon, authenticated;

-- Direct INSERT remains temporarily for the pre-RPC application paths. Limit
-- it to the current ledger payload so clients cannot forge recorded_at.
grant insert (
  id,
  portfolio_id,
  user_id,
  ticker,
  type,
  shares,
  price,
  amount,
  realised_pnl,
  currency,
  notes,
  occurred_at
)
  on table public.portfolio_transactions
  to authenticated;
