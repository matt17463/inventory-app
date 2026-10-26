-- Durable order-line capture outcomes prevent failed managed graphic choices from being treated as legacy.
create table if not exists public.sc_woo_graphic_capture_states (
 woo_order_id bigint not null check (woo_order_id>0),
 woo_line_item_id bigint not null check (woo_line_item_id>0),
 status text not null check(status in ('managed_pending','managed_failed','managed_resolved')),
 reason text,
 updated_at timestamptz not null default now(),
 primary key (woo_order_id,woo_line_item_id)
);
alter table public.sc_woo_graphic_capture_states enable row level security;
revoke all on public.sc_woo_graphic_capture_states from public,anon,authenticated;
grant select,insert,update,delete on public.sc_woo_graphic_capture_states to service_role;
