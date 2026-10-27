-- Exact configuration certificates extend existing recipes, reviews and travelers.
-- No source approval or historical snapshot is created/rewritten by this migration.
create schema if not exists sc_certification;
revoke all on schema sc_certification from public, anon, authenticated;

create table public.sc_variation_configurations (
 id uuid primary key default gen_random_uuid(),
 product_id uuid not null references public.products(id) on delete restrict,
 recipe_version_id uuid not null references public.sc_manufacturing_recipe_versions(id) on delete restrict,
 -- One exact output per recipe placement, in the recipe's placement order.
 output_ids uuid[] not null check(cardinality(output_ids) between 1 and 30),
 review_evidence text not null check(length(trim(review_evidence))>=12),
 reviewed_by uuid not null,
 reviewed_at timestamptz not null default now(),
 unique(product_id,recipe_version_id)
);
create table public.sc_variation_certifications (
 id uuid primary key default gen_random_uuid(),
 configuration_id uuid not null references public.sc_variation_configurations(id) on delete restrict,
 product_id uuid not null references public.products(id) on delete restrict,
 recipe_version_id uuid not null references public.sc_manufacturing_recipe_versions(id) on delete restrict,
 evidence_snapshot jsonb not null,
 evidence_fingerprint text not null,
 status text not null check(status in ('certified','revoked')),
 certified_by uuid not null,
 certified_at timestamptz not null default now(),
 revoked_at timestamptz,
 revocation_reason text,
 check((status='certified' and revoked_at is null) or (status='revoked' and revoked_at is not null))
);
create unique index sc_variation_one_current_certificate on public.sc_variation_certifications(configuration_id) where status='certified';
create index sc_variation_certificate_product on public.sc_variation_certifications(product_id,recipe_version_id);
create table public.sc_certification_audit (
 id uuid primary key default gen_random_uuid(),
 certification_id uuid references public.sc_variation_certifications(id) on delete restrict,
 configuration_id uuid references public.sc_variation_configurations(id) on delete restrict,
 kind text not null,
 reason text not null,
 source_table text,
 actor_id uuid default auth.uid(),
 created_at timestamptz not null default now(),
 details jsonb not null default '{}'::jsonb
);
create index sc_certification_audit_certificate on public.sc_certification_audit(certification_id,created_at);
create table public.sc_traveler_certification_bindings (
 traveler_id uuid not null references public.sc_job_travelers(id) on delete restrict,
 job_item_id bigint not null references public.job_items(id) on delete restrict,
 certification_id uuid not null references public.sc_variation_certifications(id) on delete restrict,
 order_snapshot jsonb not null,
 bound_by uuid,
 bound_at timestamptz not null default now(),
 primary key(traveler_id,job_item_id,certification_id)
);
create index sc_traveler_certification_certificate on public.sc_traveler_certification_bindings(certification_id);

-- Storage receipts cover exact artwork revisions as well as object paths.
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
  select ja.artwork_asset_id
   from public.sc_job_line_placement_artwork ja
   where ja.job_item_id=new.job_item_id and ja.recipe_version_id=v_recipe
  union
  select (s.resolution_snapshot->>'artworkAssetId')::uuid
   from public.sc_order_graphic_selections s
   join public.job_items ji on ji.id=new.job_item_id
   join public.jobs j on j.id=ji.job_id
   where s.job_item_id=ji.id or (s.source='woocommerce' and s.external_order_id=j.woocommerce_order_id::text and s.external_line_id=ji.woocommerce_line_item_id::text)
 ) candidates where id is not null;
 select md5(coalesce(string_agg(
  a.id::text || ':' || coalesce(a.storage_provider,'') || ':' || coalesce(a.storage_bucket,'') || ':' ||
  coalesce(a.storage_path,'') || ':' || coalesce(a.preflight_status,'') || ':' || coalesce(to_char(a.updated_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),''),
  '|' order by a.id),'') ||
  coalesce((select '|placements:' || string_agg(ja.placement_name || ':' || ja.artwork_asset_id::text,
    '|' order by ja.placement_name,ja.artwork_asset_id)
   from public.sc_job_line_placement_artwork ja
   where ja.job_item_id=new.job_item_id and ja.recipe_version_id=v_recipe),''))
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

alter table public.sc_job_travelers add column superseded_at timestamptz;
alter table public.sc_job_traveler_lines add column superseded_at timestamptz;
alter table public.sc_job_travelers drop constraint sc_job_travelers_job_item_id_key;
alter table public.sc_job_traveler_lines drop constraint sc_job_traveler_lines_job_item_id_key;
create unique index sc_job_travelers_current_item on public.sc_job_travelers(job_item_id) where superseded_at is null;
create unique index sc_job_traveler_lines_current_item on public.sc_job_traveler_lines(job_item_id) where superseded_at is null;
create table public.sc_traveler_supersessions (
 prior_traveler_id uuid primary key references public.sc_job_travelers(id),
 replacement_traveler_id uuid not null references public.sc_job_travelers(id),
 reason text not null,
 actor_id uuid not null,
 created_at timestamptz not null default now()
);

create index sc_variation_configuration_recipe on public.sc_variation_configurations(recipe_version_id);
create index sc_variation_certificate_recipe on public.sc_variation_certifications(recipe_version_id);
create index sc_certification_audit_configuration on public.sc_certification_audit(configuration_id);
create index sc_traveler_certification_item on public.sc_traveler_certification_bindings(job_item_id);
create index sc_traveler_supersession_replacement on public.sc_traveler_supersessions(replacement_traveler_id);

-- A single transaction lock orders source edits, certification, and release. Source
-- statements acquire it BEFORE taking row locks; no validation/write race window.
create function sc_certification.lock_sources() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(17463,20261027);
 return null;
end $$;

create function sc_certification.product_spec(p public.products) returns jsonb
language sql immutable set search_path='' as $$
 select jsonb_build_object('id',p.id,'parent_id',p.woocommerce_product_id,
 'variation_id',p.woocommerce_variation_id,'blank_product_id',p.blank_product_id,
 'sku',p.sku,'size',p.size,'size_id',p.size_id,'color_id',p.color_id,
 'brand_id',p.brand_id,'product_type_id',p.product_type_id,'customer_id',p.customer_id,
 'logo_id',p.logo_id,'is_finished',p.is_finished,'woo_row_type',p.woo_row_type,
 'woocommerce_status',p.woocommerce_status)
$$;

create function sc_certification.evaluate(p_configuration uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 c public.sc_variation_configurations%rowtype; p public.products%rowtype; b public.blank_products%rowtype;
 rv public.sc_manufacturing_recipe_versions%rowtype; r public.sc_manufacturing_recipes%rowtype;
 m public.sc_material_recipes%rowtype; al public.sc_catalog_artwork_links%rowtype;
 o public.mockup_outputs%rowtype; pl public.mockup_placements%rowtype;
 a public.mockup_artwork_assets%rowtype; mb public.mockup_blank_assets%rowtype;
 pr public.mockup_projects%rowtype; cr public.mockup_reviews%rowtype;
 idx integer; pos jsonb; evidence jsonb='[]'; blockers jsonb='[]'; snap jsonb;
 latest_revision integer; graphic_state jsonb;
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
  if not exists(select 1 from public.sc_catalog_recipe_assignments ca where ca.woocommerce_product_id=p.woocommerce_product_id
    and ca.disposition='assigned' and ca.recipe_id=rv.recipe_id) then
   blockers=blockers||jsonb_build_array('Product routing does not assign this recipe');
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
  'machine_settings',to_jsonb(m),'client_graphics',graphic_state,'catalog_artwork',to_jsonb(al),'placements',evidence);
 return jsonb_build_object('ready',jsonb_array_length(blockers)=0,'blockers',blockers,'snapshot',snap,'fingerprint',md5(snap::text));
end $$;

-- Privileged helpers stay in an unexposed schema; public RPCs check employee role.
create function public.sc_save_variation_configuration(p_product_id uuid,p_recipe_version_id uuid,p_output_ids uuid[],p_review_evidence text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if auth.uid() is null or not public.sc_internal_access_allowed(array['admin','manager']) then raise exception 'Manager access required' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(17463,20261027);
 insert into public.sc_variation_configurations(product_id,recipe_version_id,output_ids,review_evidence,reviewed_by)
 values(p_product_id,p_recipe_version_id,p_output_ids,p_review_evidence,auth.uid())
 on conflict(product_id,recipe_version_id) do update set output_ids=excluded.output_ids,review_evidence=excluded.review_evidence,reviewed_by=auth.uid(),reviewed_at=clock_timestamp()
 returning id into v_id;
 insert into public.sc_certification_audit(configuration_id,kind,reason) values(v_id,'configuration_reviewed',p_review_evidence);
 return v_id;
end $$;
create function public.sc_check_variation_configuration(p_configuration_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.sc_internal_access_allowed(array['admin','manager','operator','viewer']) then raise exception 'Employee access required' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(17463,20261027);
 return sc_certification.evaluate(p_configuration_id);
end $$;
create function public.sc_certify_variation(p_configuration_id uuid) returns uuid
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
 insert into public.sc_variation_certifications(configuration_id,product_id,recipe_version_id,evidence_snapshot,evidence_fingerprint,status,certified_by)
 values(c.id,c.product_id,c.recipe_version_id,v->'snapshot',v->>'fingerprint','certified',auth.uid()) returning id into new_id;
 insert into public.sc_certification_audit(certification_id,configuration_id,kind,reason) values(new_id,c.id,'certified','Exact variation evidence validated');
 return new_id;
end $$;

create function sc_certification.revalidate_sources() returns trigger
language plpgsql security definer set search_path='' as $$
declare c record; v jsonb;
begin
 for c in select * from public.sc_variation_certifications where status='certified' loop
  v=sc_certification.evaluate(c.configuration_id);
  if not (v->>'ready')::boolean or c.evidence_fingerprint is distinct from v->>'fingerprint' then
   update public.sc_variation_certifications set status='revoked',revoked_at=clock_timestamp(),
    revocation_reason=TG_TABLE_NAME||': evidence changed or withdrawn' where id=c.id;
   insert into public.sc_certification_audit(certification_id,configuration_id,kind,reason,source_table,details)
   values(c.id,c.configuration_id,'revoked',TG_TABLE_NAME||': evidence changed or withdrawn',TG_TABLE_NAME,
    jsonb_build_object('blockers',v->'blockers','prior_fingerprint',c.evidence_fingerprint,'current_fingerprint',v->>'fingerprint',
     'affected_travelers',(select coalesce(jsonb_agg(distinct traveler_id),'[]') from public.sc_traveler_certification_bindings where certification_id=c.id)));
  end if;
 end loop;
 return null;
end $$;

-- Enrollment is sticky: withdrawing a graphic binding cannot downgrade a managed
-- product into the legacy path. Ordinary catalog review queues do not enroll it.
create table sc_certification.managed_parents (
 woocommerce_product_id bigint primary key,
 graphic_selection_required boolean not null default false,
 enrolled_at timestamptz not null default now()
);
alter table sc_certification.managed_parents enable row level security;
insert into sc_certification.managed_parents(woocommerce_product_id,graphic_selection_required)
 select distinct woo_product_id,true from public.sc_client_graphic_product_bindings where allowed and verified_at is not null on conflict do nothing;
insert into sc_certification.managed_parents(woocommerce_product_id) select woocommerce_product_id from public.sc_catalog_recipe_assignments where disposition='assigned' on conflict do nothing;
create function sc_certification.enroll_product() returns trigger
language plpgsql security definer set search_path='' as $$
declare parent_id bigint; graphic_required boolean=false;
begin
 if TG_TABLE_NAME='sc_variation_configurations' then
  select woocommerce_product_id into parent_id from public.products where id=new.product_id;
 elsif TG_TABLE_NAME='sc_catalog_recipe_assignments' then
  if new.disposition='assigned' then parent_id=new.woocommerce_product_id; end if;
 elsif new.allowed and new.verified_at is not null then parent_id=new.woo_product_id; graphic_required=true;
 end if;
 if parent_id is not null then insert into sc_certification.managed_parents(woocommerce_product_id,graphic_selection_required) values(parent_id,graphic_required) on conflict(woocommerce_product_id) do update set graphic_selection_required=sc_certification.managed_parents.graphic_selection_required or excluded.graphic_selection_required; end if;
 return new;
end $$;
create trigger sc_certification_enroll after insert or update on public.sc_variation_configurations for each row execute function sc_certification.enroll_product();
create trigger sc_certification_enroll after insert or update on public.sc_catalog_recipe_assignments for each row execute function sc_certification.enroll_product();
create trigger sc_certification_enroll after insert or update on public.sc_client_graphic_product_bindings for each row execute function sc_certification.enroll_product();

-- Bind every order channel to the same exact product and certificate.
create function sc_certification.line_product(p_item bigint) returns uuid
language plpgsql security definer set search_path='' as $$
declare i public.job_items%rowtype; ids uuid[];
begin
 select * into i from public.job_items where id=p_item;
 if i.finished_product_id is not null then
  select array_agg(id) into ids from public.products p where p.id=i.finished_product_id
   and (i.woocommerce_variation_id is null or i.woocommerce_variation_id=0 or p.woocommerce_variation_id=i.woocommerce_variation_id)
   and (i.woocommerce_product_id is null or p.woocommerce_product_id=i.woocommerce_product_id);
 elsif coalesce(i.woocommerce_variation_id,0)>0 then
  select array_agg(id) into ids from public.products p where p.woocommerce_variation_id=i.woocommerce_variation_id
   and (i.woocommerce_product_id is null or p.woocommerce_product_id=i.woocommerce_product_id);
 elsif i.woocommerce_product_id is not null then
  select array_agg(id) into ids from public.products p where p.woocommerce_product_id=i.woocommerce_product_id and coalesce(p.woocommerce_variation_id,0)=0
   and not exists(select 1 from public.products v where v.woocommerce_product_id=i.woocommerce_product_id and coalesce(v.woocommerce_variation_id,0)>0);
 end if;
 if cardinality(ids)=1 then return ids[1]; end if;
 return null;
end $$;
create function sc_certification.managed_line(p_item bigint) returns boolean
language sql security definer set search_path='' as $$
 select exists(select 1 from public.job_items i join public.jobs j on j.id=i.job_id where i.id=p_item and (
  exists(select 1 from sc_certification.managed_parents mp where mp.woocommerce_product_id=coalesce(i.woocommerce_product_id,(select p.woocommerce_product_id from public.products p where p.id=i.finished_product_id)))
  or exists(select 1 from public.sc_traveler_certification_bindings tb where tb.job_item_id=i.id)
  or exists(select 1 from public.sc_order_graphic_selections s where s.job_item_id=i.id or (s.source='woocommerce' and s.external_order_id=j.woocommerce_order_id::text and s.external_line_id=i.woocommerce_line_item_id::text))
  or exists(select 1 from public.sc_woo_graphic_capture_states s where s.woo_order_id=j.woocommerce_order_id and s.woo_line_item_id=i.woocommerce_line_item_id)
  or exists(select 1 from public.sc_client_graphic_product_bindings b where b.woo_product_id=coalesce(i.woocommerce_product_id,(select p.woocommerce_product_id from public.products p where p.id=sc_certification.line_product(i.id))) and b.allowed and b.verified_at is not null)
  or exists(select 1 from public.sc_variation_configurations c join public.products cp on cp.id=c.product_id where c.product_id=sc_certification.line_product(i.id) or (cp.woocommerce_product_id is not null and cp.woocommerce_product_id=coalesce(i.woocommerce_product_id,(select q.woocommerce_product_id from public.products q where q.id=i.finished_product_id))))
  or exists(select 1 from jsonb_array_elements(case when jsonb_typeof(j.woo_payload->'line_items')='array' then j.woo_payload->'line_items' else '[]' end) l
    cross join lateral jsonb_array_elements(case when jsonb_typeof(l->'meta_data')='array' then l->'meta_data' else '[]' end) m
    where l->>'id'=i.woocommerce_line_item_id::text and lower(m->>'key') in ('_sc_graphic_family_id','sc_graphic_family_id'))
 ))
$$;
create function sc_certification.order_spec(p_item bigint) returns jsonb
language sql security definer set search_path='' as $$
 select jsonb_build_object('job_id',i.job_id,'job_item_id',i.id,'product_id',sc_certification.line_product(i.id),
 'parent',i.woocommerce_product_id,'variation',i.woocommerce_variation_id,'blank',i.blank_product_id,
 'finished_product',i.finished_product_id,'placement',i.placement,'decoration_size',i.decoration_size,
 'size',i.size,'color',i.color,'attributes',i.selected_attributes,'quantity',i.quantity,
 'capture_states',(select coalesce(jsonb_agg(to_jsonb(c) order by c.woo_line_item_id),'[]') from public.sc_woo_graphic_capture_states c join public.jobs j on j.id=i.job_id where c.woo_order_id=j.woocommerce_order_id and c.woo_line_item_id=i.woocommerce_line_item_id),
 'checkout_graphic_metadata',(select coalesce(jsonb_agg(meta),'[]') from public.jobs j cross join lateral jsonb_array_elements(case when jsonb_typeof(j.woo_payload->'line_items')='array' then j.woo_payload->'line_items' else '[]' end) line cross join lateral jsonb_array_elements(case when jsonb_typeof(line->'meta_data')='array' then line->'meta_data' else '[]' end) meta where j.id=i.job_id and line->>'id'=i.woocommerce_line_item_id::text and lower(meta->>'key') in ('_sc_graphic_family_id','sc_graphic_family_id')),
 'graphic_selections',(select coalesce(jsonb_agg(to_jsonb(s) order by s.id),'[]') from public.sc_order_graphic_selections s join public.jobs j on j.id=i.job_id
  where s.job_item_id=i.id or(s.source='woocommerce' and s.external_order_id=j.woocommerce_order_id::text and s.external_line_id=i.woocommerce_line_item_id::text)),
 'placement_artwork',(select coalesce(jsonb_agg(to_jsonb(a) order by a.id),'[]') from public.sc_job_line_placement_artwork a where a.job_item_id=i.id))
 from public.job_items i where i.id=p_item
$$;
create function sc_certification.selection_is_current(s public.sc_order_graphic_selections) returns boolean
language sql security definer set search_path='' as $$
 with candidates as (
  select rule.id,rule.variant_id,v.artwork_asset_id,v.version,rule.priority,
   (select count(*) from unnest(array['garment_type','garment_style','garment_color','color_group','size_group','placement_name','process']) field where trim(coalesce(to_jsonb(rule)->>field,''))<>'') specificity
  from public.sc_client_graphic_rules rule join public.sc_client_graphic_variants v on v.id=rule.variant_id and v.family_id=rule.family_id
   join public.sc_client_graphic_families f on f.id=rule.family_id
  where rule.family_id=s.family_id and f.state='approved' and v.state='approved' and rule.enabled
   and (rule.effective_from is null or rule.effective_from<=clock_timestamp())
   and (rule.effective_until is null or rule.effective_until>clock_timestamp())
   and not exists(select 1 from unnest(array['garment_type','garment_style','garment_color','color_group','size_group','placement_name','process']) field
    where trim(coalesce(to_jsonb(rule)->>field,''))<>'' and lower(trim(to_jsonb(rule)->>field))<>lower(trim(coalesce(s.selected_payload->>field,''))))
 ), ranked as (select *,dense_rank() over(order by priority desc,specificity desc) ranking from candidates)
 select coalesce((select count(distinct variant_id)=1 and bool_and(variant_id::text=s.resolution_snapshot->>'variantId' and artwork_asset_id::text=s.resolution_snapshot->>'artworkAssetId' and version::text=s.resolution_snapshot->>'variantVersion')
  from ranked where ranking=1),false)
$$;
create function sc_certification.require_line(p_item bigint,p_recipe uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare p_id uuid; cert public.sc_variation_certifications%rowtype; v jsonb; i public.job_items%rowtype;
begin
 perform pg_advisory_xact_lock(17463,20261027);
 if not sc_certification.managed_line(p_item) then return null; end if;
 p_id=sc_certification.line_product(p_item);
 if p_id is null then raise exception 'Managed production requires an unambiguous exact variation (line %)',p_item using errcode='23514'; end if;
 select * into i from public.job_items where id=p_item;
 if exists(select 1 from public.products p where p.id=p_id and nullif(trim(p.size),'') is not null and nullif(trim(coalesce(i.selected_size,i.size)), '') is not null
  and lower(trim(p.size))<>lower(trim(coalesce(i.selected_size,i.size)))) then raise exception 'Order size differs from certified variation'; end if;
 if exists(select 1 from public.sc_woo_graphic_capture_states c join public.jobs j on j.id=i.job_id
   where c.woo_order_id=j.woocommerce_order_id and c.woo_line_item_id=i.woocommerce_line_item_id and c.status<>'managed_resolved') then raise exception 'Managed Woo artwork capture is unresolved'; end if;
 if exists(select 1 from public.jobs j where j.id=i.job_id and j.woocommerce_order_id is not null and (
   exists(select 1 from sc_certification.managed_parents mp join public.products p on p.woocommerce_product_id=mp.woocommerce_product_id where p.id=p_id and mp.graphic_selection_required)
   or jsonb_array_length(sc_certification.order_spec(i.id)->'checkout_graphic_metadata')>0
   or exists(select 1 from public.sc_woo_graphic_capture_states c where c.woo_order_id=j.woocommerce_order_id and c.woo_line_item_id=i.woocommerce_line_item_id))
   and not exists(select 1 from public.sc_order_graphic_selections sel where sel.job_item_id=i.id or(sel.source='woocommerce' and sel.external_order_id=j.woocommerce_order_id::text and sel.external_line_id=i.woocommerce_line_item_id::text))) then raise exception 'Managed Woo selection is missing its exact artwork assignment'; end if;
 select * into cert from public.sc_variation_certifications where product_id=p_id and recipe_version_id=p_recipe and status='certified';
 if cert.id is null then raise exception 'Managed production requires a current variation certificate (line %)',p_item using errcode='23514'; end if;
 v=sc_certification.evaluate(cert.configuration_id);
 if not (v->>'ready')::boolean or cert.evidence_fingerprint is distinct from v->>'fingerprint' then raise exception 'Variation certificate evidence is stale (line %)',p_item using errcode='23514'; end if;
 if i.blank_product_id is not null and i.blank_product_id::text is distinct from cert.evidence_snapshot->'product'->>'blank_product_id' then raise exception 'Order blank differs from certified variation'; end if;
 if (select count(*) from public.sc_order_graphic_selections sel join public.jobs j on j.id=i.job_id where sel.job_item_id=i.id or(sel.source='woocommerce' and sel.external_order_id=j.woocommerce_order_id::text and sel.external_line_id=i.woocommerce_line_item_id::text))>1 then raise exception 'Conflicting customer graphic selections for this order line'; end if;
 -- Generic recipe placement files must equal the certified files, not merely pass preflight.
 if exists(select 1 from jsonb_array_elements(cert.evidence_snapshot->'placements') e
   where not exists(select 1 from public.sc_manufacturing_recipe_versions rv
    where rv.id=p_recipe and (coalesce(e->'recipe_placement'->>'artwork_asset_id',rv.artwork_asset_id::text)=e->'artwork'->>'id'
     or exists(select 1 from public.sc_job_line_placement_artwork a where a.job_item_id=p_item and a.recipe_version_id=p_recipe
      and a.placement_name=e->'recipe_placement'->>'placement_name' and a.artwork_asset_id::text=e->'artwork'->>'id')))) then
  raise exception 'Order placement artwork differs from certified configuration';
 end if;
 if exists(select 1 from public.sc_order_graphic_selections s join public.jobs j on j.id=i.job_id
   where (s.job_item_id=i.id or(s.source='woocommerce' and s.external_order_id=j.woocommerce_order_id::text and s.external_line_id=i.woocommerce_line_item_id::text))
   and (s.resolution_snapshot->>'status' is distinct from 'resolved' or not exists(
    select 1 from jsonb_array_elements(cert.evidence_snapshot->'placements') e where e->'artwork'->>'id'=s.resolution_snapshot->>'artworkAssetId'))) then
  raise exception 'Customer-selected artwork differs from certified configuration';
 end if;
 if exists(select 1 from public.sc_order_graphic_selections sel join public.jobs j on j.id=i.job_id
  where (sel.job_item_id=i.id or(sel.source='woocommerce' and sel.external_order_id=j.woocommerce_order_id::text and sel.external_line_id=i.woocommerce_line_item_id::text))
   and not sc_certification.selection_is_current(sel)) then raise exception 'Customer graphic rule, family or approved revision is stale or ambiguous'; end if;
 return cert.id;
end $$;
create function sc_certification.bind_traveler_line() returns trigger
language plpgsql security definer set search_path='' as $$
declare c_id uuid; rv uuid;
begin
 select recipe_version_id into rv from public.sc_job_travelers where id=new.traveler_id;
 c_id=sc_certification.require_line(new.job_item_id,rv);
 if c_id is not null then
  insert into public.sc_traveler_certification_bindings(traveler_id,job_item_id,certification_id,order_snapshot,bound_by)
  values(new.traveler_id,new.job_item_id,c_id,sc_certification.order_spec(new.job_item_id),auth.uid());
 end if;
 return new;
end $$;
create trigger sc_certification_bind_line after insert on public.sc_job_traveler_lines for each row execute function sc_certification.bind_traveler_line();

create function sc_certification.require_traveler(p_traveler uuid) returns void
language plpgsql security definer set search_path='' as $$
declare t public.sc_job_travelers%rowtype; l record; c_id uuid;
begin
 perform pg_advisory_xact_lock(17463,20261027);
 select * into t from public.sc_job_travelers where id=p_traveler;
 if t.id is null then raise exception 'Traveler not found'; end if;
 if t.superseded_at is not null then raise exception 'Traveler was superseded; use its replacement'; end if;
 for l in select job_item_id from public.sc_job_traveler_lines where traveler_id=t.id union select t.job_item_id loop
  c_id=sc_certification.require_line(l.job_item_id,t.recipe_version_id);
  if c_id is not null and not exists(select 1 from public.sc_traveler_certification_bindings b
    where b.traveler_id=t.id and b.job_item_id=l.job_item_id and b.certification_id=c_id
     and b.order_snapshot=sc_certification.order_spec(l.job_item_id)) then
   raise exception 'Existing managed traveler needs current evidence revalidation (line %)',l.job_item_id using errcode='23514';
  end if;
 end loop;
end $$;
create function public.sc_revalidate_traveler(p_traveler_id uuid) returns void
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
create function public.sc_check_traveler_certification(p_traveler_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.sc_internal_access_allowed(array['admin','manager','operator','viewer']) then raise exception 'Employee access required' using errcode='42501'; end if;
 begin
  perform sc_certification.require_traveler(p_traveler_id);
  return jsonb_build_object('ready',true,'managed',exists(select 1 from public.sc_job_traveler_lines l where l.traveler_id=p_traveler_id and sc_certification.managed_line(l.job_item_id)),'blockers','[]'::jsonb);
 exception when check_violation or raise_exception then return jsonb_build_object('ready',false,'blockers',jsonb_build_array(SQLERRM)); end;
end $$;

create function sc_certification.guard_progress() returns trigger
language plpgsql security definer set search_path='' as $$
declare i record; t_id uuid;
begin
 perform pg_advisory_xact_lock(17463,20261027);
 if TG_TABLE_NAME='sc_job_traveler_events' then
  if new.kind not in ('note','exception') then perform sc_certification.require_traveler(new.traveler_id); end if;
 elsif TG_TABLE_NAME='job_items' then
  if TG_OP='UPDATE' and new.status is not distinct from old.status then return new; end if;
  if lower(coalesce(new.status,'')) in ('ready_to_produce','in_production','production','printing','qc','ready_to_ship','production_complete','completed','complete') and sc_certification.managed_line(new.id) then
   select traveler_id into t_id from public.sc_job_traveler_lines where job_item_id=new.id and superseded_at is null;
   if t_id is null then raise exception 'Managed production requires a certified traveler for line %',new.id; end if;
   perform sc_certification.require_traveler(t_id);
  end if;
 elsif TG_TABLE_NAME='jobs' then
  if TG_OP='UPDATE' and new.status is not distinct from old.status and new.production_status is not distinct from old.production_status and new.production_completed_at is not distinct from old.production_completed_at then return new; end if;
  if lower(coalesce(new.status,'')) in ('ready_to_produce','in_production','production','printing','qc','ready_to_ship','production_complete','completed','complete') or lower(coalesce(new.production_status,'')) in ('ready_to_produce','in_production','qc','ready_to_ship','production_complete','completed') or new.production_completed_at is not null then
   for i in select id from public.job_items where job_id=new.id and lower(coalesce(status,'')) not in ('cancelled','canceled','voided','removed') loop
    if sc_certification.managed_line(i.id) then
     select traveler_id into t_id from public.sc_job_traveler_lines where job_item_id=i.id and superseded_at is null;
     if t_id is null then raise exception 'Managed production requires a certified traveler for line %',i.id; end if;
     perform sc_certification.require_traveler(t_id);
    end if;
   end loop;
  end if;
 end if;
 return new;
end $$;
create trigger sc_certification_progress before insert on public.sc_job_traveler_events for each row execute function sc_certification.guard_progress();
create trigger sc_certification_progress after insert or update on public.job_items for each row execute function sc_certification.guard_progress();
create trigger sc_certification_progress after update on public.jobs for each row execute function sc_certification.guard_progress();

create function public.sc_job_line_readiness(p_job_item_ids bigint[],p_recipe_version_ids uuid[]) returns jsonb
language plpgsql security definer set search_path='' as $$
declare idx integer; result jsonb='[]'; t uuid; c uuid;
begin
 if auth.uid() is null or not public.sc_internal_access_allowed(array['admin','manager','operator','viewer']) then raise exception 'Employee access required' using errcode='42501'; end if;
 if cardinality(p_job_item_ids) is distinct from cardinality(p_recipe_version_ids) or cardinality(p_job_item_ids)>2000 then raise exception 'Invalid readiness batch'; end if;
 perform pg_advisory_xact_lock(17463,20261027);
 if coalesce(cardinality(p_job_item_ids),0)=0 then return result; end if;
 for idx in 1..cardinality(p_job_item_ids) loop
  begin
   c=sc_certification.require_line(p_job_item_ids[idx],p_recipe_version_ids[idx]);
   select traveler_id into t from public.sc_job_traveler_lines where job_item_id=p_job_item_ids[idx] and superseded_at is null;
   if t is not null then perform sc_certification.require_traveler(t); end if;
   result=result||jsonb_build_array(jsonb_build_object('job_item_id',p_job_item_ids[idx],'ready',true,'certification_id',c,'managed',sc_certification.managed_line(p_job_item_ids[idx]),'blockers','[]'::jsonb));
  exception when check_violation or raise_exception then
   result=result||jsonb_build_array(jsonb_build_object('job_item_id',p_job_item_ids[idx],'ready',false,'blockers',jsonb_build_array(SQLERRM)));
  end;
 end loop;
 return result;
end $$;

-- Production packets and artwork handoff release use the same certificate policy.
create function sc_certification.require_project(p_project uuid) returns void
language plpgsql security definer set search_path='' as $$
declare parent bigint; p record; c public.sc_variation_certifications%rowtype; v jsonb;
begin
 perform pg_advisory_xact_lock(17463,20261027);
 select woo_product_id into parent from public.mockup_projects where id=p_project;
 if not exists(select 1 from sc_certification.managed_parents where woocommerce_product_id=parent) then return; end if;
 for p in select id from public.products where woocommerce_product_id=parent and (coalesce(woocommerce_variation_id,0)>0 or not exists(select 1 from public.products x where x.woocommerce_product_id=parent and coalesce(x.woocommerce_variation_id,0)>0)) loop
  select vc.* into c from public.sc_variation_certifications vc
   where vc.product_id=p.id and vc.status='certified' and exists(select 1 from jsonb_array_elements(vc.evidence_snapshot->'placements') e where e->'output'->>'project_id'=p_project::text);
  if c.id is null then raise exception 'Production packet requires current certificates for every included variation'; end if;
  v=sc_certification.evaluate(c.configuration_id);
  if not (v->>'ready')::boolean or c.evidence_fingerprint is distinct from v->>'fingerprint' then raise exception 'Production packet evidence is stale'; end if;
 end loop;
end $$;
create function sc_certification.guard_auxiliary_release() returns trigger
language plpgsql security definer set search_path='' as $$
declare linked_job bigint; i record; t uuid;
begin
 perform pg_advisory_xact_lock(17463,20261027);
 if TG_TABLE_NAME='mockup_production_packets' then
  if new.status in ('ready','printed','completed') then perform sc_certification.require_project(new.project_id); end if;
 elsif TG_TABLE_NAME='mockup_projects' then
  if new.status='production_ready' then perform sc_certification.require_project(new.id); end if;
 elsif TG_TABLE_NAME='sc_approval_production_handoffs' and new.automation_status='ready_for_production' then
  for linked_job in select l.job_id from public.sc_job_artwork_links l where l.handoff_id=new.id
    union select new.production_job_id::bigint where new.production_job_id ~ '^[0-9]+$' loop
   for i in select id from public.job_items where job_id=linked_job loop
    if sc_certification.managed_line(i.id) then
     select traveler_id into t from public.sc_job_traveler_lines where job_item_id=i.id and superseded_at is null;
     if t is null then raise exception 'Managed artwork release requires a certified production traveler'; end if;
     perform sc_certification.require_traveler(t);
    end if;
   end loop;
  end loop;
 end if;
 return new;
end $$;
create trigger sc_certification_packet_release before insert or update on public.mockup_production_packets for each row execute function sc_certification.guard_auxiliary_release();
create trigger sc_certification_project_release before update on public.mockup_projects for each row execute function sc_certification.guard_auxiliary_release();
create trigger sc_certification_handoff_release before insert or update on public.sc_approval_production_handoffs for each row execute function sc_certification.guard_auxiliary_release();

create function sc_certification.audit_order_changes() returns trigger
language plpgsql security definer set search_path='' as $$
declare b record; fingerprint text;
begin
 for b in select * from public.sc_traveler_certification_bindings loop
  fingerprint=md5(coalesce(sc_certification.order_spec(b.job_item_id)::text,'missing'));
  if b.order_snapshot is distinct from sc_certification.order_spec(b.job_item_id)
   and not exists(select 1 from public.sc_certification_audit a where a.kind='traveler_invalidated' and a.certification_id=b.certification_id
    and a.details->>'traveler_id'=b.traveler_id::text and a.details->>'order_fingerprint'=fingerprint) then
   insert into public.sc_certification_audit(certification_id,kind,reason,source_table,details)
    values(b.certification_id,'traveler_invalidated','Originating order evidence changed',TG_TABLE_NAME,
     jsonb_build_object('traveler_id',b.traveler_id,'job_item_id',b.job_item_id,'order_fingerprint',fingerprint));
  end if;
 end loop;
 return null;
end $$;
do $$ declare tbl text; begin
 foreach tbl in array array['job_items','jobs','sc_order_graphic_selections','sc_job_line_placement_artwork','sc_woo_graphic_capture_states'] loop
  execute format('create trigger sc_certification_order_audit after insert or update or delete on public.%I for each statement execute function sc_certification.audit_order_changes()',tbl);
 end loop;
end $$;

-- Source edits revoke only certificates whose reproducible evidence actually changed.
-- Stock movement, notes and unrelated product edits leave certificates alone.
do $$
declare tbl text;
begin
 foreach tbl in array array['products','blank_products','sc_variation_configurations','sc_catalog_artwork_links','sc_catalog_recipe_assignments',
  'sc_manufacturing_recipes','sc_manufacturing_recipe_versions','sc_material_recipes','mockup_projects','mockup_blank_assets',
  'mockup_artwork_assets','mockup_placements','mockup_outputs','mockup_reviews','sc_client_graphic_families','sc_client_graphic_variants','sc_client_graphic_rules','sc_client_graphic_product_bindings'] loop
  execute format('create trigger sc_certification_source_lock before insert or update or delete on public.%I for each statement execute function sc_certification.lock_sources()',tbl);
  execute format('create trigger sc_certification_source_revalidate after insert or update or delete on public.%I for each statement execute function sc_certification.revalidate_sources()',tbl);
 end loop;
 foreach tbl in array array['jobs','job_items','sc_job_travelers','sc_job_traveler_lines','sc_job_traveler_events','sc_order_graphic_selections','sc_job_line_placement_artwork','sc_woo_graphic_capture_states','sc_client_graphic_product_bindings','mockup_production_packets','sc_approval_production_handoffs','sc_job_artwork_links'] loop
  execute format('create trigger sc_certification_order_lock before insert or update or delete on public.%I for each statement execute function sc_certification.lock_sources()',tbl);
 end loop;
end $$;

create or replace function public.sc_create_grouped_traveler(
 p_job_id bigint,p_job_item_ids bigint[],p_recipe_version_id uuid
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_item bigint; v_primary bigint; v_traveler uuid; v_count integer; v_expected integer;
declare i public.job_items%rowtype;
begin
 perform pg_advisory_xact_lock(17463,20261027);
 if auth.uid() is null or not public.sc_internal_access_allowed(array['admin','manager','operator']) then
  raise exception 'Insufficient permission' using errcode='42501';
 end if;
 if p_job_id is null or p_recipe_version_id is null or p_job_item_ids is null
    or cardinality(p_job_item_ids)=0 or cardinality(p_job_item_ids)>100 then
  raise exception 'Select 1–100 job lines and an approved recipe';
 end if;
 select count(distinct x),count(*) into v_expected,v_count from unnest(p_job_item_ids) x;
 if v_expected<>v_count or v_expected=0 or exists(select 1 from unnest(p_job_item_ids) x where x is null) then
  raise exception 'Duplicate or empty job lines not allowed';
 end if;
 perform 1 from public.jobs where id=p_job_id for update;
 if not found then raise exception 'Production job was not found'; end if;
 if not exists(select 1 from public.sc_manufacturing_recipe_versions
    where id=p_recipe_version_id and status='approved') then
  raise exception 'Select an approved recipe revision';
 end if;
 select count(*) into v_count from public.job_items where job_id=p_job_id and id=any(p_job_item_ids) and quantity>0;
 if v_count<>v_expected then raise exception 'All selected lines must belong to this job and have positive quantities'; end if;
 if exists(select 1 from public.sc_job_traveler_lines where job_item_id=any(p_job_item_ids) and superseded_at is null)
 or exists(select 1 from public.sc_job_travelers where job_item_id=any(p_job_item_ids) and superseded_at is null) then
  raise exception 'One or more selected lines already have a traveler';
 end if;
 select min(x) into v_primary from unnest(p_job_item_ids) x;
 insert into public.sc_job_travelers(job_id,job_item_id,recipe_version_id,created_by)
 values(p_job_id,v_primary,p_recipe_version_id,auth.uid()) returning id into v_traveler;
 for v_item in select distinct x from unnest(p_job_item_ids) x where x<>v_primary loop
  select * into i from public.job_items where id=v_item;
  insert into public.sc_job_traveler_lines(traveler_id,job_item_id,quantity,item_snapshot)
  values(v_traveler,i.id,i.quantity,jsonb_build_object(
   'sku',coalesce(i.order_sku,i.sku),'size',i.size,'color',i.color,
   'name',coalesce(i.ordered_product_name,i.item_name,i.name),'quantity',i.quantity,
   'brand',i.brand,'product_type',i.product_type,'placement',i.placement));
 end loop;
 return v_traveler;
end $$;
revoke all on function public.sc_create_grouped_traveler(bigint,bigint[],uuid) from public,anon;
grant execute on function public.sc_create_grouped_traveler(bigint,bigint[],uuid) to authenticated;

create function public.sc_replace_managed_traveler(p_traveler_id uuid,p_recipe_version_id uuid,p_reason text)
returns uuid language plpgsql security definer set search_path='' as $$
declare t public.sc_job_travelers%rowtype; ids bigint[]; new_id uuid; item bigint;
begin
 if auth.uid() is null or not public.sc_internal_access_allowed(array['admin','manager']) then raise exception 'Manager access required' using errcode='42501'; end if;
 if length(trim(p_reason))<12 then raise exception 'Explain the reviewed replacement'; end if;
 perform pg_advisory_xact_lock(17463,20261027);
 select * into t from public.sc_job_travelers where id=p_traveler_id and superseded_at is null for update;
 if t.id is null then raise exception 'Active traveler not found'; end if;
 select array_agg(job_item_id order by job_item_id) into ids from public.sc_job_traveler_lines where traveler_id=t.id;
 foreach item in array ids loop perform sc_certification.require_line(item,p_recipe_version_id); end loop;
 update public.sc_job_traveler_lines set superseded_at=clock_timestamp() where traveler_id=t.id;
 update public.sc_job_travelers set superseded_at=clock_timestamp() where id=t.id;
 new_id=public.sc_create_grouped_traveler(t.job_id,ids,p_recipe_version_id);
 insert into public.sc_traveler_supersessions(prior_traveler_id,replacement_traveler_id,reason,actor_id) values(t.id,new_id,p_reason,auth.uid());
 insert into public.sc_certification_audit(kind,reason,details) values('traveler_replaced',p_reason,jsonb_build_object('prior_traveler_id',t.id,'replacement_traveler_id',new_id));
 return new_id;
end $$;
revoke all on function public.sc_replace_managed_traveler(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.sc_replace_managed_traveler(uuid,uuid,text) to authenticated;

-- Existing snapshots and the evidence/audit ledger are immutable to all API roles.
create function sc_certification.immutable() returns trigger language plpgsql set search_path='' as $$
begin
 if TG_TABLE_NAME in ('sc_job_travelers','sc_job_traveler_lines') and TG_OP='UPDATE'
  and current_user=pg_get_userbyid((select relowner from pg_class where oid=TG_RELID))
  and old.superseded_at is null and new.superseded_at is not null
  and (to_jsonb(old)-'superseded_at')=(to_jsonb(new)-'superseded_at') then return new; end if;
 raise exception 'Historical production evidence is immutable' using errcode='42501';
end $$;
create function sc_certification.guard_certificate_history() returns trigger language plpgsql set search_path='' as $$
begin
 if TG_OP='DELETE' then raise exception 'Certification history is immutable'; end if;
 if old.status<>'certified' or new.status<>'revoked' or (to_jsonb(old)-array['status','revoked_at','revocation_reason']) is distinct from (to_jsonb(new)-array['status','revoked_at','revocation_reason']) then raise exception 'Certification evidence is immutable'; end if;
 return new;
end $$;
create trigger sc_certification_history before update or delete on public.sc_variation_certifications for each row execute function sc_certification.guard_certificate_history();
create trigger sc_certification_immutable before update or delete on public.sc_job_travelers for each row execute function sc_certification.immutable();
create trigger sc_certification_immutable before update or delete on public.sc_job_traveler_lines for each row execute function sc_certification.immutable();
create trigger sc_certification_immutable before update or delete on public.sc_traveler_supersessions for each row execute function sc_certification.immutable();
create trigger sc_certification_immutable before update or delete on public.sc_job_traveler_events for each row execute function sc_certification.immutable();
create trigger sc_certification_immutable before update or delete on public.sc_certification_audit for each row execute function sc_certification.immutable();
create trigger sc_certification_immutable before update or delete on public.sc_traveler_certification_bindings for each row execute function sc_certification.immutable();

do $$ declare tbl text; begin
 foreach tbl in array array['sc_variation_configurations','sc_variation_certifications','sc_certification_audit','sc_traveler_certification_bindings','sc_traveler_supersessions'] loop
  execute format('alter table public.%I enable row level security',tbl);
  execute format('revoke all on public.%I from public,anon,authenticated,service_role',tbl);
  execute format('grant select on public.%I to authenticated',tbl);
  execute format('create policy sc_certification_employee_read on public.%I for select to authenticated using ((select public.sc_internal_access_allowed(array[''admin'',''manager'',''operator'',''viewer''])))',tbl);
 end loop;
end $$;
revoke all on all functions in schema sc_certification from public,anon,authenticated,service_role;
revoke all on all tables in schema sc_certification from public,anon,authenticated,service_role;
revoke all on function public.sc_save_variation_configuration(uuid,uuid,uuid[],text),public.sc_check_variation_configuration(uuid),public.sc_certify_variation(uuid),public.sc_revalidate_traveler(uuid),public.sc_check_traveler_certification(uuid),public.sc_job_line_readiness(bigint[],uuid[]) from public,anon,authenticated;
grant execute on function public.sc_save_variation_configuration(uuid,uuid,uuid[],text),public.sc_check_variation_configuration(uuid),public.sc_certify_variation(uuid),public.sc_revalidate_traveler(uuid),public.sc_check_traveler_certification(uuid),public.sc_job_line_readiness(bigint[],uuid[]) to authenticated;
insert into public.sc_certification_audit(kind,reason,details)
 select 'existing_traveler_review_required','Historical traveler retained; current managed evidence must be checked before production',
 jsonb_build_object('traveler_id',t.id,'job_item_id',t.job_item_id) from public.sc_job_travelers t;
notify pgrst,'reload schema';
