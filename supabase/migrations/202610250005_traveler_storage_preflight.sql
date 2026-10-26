-- Fail-closed server-side artwork presence receipts. Apply only with endpoint deployment.
create table if not exists public.sc_traveler_storage_preflight (
 id uuid primary key default gen_random_uuid(),
 job_id bigint not null references public.jobs(id) on delete cascade,
 recipe_version_id uuid not null references public.sc_manufacturing_recipe_versions(id),
 requested_by uuid not null,
 job_item_ids bigint[] not null,
 artwork_fingerprint text not null,
 checked_at timestamptz not null default now(),
 expires_at timestamptz not null,
 constraint sc_storage_preflight_expiry check (expires_at > checked_at and expires_at <= checked_at + interval '5 minutes')
);
create index if not exists sc_storage_preflight_lookup on public.sc_traveler_storage_preflight(job_id,recipe_version_id,requested_by,expires_at desc);
alter table public.sc_traveler_storage_preflight enable row level security;
revoke all on public.sc_traveler_storage_preflight from public,anon,authenticated;
grant all on public.sc_traveler_storage_preflight to service_role;

create or replace function public.sc_require_traveler_storage_preflight()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
 v_job bigint;
 v_recipe uuid;
 v_ids bigint[];
 v_assets uuid[];
 v_fingerprint text;
begin
 select t.job_id,t.recipe_version_id into v_job,v_recipe
 from public.sc_job_travelers t where t.id=new.traveler_id;
 select array_agg(l.job_item_id order by l.job_item_id)
 into v_ids from public.sc_job_traveler_lines l where l.traveler_id=new.traveler_id;
 v_ids := (select array_agg(distinct x order by x) from unnest(coalesce(v_ids,'{}'::bigint[]) || array[new.job_item_id]) x);
 select array_agg(distinct id order by id) into v_assets
 from (
  select rv.artwork_asset_id id from public.sc_manufacturing_recipe_versions rv where rv.id=v_recipe
  union
  select coalesce((p->>'artwork_asset_id')::uuid,rv.artwork_asset_id)
   from public.sc_manufacturing_recipe_versions rv
   cross join lateral jsonb_array_elements(case when jsonb_typeof(rv.placements)='array' then rv.placements else '[]'::jsonb end) p
   where rv.id=v_recipe
  union
  select (s.resolution_snapshot->>'artworkAssetId')::uuid
   from public.sc_order_graphic_selections s
   join public.job_items ji on ji.id=new.job_item_id
   join public.jobs j on j.id=ji.job_id
   where s.job_item_id=ji.id or (s.source='woocommerce' and s.external_order_id=j.woocommerce_order_id::text and s.external_line_id=ji.woocommerce_line_item_id::text)
 ) candidates where id is not null;
 select md5(coalesce(string_agg(
  a.id::text || ':' || coalesce(a.storage_provider,'') || ':' || coalesce(a.storage_bucket,'') || ':' ||
  coalesce(a.storage_path,'') || ':' || coalesce(a.preflight_status,''),
  '|' order by a.id),''))
 into v_fingerprint from public.mockup_artwork_assets a where a.id=any(coalesce(v_assets,'{}'::uuid[]));
 if not exists (
  select 1 from public.sc_traveler_storage_preflight p
  where p.job_id=v_job and p.recipe_version_id=v_recipe and p.requested_by=auth.uid()
   and p.expires_at>clock_timestamp() and p.artwork_fingerprint=v_fingerprint
   and new.job_item_id=any(p.job_item_ids)
 ) then
  raise exception 'Fresh trusted artwork storage verification is required before traveler creation';
 end if;
 return new;
end $$;
revoke all on function public.sc_require_traveler_storage_preflight() from public,anon,authenticated;
drop trigger if exists sc_require_traveler_storage_preflight on public.sc_job_traveler_lines;
create trigger sc_require_traveler_storage_preflight before insert on public.sc_job_traveler_lines
for each row execute function public.sc_require_traveler_storage_preflight();
