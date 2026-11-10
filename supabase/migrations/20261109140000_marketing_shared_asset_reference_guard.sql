-- Validate cross-module artwork provenance even for direct PostgREST writes.
-- This does not alter existing Mockup Studio employee workflows.
create or replace function sc_internal.sc_growth_shared_asset_guard()
returns trigger language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare
  item jsonb;
  source_name text;
  asset_id uuid;
  asset_project uuid;
  linked_customer text;
  asset_status text;
  client_customer text;
begin
  if auth.uid() is not null and not public.sc_internal_access_allowed(array['admin','manager','operator','marketing']) then
    raise exception 'Employee permission required for shared artwork references';
  end if;
  select customer_id::text into client_customer
  from public.sc_growth_accounts where id = new.account_id;
  for item in
    select value from jsonb_array_elements(
      jsonb_build_array(new.content->'marketing_artwork', new.content->'marketing_product_image')
      || coalesce(new.content->'marketing_product_images', '[]'::jsonb)
      || coalesce(new.content->'marketing_logo_options', '[]'::jsonb)
    )
  loop
    if item is null or jsonb_typeof(item) <> 'object' or not (item ? 'source') then continue; end if;
    source_name := item->>'source';
    if source_name = 'blank_products' then
      if not exists(select 1 from public.blank_products where id::text = item->>'asset_id' and sc_is_archived = false)
        then raise exception 'Shared blank catalog reference is invalid'; end if;
      continue;
    end if;
    if source_name not in ('mockup_artwork_assets','mockup_blank_assets','mockup_outputs')
      then raise exception 'Unsupported shared asset source'; end if;
    if client_customer is null then raise exception 'Marketing account must be linked to a customer'; end if;
    begin asset_id := (item->>'asset_id')::uuid;
    exception when invalid_text_representation then raise exception 'Invalid shared asset identifier'; end;
    if source_name = 'mockup_artwork_assets' then
      select project_id into asset_project from public.mockup_artwork_assets where id = asset_id;
    elsif source_name = 'mockup_blank_assets' then
      select project_id into asset_project from public.mockup_blank_assets where id = asset_id;
    else
      select project_id, approval_status into asset_project, asset_status
      from public.mockup_outputs where id = asset_id;
      if asset_status not in ('internal_approved','customer_approved')
        then raise exception 'Unapproved mockup cannot be reused'; end if;
    end if;
    if asset_project is null then raise exception 'Shared artwork asset not found'; end if;
    select customer_id_text into linked_customer from public.mockup_projects where id = asset_project;
    if linked_customer is distinct from client_customer
      then raise exception 'Shared artwork belongs to another customer'; end if;
  end loop;
  return new;
end $$;
revoke all on function sc_internal.sc_growth_shared_asset_guard() from public, anon, authenticated;
drop trigger if exists sc_growth_shared_asset_guard on public.sc_growth_documents;
create trigger sc_growth_shared_asset_guard
before insert or update of content, account_id on public.sc_growth_documents
for each row execute function sc_internal.sc_growth_shared_asset_guard();
