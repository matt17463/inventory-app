-- Keep the guarded public signature and existing brand IDs/codes. Decode only
-- ampersand encodings used by WooCommerce term labels before exact comparison.
create or replace function sc_internal.sc_upsert_brand_from_woocommerce(
 p_name text,p_woo_term_id bigint default null,p_woo_term_slug text default null,
 p_woo_attribute_taxonomy text default 'pa_brand'
) returns jsonb language plpgsql security definer set search_path='' as $function$
declare v_name text;v_ids bigint[];v_existing_id bigint;v_brand jsonb;v_action text;
begin
 v_name:=nullif(btrim(regexp_replace(coalesce(p_name,''),'(&amp;|&#0*38;|&#x0*26;)','&','gi')),'');
 if v_name is null then return jsonb_build_object('success',false,'message','Brand name is required.');end if;
 perform pg_advisory_xact_lock(hashtextextended('woocommerce-brand:'||public.sc_brand_norm(v_name),0));
 if p_woo_term_id is not null then
  select array_agg(b.id order by b.id) into v_ids from public.brands b where b.woo_term_id=p_woo_term_id;
 end if;
 if coalesce(cardinality(v_ids),0)=0 then
  select array_agg(b.id order by b.id) into v_ids from public.brands b
  where public.sc_brand_norm(regexp_replace(b.name,'(&amp;|&#0*38;|&#x0*26;)','&','gi'))=public.sc_brand_norm(v_name);
 end if;
 if cardinality(v_ids)>1 then
  return jsonb_build_object('success',false,'message','More than one brand matches this WooCommerce term. Review the duplicate brands first.','requested_name',v_name);
 end if;
 v_existing_id:=v_ids[1];
 if v_existing_id is not null then
  update public.brands b set name=v_name,woo_term_id=coalesce(p_woo_term_id,b.woo_term_id),
   woo_term_slug=coalesce(nullif(p_woo_term_slug,''),b.woo_term_slug),
   woo_attribute_taxonomy=coalesce(nullif(p_woo_attribute_taxonomy,''),b.woo_attribute_taxonomy),updated_at=now()
  where b.id=v_existing_id returning to_jsonb(b) into v_brand;
  v_action:='reused_existing';
 else
  insert into public.brands(name,code,woo_term_id,woo_term_slug,woo_attribute_taxonomy,updated_at)
  values(v_name,public.sc_brand_norm(v_name),p_woo_term_id,p_woo_term_slug,p_woo_attribute_taxonomy,now())
  returning to_jsonb(brands) into v_brand;
  v_action:='inserted';
 end if;
 return jsonb_build_object('success',true,'action',v_action,'requested_name',v_name,
  'normalized_name',public.sc_brand_norm(v_name),'brand',v_brand);
exception when others then
 -- Never report success with a missing brand, including uniqueness conflicts.
 return jsonb_build_object('success',false,'message',sqlerrm,'requested_name',v_name);
end;
$function$;
revoke all on function sc_internal.sc_upsert_brand_from_woocommerce(text,bigint,text,text) from public,anon,authenticated;
grant execute on function sc_internal.sc_upsert_brand_from_woocommerce(text,bigint,text,text) to service_role;
notify pgrst,'reload schema';
