
-- Local/staging smoke test for Step 2 metadata objects.
-- Do not run this as a destructive production reset. It performs assertions only.

do $$
declare
  v_report jsonb;
begin
  if to_regclass('public.sc_schema_contract_versions') is null then
    raise exception 'Missing sc_schema_contract_versions';
  end if;
  if to_regprocedure('public.sc_schema_contract_report_v1(text)') is null then
    raise exception 'Missing sc_schema_contract_report_v1(text)';
  end if;
  if to_regprocedure('public.sc_schema_snapshot_v1()') is null then
    raise exception 'Missing sc_schema_snapshot_v1()';
  end if;
  if to_regprocedure('public.sc_schema_fingerprint_v1()') is null then
    raise exception 'Missing sc_schema_fingerprint_v1()';
  end if;

  v_report := public.sc_schema_contract_report_v1('2026-07-25-steps6-14-v1');
  if v_report->>'contract_version' <> '2026-07-25-steps6-14-v1' then
    raise exception 'Unexpected contract version: %', v_report->>'contract_version';
  end if;
end $$;

select public.sc_schema_contract_report_v1('2026-07-25-steps6-14-v1');
