alter table if exists portfolio_holdings
  add column if not exists risk_level_at_entry numeric null;

alter table if exists portfolio_holdings
  add column if not exists target_level_at_entry numeric null;

comment on column portfolio_holdings.risk_level_at_entry is
  'Buy-time risk / stop-loss price saved when the holding is bought or logged. Alerts should use this stored value only.';

comment on column portfolio_holdings.target_level_at_entry is
  'Buy-time target / take-profit price saved when the holding is bought or logged. Alerts should use this stored value only.';
