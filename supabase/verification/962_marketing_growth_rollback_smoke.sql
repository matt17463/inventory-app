-- Run after the marketing migration. All fixture data and temporary role
-- changes are rolled back. Existing operational stock must remain unchanged.
begin;
create temp table growth_checks(check_name text,passed boolean) on commit drop;
grant select,insert on growth_checks to authenticated,anon;
select set_config('test.employee_id',(select user_id::text from public.sc_app_user_roles where role='admin' and is_active limit 1),true);
select set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',current_setting('test.employee_id'))::text,true);
set local role authenticated;
do $test$
declare a uuid;b uuid;o uuid;c uuid;proposal public.sc_growth_proposals;m public.sc_growth_materials;
 r jsonb;r2 jsonb;line jsonb:='[{"description":"Fixture shirt","quantity":10,"unit_cost":10,"decoration_cost":5,"labor_cost":2,"other_cost":1,"setup_fee":20,"retail_price":30,"wholesale_price":24}]';
 n int;before_count int;before_units numeric;
begin
 select sum(quantity_change) into before_units from public.blank_inventory_movements;
 r:=public.sc_growth_price_v1('{"model":"retail","target_margin_percent":30}',line);
 if (r->>'cost')::numeric<>200 or (r->>'business_profit')::numeric<>100 or (r->>'business_margin_percent')::numeric<>33.33 then raise exception 'Retail calculation failed: %',r;end if;
 r:=public.sc_growth_price_v1('{"model":"wholesale_keep_difference","target_margin_percent":10}',line);
 if (r->>'partner_share')::numeric<>60 or (r->>'business_profit')::numeric<>40 or (r->>'business_margin_percent')::numeric<>16.67 then raise exception 'Wholesale calculation failed: %',r;end if;
 r:=public.sc_growth_price_v1('{"model":"revenue_share","share_percent":20,"target_margin_percent":10}',line);
 if (r->>'partner_share')::numeric<>60 or (r->>'business_profit')::numeric<>40 then raise exception 'Net sales share failed';end if;
 r:=public.sc_growth_price_v1('{"model":"profit_share","share_percent":25,"target_margin_percent":10}',line);
 if (r->>'partner_share')::numeric<>25 or (r->>'business_margin_percent')::numeric<>27.27 then raise exception 'Profit share failed: %',r;end if;
 insert into public.sc_growth_accounts(organization,city,pricing_defaults) values('Growth Fixture A '||gen_random_uuid(),'Fixture','{"model":"profit_share","share_percent":25,"target_margin_percent":10}') returning id into a;
 insert into public.sc_growth_accounts(organization) values('Growth Fixture B '||gen_random_uuid()) returning id into b;
 insert into public.sc_growth_contacts(account_id,name) values(b,'Other client contact') returning id into c;
 insert into public.sc_growth_opportunities(account_id,title,brief) values(a,'Fixture campaign','Exact logo, black tees, launch next month.') returning id into o;
 begin
  insert into public.sc_growth_activities(opportunity_id,contact_id,summary) values(o,c,'Wrong client');
  raise exception 'Cross-client contact accepted';
 exception when raise_exception then if sqlerrm='Cross-client contact accepted' then raise;end if;end;
 insert into public.sc_growth_proposals(opportunity_id,title,config,lines) values(o,'Fixture terms','{"model":"profit_share","share_percent":25,"target_margin_percent":10}',line) returning * into proposal;
 perform public.sc_growth_approve_proposal_v1(proposal.id,proposal.updated_at,'Fixture approval');
 begin update public.sc_growth_proposals set config='{"model":"retail"}' where id=proposal.id;raise exception 'Approved terms mutable';exception when raise_exception then if sqlerrm='Approved terms mutable' then raise;end if;end;
 begin update public.sc_growth_proposals set status='draft' where id=proposal.id;raise exception 'Approved version reopened';exception when raise_exception then if sqlerrm='Approved version reopened' then raise;end if;end;
 r:=public.sc_growth_handoff_v1(o,'operations',proposal.id,null);
 r2:=public.sc_growth_handoff_v1(o,'operations',proposal.id,null);
 if r->>'customer_id'<>r2->>'customer_id' or r->>'artwork_request_id'<>r2->>'artwork_request_id' or r->>'quote_id'<>r2->>'quote_id' or r->>'mockup_project_id'<>r2->>'mockup_project_id' then raise exception 'Repeat handoff duplicated records';end if;
 select count(*) into n from public.sc_growth_tasks where opportunity_id=o;
 if n<>7 then raise exception 'Expected 7 departmental tasks, got %',n;end if;
 if (select count(*) from public.phase5_quote_items where quote_id=(r->>'quote_id')::bigint)<>1 then raise exception 'Quote line missing';end if;
 if (select count(*) from public.mockup_pricing_items where project_id=(r->>'mockup_project_id')::uuid)<>1 then raise exception 'Repeated handoff duplicated pricing';end if;
 begin update public.sc_growth_opportunities set stage='live',store_url='https://example.invalid' where id=o;raise exception 'Launch gate skipped';exception when raise_exception then if sqlerrm='Launch gate skipped' then raise;end if;end;
 update public.sc_growth_tasks set status='complete' where opportunity_id=o and task_key in('artwork_approval','product_mapping','store_checkout');
 update public.sc_growth_opportunities set stage='live',store_url='https://example.invalid' where id=o;
 insert into public.sc_growth_materials(title,body,kind) values('Fixture flyer','Approved text','flyer') returning * into m;
 update public.sc_growth_materials set status='approved' where id=m.id;
 begin update public.sc_growth_materials set body='Changed after approval' where id=m.id;raise exception 'Approved material mutable';exception when raise_exception then if sqlerrm='Approved material mutable' then raise;end if;end;
 if before_units<>(select sum(quantity_change) from public.blank_inventory_movements) then raise exception 'Marketing changed inventory';end if;
 perform set_config('test.growth_opp',o::text,true);
 insert into growth_checks values('four client pricing models and decimal margins',true),('cross-client contact rejected',true),('approved pricing and materials immutable',true),('handoff drafts atomic and repeat-safe',true),('department launch gates enforced',true),('physical inventory untouched',true);
end $test$;
do $more$
declare o public.sc_growth_opportunities;p public.sc_growth_proposals;r jsonb;r2 jsonb;a uuid;j bigint;n int;initial uuid;line jsonb;org text:='Imported Fixture '||gen_random_uuid();
begin
 select * into o from public.sc_growth_opportunities where id=current_setting('test.growth_opp')::uuid;
 select * into p from public.sc_growth_proposals where opportunity_id=o.id and status='approved';
 initial:=p.id;line:=p.lines;
 update public.sc_growth_accounts set pricing_defaults='{"model":"revenue_share","share_percent":80,"target_margin_percent":5}' where id=o.account_id;
 if (select config->>'share_percent' from public.sc_growth_proposals where id=initial)<>'25' then raise exception 'Client default changed approved history';end if;
 insert into public.sc_growth_proposals(opportunity_id,title,version,config,lines) values(o.id,'Revised agreement',2,'{"model":"profit_share","share_percent":30,"target_margin_percent":10}',line) returning * into p;
 begin perform public.sc_growth_approve_proposal_v1(p.id,p.updated_at-interval '1 second','stale');raise exception 'Stale approval accepted';exception when raise_exception then if sqlerrm='Stale approval accepted' then raise;end if;end;
 perform public.sc_growth_approve_proposal_v1(p.id,p.updated_at,'New client-specific agreement');
 if (select status from public.sc_growth_proposals where id=initial)<>'superseded' then raise exception 'Prior agreement not preserved';end if;
 r:=public.sc_growth_handoff_v1(o.id,'operations',p.id,null);
 r2:=public.sc_growth_handoff_v1(o.id,'operations',p.id,null);
 if r->>'quote_id'=o.quote_id::text or r->>'quote_id'<>r2->>'quote_id' then raise exception 'New agreement did not create one new supply estimate';end if;
 if (select count(*) from public.mockup_pricing_items where project_id=o.mockup_project_id)<>1 then raise exception 'Old and new mockup prices stacked';end if;
 if not exists(select 1 from public.sc_growth_audit where action='REPLACED_BY_APPROVED_VERSION') then raise exception 'Prior pricing audit missing';end if;
 update public.mockup_projects set woo_product_id=987654321001 where id=o.mockup_project_id;
 insert into public.jobs(job_name,customer_name,status) values('Fixture marketing order','Fixture only','queued') returning id into j;
 insert into public.job_items(job_id,quantity,status,woocommerce_product_id,inventory_required) values(j,1,'completed',987654321001,false);
 if not exists(select 1 from public.sc_growth_order_links where opportunity_id=o.id and job_id=j and source='woocommerce_product') then raise exception 'Published product attribution failed';end if;
 r:=public.sc_growth_operational_snapshot_v1(o.id);
 if jsonb_array_length(r->'jobs')<>1 or r->'jobs'->0->>'status'<>'queued' then raise exception 'Linked order snapshot failed';end if;
 r:=public.sc_growth_import_accounts_v1(jsonb_build_array(jsonb_build_object('organization',org,'segment','school','contact_name','Training Coordinator','website','https://example.invalid')));
 r2:=public.sc_growth_import_accounts_v1(jsonb_build_array(jsonb_build_object('organization',org,'segment','school')));
 if r->>'created'<>'1' or r2->>'existing_unchanged'<>'1' then raise exception 'Prospect import idempotency failed';end if;
 perform public.sc_growth_dashboard_v1();
 insert into growth_checks values('client defaults preserve approved history',true),('approval detects stale edits',true),('new agreement replaces imported draft pricing without stacking',true),('published product attribution and live order status',true),('prospect import is repeat-safe',true);
end $more$;

reset role;
update public.sc_app_user_roles set role='operator' where user_id=current_setting('test.employee_id')::uuid;
set local role authenticated;
do $test$ begin
 begin perform public.sc_growth_handoff_v1(current_setting('test.growth_opp')::uuid,'design');raise exception 'Operator allowed handoff';exception when insufficient_privilege then null;end;
 insert into public.sc_growth_tasks(opportunity_id,title) values(current_setting('test.growth_opp')::uuid,'Operator follow-up');
 insert into growth_checks values('operator can follow up but cannot approve handoffs',true);
end $test$;
reset role;
update public.sc_app_user_roles set role='viewer' where user_id=current_setting('test.employee_id')::uuid;
set local role authenticated;
do $test$ begin
 if not exists(select 1 from public.sc_growth_accounts) then raise exception 'Viewer read failed';end if;
 begin insert into public.sc_growth_accounts(organization) values('Viewer cannot write');raise exception 'Viewer wrote marketing record';exception when insufficient_privilege then null;end;
 insert into growth_checks values('viewer read/write boundary',true);
end $test$;
reset role;
update public.sc_app_user_roles set role='marketing' where user_id=current_setting('test.employee_id')::uuid;
set local role authenticated;
do $marketing$
declare o uuid:=current_setting('test.growth_opp')::uuid;p public.sc_growth_proposals;begin
 if not exists(select 1 from public.sc_growth_accounts) then raise exception 'Marketing client read failed';end if;
 if exists(select 1 from public.products) then raise exception 'Marketing can read internal product mirror';end if;
 if exists(select 1 from public.blank_inventory_movements) then raise exception 'Marketing can read shop ledger';end if;
 begin perform public.sc_home_dashboard_stats();raise exception 'Marketing can call shop RPC';exception when insufficient_privilege then null;end;
 begin perform public.sc_growth_handoff_v1(o,'design');raise exception 'Marketing allowed operational handoff';exception when insufficient_privilege then null;end;
 begin update public.sc_growth_accounts set customer_id=(select 1::bigint) where id=(select account_id from public.sc_growth_opportunities where id=o);raise exception 'Marketing can relink customer';exception when insufficient_privilege then null;end;
 begin update public.sc_growth_opportunities set quote_id=null where id=o;raise exception 'Marketing can relink operational references';exception when insufficient_privilege then null;end;
 insert into public.sc_growth_tasks(opportunity_id,title) values(o,'Marketing follow-up');
 perform * from public.sc_growth_catalog_search_v1('Gildan');
 perform public.sc_growth_pricing_rules_v1();
 perform public.sc_growth_operational_snapshot_v1(o);
 insert into growth_checks values('restricted marketing role can plan but cannot access shop data or relink operations',true);
end $marketing$;

reset role;
set local role anon;
do $test$ begin
 begin perform 1 from public.sc_growth_accounts;raise exception 'Anonymous read allowed';exception when insufficient_privilege then null;end;
 insert into growth_checks values('anonymous marketing access denied',true);
end $test$;
reset role;
select * from growth_checks;
rollback;
