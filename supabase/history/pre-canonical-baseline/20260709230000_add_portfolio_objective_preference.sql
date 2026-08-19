alter table public.user_portfolios
  add column if not exists objective text;

alter table public.user_portfolios
  drop constraint if exists user_portfolios_objective_check;

alter table public.user_portfolios
  add constraint user_portfolios_objective_check
  check (
    objective is null
    or objective = any (
      array[
        'growth'::text,
        'income'::text,
        'balanced'::text,
        'capital_preservation'::text,
        'watchlist'::text
      ]
    )
  );
