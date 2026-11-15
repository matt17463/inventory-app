begin;

create table public.sc_printer_bridge_credentials (
  scope text primary key check (scope in ('ha_read', 'roland_health', 'roland_print', 'omni_events')),
  token_sha256 text unique not null check (token_sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);

alter table public.sc_printer_bridge_credentials enable row level security;
revoke all on public.sc_printer_bridge_credentials from public, anon, authenticated, service_role;
grant select (scope, token_sha256) on public.sc_printer_bridge_credentials to service_role;

commit;
