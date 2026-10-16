-- Add a restricted role; this does not assign or invite any user.
do $roles$ declare r record;begin
 for r in select conname from pg_constraint where conrelid='public.sc_app_user_roles'::regclass and contype='c' and pg_get_constraintdef(oid) like '%role = ANY%' loop
  execute format('alter table public.sc_app_user_roles drop constraint %I',r.conname);
 end loop;
 alter table public.sc_app_user_roles add constraint sc_app_user_roles_growth_role_check check(role in('admin','manager','operator','viewer','marketing'));
end $roles$;
-- Client acquisition, approved commercial terms and linked operational handoffs.
create table public.sc_growth_accounts(
 id uuid primary key default gen_random_uuid(), organization text not null check(length(btrim(organization)) between 1 and 200),
 segment text not null default 'business' check(segment in('school','nonprofit','team','club','business','other')),
 city text not null default '', website text, source text, owner_name text, notes text,
 customer_id bigint references public.customers(id),
 pricing_defaults jsonb not null default '{"model":"retail","share_percent":0,"target_margin_percent":40}'::jsonb,
 archived_at timestamptz, created_by uuid references auth.users(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create unique index sc_growth_account_identity on public.sc_growth_accounts(lower(btrim(organization)),lower(btrim(city))) where archived_at is null;
create table public.sc_growth_contacts(
 id uuid primary key default gen_random_uuid(),account_id uuid not null references public.sc_growth_accounts(id),
 name text not null check(length(btrim(name)) between 1 and 200),job_title text,email text,phone text,
 contact_permission text not null default 'unknown' check(contact_permission in('unknown','permitted','do_not_contact')),
 is_primary boolean not null default false, notes text,archived_at timestamptz,created_by uuid references auth.users(id),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create unique index sc_growth_primary_contact on public.sc_growth_contacts(account_id) where is_primary and archived_at is null;
create index sc_growth_contacts_account on public.sc_growth_contacts(account_id);
create table public.sc_growth_opportunities(
 id uuid primary key default gen_random_uuid(),account_id uuid not null references public.sc_growth_accounts(id),
 title text not null check(length(btrim(title)) between 1 and 200),
 stage text not null default 'identified' check(stage in('identified','contacted','qualified','demo','proposal','negotiation','won','launching','live','nurture','lost')),
 owner_name text,source text,estimated_value numeric(14,2) not null default 0 check(estimated_value>=0),
 probability integer not null default 10 check(probability between 0 and 100),
 target_date date,next_action text,next_action_date date,brief text,loss_reason text,demo_url text,store_url text,
 demo_status text not null default 'planned' check(demo_status in('planned','ready','presented','feedback','approved')),
 artwork_request_id bigint references public.phase5_artwork_requests(id),mockup_project_id uuid references public.mockup_projects(id),
 store_workflow_id uuid references public.sc_team_store_workflows(id),quote_id bigint references public.phase5_quotes(id),
 handoff_proposal_id uuid,handed_off_at timestamptz,archived_at timestamptz,created_by uuid references auth.users(id),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index sc_growth_opportunities_account on public.sc_growth_opportunities(account_id);
create index sc_growth_opportunities_pipeline on public.sc_growth_opportunities(stage,next_action_date) where archived_at is null;
create table public.sc_growth_materials(
 id uuid primary key default gen_random_uuid(),title text not null check(length(btrim(title)) between 1 and 200),
 kind text not null default 'flyer' check(kind in('flyer','email','sample','presentation','pricing_guide','demo','other')),
 segment text not null default 'all',revision integer not null default 1 check(revision>0),parent_id uuid references public.sc_growth_materials(id),
 status text not null default 'draft' check(status in('draft','approved','retired')),body text,url text,
 storage_path text,file_name text,mime_type text,file_size bigint check(file_size between 1 and 26214400),upload_complete boolean not null default false,
 cost numeric(12,2) not null default 0 check(cost>=0),approved_by uuid references auth.users(id),approved_at timestamptz,
 archived_at timestamptz,created_by uuid references auth.users(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index sc_growth_materials_library on public.sc_growth_materials(status,kind);
create table public.sc_growth_activities(
 id uuid primary key default gen_random_uuid(),opportunity_id uuid not null references public.sc_growth_opportunities(id),
 contact_id uuid references public.sc_growth_contacts(id),material_id uuid references public.sc_growth_materials(id),
 kind text not null default 'note' check(kind in('note','call','email','meeting','demo','sample','follow_up')),
 summary text not null check(length(btrim(summary)) between 1 and 500),details text,outcome text,
 occurred_at timestamptz not null default now(),created_by uuid references auth.users(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index sc_growth_activities_timeline on public.sc_growth_activities(opportunity_id,occurred_at desc);
create table public.sc_growth_tasks(
 id uuid primary key default gen_random_uuid(),opportunity_id uuid not null references public.sc_growth_opportunities(id),
 task_key text,title text not null check(length(btrim(title)) between 1 and 300),
 department text not null default 'marketing' check(department in('marketing','design','catalog','storefront','purchasing','production','qc','shipping')),
 owner_name text,due_date date,status text not null default 'open' check(status in('open','in_progress','blocked','complete','cancelled')),
 notes text,completed_at timestamptz,created_by uuid references auth.users(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(opportunity_id,task_key)
);
create index sc_growth_tasks_due on public.sc_growth_tasks(due_date) where status in('open','in_progress','blocked');
create table public.sc_growth_samples(
 id uuid primary key default gen_random_uuid(),opportunity_id uuid not null references public.sc_growth_opportunities(id),
 description text not null check(length(btrim(description)) between 1 and 300),
 blank_product_id uuid references public.blank_products(id),quantity integer not null default 1 check(quantity between 1 and 10000),
 unit_cost numeric(12,2) not null default 0 check(unit_cost>=0),
 status text not null default 'requested' check(status in('requested','preparing','ready','delivered','return_due','returned','retired')),
 due_date date,delivered_at date,notes text,created_by uuid references auth.users(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index sc_growth_samples_opportunity on public.sc_growth_samples(opportunity_id);
create table public.sc_growth_proposals(
 id uuid primary key default gen_random_uuid(),opportunity_id uuid not null references public.sc_growth_opportunities(id),
 title text not null check(length(btrim(title)) between 1 and 200),version integer not null default 1 check(version>0),
 status text not null default 'draft' check(status in('draft','approved','superseded','withdrawn')),
 config jsonb not null default '{}',lines jsonb not null default '[]',calculation jsonb not null default '{}',
 valid_until date,terms text,approval_note text,approved_by uuid references auth.users(id),approved_at timestamptz,
 created_by uuid references auth.users(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(opportunity_id,version)
);
alter table public.sc_growth_opportunities add constraint sc_growth_handoff_proposal_fk foreign key(handoff_proposal_id) references public.sc_growth_proposals(id);
create unique index sc_growth_one_approved_proposal on public.sc_growth_proposals(opportunity_id) where status='approved';
create table public.sc_growth_order_links(
 id uuid primary key default gen_random_uuid(),opportunity_id uuid not null references public.sc_growth_opportunities(id),
 job_id bigint not null references public.jobs(id),source text not null default 'manual' check(source in('manual','woocommerce_product')),notes text,created_by uuid references auth.users(id),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(opportunity_id,job_id)
);
create index sc_growth_order_links_opportunity on public.sc_growth_order_links(opportunity_id);
create table public.sc_growth_audit(
 id bigint generated always as identity primary key,table_name text not null,record_id uuid not null,
 actor_id uuid,action text not null,old_row jsonb,new_row jsonb,created_at timestamptz not null default now()
);
create index sc_growth_audit_record on public.sc_growth_audit(table_name,record_id,created_at desc);

-- Numeric calculations run on the server using decimal money, with per-line
-- rounding. All percentage bases exclude tax/shipping and are explicit.
create function public.sc_growth_price_v1(p_config jsonb,p_lines jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare l jsonb;r jsonb:='[]';v_model text:=coalesce(p_config->>'model','retail');
 v_share numeric:=coalesce((p_config->>'share_percent')::numeric,0);
 v_target numeric:=coalesce((p_config->>'target_margin_percent')::numeric,40);
 q int;c numeric;retail numeric;wholesale numeric;cost numeric;revenue numeric;benefit numeric;net numeric;
 total_revenue numeric:=0;total_cost numeric:=0;total_benefit numeric:=0;total_units bigint:=0;v numeric;k text;
begin
 perform public.sc_require_internal_access(array['admin','manager','operator','viewer','marketing']);
 if jsonb_typeof(p_config) is distinct from 'object' then raise exception 'Choose valid pricing settings.';end if;
 if v_model not in('retail','wholesale_keep_difference','revenue_share','profit_share')
 or v_share not between 0 and 100 or v_target not between 0 and 99.99 then raise exception 'Choose valid client pricing percentages and model.';end if;
 if p_lines is null or jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines) not between 1 and 100 then raise exception 'Add between 1 and 100 pricing lines.';end if;
 for l in select value from jsonb_array_elements(p_lines) loop
  q:=(l->>'quantity')::int;
  if q is null or q not between 1 and 1000000 or nullif(btrim(l->>'description'),'') is null then raise exception 'Each pricing line needs a description and a positive whole quantity.';end if;
  foreach k in array array['unit_cost','decoration_cost','labor_cost','other_cost','setup_fee','retail_price','wholesale_price'] loop
   v:=coalesce((l->>k)::numeric,0);if v not between 0 and 10000000 then raise exception 'Invalid amount for %',k;end if;
  end loop;
  retail:=round(coalesce((l->>'retail_price')::numeric,0),2);wholesale:=round(coalesce((l->>'wholesale_price')::numeric,0),2);
  c:=coalesce((l->>'unit_cost')::numeric,0)+coalesce((l->>'decoration_cost')::numeric,0)+coalesce((l->>'labor_cost')::numeric,0)+coalesce((l->>'other_cost')::numeric,0);
  cost:=round(c*q+coalesce((l->>'setup_fee')::numeric,0),2);revenue:=round(retail*q,2);
  if v_model='wholesale_keep_difference' and wholesale>retail then raise exception 'Wholesale cannot exceed retail.';end if;
  benefit:=case v_model when 'wholesale_keep_difference' then round((retail-wholesale)*q,2)
   when 'revenue_share' then round(revenue*v_share/100,2)
   when 'profit_share' then round(greatest(revenue-cost,0)*v_share/100,2) else 0 end;
  net:=revenue-benefit-cost;
  r:=r||jsonb_build_array(l||jsonb_build_object('quantity',q,'revenue',revenue,'cost',cost,'partner_share',benefit,'business_profit',net,
   'business_margin_percent',case when revenue-benefit>0 then round(net/(revenue-benefit)*100,2) else 0 end,
   'retained_price_each',round((revenue-benefit)/q,4)));
  total_revenue:=total_revenue+revenue;total_cost:=total_cost+cost;total_benefit:=total_benefit+benefit;total_units:=total_units+q;
 end loop;
 net:=total_revenue-total_cost-total_benefit;
 return jsonb_build_object('model',v_model,'share_percent',v_share,'target_margin_percent',v_target,'currency','USD',
 'lines',r,'units',total_units,'revenue',total_revenue,'cost',total_cost,'partner_share',total_benefit,'business_profit',net,
 'retained_revenue',total_revenue-total_benefit,
 'business_margin_percent',case when total_revenue-total_benefit>0 then round(net/(total_revenue-total_benefit)*100,2) else 0 end,
 'below_target',net<0 or total_revenue-total_benefit=0 or net/(total_revenue-total_benefit)*100<v_target);
end $$;
revoke all on function public.sc_growth_price_v1(jsonb,jsonb) from public,anon;
grant execute on function public.sc_growth_price_v1(jsonb,jsonb) to authenticated,service_role;

-- Constraints, optimistic edit timestamps and immutable approved versions apply
-- equally to UI and direct database clients.
create function sc_internal.sc_growth_validate_v1() returns trigger language plpgsql security definer set search_path='' as $$
declare model text;percent numeric;target numeric;opp_account uuid;contact_account uuid;
begin
 if tg_op='INSERT' then new.created_by:=auth.uid();else new.created_by:=old.created_by;new.created_at:=old.created_at;end if;
 new.updated_at:=clock_timestamp();
 if tg_table_name='sc_growth_accounts' then if new.website is not null and new.website !~* '^https?://[^[:space:]]+$' then raise exception 'Use a full http or https website URL.';end if;end if;
 if tg_table_name='sc_growth_materials' then if new.url is not null and new.url !~* '^https?://[^[:space:]]+$' then raise exception 'Use a full http or https material URL.';end if;end if;
 if tg_table_name='sc_growth_opportunities' then if ((new.demo_url is not null and new.demo_url !~* '^https?://[^[:space:]]+$') or (new.store_url is not null and new.store_url !~* '^https?://[^[:space:]]+$')) then raise exception 'Use a full http or https storefront URL.';end if;end if;
 if tg_table_name='sc_growth_accounts' then
  if (tg_op='INSERT' and new.customer_id is not null) or (tg_op='UPDATE' and new.customer_id is distinct from old.customer_id) then perform public.sc_require_internal_access(array['admin','manager']);end if;
  model:=coalesce(new.pricing_defaults->>'model','retail');percent:=coalesce((new.pricing_defaults->>'share_percent')::numeric,0);target:=coalesce((new.pricing_defaults->>'target_margin_percent')::numeric,40);
  if model not in('retail','wholesale_keep_difference','revenue_share','profit_share') or percent not between 0 and 100 or target not between 0 and 99.99 then raise exception 'Invalid client pricing defaults.';end if;
 end if;
 if tg_table_name='sc_growth_order_links' then perform public.sc_require_internal_access(array['admin','manager','operator']);end if;
 if tg_table_name='sc_growth_opportunities' then
  if (tg_op='INSERT' and coalesce(new.artwork_request_id::text,new.mockup_project_id::text,new.store_workflow_id::text,new.quote_id::text,new.handoff_proposal_id::text,new.handed_off_at::text) is not null)
   or (tg_op='UPDATE' and (new.artwork_request_id is distinct from old.artwork_request_id or new.mockup_project_id is distinct from old.mockup_project_id or new.store_workflow_id is distinct from old.store_workflow_id or new.quote_id is distinct from old.quote_id or new.handoff_proposal_id is distinct from old.handoff_proposal_id or new.handed_off_at is distinct from old.handed_off_at)) then perform public.sc_require_internal_access(array['admin','manager']);end if;
  if new.stage='lost' and nullif(btrim(new.loss_reason),'') is null then raise exception 'Record a reason before closing a lost opportunity.';end if;
  if (tg_op='INSERT' or new.stage is distinct from old.stage) and new.stage in('won','launching','live') and not exists(select 1 from public.sc_growth_proposals p where p.opportunity_id=new.id and p.status='approved' and (p.valid_until is null or p.valid_until>=current_date)) then raise exception 'Approve current pricing before marking this opportunity won or live.';end if;
  if new.stage='live' and (new.handed_off_at is null or nullif(new.store_url,'') is null or (select count(*) from public.sc_growth_tasks t where t.opportunity_id=new.id and t.task_key in('artwork_approval','product_mapping','store_checkout') and t.status='complete')<>3) then raise exception 'Complete artwork, product mapping and checkout checks, and record the live storefront URL.';end if;
 end if;
 if tg_table_name='sc_growth_activities' then if new.contact_id is not null then
  select account_id into opp_account from public.sc_growth_opportunities where id=new.opportunity_id;
  select account_id into contact_account from public.sc_growth_contacts where id=new.contact_id and archived_at is null;
  if contact_account is distinct from opp_account then raise exception 'Choose a contact belonging to this client.';end if;
 end if;end if;
 if tg_table_name='sc_growth_tasks' then
  new.completed_at:=case when new.status='complete' then coalesce(new.completed_at,now()) else null end;
 end if;
 if tg_table_name='sc_growth_proposals' then
  if tg_op='UPDATE' and old.status<>'draft' and new.status='draft' then raise exception 'Create a new version instead of reopening approved terms.';end if;
  if tg_op='UPDATE' and old.status<>'draft' and
   (new.config<>old.config or new.lines<>old.lines or new.terms is distinct from old.terms or new.valid_until is distinct from old.valid_until or new.opportunity_id<>old.opportunity_id or new.version<>old.version or new.title<>old.title or new.approval_note is distinct from old.approval_note) then raise exception 'Approved terms are immutable. Create a new proposal version.';end if;
  if new.status<> 'draft' and (tg_op='INSERT' or old.status is distinct from new.status) then
   perform public.sc_require_internal_access(array['admin','manager']);
  end if;
  new.calculation:=public.sc_growth_price_v1(new.config,new.lines);
  if exists(select 1 from jsonb_array_elements(new.lines) l where nullif(l->>'blank_product_id','') is not null and not exists(select 1 from public.blank_products b where b.id=(l->>'blank_product_id')::uuid and not b.sc_is_archived)) then raise exception 'Choose an active physical blank for linked pricing lines.';end if;
  if new.status='approved' then
   if new.valid_until<current_date then raise exception 'Cannot approve an expired proposal.';end if;
   if (new.calculation->>'below_target')::boolean and nullif(btrim(new.approval_note),'') is null then raise exception 'Below-target pricing requires a manager approval note.';end if;
   if tg_op='INSERT' or old.status<>'approved' then new.approved_by:=auth.uid();new.approved_at:=now();
   else new.approved_by:=old.approved_by;new.approved_at:=old.approved_at;end if;
  else new.approved_by:=case when tg_op='UPDATE' then old.approved_by else null end;new.approved_at:=case when tg_op='UPDATE' then old.approved_at else null end;end if;
 end if;
 if tg_table_name='sc_growth_materials' then
  if tg_op='UPDATE' and old.status<>'draft' and new.status='draft' then raise exception 'Create a new material revision instead of reopening it.';end if;
  if tg_op='UPDATE' and old.status='approved' and (new.body is distinct from old.body or new.url is distinct from old.url or new.storage_path is distinct from old.storage_path or new.title<>old.title or new.revision<>old.revision or new.kind<>old.kind or new.segment<>old.segment or new.cost<>old.cost or new.parent_id is distinct from old.parent_id or new.file_name is distinct from old.file_name or new.mime_type is distinct from old.mime_type or new.file_size is distinct from old.file_size or new.upload_complete<>old.upload_complete) then raise exception 'Create a new revision to change approved promotional material.';end if;
  if new.status='approved' and (tg_op='INSERT' or old.status<>'approved') then
   perform public.sc_require_internal_access(array['admin','manager']);
   if new.storage_path is not null and not new.upload_complete then raise exception 'Complete the file upload before approving it.';end if;
   if coalesce(nullif(new.body,''),nullif(new.url,''),new.storage_path) is null then raise exception 'Add content, a link or a verified file before approval.';end if;
   new.approved_by:=auth.uid();new.approved_at:=now();
  elsif tg_op='UPDATE' then new.approved_by:=old.approved_by;new.approved_at:=old.approved_at;
  else new.approved_by:=null;new.approved_at:=null;end if;
 end if;
 return new;
end $$;
revoke all on function sc_internal.sc_growth_validate_v1() from public,anon,authenticated;
create function sc_internal.sc_growth_audit_v1() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.sc_growth_audit(table_name,record_id,actor_id,action,old_row,new_row)
 values(tg_table_name,new.id,auth.uid(),tg_op,case when tg_op='UPDATE' then to_jsonb(old) else null end,to_jsonb(new));
 return new;
end $$;
revoke all on function sc_internal.sc_growth_audit_v1() from public,anon,authenticated;
do $setup$ declare t text;begin
 foreach t in array array['accounts','contacts','opportunities','materials','activities','tasks','samples','proposals','order_links'] loop
  execute format('alter table public.sc_growth_%I enable row level security',t);
  execute format('revoke all on public.sc_growth_%I from public,anon,authenticated',t);
  execute format('grant select,insert,update on public.sc_growth_%I to authenticated',t);
  execute format('grant all on public.sc_growth_%I to service_role',t);
  execute format('create policy employee_read on public.sc_growth_%I for select to authenticated using ((select public.sc_internal_access_allowed(array[''admin'',''manager'',''operator'',''viewer'',''marketing''])))',t);
  execute format('create policy employee_insert on public.sc_growth_%I for insert to authenticated with check ((select public.sc_internal_access_allowed(array[''admin'',''manager'',''operator'',''marketing''])))',t);
  execute format('create policy employee_update on public.sc_growth_%I for update to authenticated using ((select public.sc_internal_access_allowed(array[''admin'',''manager'',''operator'',''marketing'']))) with check ((select public.sc_internal_access_allowed(array[''admin'',''manager'',''operator'',''marketing''])))',t);
  execute format('create trigger growth_validate before insert or update on public.sc_growth_%I for each row execute function sc_internal.sc_growth_validate_v1()',t);
  execute format('create trigger growth_audit after insert or update on public.sc_growth_%I for each row execute function sc_internal.sc_growth_audit_v1()',t);
 end loop;
end $setup$;
alter table public.sc_growth_audit enable row level security;
revoke all on public.sc_growth_audit from public,anon,authenticated;
grant select on public.sc_growth_audit to authenticated;
grant all on public.sc_growth_audit to service_role;
create policy manager_read on public.sc_growth_audit for select to authenticated using ((select public.sc_internal_access_allowed(array['admin','manager'])));

-- Approval is serialized per opportunity. Never leave two current agreements.
create function public.sc_growth_approve_proposal_v1(p_id uuid,p_expected_updated_at timestamptz,p_note text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p public.sc_growth_proposals;v_opp uuid;begin
 perform public.sc_require_internal_access(array['admin','manager']);
 select opportunity_id into v_opp from public.sc_growth_proposals where id=p_id;
 perform 1 from public.sc_growth_opportunities where id=v_opp for update;
 select * into p from public.sc_growth_proposals where id=p_id for update;
 if p.updated_at is distinct from p_expected_updated_at then raise exception 'Proposal changed. Refresh and review before approving.';end if;
 if p.id is null or p.status<>'draft' then raise exception 'Choose a draft proposal.';end if;
 update public.sc_growth_proposals set status='superseded' where opportunity_id=v_opp and status='approved';
 update public.sc_growth_proposals set status='approved',approval_note=p_note where id=p_id returning * into p;
 return to_jsonb(p);
end $$;
revoke all on function public.sc_growth_approve_proposal_v1(uuid,timestamptz,text) from public,anon;
grant execute on function public.sc_growth_approve_proposal_v1(uuid,timestamptz,text) to authenticated,service_role;

-- Atomic, repeat-safe draft creation reuses the operational record types.
create function public.sc_growth_handoff_v1(p_opportunity_id uuid,p_mode text default 'design',p_proposal_id uuid default null,p_expected_updated_at timestamptz default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare o public.sc_growth_opportunities;a public.sc_growth_accounts;p public.sc_growth_proposals;
 customer_ids bigint[];v_customer bigint;v_art bigint;v_mock uuid;v_store uuid;v_quote bigint;
 l jsonb;items jsonb:='[]';task text;v_snapshot text;
begin
 perform public.sc_require_internal_access(array['admin','manager']);
 if p_mode not in('design','operations') then raise exception 'Choose a valid handoff.';end if;
 select * into o from public.sc_growth_opportunities where id=p_opportunity_id for update;
 if p_expected_updated_at is not null and o.updated_at<>p_expected_updated_at then raise exception 'Opportunity changed. Refresh before handoff.';end if;
 if o.id is null or o.archived_at is not null or o.stage='lost' then raise exception 'Choose an active opportunity.';end if;
 select * into a from public.sc_growth_accounts where id=o.account_id for update;
 if a.archived_at is not null then raise exception 'Restore this client before handoff.';end if;
 select * into p from public.sc_growth_proposals where opportunity_id=o.id and status='approved' and (valid_until is null or valid_until>=current_date);
 if p_mode='operations' and p.id is distinct from p_proposal_id then raise exception 'The approved proposal changed. Refresh and review before handoff.';end if;
 if p_mode='operations' and p.id is null then raise exception 'Approve current commercial terms before operations handoff.';end if;
 if nullif(btrim(o.brief),'') is null then raise exception 'Add a design and product brief before handoff.';end if;
 v_customer:=a.customer_id;
 if v_customer is null then
  select array_agg(id) into customer_ids from public.customers where lower(btrim(name))=lower(btrim(a.organization));
  if cardinality(customer_ids)>1 then raise exception 'Multiple existing customers match. Link the correct customer first.';end if;
  v_customer:=customer_ids[1];
  if v_customer is null then insert into public.customers(name,code) values(a.organization,'GROWTH-'||left(a.id::text,8)) returning id into v_customer;end if;
  update public.sc_growth_accounts set customer_id=v_customer where id=a.id;
 end if;
 v_art:=o.artwork_request_id;v_mock:=o.mockup_project_id;v_store:=o.store_workflow_id;v_quote:=o.quote_id;
 v_snapshot:='Client growth opportunity '||o.id||E'\n'||o.title||E'\n'||o.brief;
 if v_art is null then
  insert into public.phase5_artwork_requests(customer_name,request_title,request_details,deadline,status,notes)
  values(a.organization,o.title,o.brief,o.target_date,'new',v_snapshot) returning id into v_art;
 end if;
 if v_mock is null then
  insert into public.mockup_projects(project_name,customer_id_text,customer_name,campaign_name,project_type,notes,storage_provider,created_by)
  values(o.title,v_customer::text,a.organization,o.title,'store_product',v_snapshot,'r2',auth.uid()) returning id into v_mock;
 end if;
 if p_mode='operations' and v_store is null then
  insert into public.sc_team_store_workflows(workflow_name,customer_name,store_name,stage,artwork_request_reference,mockup_project_id_text,due_date,notes,created_by)
  values(o.title,a.organization,o.title,'artwork','phase5_artwork_requests:'||v_art,v_mock::text,o.target_date,v_snapshot,auth.uid()) returning id into v_store;
 end if;
 if p_mode='operations' and (v_quote is null or o.handoff_proposal_id is distinct from p.id) then
  -- Preserve prior imported draft pricing in the audit before replacing it.
  -- Manually created Mockup Studio pricing rows remain untouched.
  insert into public.sc_growth_audit(table_name,record_id,actor_id,action,old_row,new_row)
  select 'mockup_pricing_items',m.id,auth.uid(),'REPLACED_BY_APPROVED_VERSION',to_jsonb(m),null
  from public.mockup_pricing_items m where m.project_id=v_mock and m.metadata ? 'growth_proposal_id';
  delete from public.mockup_pricing_items m where m.project_id=v_mock and m.metadata ? 'growth_proposal_id';

  for l in select value from jsonb_array_elements(p.calculation->'lines') loop
   items:=items||jsonb_build_array(jsonb_build_object('description',l->>'description','quantity',(l->>'quantity')::int,
    'blankProductId',nullif(l->>'blank_product_id',''),'setupFee',coalesce((l->>'setup_fee')::numeric,0),'blankCost',coalesce((l->>'unit_cost')::numeric,0)+coalesce((l->>'other_cost')::numeric,0),
    'decorationCost',coalesce((l->>'decoration_cost')::numeric,0),'laborCost',coalesce((l->>'labor_cost')::numeric,0),
    'priceEach',(l->>'retained_price_each')::numeric));
   insert into public.mockup_pricing_items(project_id,label,pricing_type,quantity,unit_cost,sell_price,pricing_path,wholesale_price,metadata)
   values(v_mock,l->>'description','per_item',(l->>'quantity')::numeric,
    round((l->>'cost')::numeric/(l->>'quantity')::numeric,4),(l->>'retail_price')::numeric,
    case when p.config->>'model'='wholesale_keep_difference' then 'wholesale' else 'direct_retail' end,
    case when p.config->>'model'='wholesale_keep_difference' then (l->>'wholesale_price')::numeric else null end,
    jsonb_build_object('growth_proposal_id',p.id,'approved_config',p.config,'partner_share',(l->>'partner_share')::numeric));
  end loop;
  v_quote:=(public.phase5_create_quote(a.organization,o.title||' — partner supply estimate','draft',
   'Approved marketing proposal '||p.id||' version '||p.version||E'\nSupply estimate uses company-retained price; shopper retail, partner benefit, setup and margin detail remain in Marketing. Not a customer invoice.\n'||coalesce(p.terms,''),items)->>'quote_id')::bigint;
 end if;
 if p_mode='operations' then
  foreach task in array array['artwork_approval','product_mapping','store_checkout','supplier_readiness','production_plan','qc_plan','shipping_plan'] loop
   insert into public.sc_growth_tasks(opportunity_id,task_key,title,department,owner_name,due_date)
   values(o.id,task,case task when 'artwork_approval' then 'Obtain final artwork and mockup approval'
    when 'product_mapping' then 'Verify product lines, sizes, colors and blank mappings'
    when 'store_checkout' then 'Verify storefront prices, options, checkout and fulfillment'
    when 'supplier_readiness' then 'Confirm supplier availability and purchasing plan'
    when 'production_plan' then 'Confirm production capacity and launch schedule'
    when 'qc_plan' then 'Confirm QC checklist and approved reference'
    else 'Confirm delivery, packing and shipping instructions' end,
    case task when 'artwork_approval' then 'design' when 'product_mapping' then 'catalog' when 'store_checkout' then 'storefront'
    when 'supplier_readiness' then 'purchasing' when 'production_plan' then 'production' when 'qc_plan' then 'qc' else 'shipping' end,
    o.owner_name,o.target_date) on conflict(opportunity_id,task_key) do nothing;
  end loop;
 end if;
 update public.sc_growth_opportunities set artwork_request_id=v_art,mockup_project_id=v_mock,store_workflow_id=v_store,quote_id=v_quote,
 handoff_proposal_id=case when p_mode='operations' then p.id else handoff_proposal_id end,
 handed_off_at=case when p_mode='operations' then coalesce(handed_off_at,now()) else handed_off_at end where id=o.id returning * into o;
 return jsonb_build_object('opportunity',to_jsonb(o),'customer_id',v_customer,'artwork_request_id',v_art,'mockup_project_id',v_mock,'store_workflow_id',v_store,'quote_id',v_quote);
end $$;
revoke all on function public.sc_growth_handoff_v1(uuid,text,uuid,timestamptz) from public,anon;
grant execute on function public.sc_growth_handoff_v1(uuid,text,uuid,timestamptz) to authenticated,service_role;
notify pgrst,'reload schema';

-- Attribute incoming order lines only by an exact published project product ID.
-- A mixed order can be linked to several campaigns; no revenue is duplicated or
-- settled here. Job status is read from the existing order rather than copied.
create index if not exists sc_growth_published_mockup_product on public.mockup_projects(woo_product_id) where woo_product_id is not null;
create function sc_internal.sc_growth_link_order_line_v1() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.woocommerce_product_id is not null then
  insert into public.sc_growth_order_links(opportunity_id,job_id,source,notes)
  select o.id,new.job_id,'woocommerce_product','Matched the published Mockup Studio product ID.'
  from public.sc_growth_opportunities o join public.mockup_projects m on m.id=o.mockup_project_id
  where m.woo_product_id=new.woocommerce_product_id and o.archived_at is null
  on conflict(opportunity_id,job_id) do nothing;
 end if;
 return new;
end $$;
revoke all on function sc_internal.sc_growth_link_order_line_v1() from public,anon,authenticated;
create trigger sc_growth_order_line_after_sync after insert or update of woocommerce_product_id on public.job_items
for each row execute function sc_internal.sc_growth_link_order_line_v1();
notify pgrst,'reload schema';

create function public.sc_growth_dashboard_v1() returns jsonb language plpgsql security invoker set search_path='' as $$
begin
 perform public.sc_require_internal_access(array['admin','manager','operator','viewer','marketing']);
 return jsonb_build_object(
 'activity_counts',(select coalesce(jsonb_object_agg(kind,n),'{}') from(select kind,count(*) n from public.sc_growth_activities where occurred_at>=now()-interval '30 days' group by kind)a),
 'sample_cost',(select coalesce(sum(s.quantity*s.unit_cost),0) from public.sc_growth_samples s join public.sc_growth_opportunities o on o.id=s.opportunity_id where o.archived_at is null and s.status<>'retired'),
 'material_cost',(select coalesce(sum(cost),0) from public.sc_growth_materials where archived_at is null and status<>'retired'),
 'approved_partner_forecast',(select coalesce(sum((p.calculation->>'partner_share')::numeric),0) from public.sc_growth_proposals p join public.sc_growth_opportunities o on o.id=p.opportunity_id where p.status='approved' and o.archived_at is null and o.stage not in('lost','live') and (p.valid_until is null or p.valid_until>=current_date)),
 'approved_profit_forecast',(select coalesce(sum((p.calculation->>'business_profit')::numeric),0) from public.sc_growth_proposals p join public.sc_growth_opportunities o on o.id=p.opportunity_id where p.status='approved' and o.archived_at is null and o.stage not in('lost','live') and (p.valid_until is null or p.valid_until>=current_date)));
end $$;
revoke all on function public.sc_growth_dashboard_v1() from public,anon;
grant execute on function public.sc_growth_dashboard_v1() to authenticated,service_role;

create function public.sc_growth_import_accounts_v1(p_rows jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r jsonb;v_id uuid;v_created int:=0;v_existing int:=0;v_org text;v_city text;begin
 perform public.sc_require_internal_access(array['admin','manager','operator','marketing']);
 if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) not between 1 and 200 then raise exception 'Import 1–200 client rows at a time.';end if;
 for r in select value from jsonb_array_elements(p_rows) loop
  v_org:=nullif(btrim(r->>'organization'),'');v_city:=coalesce(btrim(r->>'city'),'');
  if v_org is null then raise exception 'Every row needs an organization.';end if;
  perform pg_advisory_xact_lock(hashtextextended('growth-account:'||lower(v_org)||'|'||lower(v_city),0));
  select id into v_id from public.sc_growth_accounts where lower(btrim(organization))=lower(v_org) and lower(btrim(city))=lower(v_city) and archived_at is null;
  if v_id is not null then v_existing:=v_existing+1;continue;end if;
  insert into public.sc_growth_accounts(organization,city,segment,website,source,owner_name,notes)
  values(v_org,v_city,coalesce(nullif(r->>'segment',''),'business'),nullif(r->>'website',''),nullif(r->>'source',''),nullif(r->>'owner_name',''),nullif(r->>'notes','')) returning id into v_id;
  if nullif(btrim(r->>'contact_name'),'') is not null then
   insert into public.sc_growth_contacts(account_id,name,email,phone,is_primary,contact_permission)
   values(v_id,btrim(r->>'contact_name'),nullif(r->>'email',''),nullif(r->>'phone',''),true,'unknown');
  end if;
  insert into public.sc_growth_opportunities(account_id,title,owner_name,source,brief)
  values(v_id,coalesce(nullif(r->>'campaign',''),left('Introduction — '||v_org,200)),nullif(r->>'owner_name',''),nullif(r->>'source',''),nullif(r->>'brief',''));
  v_created:=v_created+1;
 end loop;
 return jsonb_build_object('created',v_created,'existing_unchanged',v_existing);
end $$;
revoke all on function public.sc_growth_import_accounts_v1(jsonb) from public,anon;
grant execute on function public.sc_growth_import_accounts_v1(jsonb) to authenticated,service_role;
notify pgrst,'reload schema';


create function public.sc_growth_catalog_search_v1(p_search text default '') returns table(blank_product_id uuid,id uuid,sku_base text,name text,unit_cost numeric)
language plpgsql stable security definer set search_path='' as $$
begin
 perform public.sc_require_internal_access(array['admin','manager','operator','viewer','marketing']);
 return query select b.id,b.id,b.sku_base,b.name,b.unit_cost from public.blank_products b
 where not b.sc_is_archived and (b.sku_base ilike '%'||left(coalesce(p_search,''),100)||'%' or b.name ilike '%'||left(coalesce(p_search,''),100)||'%') order by b.sku_base limit 30;
end $$;
revoke all on function public.sc_growth_catalog_search_v1(text) from public,anon;
grant execute on function public.sc_growth_catalog_search_v1(text) to authenticated,service_role;
create function public.sc_growth_pricing_rules_v1() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform public.sc_require_internal_access(array['admin','manager','operator','viewer','marketing']);
 return (select coalesce(jsonb_agg(to_jsonb(r)),'[]') from public.sc_pricing_rules r);
end $$;
revoke all on function public.sc_growth_pricing_rules_v1() from public,anon;
grant execute on function public.sc_growth_pricing_rules_v1() to authenticated,service_role;
create function public.sc_growth_operational_snapshot_v1(p_opportunity_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare o public.sc_growth_opportunities;begin
 perform public.sc_require_internal_access(array['admin','manager','operator','viewer','marketing']);
 select * into o from public.sc_growth_opportunities where id=p_opportunity_id;
 if o.id is null then raise exception 'Opportunity not found.';end if;
 return jsonb_build_object(
 'artwork',(select jsonb_build_object('id',id,'status',status,'deadline',deadline) from public.phase5_artwork_requests where id=o.artwork_request_id),
 'mockup',(select jsonb_build_object('id',id,'status',status,'woo_product_id',woo_product_id,'woo_product_url',woo_product_url) from public.mockup_projects where id=o.mockup_project_id),
 'store',(select jsonb_build_object('id',id,'stage',stage,'status',status) from public.sc_team_store_workflows where id=o.store_workflow_id),
 'quote',(select jsonb_build_object('id',id,'number',quote_number,'status',status) from public.phase5_quotes where id=o.quote_id),
 'jobs',(select coalesce(jsonb_agg(jsonb_build_object('id',j.id,'job_name',j.job_name,'status',j.status,'woocommerce_order_id',j.woocommerce_order_id,'due_date',j.due_date)),'[]') from public.sc_growth_order_links l join public.jobs j on j.id=l.job_id where l.opportunity_id=o.id));
end $$;
revoke all on function public.sc_growth_operational_snapshot_v1(uuid) from public,anon;
grant execute on function public.sc_growth_operational_snapshot_v1(uuid) to authenticated,service_role;
notify pgrst,'reload schema';
create index sc_growth_audit_record_history on public.sc_growth_audit(record_id,created_at desc);
create index sc_growth_order_links_job on public.sc_growth_order_links(job_id);
