-- Temporary-table fixtures exercise the deployed function without touching production rows.
begin;
create temporary table sc_team_store_workflows(id uuid,order_channel text);
create temporary table jobs as select * from public.jobs with no data;
create temporary table job_items as select * from public.job_items with no data;
create temporary table sc_team_store_order_lines as select * from public.sc_team_store_order_lines with no data;
create temporary table sc_client_order_requests as select * from public.sc_client_order_requests with no data;
create temporary table app_synced_inventory_catalog_v1 as select * from public.app_synced_inventory_catalog_v1 with no data;
create function pg_temp.sc_internal_access_allowed(text[]) returns boolean language sql as 'select true';
do $qa$ begin execute replace(pg_get_functiondef('public.sc_team_campaign_purchasing(uuid)'::regprocedure),'public.','pg_temp.'); end $qa$;
insert into pg_temp.sc_team_store_workflows values
('10000000-0000-4000-8000-000000000001','woocommerce'),
('10000000-0000-4000-8000-000000000002','quickbooks_invoice');
insert into pg_temp.jobs(id,woocommerce_order_id,status) values
(1,1001,'pending'),(2,1002,'pending'),(3,1003,'pending'),(4,1004,'pending'),(5,1005,'pending'),(6,1006,'cancelled'),(7,null,'pending'),(8,null,'pending');
insert into pg_temp.job_items(id,job_id,woocommerce_line_item_id,quantity,sku,selected_brand,selected_style,selected_color,selected_size,status,inventory_required,blank_product_id) values
(1,1,11,10,'PAID','QA','Fixture','Blue','M','pending',true,'20000000-0000-4000-8000-000000000001'),
(2,2,12,10,'UNPAID','QA','Fixture','Blue','M','pending',true,null),
(3,3,13,10,'FULL-REFUND','QA','Fixture','Blue','M','pending',true,null),
(4,4,14,10,'PARTIAL','QA','Fixture','Blue','M','pending',true,null),
(5,5,15,10,'REVIEW','QA','Fixture','Blue','M','pending',true,null),
(6,6,16,10,'CANCELLED-JOB','QA','Fixture','Blue','M','pending',true,null),
(7,7,null,6,'QBO-PAID','QA','Fixture','Red','L','pending',true,null),
(8,8,null,6,'QBO-UNPAID','QA','Fixture','Red','L','pending',true,null),
(9,1,11,10,'COMPLETE','QA','Fixture','Blue','M','complete',true,null),
(10,1,11,10,'NON-INVENTORY','QA','Fixture','Blue','M','pending',false,null);
insert into pg_temp.sc_team_store_order_lines(campaign_id,woo_order_id,woo_line_item_id,payment_confirmed,quantity,refunded_quantity,refund_requires_review) values
('10000000-0000-4000-8000-000000000001',1001,11,true,10,0,false),
('10000000-0000-4000-8000-000000000001',1002,12,false,10,0,false),
('10000000-0000-4000-8000-000000000001',1003,13,true,10,10,false),
('10000000-0000-4000-8000-000000000001',1004,14,true,10,2,false),
('10000000-0000-4000-8000-000000000001',1005,15,true,10,0,true),
('10000000-0000-4000-8000-000000000001',1006,16,true,10,0,false);
insert into pg_temp.sc_client_order_requests(campaign_id,generated_job_id,payment_received_at) values
('10000000-0000-4000-8000-000000000002',7,now()),
('10000000-0000-4000-8000-000000000002',8,null);
insert into pg_temp.app_synced_inventory_catalog_v1(blank_product_id,available_quantity) values
('20000000-0000-4000-8000-000000000001',3);
insert into pg_temp.jobs(id,woocommerce_order_id,status) values (9,1009,'pending'),(10,1010,'pending');
insert into pg_temp.job_items(id,job_id,woocommerce_line_item_id,quantity,sku,selected_color,selected_size,status,inventory_required) values
(11,9,19,4,'SPLIT','Blue','M','pending',true),
(12,9,19,6,'SPLIT','Blue','M','pending',true),
(13,10,20,4,'AFTER-COMPLETE','Blue','M','complete',true),
(14,10,20,6,'AFTER-COMPLETE','Blue','M','pending',true);
insert into pg_temp.sc_team_store_order_lines(campaign_id,woo_order_id,woo_line_item_id,payment_confirmed,quantity,refunded_quantity,refund_requires_review) values
('10000000-0000-4000-8000-000000000001',1009,19,true,10,2,false),
('10000000-0000-4000-8000-000000000001',1010,20,true,10,2,false);
create temporary table qa_results as
select * from pg_temp.sc_team_campaign_purchasing('10000000-0000-4000-8000-000000000001')
union all select * from pg_temp.sc_team_campaign_purchasing('10000000-0000-4000-8000-000000000002');
do $qa$ begin
 if (select count(*) from pg_temp.qa_results) <> 5 then raise exception 'Unexpected demand rows: %',(select jsonb_agg(to_jsonb(r)) from pg_temp.qa_results r); end if;
 if (select open_units from pg_temp.qa_results where sku='PAID') <> 10 then raise exception 'Paid demand wrong'; end if;
 if (select open_units from pg_temp.qa_results where sku='PARTIAL') <> 8 then raise exception 'Partial refund cap wrong'; end if;
 if (select open_units from pg_temp.qa_results where sku='QBO-PAID') <> 6 then raise exception 'Paid QBO demand wrong'; end if;
 if (select catalog_available from pg_temp.qa_results where sku='PAID') <> 3 then raise exception 'Available stock must remain authoritative'; end if;
 if (select open_units from pg_temp.qa_results where sku='SPLIT') <> 8 then raise exception 'Split rows exceed net paid units'; end if;
 if (select open_units from pg_temp.qa_results where sku='AFTER-COMPLETE') <> 4 then raise exception 'Completed rows not deducted from refund cap'; end if;
end $qa$;
create or replace function pg_temp.sc_internal_access_allowed(text[]) returns boolean language sql as 'select false';
do $qa$ begin
 begin
  perform * from pg_temp.sc_team_campaign_purchasing('10000000-0000-4000-8000-000000000001');
  raise exception 'Unauthorized purchasing query unexpectedly succeeded';
 exception when insufficient_privilege then null;
 end;
end $qa$;
select sku,open_units,catalog_available from pg_temp.qa_results order by sku;
rollback;
