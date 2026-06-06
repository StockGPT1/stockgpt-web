-- 20260606_phase1_security_advisor_fixes.sql
-- Tightens SECURITY DEFINER exposure and adds explicit deny policies for server-only tables.

begin;

-- Keep this helper callable by signed-in users, but make it SECURITY INVOKER
-- and force the checked user id to match auth.uid().
create or replace function public.is_active_subscriber(user_uuid uuid)
returns boolean
language sql
security invoker
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = user_uuid
      and p.id = auth.uid()
      and lower(coalesce(p.subscription_status, '')) in (
        'basic',
        'core',
        'premium',
        'executive',
        'max',
        'alpha',
        'trialing',
        'active'
      )
  );
$$;

revoke all on function public.is_active_subscriber(uuid) from public, anon;
grant execute on function public.is_active_subscriber(uuid) to authenticated;

-- Trigger/helper functions should not be callable through the public API.
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.sync_profile_email_from_auth() from public, anon, authenticated;

-- Explicit deny policies keep these tables server-only while satisfying the
-- RLS-enabled-with-no-policy advisor. Server routes use the service role.
drop policy if exists affiliate_applications_no_client_access on public.affiliate_applications;
create policy affiliate_applications_no_client_access
on public.affiliate_applications
for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists alpha_waitlist_no_client_access on public.alpha_waitlist;
create policy alpha_waitlist_no_client_access
on public.alpha_waitlist
for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists premium_waitlist_no_client_access on public.premium_waitlist;
create policy premium_waitlist_no_client_access
on public.premium_waitlist
for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists pro_waitlist_no_client_access on public.pro_waitlist;
create policy pro_waitlist_no_client_access
on public.pro_waitlist
for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists security_audit_events_no_client_access on public.security_audit_events;
create policy security_audit_events_no_client_access
on public.security_audit_events
for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists security_rate_limits_no_client_access on public.security_rate_limits;
create policy security_rate_limits_no_client_access
on public.security_rate_limits
for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists stock_factor_diagnostics_history_no_client_access on public.stock_factor_diagnostics_history;
create policy stock_factor_diagnostics_history_no_client_access
on public.stock_factor_diagnostics_history
for all
to anon, authenticated
using (false)
with check (false);

commit;
