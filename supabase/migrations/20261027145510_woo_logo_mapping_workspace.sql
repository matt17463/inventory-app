-- Draft catalog mapping is deliberately independent from approval and live activation.
create table public.sc_woo_logo_mapping_plans (
 id uuid primary key default gen_random_uuid(),
 woo_product_id bigint not null check(woo_product_id>0),
 source_hash text not null check(source_hash ~ '^[a-f0-9]{64}$'),
 baseline jsonb not null check(jsonb_typeof(baseline)='object'),
 mappings jsonb not null default '{}' check(jsonb_typeof(mappings)='object'),
 canonical jsonb not null default '{}' check(jsonb_typeof(canonical)='object'),
 analysis jsonb not null default '{}' check(jsonb_typeof(analysis)='object'),
 revision integer not null default 1 check(revision>0),
 note text not null default '',
 created_by uuid not null,
 updated_by uuid not null,
 created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp(),
 unique(woo_product_id,source_hash)
);
create table public.sc_woo_logo_mapping_events (
 id bigint generated always as identity primary key,
 plan_id uuid not null references public.sc_woo_logo_mapping_plans(id) on delete restrict,
 revision integer not null,
 actor uuid not null,
 recorded_at timestamptz not null default clock_timestamp(),
 document jsonb not null
);
create index sc_woo_logo_mapping_recent on public.sc_woo_logo_mapping_plans(updated_at desc);
create index sc_woo_logo_mapping_event_plan on public.sc_woo_logo_mapping_events(plan_id,revision);
alter table public.sc_woo_logo_mapping_plans enable row level security;
alter table public.sc_woo_logo_mapping_events enable row level security;
revoke all on public.sc_woo_logo_mapping_plans,public.sc_woo_logo_mapping_events from public,anon,authenticated;
grant select on public.sc_woo_logo_mapping_plans,public.sc_woo_logo_mapping_events to authenticated;
grant select,insert,update on public.sc_woo_logo_mapping_plans to service_role;
grant select,insert on public.sc_woo_logo_mapping_events to service_role;
grant usage,select on sequence public.sc_woo_logo_mapping_events_id_seq to service_role;
create policy manager_read on public.sc_woo_logo_mapping_plans for select to authenticated
 using(public.sc_internal_access_allowed(array['admin','manager']));
create policy manager_read on public.sc_woo_logo_mapping_events for select to authenticated
 using(public.sc_internal_access_allowed(array['admin','manager']));
create function public.sc_woo_logo_mapping_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' then raise exception 'Mapping history must be preserved'; end if;
 if tg_op='UPDATE' and (new.id,new.woo_product_id,new.source_hash,new.baseline,new.created_by,new.created_at)
  is distinct from (old.id,old.woo_product_id,old.source_hash,old.baseline,old.created_by,old.created_at) then
  raise exception 'Baseline is immutable; capture a separate plan for changed Woo source';
 end if;
 if tg_op='UPDATE' then new.revision=old.revision+1;new.updated_at=clock_timestamp();end if;
 return new;
end $$;
revoke all on function public.sc_woo_logo_mapping_guard() from public,anon,authenticated,service_role;
create trigger protect_logo_mapping_baseline before update or delete on public.sc_woo_logo_mapping_plans
 for each row execute function public.sc_woo_logo_mapping_guard();
create function public.sc_woo_logo_mapping_audit() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.sc_woo_logo_mapping_events(plan_id,revision,actor,document)
 values(new.id,new.revision,new.updated_by,to_jsonb(new)-'baseline');return new;
end $$;
revoke all on function public.sc_woo_logo_mapping_audit() from public,anon,authenticated,service_role;
create trigger audit_logo_mapping after insert or update on public.sc_woo_logo_mapping_plans
 for each row execute function public.sc_woo_logo_mapping_audit();
create trigger protect_logo_mapping_events before update or delete on public.sc_woo_logo_mapping_events
 for each row execute function sc_certification.immutable_artwork_revision();

create function public.sc_create_logo_mapping_family(p_plan uuid,p_choice text,p_label text) returns uuid
language plpgsql security definer set search_path='' as $$
declare item public.sc_woo_logo_mapping_plans%rowtype; result uuid; variant uuid; artwork uuid; entry jsonb;
begin
 if auth.uid() is null or not public.sc_internal_access_allowed(array['admin','manager']) then raise exception 'Manager access required' using errcode='42501';end if;
 if length(trim(p_choice))<1 or length(trim(p_label))<2 then raise exception 'Exact legacy choice and customer label required';end if;
 select * into item from public.sc_woo_logo_mapping_plans where id=p_plan for update;
 if not found then raise exception 'Mapping plan not found';end if;
 if not item.mappings ? p_choice then raise exception 'Save the exact legacy choice in this draft first';end if;
 entry=item.mappings->p_choice;
 if nullif(entry->>'family_id','') is not null then result=(entry->>'family_id')::uuid;
 else
  insert into public.sc_client_graphic_families(name,internal_name,storefront_label,storefront_visibility,state)
  values(trim(p_label),'Woo '||item.woo_product_id||' / '||p_choice,trim(p_label),'selectable','draft') returning id into result;
 end if;
 if nullif(entry->>'variant_id','') is not null then variant=(entry->>'variant_id')::uuid;
 elsif nullif(entry->>'artwork_asset_id','') is not null
  and exists(select 1 from public.sc_client_graphic_families where id=result and state='draft')
  and not exists(select 1 from public.sc_variation_certifications c cross join lateral
   jsonb_array_elements(c.evidence_snapshot->'placements') e where c.status='certified'
   and e->'artwork'->>'id'=entry->>'artwork_asset_id') then
  artwork=(entry->>'artwork_asset_id')::uuid;
  insert into public.sc_client_graphic_variants(family_id,artwork_asset_id,label,process,state)
  values(result,artwork,trim(p_label),coalesce(nullif(entry->>'process',''),'Unspecified'),'draft') returning id into variant;
 end if;
 -- Even disabled live bindings are part of certificate fingerprints. Keep this
 -- product association in the pending transfer ledger, not the live binding table.
 if not exists(select 1 from public.sc_client_graphic_transfer_reviews where source_kind='woo_logo_mapping'
  and source_key=item.id::text||':'||p_choice) then
  insert into public.sc_client_graphic_transfer_reviews(woo_product_id,source_kind,source_key,source_value,proposed_family_id,evidence)
  values(item.woo_product_id,'woo_logo_mapping',item.id::text||':'||p_choice,p_choice,result,
   jsonb_build_object('plan_id',item.id,'source_hash',item.source_hash,'mapping_only',true));
 end if;
 update public.sc_woo_logo_mapping_plans set mappings=jsonb_set(mappings,array[p_choice],
  (mappings->p_choice)||jsonb_build_object('family_id',result,'variant_id',coalesce(variant::text,''),'label',trim(p_label))),updated_by=auth.uid() where id=p_plan;
 return result;
end $$;
revoke all on function public.sc_create_logo_mapping_family(uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function public.sc_create_logo_mapping_family(uuid,text,text) to authenticated;
