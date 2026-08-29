-- LOCAL DEVELOPMENT ONLY.
-- Catalog and relational assertions for the Stage 05B ownership foundation.

do $portfolio_persistence_assertions$
declare
  constraint_definition text;
  policy_count integer;
begin
  select pg_get_constraintdef(c.oid)
  into constraint_definition
  from pg_constraint c
  where c.conrelid = 'public.user_portfolios'::regclass
    and c.conname = 'user_portfolios_id_user_id_key'
    and c.contype = 'u';

  if constraint_definition <> 'UNIQUE (id, user_id)' then
    raise exception 'Missing exact user_portfolios (id, user_id) unique constraint';
  end if;

  select pg_get_constraintdef(c.oid)
  into constraint_definition
  from pg_constraint c
  where c.conrelid = 'public.portfolio_transactions'::regclass
    and c.conname = 'portfolio_transactions_portfolio_owner_fkey'
    and c.contype = 'f'
    and not c.convalidated;

  if constraint_definition <> 'FOREIGN KEY (portfolio_id, user_id) REFERENCES user_portfolios(id, user_id) ON DELETE CASCADE NOT VALID' then
    raise exception 'Transaction owner foreign key is missing, validated, or malformed: %', constraint_definition;
  end if;

  select pg_get_constraintdef(c.oid)
  into constraint_definition
  from pg_constraint c
  where c.conrelid = 'public.portfolio_snapshots'::regclass
    and c.conname = 'portfolio_snapshots_portfolio_owner_fkey'
    and c.contype = 'f'
    and not c.convalidated;

  if constraint_definition <> 'FOREIGN KEY (portfolio_id, user_id) REFERENCES user_portfolios(id, user_id) ON DELETE CASCADE NOT VALID' then
    raise exception 'Snapshot owner foreign key is missing, validated, or malformed: %', constraint_definition;
  end if;

  if exists (
    select 1
    from public.portfolio_transactions t
    left join public.user_portfolios p
      on p.id = t.portfolio_id and p.user_id = t.user_id
    where p.id is null
  ) then
    raise exception 'Local transaction fixtures contain a parent/owner mismatch';
  end if;

  if exists (
    select 1
    from public.portfolio_snapshots s
    left join public.user_portfolios p
      on p.id = s.portfolio_id and p.user_id = s.user_id
    where p.id is null
  ) then
    raise exception 'Local snapshot fixtures contain a parent/owner mismatch';
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'portfolio_transactions'
      and policyname in (
        'Users can delete their own portfolio transactions',
        'Users can insert their own portfolio transactions',
        'Users can read their own portfolio transactions',
        'Users can update their own portfolio transactions'
      )
  ) then
    raise exception 'Legacy user_id-only transaction policy remains active';
  end if;

  select count(*)
  into policy_count
  from pg_policies
  where schemaname = 'public'
    and tablename = 'portfolio_transactions'
    and policyname like 'portfolio_transactions_%_owned_parent'
    and roles = array['authenticated']::name[];

  if policy_count <> 4 then
    raise exception 'Expected four authenticated parent-aware transaction policies, found %', policy_count;
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'portfolio_snapshots'
      and policyname in (
        'portfolio_snapshots_insert_own',
        'portfolio_snapshots_select_own',
        'portfolio_snapshots_update_own'
      )
  ) then
    raise exception 'Legacy user_id-only snapshot policy remains active';
  end if;

  select count(*)
  into policy_count
  from pg_policies
  where schemaname = 'public'
    and tablename = 'portfolio_snapshots'
    and policyname like 'portfolio_snapshots_%_owned_parent'
    and roles = array['authenticated']::name[];

  if policy_count <> 3 then
    raise exception 'Expected three authenticated parent-aware snapshot policies, found %', policy_count;
  end if;

  if not has_table_privilege('authenticated', 'public.portfolio_transactions', 'select,insert,update,delete')
    or not has_table_privilege('authenticated', 'public.portfolio_snapshots', 'select,insert,update')
    or not has_table_privilege('authenticated', 'public.portfolio_holdings', 'select,insert,update,delete')
    or not has_table_privilege('authenticated', 'public.user_portfolios', 'select,insert,update,delete') then
    raise exception '05B unexpectedly removed an active direct financial table privilege';
  end if;
end;
$portfolio_persistence_assertions$;
