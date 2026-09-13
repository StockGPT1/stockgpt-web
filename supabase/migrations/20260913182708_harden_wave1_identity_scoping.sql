create extension if not exists btree_gist with schema extensions;

alter table public.instrument_aliases
  drop constraint instrument_aliases_namespace_scope_value_key;

alter table public.instrument_aliases
  add constraint instrument_aliases_no_overlapping_validity
  exclude using gist (
    namespace with =,
    scope with =,
    value with =,
    (
      tstzrange(
        coalesce(valid_from, '-infinity'::timestamptz),
        coalesce(valid_to, 'infinity'::timestamptz),
        '[)'
      )
    ) with &&
  );

comment on constraint instrument_aliases_no_overlapping_validity on public.instrument_aliases is
  'An alias may be reused over time, but one namespace/scope/value can identify only one listing at any instant.';

alter table public.broker_connections
  drop constraint broker_connections_provider_external_key;

alter table public.broker_connections
  add constraint broker_connections_owner_provider_external_key
  unique (user_id, provider_id, external_connection_id);

comment on constraint broker_connections_owner_provider_external_key on public.broker_connections is
  'Provider-local connection identity is unique within one StockGPT owner and provider, not globally across all owners.';
