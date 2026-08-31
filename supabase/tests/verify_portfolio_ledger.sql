-- LOCAL DEVELOPMENT ONLY.
-- Catalog and deterministic seed assertions for the Stage 05C ledger contract.

do $portfolio_ledger_assertions$
declare
  occurred_default text;
  insert_column text;
begin
  select pg_get_expr(d.adbin, d.adrelid)
  into occurred_default
  from pg_attribute a
  join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
  where a.attrelid = 'public.portfolio_transactions'::regclass
    and a.attname = 'occurred_at'
    and not a.attnotnull;

  if occurred_default <> 'now()' then
    raise exception 'occurred_at must be nullable with a now() default, found %', occurred_default;
  end if;

  if col_description('public.portfolio_transactions'::regclass, (
      select attnum from pg_attribute
      where attrelid = 'public.portfolio_transactions'::regclass and attname = 'occurred_at'
    )) not like 'When the underlying activity occurred;%'
    or col_description('public.portfolio_transactions'::regclass, (
      select attnum from pg_attribute
      where attrelid = 'public.portfolio_transactions'::regclass and attname = 'created_at'
    )) <> 'When StockGPT recorded the ledger row.' then
    raise exception 'Ledger timestamp semantics are not documented in the catalog';
  end if;

  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'portfolio_transactions'
      and indexname = 'portfolio_transactions_portfolio_occurred_recorded_idx'
      and indexdef like '%(portfolio_id, occurred_at DESC NULLS LAST, created_at DESC, id)%'
  ) then
    raise exception 'Portfolio activity chronology index is missing or malformed';
  end if;

  if (select count(*) from pg_policies
      where schemaname = 'public'
        and tablename = 'portfolio_transactions'
        and policyname in (
          'portfolio_transactions_select_owned_parent',
          'portfolio_transactions_insert_canonical_usd_parent'
        )
        and roles = array['authenticated']::name[]) <> 2
    or exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'portfolio_transactions'
        and cmd in ('UPDATE', 'DELETE')
    ) then
    raise exception 'Transaction RLS is not append-only and parent-aware';
  end if;

  if not has_table_privilege('authenticated', 'public.portfolio_transactions', 'select')
    or has_table_privilege('authenticated', 'public.portfolio_transactions', 'insert')
    or has_table_privilege('authenticated', 'public.portfolio_transactions', 'update')
    or has_table_privilege('authenticated', 'public.portfolio_transactions', 'delete')
    or has_any_column_privilege('anon', 'public.portfolio_transactions', 'insert')
    or has_any_column_privilege('anon', 'public.portfolio_transactions', 'update')
    or has_table_privilege('anon', 'public.portfolio_transactions', 'delete')
    or has_column_privilege('authenticated', 'public.portfolio_transactions', 'created_at', 'insert')
    or not has_table_privilege('service_role', 'public.portfolio_transactions', 'select,insert,update,delete') then
    raise exception 'Ledger grants do not enforce append-only authenticated access and trusted lifecycle access';
  end if;

  foreach insert_column in array array[
    'id', 'portfolio_id', 'user_id', 'ticker', 'type', 'shares', 'price',
    'amount', 'realised_pnl', 'currency', 'notes', 'occurred_at'
  ] loop
    if not has_column_privilege(
      'authenticated',
      'public.portfolio_transactions',
      insert_column,
      'insert'
    ) then
      raise exception 'Authenticated INSERT privilege missing for %', insert_column;
    end if;
  end loop;

  if (select count(*) from public.portfolio_transactions
      where id in (
        'b1111111-1111-4111-8111-111111111111',
        'b2222222-2222-4222-8222-222222222222',
        'b3333333-3333-4333-8333-333333333333'
      ) and occurred_at = created_at) <> 3 then
    raise exception 'Synthetic transaction occurrence timestamps are not deterministic';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.portfolio_transactions'::regclass
      and conname = 'portfolio_transactions_portfolio_owner_fkey'
      and contype = 'f'
  ) then
    raise exception '05B transaction parent/owner constraint is missing';
  end if;
end;
$portfolio_ledger_assertions$;
