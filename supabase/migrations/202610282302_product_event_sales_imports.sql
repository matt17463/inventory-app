-- Product & Event Center automation audit and exact-source sales reconciliation.
create table if not exists public.sc_pdc_sales_imports (
 id uuid primary key default gen_random_uuid(),
 opportunity_id uuid not null references public.sc_pdc_opportunities(id) on delete restrict,
 event_id uuid not null references public.sc_pdc_events(id) on delete restrict,
 source text not null default 'quickbooks' check(source='quickbooks'),
 external_invoice_id text not null check(length(external_invoice_id) between 1 and 80),
 invoice_number text not null check(length(invoice_number) between 1 and 100),
 invoice_date date not null,
 units integer not null check(units >= 0),
 gross_sales numeric(14,2) not null check(gross_sales >= 0),
 verified_invoice_total numeric(14,2) not null check(verified_invoice_total >= 0),
 verified_invoice_balance numeric(14,2) not null check(verified_invoice_balance >= 0),
 variable_cost numeric(14,2) not null default 0 check(variable_cost >= 0),
 snapshot jsonb not null default '{}'::jsonb check(jsonb_typeof(snapshot)='object'),
 imported_by uuid not null default auth.uid() references auth.users(id),
 imported_at timestamptz not null default now(),
 unique(source,external_invoice_id,opportunity_id)
);
create index if not exists sc_pdc_sales_imports_by_period on public.sc_pdc_sales_imports(opportunity_id,invoice_date desc);
alter table public.sc_pdc_sales_imports enable row level security;
revoke all on public.sc_pdc_sales_imports from anon,authenticated;
grant select,insert on public.sc_pdc_sales_imports to authenticated;
create policy sc_pdc_sales_imports_select on public.sc_pdc_sales_imports for select to authenticated
 using (public.sc_current_app_role() in ('admin','manager'));
create policy sc_pdc_sales_imports_insert on public.sc_pdc_sales_imports for insert to authenticated
 with check ((select auth.uid())=imported_by and public.sc_current_app_role() in ('admin','manager'));
-- Append-only: invoice mutation requires a new explicit reconciliation, not silent overwrite.
