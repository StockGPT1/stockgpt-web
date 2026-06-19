-- Portfolio snapshot source-boundary cleanup and lookup indexes.
-- Historical rows are valid only before a portfolio's first live/current snapshot.

do $$
begin
  if to_regclass('public.portfolio_snapshots') is not null then
    execute 'create index if not exists idx_portfolio_snapshots_portfolio_source_at
      on public.portfolio_snapshots (portfolio_id, source, snapshot_at)';

    execute 'create index if not exists idx_portfolio_snapshots_user_portfolio_source_at
      on public.portfolio_snapshots (user_id, portfolio_id, source, snapshot_at)';
  end if;

  if to_regclass('public.portfolio_page_snapshots') is not null then
    execute 'create index if not exists idx_portfolio_page_snapshots_portfolio_owner_updated
      on public.portfolio_page_snapshots (portfolio_id, owner_id, updated_at desc)';
  end if;

  if to_regclass('public.portfolio_holdings') is not null then
    execute 'create index if not exists idx_portfolio_holdings_portfolio_id
      on public.portfolio_holdings (portfolio_id)';
  end if;

  if to_regclass('public.portfolio_transactions') is not null then
    execute 'create index if not exists idx_portfolio_transactions_portfolio_created_at
      on public.portfolio_transactions (portfolio_id, created_at)';
  end if;
end $$;

do $$
declare
  deleted_count integer := 0;
begin
  if to_regclass('public.portfolio_snapshots') is null then
    return;
  end if;

  with first_live as (
    select
      portfolio_id,
      min(snapshot_at) as first_live_snapshot_at
    from public.portfolio_snapshots
    where source in ('cron_refresh', 'page_current_value', 'page', 'health_repair_live', 'system')
    group by portfolio_id
  ),
  deleted as (
    delete from public.portfolio_snapshots ps
    using first_live fl
    where ps.portfolio_id = fl.portfolio_id
      and ps.source in ('backfill', 'chart_rebuild')
      and ps.snapshot_at >= fl.first_live_snapshot_at
      and exists (
        select 1
        from public.user_portfolios up
        where up.id = ps.portfolio_id
      )
    returning 1
  )
  select count(*) into deleted_count from deleted;

  raise notice 'Deleted % historical portfolio snapshot rows at or after first live snapshot', deleted_count;
end $$;
