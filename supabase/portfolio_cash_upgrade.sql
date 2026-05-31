alter table if exists user_portfolios
  add column if not exists cash_balance numeric not null default 0;

comment on column user_portfolios.cash_balance is
  'Available uninvested cash. Added deposits are not counted as portfolio profit/loss.';
