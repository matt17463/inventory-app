-- Skilled Crafting v1.4.28
-- Operations Calendar + Client Order Intake
create sequence if not exists public.sc_client_order_number_seq start 1000;

create table if not exists public.sc_client_order_requests (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique default ('CO-' || nextval('public.sc_client_order_number_seq')::text),
  organization text not null,
  contact_name text not null,
  contact_email text not null,
  contact_phone text,
  order_type text,
  desired_completion_date date,
  event_date date,
  delivery_method text,
  preferred_contact_method text,
  garment_types text[] not null default '{}',
  preferred_colors text[] not null default '{}',
  artwork_choice text,
  artwork_reference_url text,
  customization_notes text,
  customer_notes text,
  internal_notes text,
  status text not null default 'submitted'
    check (status in ('submitted','review','pricing','quote_sent','awaiting_approval','awaiting_payment','artwork','ready_for_production','production','ready_pickup','completed','cancelled')),
  source text not null default 'public_order_form',
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.sc_client_order_request_items (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.sc_client_order_requests(id) on delete cascade,
  line_number integer not null,
  recipient_name text,
  garment_type text,
  size text,
  garment_color text,
  name_on_back text,
  name_text_color text,
  jersey_number text,
  quantity integer not null default 1 check (quantity > 0 and quantity <= 999),
  notes text,
  created_at timestamptz not null default now(),
  unique (request_id, line_number)
);

create table if not exists public.sc_client_order_attachments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.sc_client_order_requests(id) on delete cascade,
  file_name text not null,
  mime_type text,
  file_size_bytes bigint,
  storage_provider text not null default 'r2',
  storage_bucket text not null,
  storage_path text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.sc_client_order_submission_guard (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  submitted_at timestamptz not null default now()
);
create index if not exists sc_client_order_guard_lookup_idx
  on public.sc_client_order_submission_guard(ip_hash, submitted_at desc);
create index if not exists sc_client_order_requests_status_due_idx
  on public.sc_client_order_requests(status, desired_completion_date, submitted_at desc);

alter table public.sc_client_order_requests enable row level security;
alter table public.sc_client_order_request_items enable row level security;
alter table public.sc_client_order_attachments enable row level security;
alter table public.sc_client_order_submission_guard enable row level security;

revoke all on public.sc_client_order_requests from anon;
revoke all on public.sc_client_order_request_items from anon;
revoke all on public.sc_client_order_attachments from anon;
revoke all on public.sc_client_order_submission_guard from anon;
grant select, update on public.sc_client_order_requests to authenticated;
grant select on public.sc_client_order_request_items to authenticated;
grant select on public.sc_client_order_attachments to authenticated;

drop policy if exists sc_client_orders_employee_select on public.sc_client_order_requests;
create policy sc_client_orders_employee_select on public.sc_client_order_requests
for select to authenticated using (
  exists (
    select 1 from public.sc_app_user_roles r
    where r.user_id = auth.uid() and r.is_active = true
  )
);

drop policy if exists sc_client_orders_employee_update on public.sc_client_order_requests;
create policy sc_client_orders_employee_update on public.sc_client_order_requests
for update to authenticated using (
  exists (
    select 1 from public.sc_app_user_roles r
    where r.user_id = auth.uid() and r.is_active = true
  )
) with check (
  exists (
    select 1 from public.sc_app_user_roles r
    where r.user_id = auth.uid() and r.is_active = true
  )
);

drop policy if exists sc_client_order_items_employee_select on public.sc_client_order_request_items;
create policy sc_client_order_items_employee_select on public.sc_client_order_request_items
for select to authenticated using (
  exists (
    select 1 from public.sc_app_user_roles r
    where r.user_id = auth.uid() and r.is_active = true
  )
);

drop policy if exists sc_client_order_attachments_employee_select on public.sc_client_order_attachments;
create policy sc_client_order_attachments_employee_select on public.sc_client_order_attachments
for select to authenticated using (
  exists (
    select 1 from public.sc_app_user_roles r
    where r.user_id = auth.uid() and r.is_active = true
  )
);

create or replace function public.sc_touch_client_order_request()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists sc_touch_client_order_request on public.sc_client_order_requests;
create trigger sc_touch_client_order_request
before update on public.sc_client_order_requests
for each row execute function public.sc_touch_client_order_request();

create or replace view public.sc_client_order_requests_detail
with (security_invoker = true) as
select
  r.*,
  coalesce(i.item_count,0)::integer as item_count,
  coalesce(i.total_quantity,0)::integer as total_quantity
from public.sc_client_order_requests r
left join (
  select request_id, count(*) item_count, sum(quantity) total_quantity
  from public.sc_client_order_request_items
  group by request_id
) i on i.request_id = r.id;

grant select on public.sc_client_order_requests_detail to authenticated;
