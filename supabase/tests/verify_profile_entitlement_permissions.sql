-- LOCAL DEVELOPMENT ONLY.
-- Catalog-level companion to the hostile Data API session checks.

do $profile_permission_assertions$
declare
  user_editable_columns text[] := array[
    'full_name',
    'date_of_birth',
    'phone',
    'email_news_digests',
    'email_portfolio_alerts',
    'email_watchlist_alerts',
    'preferred_currency'
  ];
  protected_columns text[] := array[
    'id',
    'email',
    'subscription_status',
    'stripe_customer_id',
    'created_at',
    'email_digest_last_sent_on',
    'email_digest_last_sent_at',
    'first_name',
    'last_name',
    'marketing_consent',
    'email_consent',
    'terms_accepted',
    'newsletter_digest_consent',
    'consent_captured_at'
  ];
  column_name text;
begin
  if has_table_privilege('authenticated', 'public.profiles', 'update') then
    raise exception 'authenticated retains table-wide profiles UPDATE';
  end if;

  if has_table_privilege('anon', 'public.profiles', 'update') then
    raise exception 'anon retains table-wide profiles UPDATE';
  end if;

  if has_any_column_privilege('anon', 'public.profiles', 'update') then
    raise exception 'anon retains column-level profiles UPDATE';
  end if;

  foreach column_name in array user_editable_columns loop
    if not has_column_privilege(
      'authenticated',
      'public.profiles',
      column_name,
      'update'
    ) then
      raise exception 'authenticated cannot update approved profile column %', column_name;
    end if;
  end loop;

  foreach column_name in array protected_columns loop
    if has_column_privilege(
      'authenticated',
      'public.profiles',
      column_name,
      'update'
    ) then
      raise exception 'authenticated can update protected profile column %', column_name;
    end if;

    if has_column_privilege('anon', 'public.profiles', column_name, 'update') then
      raise exception 'anon can update profile column %', column_name;
    end if;
  end loop;

  if not has_table_privilege('service_role', 'public.profiles', 'update') then
    raise exception 'service_role lost profiles UPDATE authority';
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and cmd in ('INSERT', 'ALL')
      and ('authenticated' = any (roles) or 'public' = any (roles))
  ) then
    raise exception 'profiles unexpectedly exposes an authenticated INSERT policy';
  end if;
end;
$profile_permission_assertions$;
