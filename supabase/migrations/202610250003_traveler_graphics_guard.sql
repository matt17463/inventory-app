-- Server-side validation on every new traveler line; additive and unapplied.
-- The existing grouped traveler RPC inserts every selected line through sc_job_traveler_lines.
-- This guard executes inside the same database transaction, so an invalid line aborts the whole traveler.
create or replace function public.sc_validate_traveler_graphic_line()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
 v_recipe jsonb;
 v_placements jsonb;
 v_art uuid;
 v_asset_status text;
 v_selection record;
 v_link_count integer;
 v_verified_count integer := 0;
 v_asset_found boolean;
begin
 select to_jsonb(rv), coalesce(rv.placements,'[]'::jsonb)
 into v_recipe,v_placements
 from public.sc_job_travelers t
 join public.sc_manufacturing_recipe_versions rv on rv.id=t.recipe_version_id
 where t.id=new.traveler_id and rv.status='approved';
 if v_recipe is null then
  raise exception 'Traveler must use an approved recipe version';
 end if;
 select count(*) into v_link_count from public.sc_order_graphic_selections
 where job_item_id=new.job_item_id;
 if v_link_count>1 then raise exception 'Conflicting graphic assignments for job line'; end if;
 for v_selection in
  select family_id,resolution_snapshot from public.sc_order_graphic_selections where job_item_id=new.job_item_id
 loop
  if v_selection.family_id is null or v_selection.resolution_snapshot is null
    or v_selection.resolution_snapshot->>'status'<>'resolved' then
   raise exception 'Order graphic resolution is missing or incomplete';
  end if;
  begin
   v_art := (v_selection.resolution_snapshot->>'artworkAssetId')::uuid;
  exception when invalid_text_representation then
   raise exception 'Invalid approved artwork identifier';
  end;
  if v_art is null then raise exception 'Order line missing approved artwork'; end if;
  select a.preflight_status into v_asset_status
   from public.mockup_artwork_assets a where a.id=v_art;
  if coalesce(lower(v_asset_status),'') not in ('passed','approved','ready') then
   raise exception 'Selected artwork has not passed preflight';
  end if;
  -- Prevent matching left-chest art to full-back solely because it occurs anywhere.
  -- The selected artwork must occur on the exact recipe placement specified in the order context.
  select exists(
   select 1 from jsonb_array_elements(
    case when jsonb_typeof(v_placements)='array' then v_placements else '[]'::jsonb end
   ) p
   where coalesce(p->>'artwork_asset_id',v_recipe->>'artwork_asset_id')=v_art::text
   and (coalesce(v_selection.resolution_snapshot->>'placement_name','')=''
        or lower(coalesce(p->>'placement_name',''))=lower(v_selection.resolution_snapshot->>'placement_name'))
  ) into v_asset_found;
  if not v_asset_found
     and not (
      (v_placements='[]'::jsonb or v_placements is null)
      and v_recipe->>'artwork_asset_id'=v_art::text
      and coalesce(v_selection.resolution_snapshot->>'placement_name','')=''
     ) then
   raise exception 'Selected artwork does not match the approved recipe placement';
  end if;
  v_verified_count := v_verified_count+1;
 end loop;
 return new;
end $$;
revoke all on function public.sc_validate_traveler_graphic_line() from public,anon,authenticated;
drop trigger if exists sc_validate_traveler_graphic_line on public.sc_job_traveler_lines;
create trigger sc_validate_traveler_graphic_line
before insert on public.sc_job_traveler_lines
for each row execute function public.sc_validate_traveler_graphic_line();
