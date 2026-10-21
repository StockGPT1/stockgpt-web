-- Admission only: existing projections, manual accounting and sync are unchanged.
create schema broker_rollout_private;
revoke all on schema broker_rollout_private from public, anon, authenticated, service_role;
grant usage on schema broker_rollout_private to service_role;

create table broker_rollout_private.projection_control (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default false,
  updated_at timestamptz not null default clock_timestamp()
);
insert into broker_rollout_private.projection_control (singleton) values (true);
create table broker_rollout_private.projection_approvals (
  user_id uuid not null,
  account_id uuid not null,
  approval_reference text not null check (length(btrim(approval_reference)) between 1 and 96),
  valid_from timestamptz not null check (isfinite(valid_from)),
  valid_until timestamptz not null check (isfinite(valid_until)),
  revoked_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  primary key (user_id, account_id),
  foreign key (account_id, user_id) references public.broker_accounts(id, user_id) on delete cascade,
  check (valid_from < valid_until)
);
alter table broker_rollout_private.projection_control enable row level security;
alter table broker_rollout_private.projection_approvals enable row level security;
revoke all on all tables in schema broker_rollout_private from public, anon, authenticated, service_role;
grant select, update on broker_rollout_private.projection_control to service_role;
grant select, insert, update, delete on broker_rollout_private.projection_approvals to service_role;

create function broker_rollout_private.guard_connected_projection_admission()
returns trigger language plpgsql security definer set search_path = '' as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_enabled boolean;
  v_approval broker_rollout_private.projection_approvals%rowtype;
begin
  if tg_op = 'UPDATE' then
    if new.management_source is distinct from old.management_source
       or new.broker_account_id is distinct from old.broker_account_id then
      raise exception using errcode = '42501', message = 'portfolio_source_transition_forbidden';
    end if;
    return new;
  end if;
  if new.management_source <> 'connected' then return new; end if;
  if v_user_id is null or v_user_id <> new.user_id then
    raise exception using errcode = '42501', message = 'beta_projection_unavailable';
  end if;
  if not public.is_active_subscriber(v_user_id) then
    raise exception using errcode = '42501', message = 'subscription_required';
  end if;
  perform 1 from public.broker_accounts a
    where a.id = new.broker_account_id and a.user_id = v_user_id
      and a.status = 'active' and a.last_successful_sync_at is not null for share;
  if not found then
    raise exception using errcode = '42501', message = 'beta_projection_unavailable';
  end if;
  -- Locks serialize admission against committed stop/revocation. They do not
  -- cancel an insertion that already acquired its admission locks.
  select c.enabled into v_enabled from broker_rollout_private.projection_control c
    where c.singleton for share;
  if v_enabled is distinct from true then
    raise exception using errcode = '42501', message = 'beta_projection_unavailable';
  end if;
  select a.* into v_approval from broker_rollout_private.projection_approvals a
    where a.user_id = v_user_id and a.account_id = new.broker_account_id for share;
  if not found or v_approval.revoked_at is not null
    or clock_timestamp() < v_approval.valid_from
    or clock_timestamp() >= v_approval.valid_until then
    raise exception using errcode = '42501', message = 'beta_projection_unavailable';
  end if;
  return new;
end;
$function$;
revoke all on function broker_rollout_private.guard_connected_projection_admission() from public, anon, authenticated, service_role;
create trigger guard_connected_projection_admission
  before insert or update of management_source, broker_account_id on public.user_portfolios
  for each row execute function broker_rollout_private.guard_connected_projection_admission();
comment on schema broker_rollout_private is 'Trusted backend beta admission only; default stopped and no approvals. Not a public API.';
