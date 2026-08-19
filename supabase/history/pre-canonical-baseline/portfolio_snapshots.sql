create table if not exists public.portfolio_snapshots (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.user_portfolios(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  snapshot_at timestamptz not null default now(),
  value numeric(14,2) not null check (value >= 0),
  cash numeric(14,2) not null default 0,
  basis numeric(14,2) not null default 0,
  pnl numeric(14,2) not null default 0,
  pnl_pct numeric(12,4) not null default 0,
  source text not null default 'system',
  created_at timestamptz not null default now(),
  unique (portfolio_id, snapshot_at)
);

create index if not exists portfolio_snapshots_portfolio_time_idx
  on public.portfolio_snapshots (portfolio_id, snapshot_at desc);

create index if not exists portfolio_snapshots_user_portfolio_idx
  on public.portfolio_snapshots (user_id, portfolio_id);

alter table public.portfolio_snapshots enable row level security;

drop policy if exists "portfolio_snapshots_select_own" on public.portfolio_snapshots;
create policy "portfolio_snapshots_select_own"
  on public.portfolio_snapshots
  for select
  using (auth.uid() = user_id);

drop policy if exists "portfolio_snapshots_insert_own" on public.portfolio_snapshots;
create policy "portfolio_snapshots_insert_own"
  on public.portfolio_snapshots
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "portfolio_snapshots_update_own" on public.portfolio_snapshots;
create policy "portfolio_snapshots_update_own"
  on public.portfolio_snapshots
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
