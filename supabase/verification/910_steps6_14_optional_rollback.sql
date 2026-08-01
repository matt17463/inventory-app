-- OPTIONAL LIMITED ROLLBACK TEMPLATE.
-- It intentionally does not remove audit/run history by default and does not touch business rows.
-- Review each line before use.

-- drop function if exists public.sc_deployment_health_v1();
-- drop function if exists public.sc_ensure_job_item_reservation_v1(bigint, bigint, uuid, integer);
-- delete from public.sc_integration_security_registry where endpoint_name = 'deployment-health';
-- delete from public.sc_application_schema_versions where version_key in ('202607250501','202607250601','202607250701','202607251301');
-- delete from public.sc_application_releases where release_key = '2026-07-25-steps-6-14-v1';

-- Audit tables are retained intentionally:
-- public.sc_woocommerce_status_change_audit
-- public.sc_supplier_catalog_sync_runs
-- public.sc_pullsheet_sync_runs
