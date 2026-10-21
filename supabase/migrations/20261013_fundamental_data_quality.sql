-- Original financial inputs and their provenance, before ranking imputation.
-- Apply before releasing the ranking engine that writes these columns.
begin;

create table if not exists public.stock_fundamental_snapshots (
  ticker text primary key,
  collected_at timestamptz not null,
  source text not null,
  "values" jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  constraint stock_fundamental_values_object check (jsonb_typeof("values") = 'object'),
  constraint stock_fundamental_metadata_object check (jsonb_typeof(metadata) = 'object')
);

alter table public.stock_fundamental_snapshots enable row level security;
revoke all on public.stock_fundamental_snapshots from anon;
revoke insert, update, delete, truncate, references, trigger on public.stock_fundamental_snapshots from authenticated;
grant select on public.stock_fundamental_snapshots to authenticated;
grant all on public.stock_fundamental_snapshots to service_role;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'stock_fundamental_snapshots'
      and policyname = 'stock_fundamental_snapshots_subscriber_select'
  ) then
    create policy stock_fundamental_snapshots_subscriber_select
      on public.stock_fundamental_snapshots for select to authenticated
      using (public.is_active_subscriber(auth.uid()));
  end if;
end;
$$;

alter table public.stock_factor_diagnostics
  add column if not exists input_values jsonb,
  add column if not exists input_metadata jsonb,
  add column if not exists missing_factor_names text[],
  add column if not exists imputed_factor_names text[],
  add column if not exists fundamental_factors_available integer,
  add column if not exists model_version text,
  add column if not exists comparison_valid boolean;

alter table public.stock_factor_diagnostics_history
  add column if not exists input_values jsonb,
  add column if not exists input_metadata jsonb,
  add column if not exists missing_factor_names text[],
  add column if not exists imputed_factor_names text[],
  add column if not exists fundamental_factors_available integer,
  add column if not exists model_version text,
  add column if not exists comparison_valid boolean;

alter table public.stock_rankings
  add column if not exists factor_coverage numeric,
  add column if not exists data_confidence text;

comment on table public.stock_fundamental_snapshots is
  'Original provider financial values, field sources/periods/statuses; never sector-imputed scoring values. collected_at is retrieval time, not filing publication.';
comment on column public.stock_factor_diagnostics.input_values is
  'The 21 scoring inputs before imputation; unavailable inputs remain JSON null.';
comment on column public.stock_rankings.factor_coverage is
  'Fraction of the 21 scoring factors actually available before imputation; completeness, not predictive accuracy.';


-- A failed provider request or database write must not leave new scores with
-- old diagnostics, or trigger a destructive full-table replacement.
create or replace function public.publish_stock_rankings_with_inputs(
  p_rankings jsonb, p_diagnostics jsonb, p_fundamentals jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  ranking_count integer;
begin
  if jsonb_typeof(p_rankings) is distinct from 'array'
     or jsonb_typeof(p_diagnostics) is distinct from 'array'
     or jsonb_typeof(p_fundamentals) is distinct from 'array' then
    raise exception 'Ranking publication requires three JSON arrays';
  end if;
  perform pg_advisory_xact_lock(hashtext('stockgpt_rankings_publish'));
  ranking_count := jsonb_array_length(p_rankings);
  if ranking_count < 490 or jsonb_array_length(p_diagnostics) <> ranking_count then
    raise exception 'Incomplete ranking or diagnostic batch; existing data retained';
  end if;
  if (select count(distinct row->>'ticker') from jsonb_array_elements(p_rankings) row) <> ranking_count then
    raise exception 'Ranking tickers must be unique';
  end if;
  if exists (
    select 1 from jsonb_populate_recordset(null::public.stock_rankings, p_rankings) r
    where r.ticker is null or r.ticker = '' or r.price is null or r.price <= 0
       or r.score is null or r.score <= 0 or r.factor_coverage is null
       or r.factor_coverage < 0 or r.factor_coverage > 1
  ) then
    raise exception 'Invalid ranking values; existing data retained';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_rankings) r
    where not exists (select 1 from jsonb_array_elements(p_diagnostics) d where d->>'ticker' = r->>'ticker')
       or not exists (select 1 from jsonb_array_elements(p_fundamentals) f where f->>'ticker' = r->>'ticker')
  ) then
    raise exception 'Every ranked stock requires original fundamentals and diagnostics';
  end if;
  if exists (
    select 1 from jsonb_populate_recordset(null::public.stock_factor_diagnostics, p_diagnostics) d
    where d.factor_coverage is null or d.factor_coverage < 0 or d.factor_coverage > 1
       or jsonb_typeof(d.input_values) is distinct from 'object'
       or jsonb_typeof(d.input_metadata) is distinct from 'object'
       or d.fundamental_factors_available is null
  ) then
    raise exception 'Original factor inputs and metadata are required';
  end if;

  insert into public.stock_fundamental_snapshots(ticker, collected_at, source, "values", metadata)
  select r.ticker, r.collected_at, r.source, r."values", r.metadata
  from jsonb_populate_recordset(null::public.stock_fundamental_snapshots, p_fundamentals) r
  on conflict (ticker) do update set
    collected_at = excluded.collected_at, source = excluded.source,
    "values" = excluded."values", metadata = excluded.metadata;

  insert into public.stock_factor_diagnostics(ticker, updated_at, run_id, raw_score, current_score, smoothed_score, previous_score, factor_coverage, previous_factor_coverage, factor_coverage_change, quality_score, growth_score, value_score, momentum_score, risk_score, income_score, quality_change, growth_change, value_change, momentum_change, risk_change, income_change, factor_contributions, top_negative_factors, top_positive_factors, missing_factors, diagnosis, input_values, input_metadata, missing_factor_names, imputed_factor_names, fundamental_factors_available, model_version, comparison_valid)
  select r.ticker, r.updated_at, r.run_id, r.raw_score, r.current_score, r.smoothed_score, r.previous_score, r.factor_coverage, r.previous_factor_coverage, r.factor_coverage_change, r.quality_score, r.growth_score, r.value_score, r.momentum_score, r.risk_score, r.income_score, r.quality_change, r.growth_change, r.value_change, r.momentum_change, r.risk_change, r.income_change, r.factor_contributions, r.top_negative_factors, r.top_positive_factors, r.missing_factors, r.diagnosis, r.input_values, r.input_metadata, r.missing_factor_names, r.imputed_factor_names, r.fundamental_factors_available, r.model_version, r.comparison_valid
  from jsonb_populate_recordset(null::public.stock_factor_diagnostics, p_diagnostics) r
  on conflict (ticker) do update set
    updated_at = excluded.updated_at,
    run_id = excluded.run_id,
    raw_score = excluded.raw_score,
    current_score = excluded.current_score,
    smoothed_score = excluded.smoothed_score,
    previous_score = excluded.previous_score,
    factor_coverage = excluded.factor_coverage,
    previous_factor_coverage = excluded.previous_factor_coverage,
    factor_coverage_change = excluded.factor_coverage_change,
    quality_score = excluded.quality_score,
    growth_score = excluded.growth_score,
    value_score = excluded.value_score,
    momentum_score = excluded.momentum_score,
    risk_score = excluded.risk_score,
    income_score = excluded.income_score,
    quality_change = excluded.quality_change,
    growth_change = excluded.growth_change,
    value_change = excluded.value_change,
    momentum_change = excluded.momentum_change,
    risk_change = excluded.risk_change,
    income_change = excluded.income_change,
    factor_contributions = excluded.factor_contributions,
    top_negative_factors = excluded.top_negative_factors,
    top_positive_factors = excluded.top_positive_factors,
    missing_factors = excluded.missing_factors,
    diagnosis = excluded.diagnosis,
    input_values = excluded.input_values,
    input_metadata = excluded.input_metadata,
    missing_factor_names = excluded.missing_factor_names,
    imputed_factor_names = excluded.imputed_factor_names,
    fundamental_factors_available = excluded.fundamental_factors_available,
    model_version = excluded.model_version, comparison_valid = excluded.comparison_valid;

  insert into public.stock_factor_diagnostics_history(ticker, updated_at, run_id, raw_score, current_score, smoothed_score, previous_score, factor_coverage, previous_factor_coverage, factor_coverage_change, quality_score, growth_score, value_score, momentum_score, risk_score, income_score, quality_change, growth_change, value_change, momentum_change, risk_change, income_change, factor_contributions, top_negative_factors, top_positive_factors, missing_factors, diagnosis, input_values, input_metadata, missing_factor_names, imputed_factor_names, fundamental_factors_available, model_version, comparison_valid)
  select r.ticker, r.updated_at, r.run_id, r.raw_score, r.current_score, r.smoothed_score, r.previous_score, r.factor_coverage, r.previous_factor_coverage, r.factor_coverage_change, r.quality_score, r.growth_score, r.value_score, r.momentum_score, r.risk_score, r.income_score, r.quality_change, r.growth_change, r.value_change, r.momentum_change, r.risk_change, r.income_change, r.factor_contributions, r.top_negative_factors, r.top_positive_factors, r.missing_factors, r.diagnosis, r.input_values, r.input_metadata, r.missing_factor_names, r.imputed_factor_names, r.fundamental_factors_available, r.model_version, r.comparison_valid
  from jsonb_populate_recordset(null::public.stock_factor_diagnostics_history, p_diagnostics) r;

  insert into public.stock_rankings(rank, ticker, company, sector, price, score, momentum, pe, risk, updated_at, last_ranking_update, last_fundamentals_update, factor_coverage, data_confidence)
  select r.rank, r.ticker, r.company, r.sector, r.price, r.score, r.momentum, r.pe, r.risk, r.updated_at, r.last_ranking_update, r.last_fundamentals_update, r.factor_coverage, r.data_confidence
  from jsonb_populate_recordset(null::public.stock_rankings, p_rankings) r
  on conflict (ticker) do update set
    rank = excluded.rank,
    company = excluded.company,
    sector = excluded.sector,
    price = excluded.price,
    score = excluded.score,
    momentum = excluded.momentum,
    pe = excluded.pe,
    risk = excluded.risk,
    updated_at = excluded.updated_at,
    last_ranking_update = excluded.last_ranking_update,
    last_fundamentals_update = excluded.last_fundamentals_update,
    factor_coverage = excluded.factor_coverage,
    data_confidence = excluded.data_confidence;

  -- Only remove departed constituents after the complete new batch is written.
  delete from public.stock_rankings
  where ticker not in (select row->>'ticker' from jsonb_array_elements(p_rankings) row);

  return jsonb_build_object('rankings', ranking_count, 'diagnostics', jsonb_array_length(p_diagnostics),
                            'fundamentals', jsonb_array_length(p_fundamentals));
end;
$$;

revoke all on function public.publish_stock_rankings_with_inputs(jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.publish_stock_rankings_with_inputs(jsonb, jsonb, jsonb) to service_role;

commit;
