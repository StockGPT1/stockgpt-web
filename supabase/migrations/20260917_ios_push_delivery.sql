alter table public.ios_push_devices
  add column if not exists environment text not null default 'sandbox'
  check (environment in ('sandbox', 'production'));

create table if not exists public.ios_push_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null,
  alert_key text not null,
  sent_at timestamptz not null default now(),
  unique (token, alert_key)
);

create index if not exists ios_push_deliveries_user_id_idx
  on public.ios_push_deliveries(user_id, sent_at desc);

alter table public.ios_push_deliveries enable row level security;

-- Delivery records are service-only. No end-user RLS policies are intentionally
-- created; the service-role client used by the cron bypasses RLS.
