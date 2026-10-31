-- Photograph evidence is staff-readable and writable only through reviewed server routes.
create table public.sc_blank_photo_sources (
 blank_id uuid primary key references public.blank_products(id) on delete cascade,
 supplier_name text not null default 'Manual', source_product_url text, source_image_url text,
 capture_type text not null check(capture_type in ('direct','screenshot','manual','legacy')),
 match_confidence text not null check(match_confidence in ('exact','likely','provisional','unverified')),
 review_status text not null check(review_status in ('approved','needs_review','cleared')),
 matched_by text not null, captured_at timestamptz not null default now(),
 reviewed_by uuid, reviewed_at timestamptz, locked_manual_override boolean not null default false,
 evidence text not null default '', updated_at timestamptz not null default now()
);
alter table public.sc_blank_photo_sources enable row level security;
revoke all on public.sc_blank_photo_sources from anon, authenticated;
grant select on public.sc_blank_photo_sources to authenticated;
grant all on public.sc_blank_photo_sources to service_role;
create policy staff_photo_evidence on public.sc_blank_photo_sources for select to authenticated
 using ((select public.sc_internal_access_allowed(array['admin','manager','operator','viewer'])));
-- Existing images are preserved, with unknown historical evidence explicitly identified.
insert into public.sc_blank_photo_sources(blank_id,capture_type,match_confidence,review_status,matched_by,locked_manual_override,source_image_url)
select id,'legacy','unverified','needs_review','pre-existing catalog',true,image_url
from public.blank_products where image_url is not null or image_storage_path is not null;

-- Atomic family/color updates and evidence writes; service_role is the only caller.
create function public.sc_save_blank_photo(p_ids uuid[],p_patch jsonb,p_source jsonb,p_manual boolean,p_actor uuid default null,p_approve boolean default false)
returns integer language plpgsql security invoker set search_path=pg_catalog,public as $$
declare r public.blank_products; v public.blank_products; n integer:=0; family record;
begin
 if cardinality(p_ids) is null or cardinality(p_ids)<1 or cardinality(p_ids)>500 then raise exception 'Invalid photograph scope'; end if;
 if p_manual and not exists(select 1 from public.sc_app_user_roles where user_id=p_actor and is_active and role in ('admin','manager')) then raise exception 'Authorized reviewer required'; end if;
 select brand_id,product_type_id,color_id into family from public.blank_products where id=p_ids[1];
 if exists(select 1 from public.blank_products where id=any(p_ids) and (brand_id,product_type_id,color_id) is distinct from (family.brand_id,family.product_type_id,family.color_id)) then raise exception 'Photograph scope crosses product identities'; end if;
 if p_approve and not p_manual then raise exception 'Reviewer required'; end if;
 for r in select * from public.blank_products where id=any(p_ids) and sc_is_archived=false order by id for update loop
  if not p_manual and (r.image_url is not null or r.image_storage_path is not null or exists(select 1 from public.sc_blank_photo_sources where blank_id=r.id and locked_manual_override)) then continue; end if;
  if p_approve then
   update public.sc_blank_photo_sources set review_status='approved',reviewed_by=p_actor,reviewed_at=now(),locked_manual_override=true,updated_at=now() where blank_id=r.id and review_status<>'cleared';
   if found then n:=n+1; end if;
   continue;
  end if;
  v:=jsonb_populate_record(r,p_patch);
  update public.blank_products set image_url=v.image_url,image_storage_provider=v.image_storage_provider,image_storage_bucket=v.image_storage_bucket,image_storage_path=v.image_storage_path,image_file_size_bytes=v.image_file_size_bytes,image_mime_type=v.image_mime_type,image_preview_storage_provider=v.image_preview_storage_provider,image_preview_storage_bucket=v.image_preview_storage_bucket,image_preview_storage_path=v.image_preview_storage_path,image_preview_size_bytes=v.image_preview_size_bytes where id=r.id;
  insert into public.sc_blank_photo_sources(blank_id,supplier_name,source_product_url,source_image_url,capture_type,match_confidence,review_status,matched_by,reviewed_by,reviewed_at,locked_manual_override,evidence)
  values(r.id,coalesce(p_source->>'supplier_name','Manual'),p_source->>'source_product_url',v.image_url,coalesce(p_source->>'capture_type','manual'),coalesce(p_source->>'match_confidence','unverified'),case when v.image_url is null and v.image_storage_path is null then 'cleared' else 'needs_review' end,coalesce(p_source->>'matched_by',p_actor::text,'supplier sync'),null,null,p_manual,coalesce(p_source->>'evidence',''))
  on conflict(blank_id) do update set supplier_name=excluded.supplier_name,source_product_url=excluded.source_product_url,source_image_url=excluded.source_image_url,capture_type=excluded.capture_type,match_confidence=excluded.match_confidence,review_status=excluded.review_status,matched_by=excluded.matched_by,captured_at=now(),reviewed_by=null,reviewed_at=null,locked_manual_override=excluded.locked_manual_override,evidence=excluded.evidence,updated_at=now();
  n:=n+1;
 end loop;
 return n;
end $$;
revoke all on function public.sc_save_blank_photo(uuid[],jsonb,jsonb,boolean,uuid,boolean) from public,anon,authenticated;
grant execute on function public.sc_save_blank_photo(uuid[],jsonb,jsonb,boolean,uuid,boolean) to service_role;
