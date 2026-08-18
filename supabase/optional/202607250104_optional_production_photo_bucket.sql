-- OPTIONAL STEP 2 STORAGE SUPPORT
-- Run only if the contract report says production-photo-proof is missing.
-- ADDITIVE ONLY: existing bucket rows and policies are preserved.

begin;

insert into storage.buckets(id, name, public)
values ('production-photo-proof', 'production-photo-proof', true)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'sc_production_photo_authenticated_select'
  ) then
    execute $policy$
      create policy sc_production_photo_authenticated_select
      on storage.objects for select to authenticated
      using (bucket_id = 'production-photo-proof')
    $policy$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'sc_production_photo_authenticated_insert'
  ) then
    execute $policy$
      create policy sc_production_photo_authenticated_insert
      on storage.objects for insert to authenticated
      with check (bucket_id = 'production-photo-proof')
    $policy$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'sc_production_photo_authenticated_update'
  ) then
    execute $policy$
      create policy sc_production_photo_authenticated_update
      on storage.objects for update to authenticated
      using (bucket_id = 'production-photo-proof')
      with check (bucket_id = 'production-photo-proof')
    $policy$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'sc_production_photo_authenticated_delete'
  ) then
    execute $policy$
      create policy sc_production_photo_authenticated_delete
      on storage.objects for delete to authenticated
      using (bucket_id = 'production-photo-proof')
    $policy$;
  end if;
end $$;

commit;
