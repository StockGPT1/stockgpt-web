-- Bind redundant child user_id values to the owner of the referenced
-- portfolio. The foreign keys are NOT VALID so unknown historical production
-- rows do not make the initial release brittle; PostgreSQL still enforces them
-- for every new or updated row.

alter table public.user_portfolios
  add constraint user_portfolios_id_user_id_key unique (id, user_id);

alter table public.portfolio_transactions
  add constraint portfolio_transactions_portfolio_owner_fkey
  foreign key (portfolio_id, user_id)
  references public.user_portfolios (id, user_id)
  on delete cascade
  not valid;

alter table public.portfolio_snapshots
  add constraint portfolio_snapshots_portfolio_owner_fkey
  foreign key (portfolio_id, user_id)
  references public.user_portfolios (id, user_id)
  on delete cascade
  not valid;

-- Replace the former user_id-only policies. Both the current row (USING) and
-- proposed row (WITH CHECK) must resolve to the authenticated user's exact
-- owned portfolio.

drop policy "Users can delete their own portfolio transactions"
  on public.portfolio_transactions;
drop policy "Users can insert their own portfolio transactions"
  on public.portfolio_transactions;
drop policy "Users can read their own portfolio transactions"
  on public.portfolio_transactions;
drop policy "Users can update their own portfolio transactions"
  on public.portfolio_transactions;

create policy portfolio_transactions_select_owned_parent
  on public.portfolio_transactions
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.user_portfolios p
      where p.id = portfolio_transactions.portfolio_id
        and p.user_id = portfolio_transactions.user_id
        and p.user_id = (select auth.uid())
    )
  );

create policy portfolio_transactions_insert_owned_parent
  on public.portfolio_transactions
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.user_portfolios p
      where p.id = portfolio_transactions.portfolio_id
        and p.user_id = portfolio_transactions.user_id
        and p.user_id = (select auth.uid())
    )
  );

create policy portfolio_transactions_update_owned_parent
  on public.portfolio_transactions
  for update
  to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.user_portfolios p
      where p.id = portfolio_transactions.portfolio_id
        and p.user_id = portfolio_transactions.user_id
        and p.user_id = (select auth.uid())
    )
  )
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.user_portfolios p
      where p.id = portfolio_transactions.portfolio_id
        and p.user_id = portfolio_transactions.user_id
        and p.user_id = (select auth.uid())
    )
  );

create policy portfolio_transactions_delete_owned_parent
  on public.portfolio_transactions
  for delete
  to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.user_portfolios p
      where p.id = portfolio_transactions.portfolio_id
        and p.user_id = portfolio_transactions.user_id
        and p.user_id = (select auth.uid())
    )
  );

drop policy portfolio_snapshots_insert_own on public.portfolio_snapshots;
drop policy portfolio_snapshots_select_own on public.portfolio_snapshots;
drop policy portfolio_snapshots_update_own on public.portfolio_snapshots;

create policy portfolio_snapshots_select_owned_parent
  on public.portfolio_snapshots
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.user_portfolios p
      where p.id = portfolio_snapshots.portfolio_id
        and p.user_id = portfolio_snapshots.user_id
        and p.user_id = (select auth.uid())
    )
  );

create policy portfolio_snapshots_insert_owned_parent
  on public.portfolio_snapshots
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.user_portfolios p
      where p.id = portfolio_snapshots.portfolio_id
        and p.user_id = portfolio_snapshots.user_id
        and p.user_id = (select auth.uid())
    )
  );

create policy portfolio_snapshots_update_owned_parent
  on public.portfolio_snapshots
  for update
  to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.user_portfolios p
      where p.id = portfolio_snapshots.portfolio_id
        and p.user_id = portfolio_snapshots.user_id
        and p.user_id = (select auth.uid())
    )
  )
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.user_portfolios p
      where p.id = portfolio_snapshots.portfolio_id
        and p.user_id = portfolio_snapshots.user_id
        and p.user_id = (select auth.uid())
    )
  );
