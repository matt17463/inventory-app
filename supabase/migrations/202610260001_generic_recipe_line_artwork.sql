-- Additive mapping for artwork on generic recipe positions. Unapplied until reviewed release.
create table if not exists public.sc_job_line_placement_artwork (
 id uuid primary key default gen_random_uuid(),
 job_item_id bigint not null references public.job_items(id) on delete restrict,
 recipe_version_id uuid not null references public.sc_manufacturing_recipe_versions(id) on delete restrict,
 placement_name text not null check (length(trim(placement_name)) between 1 and 80),
 artwork_asset_id uuid not null references public.mockup_artwork_assets(id) on delete restrict,
 approved_by uuid not null,
 approved_at timestamptz not null default now(),
 created_at timestamptz not null default now(),
 unique(job_item_id,recipe_version_id,placement_name)
);
create index if not exists sc_job_line_placement_artwork_recipe_idx
 on public.sc_job_line_placement_artwork(recipe_version_id,job_item_id);
alter table public.sc_job_line_placement_artwork enable row level security;
revoke all on public.sc_job_line_placement_artwork from public,anon,authenticated;
grant select,insert,update,delete on public.sc_job_line_placement_artwork to service_role;
-- Privileged server function verifies actor, exact recipe placement and approved artwork.
create or replace function public.sc_approve_job_line_placement_artwork(
 p_job_item_id bigint,p_recipe_version_id uuid,p_placement_name text,p_artwork_asset_id uuid,p_actor uuid
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if p_actor is null or not exists (
   select 1 from public.sc_app_user_roles r
   where r.user_id=p_actor and r.is_active=true and r.role in ('admin','manager')
 ) then raise exception 'Manager approval required' using errcode='42501'; end if;
 if not exists(select 1 from public.job_items where id=p_job_item_id)
  or not exists (
   select 1 from public.sc_manufacturing_recipe_versions v
   where v.id=p_recipe_version_id and v.status='approved'
     and exists(select 1 from jsonb_array_elements(v.placements) p
      where p->>'placement_name'=p_placement_name)
  ) then raise exception 'Job line or recipe placement is invalid'; end if;
 if not exists(select 1 from public.mockup_artwork_assets a where a.id=p_artwork_asset_id
   and lower(a.preflight_status) in ('passed','approved','ready'))
  then raise exception 'Artwork must be preflight-approved'; end if;
 if exists(select 1 from public.sc_job_traveler_lines where job_item_id=p_job_item_id)
  then raise exception 'Cannot change approved traveler artwork'; end if;
 insert into public.sc_job_line_placement_artwork
 (job_item_id,recipe_version_id,placement_name,artwork_asset_id,approved_by)
 values(p_job_item_id,p_recipe_version_id,p_placement_name,p_artwork_asset_id,p_actor)
 on conflict(job_item_id,recipe_version_id,placement_name)
 do update set artwork_asset_id=excluded.artwork_asset_id,approved_by=excluded.approved_by,approved_at=now()
 returning id into v_id;
 return v_id;
end $$;
revoke all on function public.sc_approve_job_line_placement_artwork(bigint,uuid,text,uuid,uuid) from public,anon,authenticated;
grant execute on function public.sc_approve_job_line_placement_artwork(bigint,uuid,text,uuid,uuid) to service_role;
