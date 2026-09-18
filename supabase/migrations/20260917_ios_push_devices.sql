create table if not exists public.ios_push_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique,
  platform text not null default 'ios' check (platform = 'ios'),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists ios_push_devices_user_id_idx
  on public.ios_push_devices(user_id);

alter table public.ios_push_devices enable row level security;

drop policy if exists ios_push_devices_own_select on public.ios_push_devices;
create policy ios_push_devices_own_select
on public.ios_push_devices
for select
using (auth.uid() = user_id);

drop policy if exists ios_push_devices_own_insert on public.ios_push_devices;
create policy ios_push_devices_own_insert
on public.ios_push_devices
for insert
with check (auth.uid() = user_id);

drop policy if exists ios_push_devices_own_update on public.ios_push_devices;
create policy ios_push_devices_own_update
on public.ios_push_devices
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists ios_push_devices_own_delete on public.ios_push_devices;
create policy ios_push_devices_own_delete
on public.ios_push_devices
for delete
using (auth.uid() = user_id);
