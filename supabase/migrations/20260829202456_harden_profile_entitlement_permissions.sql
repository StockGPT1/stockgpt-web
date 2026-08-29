-- Profiles remain owner-row scoped by RLS. Narrow the Data API's column
-- authority separately so a hostile authenticated client cannot write billing,
-- identity, consent or system-delivery state on its own row.

revoke update on table public.profiles from anon, authenticated;

grant update (
  full_name,
  date_of_birth,
  phone,
  email_news_digests,
  email_portfolio_alerts,
  email_watchlist_alerts,
  preferred_currency
) on table public.profiles to authenticated;

comment on policy profiles_update_own on public.profiles is
  'Owner-row boundary; column UPDATE authority is restricted by explicit grants.';
