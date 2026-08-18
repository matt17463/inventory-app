-- Step 5: record the required authentication mode for deployed integration endpoints.
-- Metadata only; no operational data or function behavior is changed by this migration.

create table if not exists public.sc_integration_security_registry (
  endpoint_name text primary key,
  authentication_mode text not null check (authentication_mode in ('employee_jwt_role', 'shared_secret', 'woocommerce_hmac')),
  required_roles text[] not null default '{}'::text[],
  required_environment_variables text[] not null default '{}'::text[],
  compatibility_endpoint_of text,
  notes text,
  updated_at timestamptz not null default now()
);

insert into public.sc_integration_security_registry
  (endpoint_name, authentication_mode, required_roles, required_environment_variables, compatibility_endpoint_of, notes)
values
  ('update-woocommerce-order-status', 'employee_jwt_role', array['admin','manager'], array['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','WC_CONSUMER_KEY','WC_CONSUMER_SECRET'], null, 'Browser call. Requires a valid Supabase employee JWT and an active app role.'),
  ('supplier-catalog-feed-sync', 'employee_jwt_role', array['admin','manager'], array['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY'], null, 'Browser call. Requires a valid Supabase employee JWT and an active app role.'),
  ('artwork-system-handoff', 'shared_secret', '{}'::text[], array['SC_ARTWORK_WEBHOOK_SECRET'], null, 'WordPress/server integration. Missing configuration fails closed.'),
  ('manual-pullsheet', 'shared_secret', '{}'::text[], array['MANUAL_PULLSHEET_SECRET'], null, 'WordPress/server integration. Missing configuration fails closed.'),
  ('manual-pullsheet-visible-unpaired-items', 'shared_secret', '{}'::text[], array['MANUAL_PULLSHEET_SECRET'], 'manual-pullsheet', 'Compatibility URL reuses the canonical secured handler.'),
  ('set-pullsheet-due-dates', 'shared_secret', '{}'::text[], array['SC_PULLSHEET_SECRET'], null, 'WordPress/server integration. Missing configuration fails closed.'),
  ('woocommerce-webhook', 'woocommerce_hmac', '{}'::text[], array['WC_WEBHOOK_SECRET'], null, 'Requires X-WC-Webhook-Signature for every POST, including setup/test payloads.'),
  ('woocommerce-webhook-visible-unpaired-items', 'woocommerce_hmac', '{}'::text[], array['WC_WEBHOOK_SECRET'], 'woocommerce-webhook', 'Compatibility URL reuses the canonical secured handler.')
on conflict (endpoint_name) do update set
  authentication_mode = excluded.authentication_mode,
  required_roles = excluded.required_roles,
  required_environment_variables = excluded.required_environment_variables,
  compatibility_endpoint_of = excluded.compatibility_endpoint_of,
  notes = excluded.notes,
  updated_at = now();

alter table public.sc_integration_security_registry enable row level security;
grant select on public.sc_integration_security_registry to authenticated;
revoke insert, update, delete on public.sc_integration_security_registry from anon, authenticated;

do $block$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'sc_integration_security_registry'
      and policyname = 'Authenticated employees can read integration security registry'
  ) then
    create policy "Authenticated employees can read integration security registry"
      on public.sc_integration_security_registry
      for select
      to authenticated
      using (true);
  end if;
end
$block$;
