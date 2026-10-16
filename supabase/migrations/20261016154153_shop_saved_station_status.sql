-- Resolve saved production states before station filtering, priority ranking and limits.
do $patch$
declare definition text; replacement text;
begin
  select pg_get_functiondef('public.sc_shop_touch_mode_v2(text,text,integer)'::regprocedure) into definition;
  replacement := $source$(to_jsonb(b) || coalesce((
    select jsonb_build_object('pullsheet_status',coalesce(j.status,b.pullsheet_status),'woo_status',coalesce(j.woo_status,b.woo_status))
      || case when lower(j.status) in ('ready_to_produce','in_production','qc','ready_to_ship','production_complete','completed','on_hold','cancelled','canceled')
        then jsonb_build_object('production_status',lower(j.status),'board_column',case lower(j.status) when 'production_complete' then 'completed' when 'canceled' then 'cancelled' else lower(j.status) end)
        else '{}'::jsonb end
    from public.jobs j where j.id=b.job_id
  ), '{}'::jsonb)) as row_json$source$;
  if position('to_jsonb(b) as row_json' in definition) = 0 then raise exception 'Review changed Shop TV source before patching'; end if;
  execute replace(definition, 'to_jsonb(b) as row_json', replacement);
end $patch$;
notify pgrst, 'reload schema';
