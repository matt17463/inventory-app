-- Temporarily change the existing admin role within this transaction only.
-- No fixtures or role changes persist after ROLLBACK.
begin;
create temp table sc_role_smoke_results(check_name text, passed boolean, detail text) on commit drop;
grant select,insert on sc_role_smoke_results to authenticated;
select set_config('test.employee_id',(select user_id::text from public.sc_app_user_roles where role='admin' and is_active limit 1),true);
select set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',current_setting('test.employee_id'))::text,true);
update public.sc_app_user_roles set role='viewer' where user_id=current_setting('test.employee_id')::uuid;
set local role authenticated;
do $test$
declare q text;
begin
  for q in select unnest(array[
    'select public.sc_home_dashboard_stats()',
    'select * from public.phase2_get_production_board(null)',
    'select * from public.sc_shop_touch_mode_v2(null,null,10)',
    'select * from public.sc_receiving_bins_v4()',
    'select * from public.sc_existing_pull_sheets_v2()',
    'select * from public.sc_pull_sheet_items_active_v1((select min(id) from public.jobs))',
    'select * from public.sc_list_order_status_board_v2(null,null,10)',
    'select public.sc_product_data_health_page_v2(''all'',0,1)',
    'select public.sc_product_integrity_summary_v1()'
  ]) loop
    begin
      execute q;
      insert into sc_role_smoke_results values(q,true,null);
    exception when others then
      insert into sc_role_smoke_results values(q,false,sqlstate || ': '||sqlerrm);
    end;
  end loop;
end $test$;
reset role;
select * from sc_role_smoke_results;
rollback;
