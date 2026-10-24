-- Private profile photos. Every storage operation is scoped to the authenticated
-- owner's folder; the application never accepts a user ID or storage path.
begin;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-photos', 'profile-photos', false, 2097152, array['image/webp'])
on conflict (id) do nothing;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='profile_photos_select_own') then
    create policy profile_photos_select_own on storage.objects for select to authenticated using (bucket_id='profile-photos' and (storage.foldername(name))[1]=(select auth.uid()::text));
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='profile_photos_insert_own') then
    create policy profile_photos_insert_own on storage.objects for insert to authenticated with check (bucket_id='profile-photos' and (storage.foldername(name))[1]=(select auth.uid()::text));
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='profile_photos_delete_own') then
    create policy profile_photos_delete_own on storage.objects for delete to authenticated using (bucket_id='profile-photos' and (storage.foldername(name))[1]=(select auth.uid()::text));
  end if;
end $$;
commit;
