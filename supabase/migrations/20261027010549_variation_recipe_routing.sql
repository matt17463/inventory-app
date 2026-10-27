-- An explicitly reviewed variation configuration overrides the parent recipe candidate.
-- Parent routing remains the hold/fulfillment boundary and is versioned in evidence.
create or replace function sc_certification.evaluate(p_configuration uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 c public.sc_variation_configurations%rowtype; p public.products%rowtype; b public.blank_products%rowtype;
 rv public.sc_manufacturing_recipe_versions%rowtype; r public.sc_manufacturing_recipes%rowtype;
 m public.sc_material_recipes%rowtype; al public.sc_catalog_artwork_links%rowtype;
 o public.mockup_outputs%rowtype; pl public.mockup_placements%rowtype;
 a public.mockup_artwork_assets%rowtype; mb public.mockup_blank_assets%rowtype;
 pr public.mockup_projects%rowtype; cr public.mockup_reviews%rowtype;
 idx integer; pos jsonb; evidence jsonb='[]'; blockers jsonb='[]'; snap jsonb;
 latest_revision integer; graphic_state jsonb; routing public.sc_catalog_recipe_assignments%rowtype;
begin
 select * into c from public.sc_variation_configurations where id=p_configuration;
 if not found then return jsonb_build_object('ready',false,'blockers',jsonb_build_array('Exact variation configuration is missing')); end if;
 select * into p from public.products where id=c.product_id;
 if p.blank_product_id is null then blockers=blockers||jsonb_build_array('Missing blank mapping'); end if;
 select * into b from public.blank_products where id=p.blank_product_id;
 if b.id is null then blockers=blockers||jsonb_build_array('Mapped blank does not exist'); end if;
 if p.woocommerce_product_id is not null and (select count(*) from public.products q
  where q.woocommerce_product_id=p.woocommerce_product_id and coalesce(q.woocommerce_variation_id,0)=coalesce(p.woocommerce_variation_id,0))<>1 then
  blockers=blockers||jsonb_build_array('Ambiguous synchronized variation identity');
 end if;
 select * into rv from public.sc_manufacturing_recipe_versions where id=c.recipe_version_id;
 select * into r from public.sc_manufacturing_recipes where id=rv.recipe_id;
 select max(revision) into latest_revision from public.sc_manufacturing_recipe_versions where recipe_id=rv.recipe_id;
 if rv.status is distinct from 'approved' or not coalesce(rv.verified_sample,false) or rv.approved_by is null then
  blockers=blockers||jsonb_build_array('Recipe requires verified sample and manager approval');
 end if;
 if rv.revision is distinct from latest_revision then blockers=blockers||jsonb_build_array('Stale recipe revision; review the newest revision'); end if;
 if r.blank_product_id is not null and r.blank_product_id is distinct from p.blank_product_id then blockers=blockers||jsonb_build_array('Recipe blank differs from this variation'); end if;
 if rv.machine_settings_id is not null then
  select * into m from public.sc_material_recipes where id=rv.machine_settings_id;
  if m.status is distinct from 'approved' then blockers=blockers||jsonb_build_array('Machine/material settings are not approved'); end if;
 end if;
 if p.woocommerce_product_id is not null then
  select * into al from public.sc_catalog_artwork_links where woocommerce_product_id=p.woocommerce_product_id;
  if al.artwork_asset_id is null or al.review_required or al.reviewed_at is null or al.reviewed_by is null or length(trim(al.approval_evidence))<12 then
   blockers=blockers||jsonb_build_array('Missing reviewed catalog artwork evidence');
  end if;
  select * into routing from public.sc_catalog_recipe_assignments ca where ca.woocommerce_product_id=p.woocommerce_product_id;
  if routing.disposition is distinct from 'assigned' then
   blockers=blockers||jsonb_build_array('Product routing is on hold or fulfillment only');
  end if;
 end if;
 if jsonb_array_length(rv.placements)=0 or cardinality(c.output_ids)<>jsonb_array_length(rv.placements) then
  blockers=blockers||jsonb_build_array('Every recipe placement needs an exact selected output');
 else
  for idx in 1..cardinality(c.output_ids) loop
   pos=rv.placements->(idx-1);
   select * into o from public.mockup_outputs where id=c.output_ids[idx];
   select * into pl from public.mockup_placements where id=o.placement_id;
   select * into a from public.mockup_artwork_assets where id=pl.artwork_asset_id;
   select * into mb from public.mockup_blank_assets where id=pl.blank_asset_id;
   select * into pr from public.mockup_projects where id=o.project_id;
   select * into cr from public.mockup_reviews where output_id=o.id order by created_at desc,id desc limit 1;
   if o.id is null or not o.is_selected or coalesce(o.approval_status,'') not in ('internal_approved','customer_approved') or o.approved_at is null then
    blockers=blockers||jsonb_build_array('Placement '||idx||': selected internally approved mockup missing');
   end if;
   if pl.id is null or not pl.is_active or pl.project_id is distinct from o.project_id
    or a.project_id is distinct from o.project_id or mb.project_id is distinct from o.project_id
    or mb.blank_product_id_text is distinct from p.blank_product_id::text
    or (p.woocommerce_product_id is not null and pr.woo_product_id is distinct from p.woocommerce_product_id) then
    blockers=blockers||jsonb_build_array('Placement '||idx||': exact project, artwork or variation blank mismatch');
   end if;
   if pl.placement_name is distinct from pos->>'placement_name'
    or pl.print_width_inches is distinct from (pos->>'print_width_inches')::numeric
    or pl.print_height_inches is distinct from (pos->>'print_height_inches')::numeric
    or lower(pl.decoration_method) is distinct from lower(r.decoration_method)
    or (coalesce(pos->>'artwork_asset_id',rv.artwork_asset_id::text) is not null
      and a.id::text is distinct from coalesce(pos->>'artwork_asset_id',rv.artwork_asset_id::text)) then
    blockers=blockers||jsonb_build_array('Placement '||idx||': mockup differs from approved production dimensions, method or artwork');
   end if;
   if a.id is null or coalesce(lower(a.preflight_status),'') not in ('passed','approved','ready') then blockers=blockers||jsonb_build_array('Placement '||idx||': artwork preflight missing'); end if;
   if cr.id is null or cr.decision is distinct from 'approved' or cr.review_token_id is null
    or cr.project_id is distinct from o.project_id then blockers=blockers||jsonb_build_array('Placement '||idx||': missing or withdrawn customer approval');
   elsif cr.created_at < greatest(a.updated_at,pl.updated_at,mb.updated_at,o.updated_at) then
    blockers=blockers||jsonb_build_array('Placement '||idx||': customer approval is stale after evidence changes');
   end if;
   evidence=evidence||jsonb_build_array(jsonb_build_object('position',idx,'recipe_placement',pos,
    'output',to_jsonb(o),'placement',to_jsonb(pl),'artwork',to_jsonb(a),
    'mockup_blank',to_jsonb(mb),'project',jsonb_build_object('id',pr.id,'woo_product_id',pr.woo_product_id,'customer_id_text',pr.customer_id_text),
    'customer_review',to_jsonb(cr),
    'graphic_variants',(select coalesce(jsonb_agg(to_jsonb(g) order by g.id),'[]') from public.sc_client_graphic_variants g where g.artwork_asset_id=a.id)));
  end loop;
 end if;
 if p.woocommerce_product_id is not null and al.artwork_asset_id is not null and not exists(
  select 1 from jsonb_array_elements(evidence) e where e->'artwork'->>'id'=al.artwork_asset_id::text) then
  blockers=blockers||jsonb_build_array('Reviewed catalog artwork is absent from this configuration');
 end if;
 select jsonb_build_object(
  'bindings',(select coalesce(jsonb_agg(to_jsonb(g) order by g.id),'[]') from public.sc_client_graphic_product_bindings g where g.woo_product_id=p.woocommerce_product_id),
  'families',(select coalesce(jsonb_agg(to_jsonb(f) order by f.id),'[]') from public.sc_client_graphic_families f where exists(select 1 from public.sc_client_graphic_product_bindings g where g.woo_product_id=p.woocommerce_product_id and g.graphic_family_id=f.id)),
  'rules',(select coalesce(jsonb_agg(to_jsonb(rule) order by rule.id),'[]') from public.sc_client_graphic_rules rule where exists(select 1 from public.sc_client_graphic_product_bindings g where g.woo_product_id=p.woocommerce_product_id and g.graphic_family_id=rule.family_id))
 ) into graphic_state;
 if exists(select 1 from sc_certification.managed_parents mp where mp.woocommerce_product_id=p.woocommerce_product_id and mp.graphic_selection_required)
  and not exists(select 1 from public.sc_client_graphic_product_bindings g join public.sc_client_graphic_families f on f.id=g.graphic_family_id where g.woo_product_id=p.woocommerce_product_id and g.allowed and g.verified_at is not null and f.state='approved') then
  blockers=blockers||jsonb_build_array('Managed graphic binding or family approval withdrawn');
 end if;
 snap=jsonb_build_object('configuration',to_jsonb(c),'product',sc_certification.product_spec(p),
  'blank',jsonb_build_object('id',b.id,'spec',to_jsonb(b)-array['quantity','updated_at','created_at','unit_cost','cost','price','image_url','supplier_stock','last_synced_at']),'recipe_version',to_jsonb(rv),
  'recipe',jsonb_build_object('id',r.id,'blank_product_id',r.blank_product_id,'decoration_method',r.decoration_method,'garment_type',r.garment_type),
  'catalog_routing',to_jsonb(routing),'machine_settings',to_jsonb(m),'client_graphics',graphic_state,'catalog_artwork',to_jsonb(al),'placements',evidence);
 return jsonb_build_object('ready',jsonb_array_length(blockers)=0,'blockers',blockers,'snapshot',snap,'fingerprint',md5(snap::text));
end $$;

create or replace function public.sc_certify_variation(p_configuration_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare v jsonb; c public.sc_variation_configurations%rowtype; existing_id uuid; new_id uuid;
begin
 if auth.uid() is null or not public.sc_internal_access_allowed(array['admin','manager']) then raise exception 'Manager access required' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(17463,20261027);
 v=sc_certification.evaluate(p_configuration_id);
 if not (v->>'ready')::boolean then raise exception 'Certification blocked: %',v->'blockers' using errcode='23514'; end if;
 select id into existing_id from public.sc_variation_certifications where configuration_id=p_configuration_id and status='certified' and evidence_fingerprint=v->>'fingerprint';
 if existing_id is not null then return existing_id; end if;
 select * into c from public.sc_variation_configurations where id=p_configuration_id;
 with prior as (
  update public.sc_variation_certifications set status='revoked',revoked_at=clock_timestamp(),revocation_reason='Superseded by reviewed exact variation configuration'
   where product_id=c.product_id and status='certified' returning id,configuration_id
 ) insert into public.sc_certification_audit(certification_id,configuration_id,kind,reason)
  select id,configuration_id,'revoked','Superseded by reviewed exact variation configuration' from prior;

 insert into public.sc_variation_certifications(configuration_id,product_id,recipe_version_id,evidence_snapshot,evidence_fingerprint,status,certified_by)
 values(c.id,c.product_id,c.recipe_version_id,v->'snapshot',v->>'fingerprint','certified',auth.uid()) returning id into new_id;
 insert into public.sc_certification_audit(certification_id,configuration_id,kind,reason) values(new_id,c.id,'certified','Exact variation evidence validated');
 return new_id;
end $$;

create or replace function public.sc_job_line_readiness(p_job_item_ids bigint[],p_recipe_version_ids uuid[]) returns jsonb
language plpgsql security definer set search_path='' as $$
declare idx integer; result jsonb='[]'; t uuid; c uuid; chosen_recipe uuid;
begin
 if auth.uid() is null or not public.sc_internal_access_allowed(array['admin','manager','operator','viewer']) then raise exception 'Employee access required' using errcode='42501'; end if;
 if cardinality(p_job_item_ids) is distinct from cardinality(p_recipe_version_ids) or cardinality(p_job_item_ids)>2000 then raise exception 'Invalid readiness batch'; end if;
 perform pg_advisory_xact_lock(17463,20261027);
 if coalesce(cardinality(p_job_item_ids),0)=0 then return result; end if;
 for idx in 1..cardinality(p_job_item_ids) loop
  begin
   chosen_recipe=p_recipe_version_ids[idx];
   if sc_certification.managed_line(p_job_item_ids[idx]) then
    select recipe_version_id into chosen_recipe from public.sc_variation_certifications
     where product_id=sc_certification.line_product(p_job_item_ids[idx]) and status='certified';
   end if;
   c=sc_certification.require_line(p_job_item_ids[idx],chosen_recipe);
   select traveler_id into t from public.sc_job_traveler_lines where job_item_id=p_job_item_ids[idx] and superseded_at is null;
   if t is not null then perform sc_certification.require_traveler(t); end if;
   result=result||jsonb_build_array(jsonb_build_object('job_item_id',p_job_item_ids[idx],'ready',true,'certification_id',c,'recipe_version_id',chosen_recipe,'managed',sc_certification.managed_line(p_job_item_ids[idx]),'blockers','[]'::jsonb));
  exception when check_violation or raise_exception then
   result=result||jsonb_build_array(jsonb_build_object('job_item_id',p_job_item_ids[idx],'ready',false,'blockers',jsonb_build_array(SQLERRM)));
  end;
 end loop;
 return result;
end $$;
-- The evidence format now includes routing. Existing certificates need explicit
-- revalidation; never silently bless a new policy fingerprint.
with revoked as (
 update public.sc_variation_certifications set status='revoked',revoked_at=clock_timestamp(),revocation_reason='Variation routing evidence requires revalidation'
 where status='certified' returning id,configuration_id
) insert into public.sc_certification_audit(certification_id,configuration_id,kind,reason)
 select id,configuration_id,'revoked','Variation routing evidence requires revalidation' from revoked;
create unique index sc_variation_one_current_product on public.sc_variation_certifications(product_id) where status='certified';
notify pgrst,'reload schema';
