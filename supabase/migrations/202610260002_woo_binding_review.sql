-- Manager-reviewed Woo mapping approval. No WordPress activation or webhook flag changes.
create or replace function public.sc_review_woo_graphic_binding(
 p_binding_id uuid, p_actor uuid, p_decision text, p_evidence jsonb default '{}'::jsonb
) returns public.sc_client_graphic_product_bindings
language plpgsql security definer set search_path=public
as $$
declare
 v_binding public.sc_client_graphic_product_bindings%rowtype;
 v_role text;
 v_family text;
 v_variants integer;
 v_rules integer;
 v_review public.sc_client_graphic_transfer_reviews%rowtype;
begin
 if auth.role() is distinct from 'service_role' then
  raise exception 'service role only' using errcode='42501';
 end if;
 select role into v_role from public.sc_app_user_roles
 where user_id=p_actor and is_active=true;
 if v_role not in ('admin','manager') or v_role is null then
  raise exception 'Active manager approval required' using errcode='42501';
 end if;
 select * into v_binding from public.sc_client_graphic_product_bindings
 where id=p_binding_id for update;
 if not found then raise exception 'Binding not found'; end if;
 if p_decision='revoke' then
  update public.sc_client_graphic_product_bindings
    set allowed=false, verified_at=null where id=p_binding_id returning * into v_binding;
  update public.sc_client_graphic_transfer_reviews set status='rejected',verified_by=p_actor,
   verified_at=now(),evidence=jsonb_build_object('decision','revoked','reason',coalesce(p_evidence->>'reason','manager revoked binding'))
   where woo_product_id=v_binding.woo_product_id and proposed_family_id=v_binding.graphic_family_id and status='verified';
  return v_binding;
 end if;
 if p_decision<>'approve' then raise exception 'Invalid binding decision'; end if;
 if v_binding.mode not in ('fixed','selectable') then raise exception 'Internal-only binding cannot be approved'; end if;
 if not (p_evidence ? 'woo_product_confirmed' and p_evidence ? 'existing_selector_reconciled'
  and p_evidence ? 'physical_sample_verified' and p_evidence ? 'artwork_storage_verified')
  or p_evidence->>'woo_product_confirmed'<>'true'
  or p_evidence->>'existing_selector_reconciled'<>'true'
  or p_evidence->>'physical_sample_verified'<>'true'
  or p_evidence->>'artwork_storage_verified'<>'true' then
  raise exception 'Four independent verification checks required';
 end if;
 select state into v_family from public.sc_client_graphic_families where id=v_binding.graphic_family_id;
 if v_family is distinct from 'approved' then raise exception 'Graphic family not approved'; end if;
 select count(*) into v_variants from public.sc_client_graphic_variants
 where family_id=v_binding.graphic_family_id and state='approved' and artwork_asset_id is not null;
 if v_variants=0 then raise exception 'No approved artwork variant'; end if;
 select count(*) into v_rules from public.sc_client_graphic_rules r
 join public.sc_client_graphic_variants v on v.id=r.variant_id
 where r.family_id=v_binding.graphic_family_id and r.enabled=true and v.state='approved';
 if v_rules=0 then raise exception 'No active approved production rule'; end if;
 -- A durable, signed-in employee review is linked to the exact product/family.
 insert into public.sc_client_graphic_transfer_reviews
 (woo_product_id,source_kind,source_key,source_value,proposed_family_id,status,evidence,verified_by,verified_at)
 values (v_binding.woo_product_id,'manager_product_binding',v_binding.id::text,v_binding.mode,
 v_binding.graphic_family_id,'verified',p_evidence,p_actor,now())
 returning * into v_review;
 update public.sc_client_graphic_product_bindings set allowed=true,verified_at=v_review.verified_at
 where id=p_binding_id returning * into v_binding;
 return v_binding;
end
$$;
revoke all on function public.sc_review_woo_graphic_binding(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.sc_review_woo_graphic_binding(uuid,uuid,text,jsonb) to service_role;
