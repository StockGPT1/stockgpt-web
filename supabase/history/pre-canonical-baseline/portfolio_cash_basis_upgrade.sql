alter table if exists user_portfolios
  add column if not exists cash_balance numeric not null default 0;

alter table if exists user_portfolios
  add column if not exists cash_deposited_total numeric not null default 0;

update user_portfolios
set cash_deposited_total = coalesce(nullif(cash_deposited_total, 0), investment_amount, 0)
where cash_deposited_total = 0;

comment on column user_portfolios.cash_balance is
  'Available uninvested cash. Selling holdings credits this balance.';

comment on column user_portfolios.cash_deposited_total is
  'Total user cash deposited / original portfolio basis. Used for since-inception P/L so deposits do not count as profit.';
