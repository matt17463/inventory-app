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
  select 1 from jsonb_array_elements(evidence) e where e->'artwork'->>'id'=al.artwork_asset_id::text)
  and exists(select 1 from jsonb_array_elements(evidence) e where not exists(
   select 1 from public.sc_client_graphic_variants variant
    join public.sc_client_graphic_families family on family.id=variant.family_id
    join public.sc_client_graphic_product_bindings binding on binding.graphic_family_id=family.id
   where binding.woo_product_id=p.woocommerce_product_id and binding.allowed and binding.verified_at is not null
    and family.state='approved' and variant.state='approved' and variant.artwork_asset_id::text=e->'artwork'->>'id')) then
  blockers=blockers||jsonb_build_array('Variation artwork needs its own verified approved graphic binding');
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

create or replace function sc_certification.order_spec(p_item bigint) returns jsonb
language sql security definer set search_path='' as $$
 select jsonb_build_object('job_id',i.job_id,'job_item_id',i.id,'product_id',sc_certification.line_product(i.id),
 'parent',i.woocommerce_product_id,'variation',i.woocommerce_variation_id,'blank',i.blank_product_id,
 'finished_product',i.finished_product_id,'placement',i.placement,'decoration_size',i.decoration_size,
 'size',i.size,'color',i.color,'attributes',i.selected_attributes,'quantity',i.quantity,
 'selected_brand',i.selected_brand,'selected_style',i.selected_style,'selected_color',i.selected_color,'selected_size',i.selected_size,
 'production_notes',i.production_notes,'artwork_note',i.artwork_note,'notes',i.notes,'order_sku',i.order_sku,'sku',i.sku,'logo_id',i.logo_id,'logo',i.logo,'source_blank_product_id',i.source_blank_product_id,
 'capture_states',(select coalesce(jsonb_agg(to_jsonb(c) order by c.woo_line_item_id),'[]') from public.sc_woo_graphic_capture_states c join public.jobs j on j.id=i.job_id where c.woo_order_id=j.woocommerce_order_id and c.woo_line_item_id=i.woocommerce_line_item_id),
 'checkout_graphic_metadata',(select coalesce(jsonb_agg(meta),'[]') from public.jobs j cross join lateral jsonb_array_elements(case when jsonb_typeof(j.woo_payload->'line_items')='array' then j.woo_payload->'line_items' else '[]' end) line cross join lateral jsonb_array_elements(case when jsonb_typeof(line->'meta_data')='array' then line->'meta_data' else '[]' end) meta where j.id=i.job_id and line->>'id'=i.woocommerce_line_item_id::text and lower(meta->>'key') in ('_sc_graphic_family_id','sc_graphic_family_id')),
 'graphic_selections',(select coalesce(jsonb_agg(to_jsonb(s) order by s.id),'[]') from public.sc_order_graphic_selections s join public.jobs j on j.id=i.job_id
  where s.job_item_id=i.id or(s.source='woocommerce' and s.external_order_id=j.woocommerce_order_id::text and s.external_line_id=i.woocommerce_line_item_id::text)),
 'placement_artwork',(select coalesce(jsonb_agg(to_jsonb(a) order by a.id),'[]') from public.sc_job_line_placement_artwork a where a.job_item_id=i.id))
 from public.job_items i where i.id=p_item
$$;

create or replace function public.sc_revalidate_traveler(p_traveler_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare t public.sc_job_travelers%rowtype; l record; c_id uuid;
begin
 if auth.uid() is null or not public.sc_internal_access_allowed(array['admin','manager']) then raise exception 'Manager access required' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(17463,20261027);
 select * into t from public.sc_job_travelers where id=p_traveler_id;
 if t.id is null then raise exception 'Traveler not found'; end if;
 if t.superseded_at is not null then raise exception 'Traveler was superseded; use its replacement'; end if;
 for l in select job_item_id from public.sc_job_traveler_lines where traveler_id=t.id union select t.job_item_id loop
  c_id=sc_certification.require_line(l.job_item_id,t.recipe_version_id);
  if c_id is not null then
   if exists(select 1 from public.sc_traveler_certification_bindings prior where prior.traveler_id=t.id and prior.job_item_id=l.job_item_id
    and (prior.order_snapshot-array['graphic_selections','placement_artwork','capture_states','checkout_graphic_metadata']) is distinct from (sc_certification.order_spec(l.job_item_id)-array['graphic_selections','placement_artwork','capture_states','checkout_graphic_metadata'])) then
    raise exception 'Originating order specifications changed; create a reviewed replacement traveler';
   end if;
   -- Revalidation cannot make old physical instructions describe a different revision.
   if t.recipe_snapshot->>'recipe_version_id' is distinct from t.recipe_version_id::text then raise exception 'Historical recipe snapshot does not match the certified revision'; end if;
   if exists(select 1 from public.sc_job_traveler_lines x where x.traveler_id=t.id and x.job_item_id=l.job_item_id
    and (coalesce(x.item_snapshot->>'size','') is distinct from coalesce((sc_certification.order_spec(l.job_item_id))->>'size','')
     or coalesce(x.item_snapshot->>'color','') is distinct from coalesce((sc_certification.order_spec(l.job_item_id))->>'color',''))) then
    raise exception 'Historical traveler variation differs; a reviewed replacement traveler is required';
   end if;
   if exists(select 1 from public.sc_traveler_certification_bindings prior
    join public.sc_variation_certifications old_cert on old_cert.id=prior.certification_id
    join public.sc_variation_certifications next_cert on next_cert.id=c_id
    where prior.traveler_id=t.id and prior.job_item_id=l.job_item_id and exists(
     select 1 from jsonb_array_elements(old_cert.evidence_snapshot->'placements') old_e
     where not exists(select 1 from jsonb_array_elements(next_cert.evidence_snapshot->'placements') new_e
      where new_e->'recipe_placement'=old_e->'recipe_placement'
       and new_e->'artwork'->>'id'=old_e->'artwork'->>'id'
       and new_e->'artwork'->>'storage_path' is not distinct from old_e->'artwork'->>'storage_path'
       and new_e->'artwork'->>'prepared_storage_path' is not distinct from old_e->'artwork'->>'prepared_storage_path'
       and new_e->'artwork'->>'updated_at' is not distinct from old_e->'artwork'->>'updated_at'
     ))) then raise exception 'Historical artwork changed; create a reviewed replacement traveler'; end if;
   if exists(select 1 from public.sc_variation_certifications c cross join lateral jsonb_array_elements(c.evidence_snapshot->'placements') e
    where c.id=c_id and (
     coalesce(e->'recipe_placement'->>'artwork_asset_id',t.recipe_snapshot->>'artwork_asset_id')=e->'artwork'->>'id'
     or exists(select 1 from public.sc_job_traveler_lines old_line cross join lateral jsonb_array_elements(coalesce(old_line.item_snapshot->'approved_placement_artwork','[]')) old_art
       where old_line.traveler_id=t.id and old_line.job_item_id=l.job_item_id
        and old_art->>'placement_name'=e->'recipe_placement'->>'placement_name' and old_art->>'artwork_asset_id'=e->'artwork'->>'id')
    ) is not true) then
    raise exception 'Historical traveler artwork differs; a reviewed replacement traveler is required';
   end if;
   insert into public.sc_traveler_certification_bindings(traveler_id,job_item_id,certification_id,order_snapshot,bound_by)
    values(t.id,l.job_item_id,c_id,sc_certification.order_spec(l.job_item_id),auth.uid()) on conflict do nothing;
   insert into public.sc_certification_audit(certification_id,kind,reason,details)
    values(c_id,'traveler_revalidated','Existing immutable traveler checked against current evidence',jsonb_build_object('traveler_id',t.id,'job_item_id',l.job_item_id));
  end if;
 end loop;
 perform sc_certification.require_traveler(t.id);
end $$;

create or replace function sc_certification.bind_traveler_line() returns trigger
language plpgsql security definer set search_path='' as $$
declare c_id uuid; rv uuid;
begin
 select recipe_version_id into rv from public.sc_job_travelers where id=new.traveler_id;
 c_id=sc_certification.require_line(new.job_item_id,rv);
 if c_id is not null then
  insert into public.sc_traveler_certification_bindings(traveler_id,job_item_id,certification_id,order_snapshot,bound_by)
  values(new.traveler_id,new.job_item_id,c_id,sc_certification.order_spec(new.job_item_id),auth.uid());
 end if;
 new.item_snapshot=jsonb_set(coalesce(new.item_snapshot,'{}'::jsonb),'{production_order_context}',sc_certification.order_spec(new.job_item_id),true);
 return new;
end $$;
drop trigger sc_certification_bind_line on public.sc_job_traveler_lines;
create trigger sc_certification_bind_line before insert on public.sc_job_traveler_lines for each row execute function sc_certification.bind_traveler_line();
create or replace function sc_certification.enroll_product() returns trigger
language plpgsql security definer set search_path='' as $$
declare parent_id bigint; graphic_required boolean=false;
begin
 if TG_TABLE_NAME='sc_variation_configurations' then
  select woocommerce_product_id into parent_id from public.products where id=new.product_id;
 elsif TG_TABLE_NAME='sc_catalog_recipe_assignments' then
  if new.disposition='assigned' then parent_id=new.woocommerce_product_id; end if;
 elsif new.allowed and new.verified_at is not null then parent_id=new.woo_product_id; graphic_required=new.mode in ('fixed','selectable');
 end if;
 if parent_id is not null then insert into sc_certification.managed_parents(woocommerce_product_id,graphic_selection_required) values(parent_id,graphic_required) on conflict(woocommerce_product_id) do update set graphic_selection_required=sc_certification.managed_parents.graphic_selection_required or excluded.graphic_selection_required; end if;
 return new;
end $$;
notify pgrst,'reload schema';
